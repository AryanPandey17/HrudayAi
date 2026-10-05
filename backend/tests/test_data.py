"""Raw dataset contract and the target-leakage guard."""

import pytest

from ml.config import EXPECTED_ROWS, LEAKAGE_COLUMNS, TARGETS
from ml.data import feature_columns, target_series


def test_dataset_has_expected_rows_and_no_missing_values(raw):
    assert len(raw) == EXPECTED_ROWS
    assert raw.isna().sum().sum() == 0


def test_leakage_columns_are_exactly_the_angiography_columns():
    assert frozenset({"LAD", "LCX", "RCA", "Cath"}) == LEAKAGE_COLUMNS


def test_feature_columns_exclude_every_leakage_column(raw):
    features = feature_columns(raw)
    assert LEAKAGE_COLUMNS.isdisjoint(features)
    assert len(features) == raw.shape[1] - len(LEAKAGE_COLUMNS)


@pytest.mark.parametrize("target", list(TARGETS))
def test_targets_are_binary_with_both_classes(raw, target):
    labels = target_series(raw, target)
    assert set(labels.unique()) == {0, 1}


def test_unexpected_target_label_is_rejected(raw):
    corrupted = raw.copy()
    corrupted.loc[0, "LAD"] = "Unknown"
    with pytest.raises(ValueError, match="Unexpected labels"):
        target_series(corrupted, "LAD")
