"""Runtime settings and fixed UI-facing constants."""

import os

APP_NAME = "HrudayAI"

DEFAULT_CORS_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000"
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", DEFAULT_CORS_ORIGINS).split(",")]

DISCLAIMER = (
    "For decision support and educational purposes only. Predictions come from a model trained "
    "on 303 patients and are not a substitute for formal diagnostic imaging or clinical judgement."
)

# Display bands for colouring only; they are not clinical risk categories.
RISK_BANDS = (
    {"id": "low", "label": "Low", "min": 0.0},
    {"id": "moderate", "label": "Moderate", "min": 1 / 3},
    {"id": "high", "label": "High", "min": 2 / 3},
)

DEFAULT_TOP_N = 5
MAX_TOP_N = 20
