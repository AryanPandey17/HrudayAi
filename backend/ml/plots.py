"""Evaluation figures saved under ``reports/plots``."""

from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import shap
from sklearn.calibration import calibration_curve
from sklearn.metrics import roc_auc_score, roc_curve

from ml.config import REPORTS_DIR
from ml.models import MODEL_LABELS

PLOTS_DIR = REPORTS_DIR / "plots"
SHAP_MAX_DISPLAY = 15

CV_COLOR, TEST_COLOR, RAW_COLOR = "#2563eb", "#dc2626", "#9ca3af"
Labelled = tuple[np.ndarray, np.ndarray]  # (y_true, probability)


def _save(figure: plt.Figure, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    figure.tight_layout()
    figure.savefig(path, dpi=140)
    plt.close(figure)


def plot_roc(target: str, cv: Labelled, test: Labelled, path: Path) -> None:
    """ROC of the final calibrated model: pooled CV predictions and the held-out test set."""
    figure, axis = plt.subplots(figsize=(4.6, 4.4))
    for (y, proba), name, color in ((cv, "CV (pooled)", CV_COLOR), (test, "Test", TEST_COLOR)):
        fpr, tpr, _ = roc_curve(y, proba)
        axis.plot(fpr, tpr, color=color, lw=2, label=f"{name}  AUC {roc_auc_score(y, proba):.3f}")
    axis.plot([0, 1], [0, 1], color=RAW_COLOR, ls="--", lw=1)
    axis.set(xlabel="False positive rate", ylabel="True positive rate", title=f"{target} - ROC")
    axis.legend(loc="lower right", frameon=False)
    _save(figure, path)


def plot_calibration(
    target: str, cv_raw: Labelled, cv: Labelled, test: Labelled, method: str, path: Path
) -> None:
    """Reliability curves (quantile bins) before and after calibration."""
    figure, axis = plt.subplots(figsize=(4.6, 4.4))
    series = (
        (cv_raw, "CV uncalibrated", RAW_COLOR, 8),
        (cv, f"CV {method}", CV_COLOR, 8),
        (test, f"Test {method}", TEST_COLOR, 5),
    )
    for (y, proba), name, color, bins in series:
        observed, predicted = calibration_curve(y, proba, n_bins=bins, strategy="quantile")
        axis.plot(predicted, observed, marker="o", ms=4, lw=1.8, color=color, label=name)
    axis.plot([0, 1], [0, 1], color="black", ls="--", lw=1)
    axis.set(
        xlabel="Predicted probability",
        ylabel="Observed frequency",
        title=f"{target} - calibration",
        xlim=(0, 1),
        ylim=(0, 1),
    )
    axis.legend(loc="upper left", frameon=False)
    _save(figure, path)


def plot_confusion(target: str, counts: dict[str, int], threshold: float, path: Path) -> None:
    """Held-out test confusion matrix at the selected decision threshold."""
    matrix = np.array([[counts["tn"], counts["fp"]], [counts["fn"], counts["tp"]]])
    figure, axis = plt.subplots(figsize=(4.2, 3.9))
    axis.imshow(matrix, cmap="Blues", vmin=0)
    for (row, column), value in np.ndenumerate(matrix):
        color = "white" if value > matrix.max() / 2 else "black"
        axis.text(column, row, str(value), ha="center", va="center", color=color, fontsize=14)
    axis.set(
        xticks=[0, 1],
        yticks=[0, 1],
        xticklabels=["Negative", "Positive"],
        yticklabels=["Negative", "Positive"],
        xlabel="Predicted",
        ylabel="Actual",
        title=f"{target} - test confusion (threshold {threshold:.2f})",
    )
    _save(figure, path)


def plot_candidate_comparison(cv_auc: dict[str, dict[str, dict[str, float]]], path: Path) -> None:
    """CV ROC-AUC (mean +/- std over folds) of every candidate, grouped by target."""
    targets = list(cv_auc)
    models = list(next(iter(cv_auc.values())))
    width = 0.8 / len(models)
    figure, axis = plt.subplots(figsize=(8.5, 4.2))
    for index, model in enumerate(models):
        means = [cv_auc[target][model]["mean"] for target in targets]
        stds = [cv_auc[target][model]["std"] for target in targets]
        positions = np.arange(len(targets)) + (index - (len(models) - 1) / 2) * width
        axis.bar(positions, means, width * 0.92, yerr=stds, capsize=2, label=MODEL_LABELS[model])
    axis.set(
        xticks=np.arange(len(targets)),
        xticklabels=targets,
        ylabel="CV ROC-AUC (mean ± std)",
        ylim=(0.5, 1.0),
        title="Candidate models - repeated stratified CV",
    )
    axis.legend(frameon=False, fontsize=8, ncol=3, loc="upper right")
    _save(figure, path)


def plot_shap_importance(target: str, importance: list[dict], path: Path) -> None:
    """Global importance: mean |SHAP| of the top original features."""
    top = importance[:SHAP_MAX_DISPLAY][::-1]
    figure, axis = plt.subplots(figsize=(6.2, 5.2))
    values = [item["mean_abs_shap"] for item in top]
    axis.barh([item["label"] for item in top], values, color=CV_COLOR)
    axis.set(xlabel="mean |SHAP| (log-odds)", title=f"{target} - global feature importance")
    _save(figure, path)


def plot_shap_summary(
    target: str,
    shap_values: pd.DataFrame,
    feature_values: pd.DataFrame,
    labels: dict[str, str],
    path: Path,
) -> None:
    """SHAP beeswarm over the training rows, on original features."""
    shap.summary_plot(
        shap_values.to_numpy(),
        features=feature_values[shap_values.columns].to_numpy(dtype=float),
        feature_names=[labels[name] for name in shap_values.columns],
        max_display=SHAP_MAX_DISPLAY,
        show=False,
        plot_size=(7.5, 5.6),
    )
    figure = plt.gcf()
    figure.axes[0].set_title(f"{target} - SHAP summary (training rows)")
    _save(figure, path)


def plot_ladder_auc(targets: dict[str, dict], path: Path) -> None:
    """ROC-AUC per ladder stage and target: CV mean ± std (line) and hold-out value (marker)."""
    figure, axes = plt.subplots(1, len(targets), figsize=(3.1 * len(targets), 3.6), sharey=True)
    for axis, (target, report) in zip(axes, targets.items(), strict=True):
        stages = list(report["stages"].values())
        ids = [stage["stage"] for stage in stages]
        mean = np.array([stage["cv"]["roc_auc"]["mean"] for stage in stages])
        std = np.array([stage["cv"]["roc_auc"]["std"] for stage in stages])
        held_out = [stage["test"]["at_selected_threshold"]["roc_auc"] for stage in stages]
        axis.fill_between(ids, mean - std, mean + std, color=CV_COLOR, alpha=0.15, lw=0)
        axis.plot(ids, mean, color=CV_COLOR, marker="o", lw=2, label="CV mean ± std")
        axis.plot(ids, held_out, color=TEST_COLOR, marker="s", ls="--", lw=1.2, label="Hold-out")
        axis.axhline(0.5, color=RAW_COLOR, ls=":", lw=1)
        axis.set(title=target, xticks=ids, ylim=(0.45, 1.0))
        labels = [stage["label"].replace(" + ", "\n+ ") for stage in stages]
        axis.set_xticklabels(labels, fontsize=7, rotation=25, ha="right", rotation_mode="anchor")
    axes[0].set_ylabel("ROC-AUC")
    axes[0].legend(loc="lower right", frameon=False, fontsize=8)
    figure.suptitle(
        "Test ladder - discrimination as tests are added (stages are cumulative)", fontsize=10
    )
    _save(figure, path)
