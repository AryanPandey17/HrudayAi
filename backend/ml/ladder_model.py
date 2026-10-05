"""The saved test-ladder artifact. Kept apart from the training entrypoint so pickles always
reference ``ml.ladder_model`` and never ``__main__``."""

from dataclasses import dataclass
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from scipy.special import expit

from ml.calibration import CalibratedModel
from ml.config import INTERVAL_PERCENTILES, LADDER_DIR, TARGETS
from ml.schema import load_schema


@dataclass
class LadderModel:
    """A stage model plus its bootstrap refits.

    ``boot_coef`` / ``boot_intercept`` give each refit's *calibrated* log-odds as a linear
    function of the stage model's preprocessed matrix (Platt scaling already folded in).
    """

    stage: int
    model: CalibratedModel
    boot_coef: np.ndarray
    boot_intercept: np.ndarray

    def predict_interval(self, X: pd.DataFrame) -> np.ndarray:
        """Per-row (low, high) percentile interval of the bootstrap probabilities."""
        matrix = self.model.pipeline[:-1].transform(X).to_numpy()
        probabilities = expit(matrix @ self.boot_coef.T + self.boot_intercept)
        return np.percentile(probabilities, INTERVAL_PERCENTILES, axis=1).T


def ladder_path(target: str, stage: int) -> Path:
    return LADDER_DIR / f"{target.lower()}_stage{stage}.joblib"


def load_ladder() -> dict[str, dict[int, LadderModel]]:
    """Every saved stage model, keyed by target then stage id."""
    stages = [stage.id for stage in load_schema().stages]
    return {t: {s: joblib.load(ladder_path(t, s)) for s in stages} for t in TARGETS}
