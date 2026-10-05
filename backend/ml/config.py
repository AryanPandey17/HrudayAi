"""Single source of truth for paths, the random seed, and target / leakage definitions."""

from dataclasses import dataclass
from pathlib import Path
from typing import Literal

REPO_ROOT = Path(__file__).resolve().parents[2]
RAW_DATA_PATH = REPO_ROOT / "data" / "raw" / "z_alizadeh_sani_extension.xlsx"
MODELS_DIR = REPO_ROOT / "models"
LADDER_DIR = MODELS_DIR / "ladder"
REPORTS_DIR = REPO_ROOT / "reports"

SEED = 42
EXPECTED_ROWS = 303

# Validation design: one stratified hold-out, repeated stratified K-fold on the rest.
TEST_FRACTION = 0.2
CV_SPLITS = 5
CV_REPEATS = 5
CALIBRATION_SPLITS = 5

# Test ladder: bootstrap refits per stage model and the percentile interval reported from them.
N_BOOTSTRAP = 200
INTERVAL_PERCENTILES = (10, 90)


@dataclass(frozen=True)
class TargetSpec:
    """A binary prediction target read from one raw column."""

    name: str
    column: str
    positive_label: str
    negative_label: str
    description: str
    scope: Literal["overall", "vessel"]


# Adding a vessel (or any other binary target) means adding one entry here.
TARGETS: dict[str, TargetSpec] = {
    spec.name: spec
    for spec in (
        TargetSpec("CAD", "Cath", "CAD", "Normal", "Overall coronary artery disease", "overall"),
        TargetSpec(
            "LAD", "LAD", "Stenotic", "Normal", "Left anterior descending stenosis", "vessel"
        ),
        TargetSpec("LCX", "LCX", "Stenotic", "Normal", "Left circumflex stenosis", "vessel"),
        TargetSpec("RCA", "RCA", "Stenotic", "Normal", "Right coronary artery stenosis", "vessel"),
    )
}

# Angiography-derived columns. They are targets (or define one) and must never be model inputs.
LEAKAGE_COLUMNS: frozenset[str] = frozenset(spec.column for spec in TARGETS.values())
