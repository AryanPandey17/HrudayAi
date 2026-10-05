"""Shared preprocessing: output contract, strict validation and the leakage guard."""

import numpy as np
import pytest

from ml.config import LEAKAGE_COLUMNS, SEED
from ml.data import target_series
from ml.models import build_pipeline, fit_balanced
from ml.preprocess import build_preprocessor, encoded_feature_origins


@pytest.fixture(scope="module")
def matrix(raw, schema):
    return build_preprocessor(schema.features).fit_transform(raw)


def test_model_matrix_is_numeric_complete_and_named(matrix, raw, schema):
    assert len(matrix) == len(raw)
    assert not matrix.isna().any().any()
    assert all(np.issubdtype(dtype, np.number) for dtype in matrix.dtypes)
    assert set(matrix.columns) == set(encoded_feature_origins(schema.features))


def test_model_matrix_has_no_leakage_or_excluded_column(matrix, schema):
    origins = set(encoded_feature_origins(schema.features).values())
    assert origins == set(schema.names())
    assert LEAKAGE_COLUMNS.isdisjoint(origins)
    assert not any(column.startswith(tuple(LEAKAGE_COLUMNS)) for column in matrix.columns)


def test_binary_and_ordinal_codes_follow_option_order(matrix, raw):
    assert matrix.loc[raw["Sex"] == "Male", "Sex"].eq(1).all()
    assert matrix.loc[raw["Obesity"] == "N", "Obesity"].eq(0).all()
    assert matrix.loc[raw["VHD"] == "Severe", "VHD"].eq(3).all()
    assert matrix.loc[raw["BBB"] == "LBBB", "BBB_LBBB"].eq(1).all()


def test_unknown_category_is_rejected(raw, schema):
    corrupted = raw.head(5).copy()
    corrupted.loc[0, "VHD"] = "critical"
    with pytest.raises(ValueError, match="VHD"):
        build_preprocessor(schema.features).fit_transform(corrupted)


def test_missing_feature_is_rejected(raw, schema):
    with pytest.raises(ValueError, match="Missing input features"):
        build_preprocessor(schema.features).fit_transform(raw.drop(columns=["Age"]))


def test_non_numeric_value_is_rejected(raw, schema):
    corrupted = raw.head(5).astype({"Age": object})
    corrupted.loc[0, "Age"] = "old"
    with pytest.raises(ValueError, match="Age"):
        build_preprocessor(schema.features).fit_transform(corrupted)


def test_predictions_do_not_depend_on_leakage_columns(raw):
    """Scrambling LAD / LCX / RCA / Cath in the input must leave predictions unchanged."""
    y = target_series(raw, "CAD")
    pipeline = fit_balanced(build_pipeline("random_forest", SEED), raw, y)
    scrambled = raw.copy()
    for column in LEAKAGE_COLUMNS:
        scrambled[column] = scrambled[column].sample(frac=1, random_state=SEED).to_numpy()
    without = raw.drop(columns=list(LEAKAGE_COLUMNS))
    expected = pipeline.predict_proba(raw)
    assert np.array_equal(expected, pipeline.predict_proba(scrambled))
    assert np.array_equal(expected, pipeline.predict_proba(without))
