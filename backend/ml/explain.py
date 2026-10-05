"""SHAP explanations per target, reported on the original (human-readable) features.

The base model is explained in its own output space (log-odds for linear and boosted models)
with the explainer suited to its type. One-hot columns are summed back to their source feature.
Because the displayed probability is a monotone calibration of that score, each contribution is
also given as ``probability_impact``: the calibrated probability change from the baseline,
shared out in proportion to the SHAP values. SHAP values are exactly additive; the probability
impacts are a readable rescaling of them.

``python -m ml.explain`` writes ``reports/shap_global.json`` and the SHAP plots.
"""

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import shap
from scipy.special import logit
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model._base import LinearClassifierMixin

from ml import plots
from ml.calibration import PROBABILITY_EPS, CalibratedModel
from ml.config import MODELS_DIR, REPORTS_DIR, SEED, TARGETS
from ml.cv import holdout_split
from ml.data import load_raw
from ml.preprocess import encoded_feature_origins
from ml.schema import FeatureSpec, load_schema

SHAP_GLOBAL_PATH = REPORTS_DIR / "shap_global.json"
DEFAULT_TOP_N = 5


@dataclass(frozen=True)
class Contribution:
    """One original feature's share of a single prediction."""

    feature: str
    label: str
    value: str | int | float
    display_value: str
    shap_value: float
    probability_impact: float


@dataclass(frozen=True)
class Explanation:
    """Local explanation of one patient for one target."""

    target: str
    probability: float
    base_probability: float
    shap_space: str
    contributions: list[Contribution]
    top_positive: list[Contribution]
    top_negative: list[Contribution]


def _build_explainer(estimator: Any, background: pd.DataFrame) -> tuple[Any, str]:
    """Explainer matching the model type, and the space its SHAP values live in."""
    if isinstance(estimator, LinearClassifierMixin):
        masker = shap.maskers.Independent(background, max_samples=len(background))
        return shap.LinearExplainer(estimator, masker), "log_odds"
    space = "probability" if isinstance(estimator, RandomForestClassifier) else "log_odds"
    return shap.TreeExplainer(estimator), space


def _positive_class(values: Any) -> np.ndarray:
    """Normalise SHAP output (or expected value) to the positive class."""
    if isinstance(values, list):
        return np.asarray(values[1])
    values = np.asarray(values)
    return values[..., 1] if values.ndim in (1, 3) and values.shape[-1] == 2 else values


def _plain(value: Any) -> str | int | float:
    """NumPy scalar -> built-in Python scalar (JSON-serialisable)."""
    return value.item() if isinstance(value, np.generic) else value


def _display_value(feature: FeatureSpec, value: Any) -> str:
    if feature.kind != "numeric":
        return next(option.label for option in feature.options if option.value == value)
    return f"{value:.4g} {feature.unit}" if feature.unit else f"{value:.4g}"


class TargetExplainer:
    """Global and local SHAP explanations for one saved target model."""

    def __init__(self, model: CalibratedModel):
        self.model = model
        self._features = load_schema().by_name()
        self._origins = encoded_feature_origins(self._features.values())
        estimator = model.pipeline[-1]
        self._explainer, self.shap_space = _build_explainer(estimator, model.background)
        base = float(np.ravel(_positive_class(self._explainer.expected_value))[0])
        self.base_probability = self._calibrate(np.array([base]))[0]

    def _calibrate(self, base_output: np.ndarray) -> np.ndarray:
        """Calibrated probability for a base-model output given in the SHAP space."""
        if self.shap_space == "probability":
            base_output = logit(np.clip(base_output, PROBABILITY_EPS, 1 - PROBABILITY_EPS))
        return self.model.calibrator.predict(base_output)

    def _matrix_shap(self, matrix: pd.DataFrame) -> pd.DataFrame:
        """SHAP values on the model matrix, summed back to the original features."""
        values = _positive_class(self._explainer.shap_values(matrix))
        encoded = pd.DataFrame(values, index=matrix.index, columns=matrix.columns)
        return encoded.T.groupby(self._origins, sort=False).sum().T

    def shap_values_background(self) -> pd.DataFrame:
        """SHAP values of the training rows (rows x original features)."""
        return self._matrix_shap(self.model.background)

    def shap_values(self, X: pd.DataFrame) -> pd.DataFrame:
        """SHAP values (rows x original features) for raw input rows."""
        return self._matrix_shap(self.model.pipeline[:-1].transform(X))

    def background_feature_values(self) -> pd.DataFrame:
        """Training rows on the original features (one-hot groups collapsed to a category
        index), aligned with ``_matrix_shap`` output; used to colour summary plots."""
        background = self.model.background
        columns = {}
        for origin in dict.fromkeys(self._origins[column] for column in background.columns):
            members = [column for column in background.columns if self._origins[column] == origin]
            columns[origin] = (
                background[members[0]]
                if len(members) == 1
                else background[members].to_numpy().argmax(axis=1)
            )
        return pd.DataFrame(columns, index=background.index)

    def global_importance(self) -> pd.Series:
        """Mean |SHAP| per original feature over the training rows, largest first."""
        return self.shap_values_background().abs().mean().sort_values(ascending=False)

    def explain(self, patient: pd.DataFrame, top_n: int = DEFAULT_TOP_N) -> Explanation:
        """Explain a single-row raw frame; contributions are sorted by absolute SHAP value."""
        shap_row = self.shap_values(patient).iloc[0]
        probability = float(self.model.predict_proba(patient)[0])
        total = shap_row.sum()
        scale = (probability - self.base_probability) / total if abs(total) > 1e-12 else 0.0
        contributions = [
            Contribution(
                feature=name,
                label=self._features[name].label,
                value=_plain(patient[name].iloc[0]),
                display_value=_display_value(self._features[name], patient[name].iloc[0]),
                shap_value=float(shap_row[name]),
                probability_impact=float(shap_row[name] * scale),
            )
            for name in shap_row.abs().sort_values(ascending=False).index
        ]
        positive = [c for c in contributions if c.shap_value > 0][:top_n]
        negative = [c for c in contributions if c.shap_value < 0][:top_n]
        return Explanation(
            self.model.target,
            probability,
            float(self.base_probability),
            self.shap_space,
            contributions,
            positive,
            negative,
        )


def load_explainers() -> dict[str, TargetExplainer]:
    """One explainer per target from the saved artifacts."""
    return {
        target: TargetExplainer(joblib.load(MODELS_DIR / f"{target.lower()}.joblib"))
        for target in TARGETS
    }


def _global_report(explainer: TargetExplainer, labels: dict[str, str]) -> list[dict[str, Any]]:
    return [
        {"feature": name, "label": labels[name], "mean_abs_shap": round(float(value), 4)}
        for name, value in explainer.global_importance().items()
    ]


def _print_example(explanation: Explanation) -> None:
    print(
        f"\n[{explanation.target}] p = {explanation.probability:.3f} "
        f"(baseline {explanation.base_probability:.3f}, SHAP in {explanation.shap_space})"
    )
    for title, items in (
        ("raises", explanation.top_positive),
        ("lowers", explanation.top_negative),
    ):
        for c in items:
            print(
                f"  {title}  {c.label:<28} = {c.display_value:<14} "
                f"shap {c.shap_value:+.3f}  prob {c.probability_impact:+.3f}"
            )


def main() -> None:
    """Write global SHAP reports/plots and print one held-out patient's local explanation."""
    frame = load_raw()
    _, test = holdout_split(frame, SEED)
    patient = frame.iloc[[test[0]]]
    labels = {name: feature.label for name, feature in load_schema().by_name().items()}
    report = {}
    for target, explainer in load_explainers().items():
        report[target] = _global_report(explainer, labels)
        stem = plots.PLOTS_DIR / target.lower()
        plots.plot_shap_importance(target, report[target], Path(f"{stem}_shap_importance.png"))
        plots.plot_shap_summary(
            target,
            explainer.shap_values_background(),
            explainer.background_feature_values(),
            labels,
            Path(f"{stem}_shap_summary.png"),
        )
        _print_example(explainer.explain(patient))
        print(
            "  global top 5: "
            + ", ".join(
                f"{item['label']} ({item['mean_abs_shap']:.3f})" for item in report[target][:5]
            )
        )
    SHAP_GLOBAL_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(f"\nexample patient: dataset row {test[0]} (held-out test set)")
    print(f"wrote {SHAP_GLOBAL_PATH.name} and SHAP plots")


if __name__ == "__main__":
    main()
