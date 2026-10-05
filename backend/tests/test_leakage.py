"""Target-leakage guard: LAD / LCX / RCA / Cath must never reach a model.

Restored from the original suite (test_data, test_schema, test_preprocess); only the
leakage-related tests are kept.
"""

import numpy as np

from ml.config import LEAKAGE_COLUMNS, SEED
from ml.data import feature_columns, target_series
from ml.models import build_pipeline, fit_balanced
from ml.preprocess import build_preprocessor, encoded_feature_origins


def test_leakage_columns_are_exactly_the_angiography_columns():
    assert frozenset({"LAD", "LCX", "RCA", "Cath"}) == LEAKAGE_COLUMNS


def test_feature_columns_exclude_every_leakage_column(raw):
    features = feature_columns(raw)
    assert LEAKAGE_COLUMNS.isdisjoint(features)
    assert len(features) == raw.shape[1] - len(LEAKAGE_COLUMNS)


def test_schema_contains_no_leakage_column(schema):
    assert LEAKAGE_COLUMNS.isdisjoint(schema.names())


def test_model_matrix_has_no_leakage_column(raw, schema):
    matrix = build_preprocessor(schema.features).fit_transform(raw)
    origins = set(encoded_feature_origins(schema.features).values())
    assert origins == set(schema.names())
    assert LEAKAGE_COLUMNS.isdisjoint(origins)
    assert not any(column.startswith(tuple(LEAKAGE_COLUMNS)) for column in matrix.columns)


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
