"""Model-backed operations behind the HTTP routes. Built once at startup."""

import json
from dataclasses import asdict
from typing import Any

import numpy as np
import pandas as pd

from api import schemas
from api.settings import DISCLAIMER, RISK_BANDS
from ml.config import MODELS_DIR, REPORTS_DIR, TARGETS
from ml.data import load_raw
from ml.derived import DERIVED_FEATURES, with_derived
from ml.explain import TargetExplainer, load_explainers
from ml.schema import FeatureSchema, load_schema

EXAMPLE_SOURCE = "Held-out test patients (never used for training), chosen by predicted CAD risk"


def _risk_band(probability: float) -> str:
    return next(band["id"] for band in reversed(RISK_BANDS) if probability >= band["min"])


def _plain(value: Any) -> schemas.Scalar:
    return value.item() if isinstance(value, np.generic) else value


class PredictionService:
    """Holds the loaded models and answers every API question about them."""

    def __init__(self) -> None:
        self.schema: FeatureSchema = load_schema()
        derived = {feature.name for feature in self.schema.features if feature.derived}
        if derived != set(DERIVED_FEATURES):
            raise RuntimeError(f"Schema derived features {derived} lack an implementation")
        self.explainers: dict[str, TargetExplainer] = load_explainers()
        self.manifest = json.loads((MODELS_DIR / "manifest.json").read_text())
        self.metrics = json.loads((REPORTS_DIR / "metrics.json").read_text())
        self.global_importance = json.loads((REPORTS_DIR / "shap_global.json").read_text())
        self.patient_model = schemas.build_patient_model(self.schema)
        self.input_names = [f.name for f in self.schema.features if not f.derived]
        self.examples = self._build_examples()

    def schema_response(self) -> schemas.SchemaResponse:
        defaults = self.manifest["feature_defaults"]
        features = [
            schemas.FeatureOut(
                name=f.name,
                label=f.label,
                group=f.group,
                type=f.kind,
                unit=f.unit,
                min=f.minimum,
                max=f.maximum,
                step=f.step,
                options=[schemas.OptionOut(**asdict(option)) for option in f.options],
                description=f.description,
                derived=f.derived,
                default=defaults[f.name],
            )
            for f in self.schema.features
        ]
        targets = [
            schemas.TargetOut(
                name=name,
                description=spec.description,
                scope=spec.scope,
                positive_label=spec.positive_label,
                negative_label=spec.negative_label,
                model=self.explainers[name].model.model_name,
                threshold=self.explainers[name].model.threshold,
            )
            for name, spec in TARGETS.items()
        ]
        groups = [
            schemas.GroupOut(id=key, label=label) for key, label in self.schema.groups.items()
        ]
        return schemas.SchemaResponse(
            groups=groups,
            features=features,
            targets=targets,
            risk_bands=[schemas.RiskBand(**band) for band in RISK_BANDS],
            disclaimer=DISCLAIMER,
        )

    def predict(self, features: dict[str, schemas.Scalar], top_n: int) -> schemas.PredictResponse:
        """Predict and explain every target for one validated patient."""
        patient = with_derived(pd.DataFrame([features]))
        predictions = {
            name: self._predict_target(name, explainer, patient, top_n)
            for name, explainer in self.explainers.items()
        }
        inputs = {name: _plain(patient[name].iloc[0]) for name in self.schema.names()}
        return schemas.PredictResponse(
            predictions=predictions, features=inputs, disclaimer=DISCLAIMER
        )

    def _predict_target(
        self, name: str, explainer: TargetExplainer, patient: pd.DataFrame, top_n: int
    ) -> schemas.TargetPrediction:
        explanation = explainer.explain(patient, top_n)
        threshold = explainer.model.threshold
        positive = explanation.probability >= threshold
        spec = TARGETS[name]
        return schemas.TargetPrediction(
            probability=explanation.probability,
            positive=positive,
            label=spec.positive_label if positive else spec.negative_label,
            threshold=threshold,
            risk_band=_risk_band(explanation.probability),
            base_probability=explanation.base_probability,
            shap_space=explanation.shap_space,
            contributions=explanation.contributions,
            top_positive=explanation.top_positive,
            top_negative=explanation.top_negative,
        )

    def _build_examples(self) -> list[schemas.ExamplePatient]:
        """Three real held-out patients: lowest, closest-to-threshold and highest CAD risk."""
        frame = load_raw()
        test = frame.iloc[self.manifest["test_row_indices"]]
        cad = self.explainers["CAD"].model
        risk = pd.Series(cad.predict_proba(test), index=test.index)
        picks = {
            "low": ("Low predicted risk", risk.idxmin()),
            "borderline": ("Borderline predicted risk", (risk - cad.threshold).abs().idxmin()),
            "high": ("High predicted risk", risk.idxmax()),
        }
        return [
            schemas.ExamplePatient(
                id=key,
                label=label,
                dataset_row=int(row),
                features={name: _plain(frame.loc[row, name]) for name in self.input_names},
                actual={name: frame.loc[row, spec.column] for name, spec in TARGETS.items()},
                predicted_cad_probability=float(risk[row]),
            )
            for key, (label, row) in picks.items()
        ]
