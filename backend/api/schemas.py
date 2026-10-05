"""Request / response models. The patient input model is generated from the feature schema."""

import re
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, create_model

from ml.explain import Contribution
from ml.schema import FeatureSchema, FeatureSpec

Scalar = str | int | float


def _field_name(feature_name: str) -> str:
    """Valid Python identifier for a raw column name (the raw name stays the JSON key)."""
    return re.sub(r"\W+", "_", feature_name).strip("_").lower()


def _field(feature: FeatureSpec) -> tuple[Any, Any]:
    if feature.kind == "numeric":
        bounds = Field(None, alias=feature.name, ge=feature.minimum, le=feature.maximum)
        return float | None, bounds
    return Literal[feature.values] | None, Field(None, alias=feature.name)


def build_patient_model(schema: FeatureSchema) -> type[BaseModel]:
    """Pydantic model with one optional, range/option-checked field per non-derived feature.

    Fields are optional because the test ladder accepts partial input; which fields a stage
    needs is checked separately. Unknown keys are rejected, so angiography columns (LAD, LCX,
    RCA, Cath) cannot be sent.
    """
    fields = {_field_name(f.name): _field(f) for f in schema.features if not f.derived}
    return create_model("PatientFeatures", __config__=ConfigDict(extra="forbid"), **fields)


class OptionOut(BaseModel):
    value: str | int
    label: str


class FeatureOut(BaseModel):
    name: str
    label: str
    group: str
    type: str
    unit: str | None
    min: float | None
    max: float | None
    step: float | None
    options: list[OptionOut]
    description: str | None
    derived: bool
    default: Scalar
    stage: int = Field(description="First ladder stage at which this feature is used")


class GroupOut(BaseModel):
    id: str
    label: str


class TargetOut(BaseModel):
    name: str
    description: str
    scope: Literal["overall", "vessel"]
    positive_label: str
    negative_label: str
    model: str
    threshold: float


class RiskBand(BaseModel):
    id: str
    label: str
    min: float


class SchemaResponse(BaseModel):
    groups: list[GroupOut]
    features: list[FeatureOut]
    targets: list[TargetOut]
    risk_bands: list[RiskBand]
    disclaimer: str


class Interval(BaseModel):
    """Percentile interval of the probability over bootstrap refits of the stage model."""

    low: float
    high: float
    lower_percentile: int
    upper_percentile: int
    n_bootstrap: int


class StageInfo(BaseModel):
    id: int
    key: str
    label: str


class StageMetrics(BaseModel):
    """Saved validation results of the stage model that produced a prediction."""

    cv_roc_auc: dict[str, float]
    cv_f1: dict[str, float]
    cv_brier: dict[str, float]
    test_roc_auc: float
    test_roc_auc_ci95: list[float]


class TargetPrediction(BaseModel):
    """Calibrated prediction and SHAP explanation for one target."""

    probability: float
    interval: Interval
    positive: bool
    label: str
    threshold: float
    risk_band: str
    base_probability: float = Field(description="Probability at the average training score")
    shap_space: str
    contributions: list[Contribution]
    top_positive: list[Contribution]
    top_negative: list[Contribution]
    stage_metrics: StageMetrics


class PredictResponse(BaseModel):
    stage: StageInfo
    stage_selection: Literal["requested", "highest_complete"]
    ignored_features: list[str] = Field(
        description="Provided inputs that belong to a later, incomplete stage and were not used"
    )
    missing_for_next_stage: list[str] = Field(
        description="Inputs still needed to reach the next stage; empty at the last stage"
    )
    predictions: dict[str, TargetPrediction]
    features: dict[str, Scalar] = Field(description="Model inputs used, including derived features")
    disclaimer: str


class LadderStage(BaseModel):
    id: int
    key: str
    label: str
    groups: list[str]
    added_features: list[str] = Field(description="Inputs first required at this stage")
    required_features: list[str] = Field(description="All inputs required at this stage")
    n_model_features: int


class LadderResponse(BaseModel):
    stages: list[LadderStage]
    meta: dict[str, Any]
    metrics: dict[str, Any] = Field(description="reports/ladder_metrics.json, per target and stage")


class ExamplePatient(BaseModel):
    id: str
    label: str
    dataset_row: int
    features: dict[str, Scalar]
    actual: dict[str, str] = Field(description="Angiography labels from the dataset")
    predicted_cad_probability: float


class ExamplesResponse(BaseModel):
    source: str
    examples: list[ExamplePatient]


class HealthResponse(BaseModel):
    status: Literal["ok"]
    models: dict[str, str]
    n_input_features: int


class MetricsResponse(BaseModel):
    metrics: dict[str, Any]
    global_importance: dict[str, list[dict[str, Any]]]


class FieldError(BaseModel):
    field: str
    message: str


class ValidationErrorResponse(BaseModel):
    detail: str
    errors: list[FieldError]
