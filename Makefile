.PHONY: setup audit train serve test lint format

BACKEND := backend

setup:  ## Install backend dependencies from the lockfile
	cd $(BACKEND) && uv sync

audit:  ## Dataset audit -> reports/data_audit.json
	cd $(BACKEND) && uv run python -m ml.audit

train:  ## Regenerate models/, reports/metrics.json and plots (Phase 1)
	cd $(BACKEND) && uv run python -m ml.train

serve:  ## Run the API on http://localhost:8000 (Phase 3)
	cd $(BACKEND) && uv run uvicorn api.main:app --reload --port 8000

test:  ## Run the backend test suite
	cd $(BACKEND) && uv run pytest

lint:  ## Lint and check formatting
	cd $(BACKEND) && uv run ruff check . && uv run ruff format --check .

format:  ## Auto-format and apply safe lint fixes
	cd $(BACKEND) && uv run ruff format . && uv run ruff check --fix .
