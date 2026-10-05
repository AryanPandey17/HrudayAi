"""Features computed from other inputs instead of being entered (flagged ``derived`` in the
schema). Applied to API input so a request can never carry an inconsistent BMI or obesity flag;
the training data already contains these columns."""

from collections.abc import Callable

import numpy as np
import pandas as pd

OBESITY_BMI_CUTOFF = 25


def _bmi(frame: pd.DataFrame) -> pd.Series:
    return frame["Weight"] / (frame["Length"] / 100) ** 2


def _obesity(frame: pd.DataFrame) -> np.ndarray:
    return np.where(_bmi(frame) > OBESITY_BMI_CUTOFF, "Y", "N")


DERIVED_FEATURES: dict[str, Callable[[pd.DataFrame], pd.Series | np.ndarray]] = {
    "BMI": _bmi,
    "Obesity": _obesity,
}


def with_derived(frame: pd.DataFrame) -> pd.DataFrame:
    """Copy of ``frame`` with every derived feature (re)computed."""
    return frame.assign(**{name: compute(frame) for name, compute in DERIVED_FEATURES.items()})
