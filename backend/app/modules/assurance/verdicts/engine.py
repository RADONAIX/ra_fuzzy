"""Report-agnostic verdict engine.

Runs any :class:`VerdictProfile` (vocabulary + rule base + codebook) over a crisp
feature vector and returns a linguistic verdict. The fuzzy machinery (IT2
inference, Nie-Tan type reduction, CWW Jaccard decode) and the shared 0-100 risk
codebook live here; per-report vocab and rules live in ``profiles``.

Adding a report/use-case = declaring a profile, **not** touching this file.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field

from app.modules.assurance.verdicts.it2 import IT2Trap, Rule, jaccard_it2, nie_tan

# Shared output codebook on the 0-100 risk scale (CWW words). Every profile reuses
# it unless it overrides, so verdict semantics stay consistent platform-wide.
DEFAULT_CODEBOOK: dict[str, IT2Trap] = {
    "Healthy": IT2Trap("Healthy", (0, 0, 10, 30), (0, 0, 6, 20)),
    "Watch": IT2Trap("Watch", (15, 30, 45, 60), (22, 34, 41, 52)),
    "Suspect": IT2Trap("Suspect", (45, 60, 72, 85), (52, 63, 69, 78)),
    "Critical": IT2Trap("Critical", (72, 85, 100, 100), (80, 92, 100, 100)),
}


@dataclass(frozen=True)
class VerdictProfile:
    """A pluggable fuzzy spec for one report / use-case.

    key      : stable id, e.g. "recon", "file_sequence"
    label    : human-readable name
    inputs   : ordered fuzzy input variable names (a missing input defaults to 0.0)
    vocab    : {var: {term: IT2Trap}} — linguistic terms per input
    rules    : IF/THEN rule base over ``inputs`` -> codebook words
    codebook : output words (defaults to the shared Healthy/Watch/Suspect/Critical)
    """

    key: str
    label: str
    inputs: tuple[str, ...]
    vocab: Mapping[str, Mapping[str, IT2Trap]]
    rules: Sequence[Rule]
    codebook: Mapping[str, IT2Trap] = field(default_factory=lambda: DEFAULT_CODEBOOK)
    # Display metadata (drives the generic UI): what the scored entity is called
    # (e.g. "Record type", "Source") and a human label per input metric.
    entity_label: str = "Entity"
    metric_labels: Mapping[str, str] = field(default_factory=dict)

    def validate(self) -> None:
        """Fail fast on rule/vocab/codebook mismatches (a typo in a rule term)."""
        for var in self.vocab:
            if var not in self.inputs:
                raise ValueError(f"{self.key}: vocab var '{var}' is not in inputs")
        for var in self.metric_labels:
            if var not in self.inputs:
                raise ValueError(f"{self.key}: metric_label '{var}' is not in inputs")
        for i, r in enumerate(self.rules):
            for var, term in r.antecedents.items():
                if var not in self.vocab:
                    raise ValueError(f"{self.key}: rule {i} uses unknown input '{var}'")
                if term not in self.vocab[var]:
                    raise ValueError(
                        f"{self.key}: rule {i} uses unknown term '{term}' for '{var}'"
                    )
            if r.consequent not in self.codebook:
                raise ValueError(
                    f"{self.key}: rule {i} consequent '{r.consequent}' not in codebook"
                )


def _decode_word(codebook: Mapping[str, IT2Trap], band: tuple[float, float]) -> tuple[str, float]:
    """CWW decoder: wrap the type-reduced output as a small IT2 set around [band]
    and pick the codebook word with the max Jaccard similarity."""
    lo, hi = band
    spread = max(hi - lo, 2.0)
    out = IT2Trap(
        "output",
        (max(0, lo - spread * 0.25), lo, hi, min(100, hi + spread * 0.25)),
        (lo, min(lo + spread * 0.25, hi), max(hi - spread * 0.25, lo), hi),
    )
    sims = {w: jaccard_it2(out, cb) for w, cb in codebook.items()}
    word = max(sims, key=sims.get)
    return word, sims[word]


def score(profile: VerdictProfile, inputs: Mapping[str, float]) -> dict:
    """Classify one crisp feature vector with ``profile``. Returns:
        verdict    : the winning codebook word
        score      : 0-100 crisp risk (Nie-Tan)
        band       : (lo, hi) type-reduced uncertainty interval
        similarity : Jaccard similarity to the chosen word
        drivers    : up to 3 top-firing rules (explainability)
    """
    fuzzy_inputs = {k: float(inputs.get(k, 0.0)) for k in profile.inputs}
    tr = nie_tan(profile.rules, fuzzy_inputs, profile.vocab, profile.codebook)
    word, sim = _decode_word(profile.codebook, tr["interval"])
    top = sorted(tr["firings"], key=lambda f: -max(f["f"]))[:3]
    return {
        "verdict": word,
        "score": round(tr["score"], 1),
        "band": (round(tr["interval"][0], 1), round(tr["interval"][1], 1)),
        "similarity": round(sim, 3),
        "drivers": top,
    }
