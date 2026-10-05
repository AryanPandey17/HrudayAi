"""Single source of truth for paths, the random seed, and target / leakage definitions."""

from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
RAW_DATA_PATH = REPO_ROOT / "data" / "raw" / "z_alizadeh_sani_extension.xlsx"
MODELS_DIR = REPO_ROOT / "models"
REPORTS_DIR = REPO_ROOT / "reports"

SEED = 42
EXPECTED_ROWS = 303


@dataclass(frozen=True)
class TargetSpec:
    """A binary prediction target read from one raw column."""

    name: str
    column: str
    positive_label: str
    negative_label: str
    description: str


# Adding a vessel (or any other binary target) means adding one entry here.
TARGETS: dict[str, TargetSpec] = {
    spec.name: spec
    for spec in (
        TargetSpec("CAD", "Cath", "CAD", "Normal", "Overall coronary artery disease"),
        TargetSpec("LAD", "LAD", "Stenotic", "Normal", "Left anterior descending stenosis"),
        TargetSpec("LCX", "LCX", "Stenotic", "Normal", "Left circumflex stenosis"),
        TargetSpec("RCA", "RCA", "Stenotic", "Normal", "Right coronary artery stenosis"),
    )
}

# Angiography-derived columns. They are targets (or define one) and must never be model inputs.
LEAKAGE_COLUMNS: frozenset[str] = frozenset(spec.column for spec in TARGETS.values())
