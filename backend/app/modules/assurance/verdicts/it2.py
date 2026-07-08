"""Interval Type-2 fuzzy core (ported from the recon MVP, unchanged in behaviour).

Minimal, dependency-light IT2 implementation (numpy only):
  - IT2 trapezoidal membership functions (upper MF + lower MF = FOU)
  - Rule firing with min t-norm -> firing interval [f_lower, f_upper]
  - Nie-Tan closed-form type reduction (KM can replace later where exactness matters)
  - Jaccard similarity between IT2 sets (CWW decoder)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

import numpy as np


def _trap(x: np.ndarray, a: float, b: float, c: float, d: float, h: float = 1.0) -> np.ndarray:
    """Trapezoidal MF with height h. a<=b<=c<=d."""
    if b > a:
        rise = (x - a) / (b - a)
    else:
        rise = np.where(x >= a, 1.0, 0.0)
    if d > c:
        fall = (d - x) / (d - c)
    else:
        fall = np.where(x <= d, 1.0, 0.0)
    y = np.minimum(np.minimum(rise, 1.0), fall)
    return np.clip(y, 0.0, 1.0) * h


@dataclass
class IT2Trap:
    """Interval Type-2 trapezoidal set.

    upper: (a, b, c, d) trapezoid, height 1
    lower: (a, b, c, d) trapezoid, height h (h <= 1)
    The gap between upper and lower MF is the Footprint of Uncertainty.
    """

    name: str
    upper: tuple[float, float, float, float]
    lower: tuple[float, float, float, float]
    lower_h: float = 0.9

    def mu(self, x: float) -> tuple[float, float]:
        """Membership interval [mu_lower, mu_upper] of crisp x."""
        xv = np.array([float(x)])
        lo = float(_trap(xv, *self.lower, h=self.lower_h)[0])
        up = float(_trap(xv, *self.upper, h=1.0)[0])
        return (min(lo, up), up)

    def sample(self, xs: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        lo = _trap(xs, *self.lower, h=self.lower_h)
        up = _trap(xs, *self.upper, h=1.0)
        return np.minimum(lo, up), up

    def centroid_interval(self, lo_x: float, hi_x: float, n: int = 501) -> tuple[float, float]:
        """Approximate centroid interval [c_l, c_r] of the IT2 set (EIASC-lite:
        centroid of lower MF and of upper MF bound the true interval closely
        enough for MVP purposes)."""
        xs = np.linspace(lo_x, hi_x, n)
        lo, up = self.sample(xs)
        c_lo = float(np.sum(xs * lo) / np.sum(lo)) if np.sum(lo) > 0 else (lo_x + hi_x) / 2
        c_up = float(np.sum(xs * up) / np.sum(up)) if np.sum(up) > 0 else (lo_x + hi_x) / 2
        return (min(c_lo, c_up), max(c_lo, c_up))


@dataclass
class Rule:
    """IF (var1 is term1) AND (var2 is term2) ... THEN risk is <consequent>."""

    antecedents: dict[str, str]  # var name -> term name
    consequent: str
    weight: float = 1.0

    def fire(
        self, inputs: dict[str, float], vocab: dict[str, dict[str, IT2Trap]]
    ) -> tuple[float, float]:
        f_lo, f_up = 1.0, 1.0
        for var, term in self.antecedents.items():
            mu_lo, mu_up = vocab[var][term].mu(inputs[var])
            f_lo = min(f_lo, mu_lo)
            f_up = min(f_up, mu_up)
        return f_lo * self.weight, f_up * self.weight


def nie_tan(
    rules: Sequence[Rule],
    inputs: dict[str, float],
    vocab: dict[str, dict[str, IT2Trap]],
    consequents: dict[str, IT2Trap],
    domain: tuple[float, float] = (0.0, 100.0),
) -> dict:
    """Fire all rules, type-reduce with Nie-Tan, return score + interval.

    Returns dict with:
      score      : crisp risk 0-100 (Nie-Tan defuzzified)
      interval   : (y_l, y_r) type-reduced interval -> uncertainty band
      firings    : per-rule firing intervals (for explainability)
    """
    cent = {name: c.centroid_interval(*domain) for name, c in consequents.items()}
    num_nt = den_nt = 0.0
    num_l = den_l = num_r = den_r = 0.0
    firings = []
    for r in rules:
        f_lo, f_up = r.fire(inputs, vocab)
        if f_up <= 0:
            continue
        c_l, c_r = cent[r.consequent]
        f_mid = (f_lo + f_up) / 2.0
        num_nt += f_mid * (c_l + c_r) / 2.0
        den_nt += f_mid
        # conservative interval: lower firings pull to left centroids, upper to right
        num_l += f_lo * c_l
        den_l += f_lo
        num_r += f_up * c_r
        den_r += f_up
        firings.append(
            {
                "rule": r.antecedents,
                "consequent": r.consequent,
                "f": (round(f_lo, 3), round(f_up, 3)),
            }
        )

    if den_nt == 0:
        mid = sum(domain) / 2
        return {"score": mid, "interval": (domain[0], domain[1]), "firings": []}

    score = num_nt / den_nt
    y_l = num_l / den_l if den_l > 0 else score
    y_r = num_r / den_r if den_r > 0 else score
    lo, hi = min(y_l, y_r, score), max(y_l, y_r, score)
    return {"score": float(score), "interval": (float(lo), float(hi)), "firings": firings}


def jaccard_it2(
    a: IT2Trap, b: IT2Trap, domain: tuple[float, float] = (0.0, 100.0), n: int = 501
) -> float:
    """Jaccard similarity between two IT2 sets (standard CWW decoder measure)."""
    xs = np.linspace(domain[0], domain[1], n)
    a_lo, a_up = a.sample(xs)
    b_lo, b_up = b.sample(xs)
    num = np.sum(np.minimum(a_up, b_up)) + np.sum(np.minimum(a_lo, b_lo))
    den = np.sum(np.maximum(a_up, b_up)) + np.sum(np.maximum(a_lo, b_lo))
    return float(num / den) if den > 0 else 0.0
