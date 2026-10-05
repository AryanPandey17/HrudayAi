"""Shared preprocessing, used unchanged by training and by the API.

Two steps, both driven by the feature schema:

1. ``SchemaEncoder`` picks exactly the schema features out of a raw frame (so leakage or
   unknown columns can never reach a model), validates values and turns binary / ordinal
   features into integer codes.
2. A ``ColumnTransformer`` standardises numeric features, passes codes through and one-hot
   encodes nominal features with categories fixed by the schema.
"""

from collections.abc import Sequence

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from ml.schema import CODED_KINDS, FeatureSpec


class SchemaEncoder(TransformerMixin, BaseEstimator):
    """Select, validate and code the schema features of a raw frame. Stateless."""

    def __init__(self, features: Sequence[FeatureSpec]):
        self.features = features

    def fit(self, X: pd.DataFrame, y=None) -> "SchemaEncoder":
        return self

    def __sklearn_is_fitted__(self) -> bool:
        return True

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        missing = [f.name for f in self.features if f.name not in X.columns]
        if missing:
            raise ValueError(f"Missing input features: {missing}")
        encoded = {f.name: _encode_column(X[f.name], f) for f in self.features}
        return pd.DataFrame(encoded, index=X.index)

    def get_feature_names_out(self, input_features=None) -> np.ndarray:
        return np.array([f.name for f in self.features], dtype=object)


def _encode_column(series: pd.Series, feature: FeatureSpec) -> pd.Series:
    if feature.kind == "numeric":
        numeric = pd.to_numeric(series, errors="coerce").astype(float)
        if numeric.isna().any():
            raise ValueError(f"'{feature.name}' has missing or non-numeric values")
        return numeric
    invalid = series[~series.isin(feature.values)]
    if not invalid.empty:
        found = sorted({str(value) for value in invalid})
        raise ValueError(f"'{feature.name}' has values {found}; allowed: {list(feature.values)}")
    if feature.kind in CODED_KINDS:
        return series.map(feature.codes).astype(int)
    return series.astype(object)


def build_preprocessor(features: Sequence[FeatureSpec]) -> Pipeline:
    """Unfitted preprocessing pipeline: raw frame -> numeric model matrix (as a DataFrame)."""
    numeric = [f.name for f in features if f.kind == "numeric"]
    coded = [f.name for f in features if f.kind in CODED_KINDS]
    nominal = [f for f in features if f.kind == "categorical"]
    one_hot = OneHotEncoder(
        categories=[list(f.values) for f in nominal], sparse_output=False, handle_unknown="error"
    )
    columns = ColumnTransformer(
        [
            ("numeric", StandardScaler(), numeric),
            ("coded", "passthrough", coded),
            ("nominal", one_hot, [f.name for f in nominal]),
        ],
        verbose_feature_names_out=False,
    ).set_output(transform="pandas")
    return Pipeline([("encode", SchemaEncoder(tuple(features))), ("columns", columns)])


def encoded_feature_origins(features: Sequence[FeatureSpec]) -> dict[str, str]:
    """Model-matrix column -> original feature name (one-hot columns map to their source)."""
    origins: dict[str, str] = {}
    for feature in features:
        if feature.kind == "categorical":
            origins.update({f"{feature.name}_{value}": feature.name for value in feature.values})
        else:
            origins[feature.name] = feature.name
    return origins
