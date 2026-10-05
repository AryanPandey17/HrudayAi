"""Model-backed operations behind the HTTP routes. Built once at startup."""

import json
from dataclasses import asdict
from typing import Any

import numpy as np
import pandas as pd

from api import schemas
from api.settings import DISCLAIMER, RISK_BANDS
from ml.config import INTERVAL_PERCENTILES, MODELS_DIR, REPORTS_DIR, TARGETS
from ml.data import load_raw
from ml.derived import DERIVED_FEATURES, with_derived
from ml.explain import TargetExplainer, load_explainers
from ml.ladder_model import LadderModel, load_ladder
from ml.schema import FeatureSchema, Stage, load_schema

EXAMPLE_SOURCE = "Held-out test patients (never used for training), chosen by predicted CAD risk"


def _risk_band(probability: float) -> str:
    return next(band["id"] for band in reversed(RISK_BANDS) if probability >= band["min"])


def _plain(value: Any) -> schemas.Scalar:
    return value.item() if isinstance(value, np.generic) else value


class StageInputError(ValueError):
    """The provided inputs do not satisfy the requested (or the first) ladder stage."""

    def __init__(self, stage: Stage, missing: list[str]):
        super().__init__(f"Stage {stage.id} ({stage.label}) needs {len(missing)} more input(s)")
        self.stage = stage
        self.missing = missing


class UnknownStageError(ValueError):
    """The requested stage id is not defined in the schema."""


class PredictionService:
    """Holds the loaded models and answers every API question about them."""

    def __init__(self) -> None:
        self.schema: FeatureSchema = load_schema()
        derived = {feature.name for feature in self.schema.features if feature.derived}
        if derived != set(DERIVED_FEATURES):
            raise RuntimeError(f"Schema derived features {derived} lack an implementation")
        self.explainers: dict[str, TargetExplainer] = load_explainers()
        self.ladder: dict[str, dict[int, LadderModel]] = load_ladder()
        self.ladder_explainers = {
            target: {stage: TargetExplainer(item.model) for stage, item in stages.items()}
            for target, stages in self.ladder.items()
        }
        self.ladder_metrics = json.loads((REPORTS_DIR / "ladder_metrics.json").read_text())
        self.stage_inputs = {
            stage.id: [f.name for f in self.schema.stage_features(stage.id) if not f.derived]
            for stage in self.schema.stages
        }
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
                stage=next(s.id for s in self.schema.stages if f.group in s.groups),
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

    def ladder_response(self) -> schemas.LadderResponse:
        """Stage definitions and saved per-stage validation results."""
        stages = []
        for stage in self.schema.stages:
            required = self.stage_inputs[stage.id]
            earlier = set(self.stage_inputs.get(stage.id - 1, []))
            stages.append(
                schemas.LadderStage(
                    id=stage.id,
                    key=stage.key,
                    label=stage.label,
                    groups=list(stage.groups),
                    added_features=[name for name in required if name not in earlier],
                    required_features=required,
                    n_model_features=len(self.schema.stage_features(stage.id)),
                )
            )
        return schemas.LadderResponse(
            stages=stages, meta=self.ladder_metrics["meta"], metrics=self.ladder_metrics["targets"]
        )

    def _resolve_stage(self, provided: set[str], requested: int | None) -> Stage:
        """The requested stage, or the highest stage whose inputs are all present."""
        stages = {stage.id: stage for stage in self.schema.stages}
        if requested is not None and requested not in stages:
            raise UnknownStageError(f"Unknown stage {requested}; valid stages: {sorted(stages)}")
        if requested is not None:
            candidates = [stages[requested]]
        else:
            candidates = sorted(stages.values(), key=lambda stage: -stage.id)
        for stage in candidates:
            if provided.issuperset(self.stage_inputs[stage.id]):
                return stage
        lowest = candidates[-1]
        missing = [name for name in self.stage_inputs[lowest.id] if name not in provided]
        raise StageInputError(lowest, missing)

    def predict(
        self, features: dict[str, schemas.Scalar | None], stage_id: int | None, top_n: int
    ) -> schemas.PredictResponse:
        """Predict and explain every target at one ladder stage for a validated patient."""
        provided = {name: value for name, value in features.items() if value is not None}
        stage = self._resolve_stage(set(provided), stage_id)
        used = self.stage_inputs[stage.id]
        patient = with_derived(pd.DataFrame([{name: provided[name] for name in used}]))
        stage_features = [feature.name for feature in self.schema.stage_features(stage.id)]
        next_inputs = self.stage_inputs.get(stage.id + 1, [])
        return schemas.PredictResponse(
            stage=schemas.StageInfo(id=stage.id, key=stage.key, label=stage.label),
            stage_selection="requested" if stage_id is not None else "highest_complete",
            ignored_features=[name for name in provided if name not in used],
            missing_for_next_stage=[name for name in next_inputs if name not in provided],
            predictions={
                target: self._predict_target(target, stage.id, patient, top_n) for target in TARGETS
            },
            features={name: _plain(patient[name].iloc[0]) for name in stage_features},
            disclaimer=DISCLAIMER,
        )

    def _stage_metrics(self, target: str, stage_id: int) -> schemas.StageMetrics:
        report = self.ladder_metrics["targets"][target]["stages"][str(stage_id)]
        return schemas.StageMetrics(
            cv_roc_auc=report["cv"]["roc_auc"],
            cv_f1=report["cv"]["f1"],
            cv_brier=report["cv"]["brier"],
            test_roc_auc=report["test"]["at_selected_threshold"]["roc_auc"],
            test_roc_auc_ci95=report["test"]["roc_auc_ci95"],
        )

    def _predict_target(
        self, target: str, stage_id: int, patient: pd.DataFrame, top_n: int
    ) -> schemas.TargetPrediction:
        ladder_model = self.ladder[target][stage_id]
        explanation = self.ladder_explainers[target][stage_id].explain(patient, top_n)
        low, high = ladder_model.predict_interval(patient)[0]
        threshold = ladder_model.model.threshold
        positive = explanation.probability >= threshold
        spec = TARGETS[target]
        return schemas.TargetPrediction(
            probability=explanation.probability,
            interval=schemas.Interval(
                low=low,
                high=high,
                lower_percentile=INTERVAL_PERCENTILES[0],
                upper_percentile=INTERVAL_PERCENTILES[1],
                n_bootstrap=ladder_model.boot_coef.shape[0],
            ),
            positive=positive,
            label=spec.positive_label if positive else spec.negative_label,
            threshold=threshold,
            risk_band=_risk_band(explanation.probability),
            base_probability=explanation.base_probability,
            shap_space=explanation.shap_space,
            contributions=explanation.contributions,
            top_positive=explanation.top_positive,
            top_negative=explanation.top_negative,
            stage_metrics=self._stage_metrics(target, stage_id),
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
