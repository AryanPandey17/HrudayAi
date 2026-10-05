# PLAN — CardioVis 3D (Multimodal AI Hackathon 2026, Track A)

Interactive 3D system that predicts overall CAD and LAD / LCX / RCA stenosis from clinical
features (Z-Alizadeh Sani extension, 303 patients) and maps calibrated probabilities onto a
3D heart with per-patient SHAP explanations.

> Decision support / educational prototype only. No claim of clinical validity.

## Decisions made up front

| Topic | Decision | Why |
|---|---|---|
| Dataset file | Supplied as Apple Numbers (`.numbers`). Converted once to `data/raw/z_alizadeh_sani_extension.xlsx`; the pipeline reads only the `.xlsx` via openpyxl. | openpyxl cannot read `.numbers`. Converter was a throwaway tool, not a project dependency. |
| CAD target | `Cath` column (`CAD` / `Normal`). There is no separate `CAD` column. | It is the dataset's overall CAD label. |
| Vessel targets | `LAD`, `LCX`, `RCA` (`Stenotic` / `Normal`). | Problem statement. |
| Leakage guard | `LAD`, `LCX`, `RCA`, `Cath` are never model inputs for any target. Enforced in config and by a test. | Requirement 1d. |
| Python | 3.12, managed by uv (lockfile committed). | Wheels available for every dependency on arm64. |
| Models | Classical only: L2/L1 logistic regression, Random Forest, XGBoost, LightGBM, optional soft vote. CPU only. | 303 rows. |
| Package layout | `backend/ml` (pipeline) and `backend/api` (FastAPI) as flat packages, so `python -m ml.train` works. | Matches the requested commands. |

## Repo layout

```
backend/
  pyproject.toml, uv.lock      uv project, ruff + pytest config
  ml/
    config.py                  paths, seed, target + leakage column definitions
    data.py                    load raw .xlsx (openpyxl) -> DataFrame
    audit.py                   Phase 0 dataset audit -> reports/data_audit.json
    feature_schema.json        every input: type, range/options, unit, group, label
    schema.py                  typed loader for the schema
    preprocess.py              shared preprocessing (SchemaEncoder + ColumnTransformer)
    models.py                  candidate registry, class-balanced fitting
    cv.py                      hold-out split, repeated stratified K-fold loops
    calibration.py             Platt / isotonic on out-of-fold scores, CalibratedModel artifact
    evaluate.py, selection.py  metrics, corrected t-test, model + calibration selection
    feature_checks.py          redundant / rare / suspicious feature diagnostics
    plots.py, train.py         figures and the `python -m ml.train` entrypoint
    explain.py                 SHAP global + local                          [Phase 2]
  api/                         FastAPI app, Pydantic models                 [Phase 3]
  tests/
frontend/                      Next.js App Router + TS + Tailwind + R3F     [Phase 4]
data/raw/                      source .xlsx (tracked, 303 rows)
data/processed/                derived data (gitignored)
models/                        *.joblib artifacts
reports/                       metrics.json, data_audit.json, plots
notebooks/                     EDA / comparison only
docs/                          documentation (<= 6 pages), demo script
Makefile                       setup, audit, train, explain, serve, lint, format
```

## Phases

- [x] **Phase 0 — Setup**: uv project, deps, ruff, pytest, Makefile, dataset audit.
- [x] **Phase 1 — Data + modeling**: feature schema, shared preprocessing, 4 targets x 4-5
      candidates, held-out stratified test split + repeated stratified K-fold, class weights,
      calibration chosen by CV (Brier, reliability curves), selection by CV ROC-AUC with a
      simplicity tie-break, duplicate / leaky feature check, `make train` regenerates everything.
- [ ] **Phase 2 — Explainability**: SHAP per target, aggregated back to original features,
      global plots + per-patient top-N contributors.
- [ ] **Phase 3 — API**: `/health`, `/schema`, `/predict`, `/metrics`, `/examples`; contract tests.
- [ ] **Phase 4 — Frontend**: R3F heart with LAD / LCX / RCA tubes, probability color mapping,
      selection + camera focus, schema-driven form, SHAP chart, metrics panel, disclaimer.
- [ ] **Phase 5 — Docs + polish**: README, docs, demo script, fresh-clone check.

Each phase ends with real command output and a stop for review.

## Ground rules

- Every number shown in docs or UI is read from a file produced by a real run.
- All preprocessing lives inside the sklearn pipeline, fitted on training folds only.
- Fixed seed (`ml.config.SEED`) for splits, CV and models.
- New heavy dependencies are proposed before being added.
