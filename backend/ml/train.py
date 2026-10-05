"""Train, select, calibrate and evaluate one model per target.

``python -m ml.train`` regenerates ``models/*.joblib``, ``models/manifest.json``,
``reports/metrics.json``, ``reports/feature_checks.json`` and ``reports/plots/*.png``.
Everything is seeded by ``ml.config.SEED``.
"""

import json
import platform
from dataclasses import dataclass
from importlib.metadata import version
from pathlib import Path
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
from ml.evaluate import (
    bootstrap_auc_interval,
    classification_metrics,
    confusion_counts,
    summarize_folds,
)
from ml.feature_checks import feature_checks
from ml.models import MODEL_LABELS
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


def _summarize_variants(folds: list[FoldPredictions]) -> dict[str, dict[str, dict[str, float]]]:
    """Per-variant mean/std over folds, each fold scored at that variant's own threshold."""
    return {
        variant: summarize_folds(
            [
                classification_metrics(fold.y_true, fold.proba[variant], fold.thresholds[variant])
                for fold in folds
            ]
        )
        for variant in folds[0].proba
    }


def _test_report(y_true: np.ndarray, proba: np.ndarray, threshold: float) -> dict[str, Any]:
    low, high = bootstrap_auc_interval(y_true, proba, SEED)
    return {
        "n": len(y_true),
        "n_positive": int(y_true.sum()),
        "roc_auc_ci95": [low, high],
        "at_selected_threshold": classification_metrics(y_true, proba, threshold),
        "at_threshold_0.5": classification_metrics(y_true, proba, 0.5),
        "confusion_at_selected_threshold": confusion_counts(y_true, proba, threshold),
    }


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
        "candidates_cv": _summarize_variants(candidate_folds),
        "selection": selection,
        "calibration_cv": _summarize_variants(calibration_folds),
        "final": {
            "model": model_name,
            "model_label": MODEL_LABELS[model_name],
            "calibration": method,
            "threshold": threshold,
            "threshold_rule": "Youden's J on out-of-fold calibrated training predictions",
        },
        "test": _test_report(y_test, test_proba, threshold),
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


def _rounded(value: Any, digits: int = 4) -> Any:
    """Round every float in a nested structure so reruns give byte-identical JSON."""
    if isinstance(value, float):
        return round(value, digits)
    if isinstance(value, dict):
        return {key: _rounded(item, digits) for key, item in value.items()}
    if isinstance(value, list | tuple):
        return [_rounded(item, digits) for item in value]
    return value


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(_rounded(payload), indent=2, ensure_ascii=False) + "\n")


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


def _save_models(results: dict[str, TargetResult], test: np.ndarray) -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, Any] = {"seed": SEED, "test_row_indices": test.tolist(), "targets": {}}
    for target, result in results.items():
        artifact = f"{target.lower()}.joblib"
        joblib.dump(result.model, MODELS_DIR / artifact)
        manifest["targets"][target] = {"artifact": artifact, **result.report["final"]}
    _write_json(MANIFEST_PATH, manifest)


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
    _write_json(METRICS_PATH, metrics)
    _write_json(FEATURE_CHECKS_PATH, feature_checks(frame))
    _save_models(results, test)
    _save_plots(results)
    _print_summary(results)
    print(f"\nwrote {METRICS_PATH.name}, {FEATURE_CHECKS_PATH.name}, plots/ and models/")


if __name__ == "__main__":
    main()
