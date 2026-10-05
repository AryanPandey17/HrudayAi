"""HTTP layer: routing, validation and error formatting. Run with ``uvicorn api.main:app``."""

from contextlib import asynccontextmanager
from typing import Annotated, Any

from fastapi import Body, FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from api import schemas
from api.service import EXAMPLE_SOURCE, PredictionService
from api.settings import CORS_ORIGINS, DEFAULT_TOP_N, MAX_TOP_N


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load every model, explainer and report once, before serving."""
    app.state.service = PredictionService()
    yield


app = FastAPI(
    title="CardioVis API",
    description="CAD and LAD / LCX / RCA stenosis probabilities with SHAP explanations. "
    "Decision support / educational use only.",
    version="0.1.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["GET", "POST"], allow_headers=["*"]
)


def _service(request: Request) -> PredictionService:
    return request.app.state.service


def _field_errors(errors: list[dict[str, Any]]) -> list[schemas.FieldError]:
    """Pydantic errors -> one readable message per offending field."""
    formatted = []
    for error in errors:
        location = [str(part) for part in error["loc"] if part not in ("body", "query")]
        message = error["msg"].removeprefix("Value error, ")
        if error["type"] == "extra_forbidden":
            message = "Unknown feature; it is not a model input"
        formatted.append(schemas.FieldError(field=".".join(location) or "body", message=message))
    return formatted


def _validation_response(errors: list[dict[str, Any]]) -> JSONResponse:
    body = schemas.ValidationErrorResponse(
        detail="Invalid patient features", errors=_field_errors(errors)
    )
    return JSONResponse(status_code=422, content=body.model_dump())


@app.exception_handler(RequestValidationError)
async def request_validation_handler(_: Request, error: RequestValidationError) -> JSONResponse:
    return _validation_response(error.errors())


@app.get("/health")
def health(request: Request) -> schemas.HealthResponse:
    service = _service(request)
    models = {name: explainer.model.model_name for name, explainer in service.explainers.items()}
    return schemas.HealthResponse(
        status="ok", models=models, n_input_features=len(service.schema.features)
    )


@app.get("/schema")
def feature_schema(request: Request) -> schemas.SchemaResponse:
    """Everything needed to build the input form and label the outputs."""
    return _service(request).schema_response()


@app.post("/predict", responses={422: {"model": schemas.ValidationErrorResponse}})
def predict(
    request: Request,
    features: Annotated[dict[str, Any], Body(description="Feature name -> value; see /schema")],
    top_n: Annotated[int, Query(ge=1, le=MAX_TOP_N)] = DEFAULT_TOP_N,
) -> schemas.PredictResponse:
    """Calibrated probabilities and SHAP contributions for CAD, LAD, LCX and RCA."""
    service = _service(request)
    try:
        patient = service.patient_model.model_validate(features)
    except ValidationError as error:
        return _validation_response(error.errors())
    return service.predict(patient.model_dump(by_alias=True), top_n)


@app.get("/metrics")
def metrics(request: Request) -> schemas.MetricsResponse:
    """Saved evaluation results and global SHAP importance, exactly as written by training."""
    service = _service(request)
    return schemas.MetricsResponse(
        metrics=service.metrics, global_importance=service.global_importance
    )


@app.get("/examples")
def examples(request: Request) -> schemas.ExamplesResponse:
    """Real sample patients for the 'load example' selector."""
    return schemas.ExamplesResponse(source=EXAMPLE_SOURCE, examples=_service(request).examples)
