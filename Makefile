.PHONY: setup audit train explain ladder serve web test lint format

BACKEND := backend
FRONTEND := frontend

setup:  ## Install backend and frontend dependencies from their lockfiles
	cd $(BACKEND) && uv sync
	cd $(FRONTEND) && npm install

audit:  ## Dataset audit -> reports/data_audit.json
	cd $(BACKEND) && uv run python -m ml.audit

train:  ## Regenerate everything: main models, metrics, plots, SHAP reports and the test ladder
	cd $(BACKEND) && uv run python -m ml.train && uv run python -m ml.explain && uv run python -m ml.ladder

explain:  ## Regenerate only the SHAP reports from the saved models
	cd $(BACKEND) && uv run python -m ml.explain

ladder:  ## Regenerate only the test-ladder models, reports/ladder_metrics.json and its plot
	cd $(BACKEND) && uv run python -m ml.ladder

serve:  ## Run the API on http://localhost:8000 (Phase 3)
	cd $(BACKEND) && uv run uvicorn api.main:app --reload --port 8000

web:  ## Run the dashboard on http://localhost:3000 (needs `make serve` in another terminal)
	cd $(FRONTEND) && npm run dev

test:  ## Run the leakage-guard tests
	cd $(BACKEND) && uv run pytest

lint:  ## Lint and check formatting (backend), lint and type-check (frontend)
	cd $(BACKEND) && uv run ruff check . && uv run ruff format --check .
	cd $(FRONTEND) && npm run lint && npx tsc --noEmit

format:  ## Auto-format and apply safe lint fixes
	cd $(BACKEND) && uv run ruff format . && uv run ruff check --fix .
