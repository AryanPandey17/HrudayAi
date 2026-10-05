"""Selection statistics, threshold choice, calibrators and the hold-out split."""

import numpy as np
import pytest

from ml.calibration import CALIBRATORS
from ml.config import SEED, TARGETS, TEST_FRACTION
from ml.cv import FoldPredictions, holdout_split
from ml.data import target_series
from ml.evaluate import classification_metrics, corrected_resampled_ttest, youden_threshold
from ml.models import MODEL_SPECS
from ml.selection import select_model


def _folds(auc_shift: dict[str, float], n_folds: int = 25) -> list[FoldPredictions]:
    """Synthetic folds where each model's scores separate the classes by ``auc_shift``."""
    rng = np.random.default_rng(0)
    folds = []
    for _ in range(n_folds):
        y = np.tile([0, 1], 25)
        noise = rng.normal(size=len(y))
        proba = {name: 1 / (1 + np.exp(-(noise + shift * y))) for name, shift in auc_shift.items()}
        folds.append(FoldPredictions(y, proba, dict.fromkeys(proba, 0.5)))
    return folds


def test_corrected_ttest_identical_scores_is_a_tie():
    scores = np.linspace(0.7, 0.9, 25)
    assert corrected_resampled_ttest(scores, scores, 0.25) == 1.0


def test_corrected_ttest_is_more_conservative_than_plain_paired_test():
    rng = np.random.default_rng(1)
    a = rng.normal(0.85, 0.03, 25)
    b = a - rng.normal(0.01, 0.01, 25)
    assert corrected_resampled_ttest(a, b, 0.25) > corrected_resampled_ttest(a, b, 0.0)


def test_selection_prefers_simplest_model_when_tied():
    selection = select_model(_folds(dict.fromkeys(MODEL_SPECS, 1.5)))
    assert selection["selected"] == "logistic_regression"


def test_selection_keeps_complex_model_when_clearly_better():
    shifts = dict.fromkeys(MODEL_SPECS, 0.2) | {"xgboost": 3.0}
    selection = select_model(_folds(shifts))
    assert selection["best_by_cv_auc"] == selection["selected"] == "xgboost"


def test_youden_threshold_separates_perfectly_separable_scores():
    y = np.array([0, 0, 0, 1, 1, 1])
    proba = np.array([0.1, 0.2, 0.3, 0.6, 0.7, 0.8])
    threshold = youden_threshold(y, proba)
    assert 0.3 < threshold <= 0.6
    assert classification_metrics(y, proba, threshold)["accuracy"] == 1.0


@pytest.mark.parametrize("method", list(CALIBRATORS))
def test_calibrators_are_monotone_probabilities(method):
    rng = np.random.default_rng(2)
    scores = rng.normal(size=300)
    y = (rng.random(300) < 1 / (1 + np.exp(-2 * scores))).astype(int)
    calibrated = CALIBRATORS[method]().fit(scores, y).predict(np.linspace(-4, 4, 50))
    assert calibrated.min() >= 0 and calibrated.max() <= 1
    assert np.all(np.diff(calibrated) >= 0)


def test_holdout_split_is_disjoint_complete_and_reproducible(raw):
    train, test = holdout_split(raw, SEED)
    again = holdout_split(raw, SEED)
    assert set(train).isdisjoint(test) and len(train) + len(test) == len(raw)
    assert len(test) == round(TEST_FRACTION * len(raw))
    assert np.array_equal(train, again[0]) and np.array_equal(test, again[1])


def test_holdout_split_roughly_preserves_every_target_prevalence(raw):
    train, test = holdout_split(raw, SEED)
    for target in TARGETS:
        y = target_series(raw, target)
        assert abs(y.iloc[train].mean() - y.iloc[test].mean()) < 0.1, target
