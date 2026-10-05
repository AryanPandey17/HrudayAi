"""Model and calibration selection rules applied to cross-validation results."""

import numpy as np
from sklearn.metrics import brier_score_loss, roc_auc_score

from ml.calibration import CALIBRATORS
from ml.config import CV_SPLITS
from ml.cv import FoldPredictions
from ml.evaluate import corrected_resampled_ttest
from ml.models import MODEL_SPECS

TIE_ALPHA = 0.05


def fold_scores(folds: list[FoldPredictions], variant: str, metric) -> np.ndarray:
    return np.array([metric(fold.y_true, fold.proba[variant]) for fold in folds])


def select_model(folds: list[FoldPredictions]) -> dict:
    """Pick the simplest candidate that is statistically tied with the best CV ROC-AUC.

    "Tied" means the corrected resampled t-test on paired fold AUCs gives p > ``TIE_ALPHA``.
    Among tied candidates the lowest complexity wins, then the higher mean AUC. The soft-voting
    ensemble is reported but not selectable: it has no exact SHAP explainer.
    """
    auc = {name: fold_scores(folds, name, roc_auc_score) for name in MODEL_SPECS}
    best = max(auc, key=lambda name: auc[name].mean())
    ratio = 1 / (CV_SPLITS - 1)
    p_values = {name: corrected_resampled_ttest(auc[best], auc[name], ratio) for name in auc}
    tied = [name for name in auc if p_values[name] > TIE_ALPHA]
    selected = min(tied, key=lambda name: (MODEL_SPECS[name].complexity, -auc[name].mean()))
    return {
        "best_by_cv_auc": best,
        "selected": selected,
        "tie_alpha": TIE_ALPHA,
        "p_value_vs_best": p_values,
        "rule": "simplest candidate not significantly worse than the best CV ROC-AUC "
        "(Nadeau-Bengio corrected resampled t-test)",
    }


def select_calibration(folds: list[FoldPredictions]) -> str:
    """Calibration method with the lowest mean CV Brier score."""
    return min(CALIBRATORS, key=lambda name: fold_scores(folds, name, brier_score_loss).mean())
