"""Train, select, calibrate and evaluate one model per target.

``python -m ml.train`` regenerates ``models/*.joblib``, ``models/manifest.json``,
``reports/metrics.json``, ``reports/feature_checks.json`` and ``reports/plots/*.png``.
Everything is seeded by ``ml.config.SEED``.
"""

import platform
from dataclasses import dataclass
from importlib.metadata import version
from typing import Any

import joblib
import numpy as np
import pandas as pd

from ml import plots
from ml.calibration import CalibratedModel, fit_with_calibrators
from ml.config import (
    CALIBRATION_SPLITS,
    CV_REPEATS,
    CV_SPLITS,
    LEAKAGE_COLUMNS,
    MODELS_DIR,
    REPORTS_DIR,
    SEED,
    TARGETS,
)
from ml.cv import (
    UNCALIBRATED,
    FoldPredictions,
    cross_validate_calibration,
    cross_validate_candidates,
    holdout_split,
    repeated_folds,
)
from ml.data import feature_columns, load_raw, target_series
from ml.feature_checks import feature_checks
from ml.models import MODEL_LABELS
from ml.reporting import summarize_variants, test_report, write_json
from ml.schema import load_schema
from ml.selection import select_calibration, select_model

METRICS_PATH = REPORTS_DIR / "metrics.json"
FEATURE_CHECKS_PATH = REPORTS_DIR / "feature_checks.json"
MANIFEST_PATH = MODELS_DIR / "manifest.json"
VERSIONED_PACKAGES = ("scikit-learn", "xgboost", "lightgbm", "numpy", "pandas")


@dataclass
class TargetResult:
    """Everything produced for one target: the artifact, its report and data for the plots."""

    model: CalibratedModel
    report: dict[str, Any]
    cv_uncalibrated: plots.Labelled
    cv_calibrated: plots.Labelled
    test: plots.Labelled


def _pool(folds: list[FoldPredictions], variant: str) -> plots.Labelled:
    """Concatenate held-out labels and probabilities over all folds and repeats."""
    y_true = np.concatenate([fold.y_true for fold in folds])
    return y_true, np.concatenate([fold.proba[variant] for fold in folds])


def train_target(
    target: str, X: pd.DataFrame, y: pd.Series, train: np.ndarray, test: np.ndarray
) -> TargetResult:
    """Full procedure for one target; the test rows are touched only for the final report."""
    X_train, y_train = X.iloc[train], y.iloc[train]
    folds = repeated_folds(y_train, SEED)

    candidate_folds = cross_validate_candidates(X_train, y_train, folds, SEED)
    selection = select_model(candidate_folds)
    model_name = selection["selected"]

    calibration_folds = cross_validate_calibration(model_name, X_train, y_train, folds, SEED)
    method = select_calibration(calibration_folds)

    pipeline, calibrations = fit_with_calibrators(model_name, X_train, y_train, SEED)
    calibrator, threshold = calibrations[method].calibrator, calibrations[method].threshold
    background = pipeline[:-1].transform(X_train)
    model = CalibratedModel(target, model_name, method, pipeline, calibrator, threshold, background)
    y_test = y.iloc[test].to_numpy()
    test_proba = model.predict_proba(X.iloc[test])

    report = {
        "description": TARGETS[target].description,
        "prevalence": {"train": float(y_train.mean()), "test": float(y_test.mean())},
        "candidates_cv": summarize_variants(candidate_folds),
        "selection": selection,
        "calibration_cv": summarize_variants(calibration_folds),
        "final": {
            "model": model_name,
            "model_label": MODEL_LABELS[model_name],
            "calibration": method,
            "threshold": threshold,
            "threshold_rule": "Youden's J on out-of-fold calibrated training predictions",
        },
        "test": test_report(y_test, test_proba, threshold),
    }
    return TargetResult(
        model,
        report,
        _pool(calibration_folds, UNCALIBRATED),
        _pool(calibration_folds, method),
        (y_test, test_proba),
    )


def _meta(frame: pd.DataFrame, train: np.ndarray, test: np.ndarray) -> dict[str, Any]:
    schema = load_schema()
    return {
        "seed": SEED,
        "n_rows": len(frame),
        "n_train": len(train),
        "n_test": len(test),
        "n_input_features": len(schema.features),
        "excluded_features": schema.excluded,
        "leakage_columns_dropped": sorted(LEAKAGE_COLUMNS),
        "holdout": "single stratified split (by number of stenotic vessels), shared by all targets",
        "cv": {
            "splits": CV_SPLITS,
            "repeats": CV_REPEATS,
            "calibration_splits": CALIBRATION_SPLITS,
        },
        "class_imbalance": "class-balanced sample weights for every model",
        "cv_thresholds": "candidates_cv: 0.5 on class-balanced scores; calibration_cv: Youden "
        "threshold re-tuned inside every training fold (0.5 for the uncalibrated row)",
        "versions": {
            "python": platform.python_version(),
            **{package: version(package) for package in VERSIONED_PACKAGES},
        },
    }


def _save_plots(results: dict[str, TargetResult]) -> None:
    for target, result in results.items():
        final, test = result.report["final"], result.report["test"]
        stem = target.lower()
        plots.plot_roc(
            target, result.cv_calibrated, result.test, plots.PLOTS_DIR / f"{stem}_roc.png"
        )
        plots.plot_calibration(
            target,
            result.cv_uncalibrated,
            result.cv_calibrated,
            result.test,
            final["calibration"],
            plots.PLOTS_DIR / f"{stem}_calibration.png",
        )
        plots.plot_confusion(
            target,
            test["confusion_at_selected_threshold"],
            final["threshold"],
            plots.PLOTS_DIR / f"{stem}_confusion.png",
        )
    cv_auc = {
        target: {name: metrics["roc_auc"] for name, metrics in r.report["candidates_cv"].items()}
        for target, r in results.items()
    }
    plots.plot_candidate_comparison(cv_auc, plots.PLOTS_DIR / "cv_auc_comparison.png")


def _feature_defaults(X_train: pd.DataFrame) -> dict[str, Any]:
    """Form defaults: training median (snapped to the input step) or most frequent option."""
    defaults: dict[str, Any] = {}
    for feature in load_schema().features:
        column = X_train[feature.name]
        if feature.kind == "numeric":
            snapped = round(float(column.median()) / feature.step) * feature.step
            defaults[feature.name] = round(snapped, 6)
        else:
            mode = column.mode().iloc[0]
            defaults[feature.name] = mode.item() if isinstance(mode, np.generic) else mode
    return defaults


def _save_models(results: dict[str, TargetResult], X_train: pd.DataFrame, test: np.ndarray) -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, Any] = {
        "seed": SEED,
        "test_row_indices": test.tolist(),
        "feature_defaults": _feature_defaults(X_train),
        "targets": {},
    }
    for target, result in results.items():
        artifact = f"{target.lower()}.joblib"
        joblib.dump(result.model, MODELS_DIR / artifact)
        manifest["targets"][target] = {"artifact": artifact, **result.report["final"]}
    write_json(MANIFEST_PATH, manifest)


def _print_summary(results: dict[str, TargetResult]) -> None:
    print(
        "\ntarget  model                 calib     thr   CV AUC (mean±std)  CV Brier  "
        "test AUC [95% CI]        test F1  test acc"
    )
    for target, result in results.items():
        final, test = result.report["final"], result.report["test"]
        cv = result.report["calibration_cv"][final["calibration"]]
        at = test["at_selected_threshold"]
        low, high = test["roc_auc_ci95"]
        print(
            f"{target:<7} {final['model']:<21} {final['calibration']:<9} {final['threshold']:.2f}  "
            f"{cv['roc_auc']['mean']:.3f} ± {cv['roc_auc']['std']:.3f}      "
            f"{cv['brier']['mean']:.3f}     {at['roc_auc']:.3f} [{low:.3f}, {high:.3f}]   "
            f"{at['f1']:.3f}    {at['accuracy']:.3f}"
        )


def main() -> None:
    """Run the whole pipeline and write every artifact."""
    frame = load_raw()
    X = frame[feature_columns(frame)]
    train, test = holdout_split(frame, SEED)
    n_features = len(load_schema().features)
    print(f"rows: {len(frame)}  train: {len(train)}  test: {len(test)}  features: {n_features}")

    results: dict[str, TargetResult] = {}
    for target in TARGETS:
        results[target] = train_target(target, X, target_series(frame, target), train, test)
        selection = results[target].report["selection"]
        print(
            f"[{target}] best CV AUC: {selection['best_by_cv_auc']}  -> selected: "
            f"{selection['selected']}"
        )

    metrics = {
        "meta": _meta(frame, train, test),
        "targets": {target: result.report for target, result in results.items()},
    }
    write_json(METRICS_PATH, metrics)
    write_json(FEATURE_CHECKS_PATH, feature_checks(frame))
    _save_models(results, X.iloc[train], test)
    _save_plots(results)
    _print_summary(results)
    print(f"\nwrote {METRICS_PATH.name}, {FEATURE_CHECKS_PATH.name}, plots/ and models/")


if __name__ == "__main__":
    main()
