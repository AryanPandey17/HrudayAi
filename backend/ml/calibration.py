"""Probability calibration on out-of-fold scores, and the deployable calibrated model.

Calibrators are fitted on the base model's log-odds, obtained out-of-fold so the calibrator
never sees a score the base model produced for its own training rows. The base model is then
refitted on all training rows. This is one base model plus one monotone map, which keeps SHAP
explanations of the base model directly tied to the displayed probability.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

import numpy as np
import pandas as pd
from scipy.special import logit
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold
from sklearn.pipeline import Pipeline

from ml.config import CALIBRATION_SPLITS
from ml.evaluate import youden_threshold
from ml.models import build_pipeline, fit_balanced
from ml.schema import FeatureSpec

PROBABILITY_EPS = 1e-6


class Calibrator(Protocol):
    def fit(self, scores: np.ndarray, y: np.ndarray) -> "Calibrator": ...
    def predict(self, scores: np.ndarray) -> np.ndarray: ...


class SigmoidCalibrator:
    """Platt scaling: an (effectively unregularised) logistic fit on the log-odds."""

    def __init__(self) -> None:
        self._model = LogisticRegression(C=1e6, max_iter=1000)

    def fit(self, scores: np.ndarray, y: np.ndarray) -> "SigmoidCalibrator":
        self._model.fit(scores.reshape(-1, 1), y)
        return self

    def predict(self, scores: np.ndarray) -> np.ndarray:
        return self._model.predict_proba(scores.reshape(-1, 1))[:, 1]

    @property
    def slope(self) -> float:
        """Calibrated log-odds = slope * base log-odds + shift."""
        return float(self._model.coef_[0, 0])

    @property
    def shift(self) -> float:
        return float(self._model.intercept_[0])


class IsotonicCalibrator:
    """Non-parametric monotone calibration."""

    def __init__(self) -> None:
        self._model = IsotonicRegression(y_min=0.0, y_max=1.0, out_of_bounds="clip")

    def fit(self, scores: np.ndarray, y: np.ndarray) -> "IsotonicCalibrator":
        self._model.fit(scores, y)
        return self

    def predict(self, scores: np.ndarray) -> np.ndarray:
        return self._model.predict(scores)


CALIBRATORS: dict[str, type[Calibrator]] = {
    "sigmoid": SigmoidCalibrator,
    "isotonic": IsotonicCalibrator,
}


@dataclass(frozen=True)
class FittedCalibration:
    """A fitted calibrator and the decision threshold tuned on the same out-of-fold scores."""

    calibrator: Calibrator
    threshold: float


def _fit_calibration(method: str, scores: np.ndarray, y: np.ndarray) -> FittedCalibration:
    calibrator = CALIBRATORS[method]().fit(scores, y)
    return FittedCalibration(calibrator, youden_threshold(y, calibrator.predict(scores)))


def positive_log_odds(pipeline: Pipeline, X: pd.DataFrame) -> np.ndarray:
    """Log-odds of the positive class from a fitted base pipeline."""
    proba = pipeline.predict_proba(X)[:, 1]
    return logit(np.clip(proba, PROBABILITY_EPS, 1 - PROBABILITY_EPS))


def out_of_fold_log_odds(
    model_name: str,
    X: pd.DataFrame,
    y: pd.Series,
    seed: int,
    features: Sequence[FeatureSpec] | None = None,
) -> np.ndarray:
    """Base-model log-odds for every row, each predicted by a model that did not train on it."""
    folds = StratifiedKFold(n_splits=CALIBRATION_SPLITS, shuffle=True, random_state=seed)
    scores = np.empty(len(y), dtype=float)
    for train, held_out in folds.split(X, y):
        pipeline = build_pipeline(model_name, seed, features)
        fitted = fit_balanced(pipeline, X.iloc[train], y.iloc[train])
        scores[held_out] = positive_log_odds(fitted, X.iloc[held_out])
    return scores


def fit_with_calibrators(
    model_name: str,
    X: pd.DataFrame,
    y: pd.Series,
    seed: int,
    features: Sequence[FeatureSpec] | None = None,
) -> tuple[Pipeline, dict[str, FittedCalibration]]:
    """Fit the base pipeline on all rows, plus every calibrator (and its Youden threshold)
    on the out-of-fold scores."""
    scores = out_of_fold_log_odds(model_name, X, y, seed, features)
    calibrations = {name: _fit_calibration(name, scores, y.to_numpy()) for name in CALIBRATORS}
    pipeline = fit_balanced(build_pipeline(model_name, seed, features), X, y)
    return pipeline, calibrations


@dataclass
class CalibratedModel:
    """The artifact saved per target: base pipeline, calibrator and decision threshold.

    ``background`` is the preprocessed training matrix, kept as the SHAP reference data.
    """

    target: str
    model_name: str
    calibration: str
    pipeline: Pipeline
    calibrator: Calibrator
    threshold: float
    background: pd.DataFrame

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        """Calibrated probability of the positive class."""
        return self.calibrator.predict(positive_log_odds(self.pipeline, X))

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        return (self.predict_proba(X) >= self.threshold).astype(int)
