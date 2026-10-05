"""Shared fixtures."""

import pandas as pd
import pytest

from ml.data import load_raw
from ml.schema import FeatureSchema, load_schema


@pytest.fixture(scope="session")
def raw() -> pd.DataFrame:
    return load_raw()


@pytest.fixture(scope="session")
def schema() -> FeatureSchema:
    return load_schema()
