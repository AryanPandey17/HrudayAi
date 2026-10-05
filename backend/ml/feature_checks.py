"""Diagnostics for redundant, derived, rare or suspiciously predictive input features."""

from typing import Any

import pandas as pd
from sklearn.metrics import roc_auc_score

from ml.config import TARGETS
from ml.data import target_series
from ml.preprocess import SchemaEncoder
from ml.schema import load_schema

CORRELATION_FLAG = 0.8
UNIVARIATE_AUC_FLAG = 0.9
RARE_MINORITY_COUNT = 10
TOP_UNIVARIATE = 5
OBESITY_BMI_CUTOFF = 25


def feature_checks(frame: pd.DataFrame) -> dict[str, Any]:
    """Run all checks on the full raw frame (diagnostic only; nothing here is fitted)."""
    schema = load_schema()
    coded = SchemaEncoder(schema.features).transform(frame)
    matrix = pd.get_dummies(coded, columns=schema.names("categorical"), dtype=int)
    univariate = {name: _univariate_auc(matrix, target_series(frame, name)) for name in TARGETS}
    return {
        "derived_features": _derived_features(frame),
        "rare_binary_features": _rare_binary(coded, schema.names("binary")),
        "highly_correlated_pairs": _correlated_pairs(matrix),
        "top_univariate_auc": {
            t: dict(list(a.items())[:TOP_UNIVARIATE]) for t, a in univariate.items()
        },
        "suspicious_univariate": {
            t: {f: v for f, v in a.items() if v >= UNIVARIATE_AUC_FLAG}
            for t, a in univariate.items()
        },
    }


def _derived_features(frame: pd.DataFrame) -> dict[str, float]:
    """BMI and Obesity are functions of other inputs: redundant, but not target leakage."""
    bmi = frame["Weight"] / (frame["Length"] / 100) ** 2
    obese = frame["BMI"] > OBESITY_BMI_CUTOFF
    return {
        "bmi_max_abs_diff_from_weight_height": float((frame["BMI"] - bmi).abs().max()),
        "obesity_agreement_with_bmi_over_25": float(((frame["Obesity"] == "Y") == obese).mean()),
    }


def _rare_binary(coded: pd.DataFrame, binary: list[str]) -> dict[str, int]:
    minority = {name: int(coded[name].value_counts().min()) for name in binary}
    return {name: count for name, count in minority.items() if count < RARE_MINORITY_COUNT}


def _correlated_pairs(matrix: pd.DataFrame) -> list[dict[str, Any]]:
    correlation = matrix.corr(method="spearman")
    columns = list(matrix.columns)
    pairs = [
        {"a": a, "b": b, "spearman": float(correlation.loc[a, b])}
        for i, a in enumerate(columns)
        for b in columns[i + 1 :]
        if abs(correlation.loc[a, b]) >= CORRELATION_FLAG
    ]
    return sorted(pairs, key=lambda pair: -abs(pair["spearman"]))


def _univariate_auc(matrix: pd.DataFrame, y: pd.Series) -> dict[str, float]:
    """Direction-free single-feature ROC-AUC, highest first."""
    aucs = {column: roc_auc_score(y, matrix[column]) for column in matrix.columns}
    separability = {column: float(max(auc, 1 - auc)) for column, auc in aucs.items()}
    return dict(sorted(separability.items(), key=lambda item: -item[1]))
