"""Candidate model registry. Adding a candidate means adding one ``ModelSpec`` entry."""

from collections.abc import Callable
from dataclasses import dataclass

import numpy as np
import pandas as pd
from lightgbm import LGBMClassifier
from sklearn.base import ClassifierMixin
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegressionCV
from sklearn.model_selection import StratifiedKFold
from sklearn.pipeline import Pipeline
from sklearn.utils.class_weight import compute_sample_weight
from xgboost import XGBClassifier

from ml.preprocess import build_preprocessor
from ml.schema import load_schema

SOFT_VOTE = "soft_vote"


@dataclass(frozen=True)
class ModelSpec:
    """A candidate. ``complexity`` orders candidates for the prefer-simpler tie-break."""

    name: str
    label: str
    complexity: int
    factory: Callable[[int], ClassifierMixin]


def _logistic_regression(seed: int) -> ClassifierMixin:
    """L2 logistic regression; C chosen by an inner CV, so tuning stays inside each fold."""
    return LogisticRegressionCV(
        Cs=np.logspace(-3, 0, 7),
        l1_ratios=(0,),
        use_legacy_attributes=False,
        cv=StratifiedKFold(n_splits=5, shuffle=True, random_state=seed),
        scoring="roc_auc",
        max_iter=5000,
        random_state=seed,
    )


def _random_forest(seed: int) -> ClassifierMixin:
    return RandomForestClassifier(
        n_estimators=300,
        max_depth=4,
        min_samples_leaf=5,
        max_features="sqrt",
        n_jobs=1,
        random_state=seed,
    )


def _xgboost(seed: int) -> ClassifierMixin:
    return XGBClassifier(
        n_estimators=200,
        learning_rate=0.05,
        max_depth=2,
        min_child_weight=3,
        subsample=0.8,
        colsample_bytree=0.6,
        reg_lambda=5.0,
        reg_alpha=0.5,
        tree_method="hist",
        n_jobs=1,
        random_state=seed,
    )


def _lightgbm(seed: int) -> ClassifierMixin:
    return LGBMClassifier(
        n_estimators=200,
        learning_rate=0.03,
        num_leaves=4,
        max_depth=2,
        min_child_samples=15,
        subsample=0.8,
        subsample_freq=1,
        colsample_bytree=0.6,
        reg_lambda=5.0,
        reg_alpha=0.5,
        deterministic=True,
        force_row_wise=True,
        n_jobs=1,
        verbose=-1,
        random_state=seed,
    )


# Tree hyperparameters are fixed a priori (shallow, strongly regularised) rather than searched:
# with ~240 training rows a search would mostly add selection optimism.
MODEL_SPECS: dict[str, ModelSpec] = {
    spec.name: spec
    for spec in (
        ModelSpec("logistic_regression", "Logistic regression (L2)", 0, _logistic_regression),
        ModelSpec("random_forest", "Random forest", 1, _random_forest),
        ModelSpec("lightgbm", "LightGBM", 2, _lightgbm),
        ModelSpec("xgboost", "XGBoost", 2, _xgboost),
    )
}

MODEL_LABELS: dict[str, str] = {
    **{name: spec.label for name, spec in MODEL_SPECS.items()},
    SOFT_VOTE: "Soft-voting ensemble (reference)",
}


def build_pipeline(model_name: str, seed: int) -> Pipeline:
    """Unfitted preprocessing + estimator pipeline for a candidate."""
    preprocessor = build_preprocessor(load_schema().features)
    return Pipeline(
        [("preprocess", preprocessor), ("model", MODEL_SPECS[model_name].factory(seed))]
    )


def fit_balanced(pipeline: Pipeline, X: pd.DataFrame, y: pd.Series) -> Pipeline:
    """Fit with class-balanced sample weights (one imbalance strategy for every model type)."""
    weights = compute_sample_weight("balanced", y)
    return pipeline.fit(X, y, model__sample_weight=weights)
