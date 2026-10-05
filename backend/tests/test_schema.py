"""The feature schema must describe the dataset exactly and never contain a leakage column."""

from ml.config import LEAKAGE_COLUMNS


def test_schema_excluded_and_leakage_columns_partition_the_dataset(raw, schema):
    described = set(schema.names()) | set(schema.excluded) | LEAKAGE_COLUMNS
    assert described == set(raw.columns)
    assert len(schema.names()) + len(schema.excluded) + len(LEAKAGE_COLUMNS) == raw.shape[1]


def test_schema_contains_no_leakage_column(schema):
    assert LEAKAGE_COLUMNS.isdisjoint(schema.names())


def test_numeric_ranges_cover_the_observed_data(raw, schema):
    for feature in schema.features:
        if feature.kind == "numeric":
            assert feature.minimum <= raw[feature.name].min(), feature.name
            assert raw[feature.name].max() <= feature.maximum, feature.name


def test_options_match_the_observed_values(raw, schema):
    for feature in schema.features:
        if feature.kind != "numeric":
            assert set(raw[feature.name].unique()) == set(feature.values), feature.name


def test_every_group_is_used(schema):
    assert {feature.group for feature in schema.features} == set(schema.groups)
