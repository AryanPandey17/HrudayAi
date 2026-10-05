"""Report-building helpers shared by the training entrypoints."""

import json
from pathlib import Path
from typing import Any

import numpy as np

from ml.config import SEED
from ml.cv import FoldPredictions
from ml.evaluate import (
    bootstrap_auc_interval,
    classification_metrics,
    confusion_counts,
    summarize_folds,
)


def summarize_variants(folds: list[FoldPredictions]) -> dict[str, dict[str, dict[str, float]]]:
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


def test_report(y_true: np.ndarray, proba: np.ndarray, threshold: float) -> dict[str, Any]:
    low, high = bootstrap_auc_interval(y_true, proba, SEED)
    return {
        "n": len(y_true),
        "n_positive": int(y_true.sum()),
        "roc_auc_ci95": [low, high],
        "at_selected_threshold": classification_metrics(y_true, proba, threshold),
        "at_threshold_0.5": classification_metrics(y_true, proba, 0.5),
        "confusion_at_selected_threshold": confusion_counts(y_true, proba, threshold),
    }


def rounded(value: Any, digits: int = 4) -> Any:
    """Round every float in a nested structure so reruns give byte-identical JSON."""
    if isinstance(value, float):
        return round(value, digits)
    if isinstance(value, dict):
        return {key: rounded(item, digits) for key, item in value.items()}
    if isinstance(value, list | tuple):
        return [rounded(item, digits) for item in value]
    return value


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(rounded(payload), indent=2, ensure_ascii=False) + "\n")
