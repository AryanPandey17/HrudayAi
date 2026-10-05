"""Test ladder: one calibrated model per target and per cumulative stage of available tests.

Stages come from the feature schema (history + examination, then ECG, labs, echo). Every stage
model is a Platt-calibrated logistic regression validated exactly like the main models: the same
hold-out split, the same repeated stratified folds and the threshold tuned inside each fold.
Each model also carries bootstrap refits so the API can report a percentile interval around a
probability.

``python -m ml.ladder`` writes ``models/ladder/*.joblib``, ``reports/ladder_metrics.json`` and
``reports/plots/ladder_auc.png``. It does not touch the main models or ``metrics.json``.
"""

from typing import Any

import joblib
import numpy as np
import pandas as pd
from joblib import Parallel, delayed
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.utils.class_weight import compute_sample_weight

from ml import plots
from ml.calibration import CalibratedModel, fit_with_calibrators
from ml.config import (
    CV_REPEATS,
    CV_SPLITS,
    INTERVAL_PERCENTILES,
    LADDER_DIR,
    MODELS_DIR,
    N_BOOTSTRAP,
    REPORTS_DIR,
    SEED,
    TARGETS,
)
from ml.cv import cross_validate_calibration, holdout_split, repeated_folds
from ml.data import feature_columns, load_raw, target_series
from ml.evaluate import corrected_resampled_ttest
from ml.ladder_model import LadderModel, ladder_path
from ml.reporting import summarize_variants, test_report, write_json
from ml.schema import FeatureSpec, Stage, load_schema
from ml.selection import TIE_ALPHA, fold_scores

LADDER_METRICS_PATH = REPORTS_DIR / "ladder_metrics.json"
LADDER_MODEL = "logistic_regression"
LADDER_CALIBRATION = "sigmoid"


def _bootstrap_refit(X: np.ndarray, y: np.ndarray, C: float, seed: int) -> tuple[np.ndarray, float]:
    """Coefficients and intercept of the base model refitted on one bootstrap resample."""
    rows = np.random.default_rng(seed).integers(0, len(y), len(y))
    weights = compute_sample_weight("balanced", y[rows])
    base = LogisticRegression(C=C, max_iter=5000).fit(X[rows], y[rows], sample_weight=weights)
    return base.coef_[0], float(base.intercept_[0])


def bootstrap_refits(model: CalibratedModel, y_train: pd.Series) -> tuple[np.ndarray, np.ndarray]:
    """``N_BOOTSTRAP`` refits of a stage's base model on resampled training patients.

    Held fixed across refits: the preprocessing statistics, the regularisation strength chosen
    for the stage model, and its Platt calibration map (refitting the map on resamples shrinks
    probabilities towards the prevalence and pushes the stage's own estimate outside its
    interval). The interval therefore reflects how much the fitted coefficients move with the
    training sample. It does not cover calibration or model-selection uncertainty, or differences
    between this cohort and new patients.
    """
    X = model.background.to_numpy()
    C = float(np.ravel(model.pipeline[-1].C_)[0])
    seeds = np.random.SeedSequence(SEED).generate_state(N_BOOTSTRAP)
    refits = Parallel(n_jobs=-1)(
        delayed(_bootstrap_refit)(X, y_train.to_numpy(), C, int(seed)) for seed in seeds
    )
    slope, shift = model.calibrator.slope, model.calibrator.shift
    coef = slope * np.array([coef for coef, _ in refits])
    intercept = slope * np.array([intercept for _, intercept in refits]) + shift
    return coef, intercept


def _interval_report(ladder_model: LadderModel, X_test: pd.DataFrame) -> dict[str, Any]:
    """How wide the bootstrap intervals are on the held-out patients."""
    interval = ladder_model.predict_interval(X_test)
    point = ladder_model.model.predict_proba(X_test)
    width = interval[:, 1] - interval[:, 0]
    inside = (point >= interval[:, 0]) & (point <= interval[:, 1])
    return {
        "percentiles": list(INTERVAL_PERCENTILES),
        "n_bootstrap": N_BOOTSTRAP,
        "mean_width_test": float(width.mean()),
        "median_width_test": float(np.median(width)),
        "point_estimate_inside_rate_test": float(inside.mean()),
    }


def train_stage(
    target: str,
    stage: Stage,
    features: tuple[FeatureSpec, ...],
    X: pd.DataFrame,
    y: pd.Series,
    train: np.ndarray,
    test: np.ndarray,
) -> tuple[LadderModel, dict[str, Any], np.ndarray]:
    """Validate, fit and bootstrap one stage model. Returns it, its report and its fold AUCs."""
    X_train, y_train = X.iloc[train], y.iloc[train]
    folds = repeated_folds(y_train, SEED)
    cv_folds = cross_validate_calibration(LADDER_MODEL, X_train, y_train, folds, SEED, features)

    pipeline, calibrations = fit_with_calibrators(LADDER_MODEL, X_train, y_train, SEED, features)
    fitted = calibrations[LADDER_CALIBRATION]
    model = CalibratedModel(
        target,
        LADDER_MODEL,
        LADDER_CALIBRATION,
        pipeline,
        fitted.calibrator,
        fitted.threshold,
        pipeline[:-1].transform(X_train),
    )
    ladder_model = LadderModel(stage.id, model, *bootstrap_refits(model, y_train))

    y_test = y.iloc[test].to_numpy()
    report = {
        "stage": stage.id,
        "label": stage.label,
        "n_features": len(features),
        "threshold": fitted.threshold,
        "regularisation_C": float(np.ravel(pipeline[-1].C_)[0]),
        "cv": summarize_variants(cv_folds)[LADDER_CALIBRATION],
        "test": test_report(y_test, model.predict_proba(X.iloc[test]), fitted.threshold),
        "interval": _interval_report(ladder_model, X.iloc[test]),
    }
    return ladder_model, report, fold_scores(cv_folds, LADDER_CALIBRATION, roc_auc_score)


def _gain(current: np.ndarray, previous: np.ndarray) -> dict[str, Any]:
    """Paired CV ROC-AUC change from the previous stage, with the corrected resampled t-test."""
    p_value = corrected_resampled_ttest(current, previous, 1 / (CV_SPLITS - 1))
    return {
        "mean_cv_auc_gain": float(np.mean(current - previous)),
        "p_value": p_value,
        "distinguishable_from_noise": bool(p_value < TIE_ALPHA),
    }


def train_target(
    target: str, X: pd.DataFrame, y: pd.Series, train: np.ndarray, test: np.ndarray
) -> dict[str, Any]:
    """All stages of one target; saves each stage model and returns the target's report."""
    schema = load_schema()
    reports: dict[str, Any] = {}
    fold_aucs: dict[int, np.ndarray] = {}
    for stage in schema.stages:
        features = schema.stage_features(stage.id)
        ladder_model, report, fold_aucs[stage.id] = train_stage(
            target, stage, features, X, y, train, test
        )
        previous = fold_aucs.get(stage.id - 1)
        report["gain_vs_previous_stage"] = (
            None if previous is None else _gain(fold_aucs[stage.id], previous)
        )
        joblib.dump(ladder_model, ladder_path(target, stage.id))
        reports[str(stage.id)] = report
    first, last = schema.stages[0].id, schema.stages[-1].id
    return {"stages": reports, "gain_last_vs_first_stage": _gain(fold_aucs[last], fold_aucs[first])}


def _full_model_gap(target: str, X_test: pd.DataFrame) -> float:
    """Largest difference between the last stage and the main model on held-out patients."""
    last = load_schema().stages[-1].id
    stage_model: LadderModel = joblib.load(ladder_path(target, last))
    full_model: CalibratedModel = joblib.load(MODELS_DIR / f"{target.lower()}.joblib")
    gap = np.abs(stage_model.model.predict_proba(X_test) - full_model.predict_proba(X_test))
    return float(gap.max())


def _meta(X_test: pd.DataFrame) -> dict[str, Any]:
    schema = load_schema()
    return {
        "seed": SEED,
        "model": LADDER_MODEL,
        "calibration": LADDER_CALIBRATION,
        "protocol": "same hold-out split, repeated stratified CV and in-fold threshold tuning as "
        "metrics.json",
        "cv": {"splits": CV_SPLITS, "repeats": CV_REPEATS},
        "stage_gain_test": "Nadeau-Bengio corrected resampled t-test on paired fold ROC-AUCs",
        "interval": "percentile interval over bootstrap refits of the stage's base model with its "
        "calibration map held fixed; reflects training-sample variability of the coefficients only",
        "stages": [
            {
                "id": stage.id,
                "key": stage.key,
                "label": stage.label,
                "groups": list(stage.groups),
                "n_features": len(schema.stage_features(stage.id)),
            }
            for stage in schema.stages
        ],
        "last_stage_max_abs_diff_from_main_model": {
            target: _full_model_gap(target, X_test) for target in TARGETS
        },
    }


def _print_summary(targets: dict[str, Any]) -> None:
    print(
        "\ntarget stage  feat  CV AUC (mean±std)  gain vs prev (p)      hold-out AUC [95% CI]"
        "    CV F1   CV Brier  interval width"
    )
    for target, report in targets.items():
        for stage, r in report["stages"].items():
            gain = r["gain_vs_previous_stage"]
            gain_text = (
                "-"
                if gain is None
                else (
                    f"{gain['mean_cv_auc_gain']:+.3f} (p={gain['p_value']:.2f})"
                    + ("*" if gain["distinguishable_from_noise"] else " ")
                )
            )
            low, high = r["test"]["roc_auc_ci95"]
            print(
                f"{target:<6} {stage:<5} {r['n_features']:>4}  "
                f"{r['cv']['roc_auc']['mean']:.3f} ± {r['cv']['roc_auc']['std']:.3f}      "
                f"{gain_text:<20}  {r['test']['at_selected_threshold']['roc_auc']:.3f} "
                f"[{low:.3f}, {high:.3f}]   {r['cv']['f1']['mean']:.3f}   "
                f"{r['cv']['brier']['mean']:.3f}     {r['interval']['mean_width_test']:.3f}"
            )
    print("* = gain distinguishable from noise (p < 0.05)")


def main() -> None:
    """Train, validate, bootstrap and save every stage model, then write the report and plot."""
    frame = load_raw()
    X = frame[feature_columns(frame)]
    train, test = holdout_split(frame, SEED)
    LADDER_DIR.mkdir(parents=True, exist_ok=True)

    targets = {}
    for target in TARGETS:
        targets[target] = train_target(target, X, target_series(frame, target), train, test)
        print(f"[{target}] trained {len(targets[target]['stages'])} stages")

    write_json(LADDER_METRICS_PATH, {"meta": _meta(X.iloc[test]), "targets": targets})
    plots.plot_ladder_auc(targets, plots.PLOTS_DIR / "ladder_auc.png")
    _print_summary(targets)
    print(f"\nwrote {LADDER_METRICS_PATH.name}, plots/ladder_auc.png and models/ladder/")


if __name__ == "__main__":
    main()
