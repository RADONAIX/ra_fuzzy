# RADONaix Recon — common tasks. Run from radonaix-recon-mvp/.
PY := ./.venv/bin/python
PIP := ./.venv/bin/pip

.PHONY: setup setup-dev run lint clean

setup:                ## create venv + install runtime deps
	python3 -m venv .venv
	$(PIP) install -U pip
	$(PIP) install -r requirements.txt

setup-dev: setup      ## also install dev deps (pytest, ruff)
	$(PIP) install -r requirements-dev.txt

run:                  ## run the full recon + verdict pipeline
	$(PY) demo/run_demo.py

lint:                 ## lint with ruff
	./.venv/bin/ruff check .

clean:                ## remove generated outputs and caches
	rm -f out/*.csv out/*.json
	find . -type d -name __pycache__ -not -path './.venv/*' -exec rm -rf {} +
	rm -rf .pytest_cache .ruff_cache
