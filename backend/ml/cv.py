"""Cross-validation loops. Every fold refits preprocessing, model and calibrator from scratch."""

from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np
import pandas as pd
from joblib import Parallel, delayed
from scipy.special import expit
from sklearn.model_selection import RepeatedStratifiedKFold, train_test_split

from ml.calibration import fit_with_calibrators, positive_log_odds
from ml.config import CV_REPEATS, CV_SPLITS, TARGETS, TEST_FRACTION
from ml.data import target_series
from ml.models import MODEL_SPECS, SOFT_VOTE, build_pipeline, fit_balanced
from ml.schema import FeatureSpec

UNCALIBRATED = "uncalibrated"
DEFAULT_THRESHOLD = 0.5
Fold = tuple[np.ndarray, np.ndarray]


@dataclass(frozen=True)
class FoldPredictions:
    """Held-out labels of one fold, plus each compared variant's probabilities and the
    decision threshold that variant would use (fixed, or tuned inside the training fold)."""

    y_true: np.ndarray
    proba: dict[str, np.ndarray]
    thresholds: dict[str, float]


def holdout_split(frame: pd.DataFrame, seed: int) -> tuple[np.ndarray, np.ndarray]:
    """One train/test split shared by all targets, stratified on the number of stenotic vessels.

    A shared split keeps every test patient unseen by all four models; stratifying on the
    vessel count balances all four targets at once.
    """
    vessels = [name for name in TARGETS if name != "CAD"]
    vessel_count = sum(target_series(frame, name) for name in vessels)
    train, test = train_test_split(
        np.arange(len(frame)), test_size=TEST_FRACTION, stratify=vessel_count, random_state=seed
    )
    return np.sort(train), np.sort(test)


def repeated_folds(y: pd.Series, seed: int) -> list[Fold]:
    splitter = RepeatedStratifiedKFold(n_splits=CV_SPLITS, n_repeats=CV_REPEATS, random_state=seed)
    return list(splitter.split(np.zeros(len(y)), y))


def cross_validate_candidates(
    X: pd.DataFrame, y: pd.Series, folds: list[Fold], seed: int
) -> list[FoldPredictions]:
    """Held-out probabilities of every candidate (and their soft vote) on identical folds."""
    return Parallel(n_jobs=-1)(
        delayed(_candidate_fold)(X, y, train, test, seed) for train, test in folds
    )


def cross_validate_calibration(
    model_name: str,
    X: pd.DataFrame,
    y: pd.Series,
    folds: list[Fold],
    seed: int,
    features: Sequence[FeatureSpec] | None = None,
) -> list[FoldPredictions]:
    """Held-out probabilities of one model: uncalibrated and under each calibration method."""
    return Parallel(n_jobs=-1)(
        delayed(_calibration_fold)(model_name, X, y, train, test, seed, features)
        for train, test in folds
    )


def _candidate_fold(
    X: pd.DataFrame, y: pd.Series, train: np.ndarray, test: np.ndarray, seed: int
) -> FoldPredictions:
    proba = {}
    for name in MODEL_SPECS:
        fitted = fit_balanced(build_pipeline(name, seed), X.iloc[train], y.iloc[train])
        proba[name] = fitted.predict_proba(X.iloc[test])[:, 1]
    proba[SOFT_VOTE] = np.mean(list(proba.values()), axis=0)
    return FoldPredictions(y.iloc[test].to_numpy(), proba, dict.fromkeys(proba, DEFAULT_THRESHOLD))


def _calibration_fold(
    model_name: str,
    X: pd.DataFrame,
    y: pd.Series,
    train: np.ndarray,
    test: np.ndarray,
    seed: int,
    features: Sequence[FeatureSpec] | None,
) -> FoldPredictions:
    pipeline, calibrations = fit_with_calibrators(
        model_name, X.iloc[train], y.iloc[train], seed, features
    )
    scores = positive_log_odds(pipeline, X.iloc[test])
    proba = {UNCALIBRATED: expit(scores)}
    thresholds = {UNCALIBRATED: DEFAULT_THRESHOLD}
    for name, fitted in calibrations.items():
        proba[name] = fitted.calibrator.predict(scores)
        thresholds[name] = fitted.threshold
    return FoldPredictions(y.iloc[test].to_numpy(), proba, thresholds)
