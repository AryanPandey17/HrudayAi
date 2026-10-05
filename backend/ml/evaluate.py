"""Metrics, fold summaries and the statistics used for model selection."""

from collections.abc import Sequence

import numpy as np
from scipy import stats
from sklearn.metrics import (
    accuracy_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)

BOOTSTRAP_SAMPLES = 2000


def classification_metrics(
    y_true: np.ndarray, proba: np.ndarray, threshold: float = 0.5
) -> dict[str, float]:
    """Threshold metrics at ``threshold`` plus the threshold-free ROC-AUC and Brier score."""
    predicted = (proba >= threshold).astype(int)
    return {
        "accuracy": float(accuracy_score(y_true, predicted)),
        "precision": float(precision_score(y_true, predicted, zero_division=0)),
        "recall": float(recall_score(y_true, predicted, zero_division=0)),
        "specificity": float(recall_score(y_true, predicted, pos_label=0, zero_division=0)),
        "f1": float(f1_score(y_true, predicted, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_true, proba)),
        "brier": float(brier_score_loss(y_true, proba)),
    }


def summarize_folds(fold_metrics: Sequence[dict[str, float]]) -> dict[str, dict[str, float]]:
    """Mean and standard deviation of each metric across folds."""
    return {
        name: {
            "mean": float(np.mean([fold[name] for fold in fold_metrics])),
            "std": float(np.std([fold[name] for fold in fold_metrics], ddof=1)),
        }
        for name in fold_metrics[0]
    }


def corrected_resampled_ttest(
    scores_a: np.ndarray, scores_b: np.ndarray, test_train_ratio: float
) -> float:
    """Two-sided p-value of the Nadeau-Bengio corrected resampled t-test on paired fold scores.

    Folds of repeated K-fold overlap, so a plain paired t-test understates the variance; the
    correction inflates it by ``1/n + n_test/n_train``.
    """
    differences = np.asarray(scores_a) - np.asarray(scores_b)
    n = len(differences)
    variance = np.var(differences, ddof=1)
    if variance == 0:
        return 1.0 if np.mean(differences) == 0 else 0.0
    statistic = np.mean(differences) / np.sqrt((1 / n + test_train_ratio) * variance)
    return float(2 * stats.t.sf(abs(statistic), df=n - 1))


def youden_threshold(y_true: np.ndarray, proba: np.ndarray) -> float:
    """Threshold maximising sensitivity + specificity - 1."""
    false_positive_rate, true_positive_rate, thresholds = roc_curve(y_true, proba)
    best = int(np.argmax(true_positive_rate - false_positive_rate))
    return float(min(thresholds[best], 1.0))


def bootstrap_auc_interval(
    y_true: np.ndarray, proba: np.ndarray, seed: int, level: float = 0.95
) -> tuple[float, float]:
    """Percentile bootstrap confidence interval for ROC-AUC."""
    rng = np.random.default_rng(seed)
    aucs = []
    while len(aucs) < BOOTSTRAP_SAMPLES:
        sample = rng.integers(0, len(y_true), len(y_true))
        if y_true[sample].min() != y_true[sample].max():
            aucs.append(roc_auc_score(y_true[sample], proba[sample]))
    tail = (1 - level) / 2 * 100
    low, high = np.percentile(aucs, [tail, 100 - tail])
    return float(low), float(high)


def confusion_counts(y_true: np.ndarray, proba: np.ndarray, threshold: float) -> dict[str, int]:
    tn, fp, fn, tp = confusion_matrix(y_true, (proba >= threshold).astype(int)).ravel()
    return {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)}
