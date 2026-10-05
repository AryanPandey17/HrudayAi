"""Dataset audit: shape, dtypes, missing values, cardinality and class balance.

Run with ``python -m ml.audit``. Writes ``reports/data_audit.json`` and prints a summary.
"""

import json
from typing import Any

import pandas as pd

from ml.config import LEAKAGE_COLUMNS, REPORTS_DIR, TARGETS
from ml.data import feature_columns, load_raw, target_series

AUDIT_PATH = REPORTS_DIR / "data_audit.json"
MAX_LISTED_VALUES = 8


def audit(frame: pd.DataFrame) -> dict[str, Any]:
    """Collect all audit facts for a raw frame as a JSON-serialisable dict."""
    features = feature_columns(frame)
    return {
        "shape": {"rows": int(frame.shape[0]), "columns": int(frame.shape[1])},
        "n_features": len(features),
        "leakage_columns_present": sorted(LEAKAGE_COLUMNS & set(frame.columns)),
        "dtype_counts": {str(k): int(v) for k, v in frame.dtypes.value_counts().items()},
        "missing_total": int(frame.isna().sum().sum()),
        "missing_by_column": {c: int(n) for c, n in frame.isna().sum().items() if n > 0},
        "duplicate_rows": int(frame.duplicated().sum()),
        "duplicate_feature_rows": int(frame[features].duplicated().sum()),
        "constant_columns": [c for c in frame.columns if frame[c].nunique(dropna=False) <= 1],
        "columns": {c: _describe_column(frame[c]) for c in frame.columns},
        "class_balance": {name: _class_balance(frame, name) for name in TARGETS},
        "vessels_vs_cad": _vessel_consistency(frame),
    }


def _describe_column(series: pd.Series) -> dict[str, Any]:
    info: dict[str, Any] = {
        "dtype": str(series.dtype),
        "n_unique": int(series.nunique(dropna=False)),
        "n_missing": int(series.isna().sum()),
    }
    if info["n_unique"] <= MAX_LISTED_VALUES:
        counts = series.value_counts(dropna=False)
        info["value_counts"] = {str(value): int(n) for value, n in counts.items()}
    if pd.api.types.is_numeric_dtype(series):
        info["min"], info["max"] = float(series.min()), float(series.max())
        info["mean"] = round(float(series.mean()), 4)
    return info


def _class_balance(frame: pd.DataFrame, target: str) -> dict[str, Any]:
    labels = target_series(frame, target)
    positives = int(labels.sum())
    return {
        "column": TARGETS[target].column,
        "positive_label": TARGETS[target].positive_label,
        "positive": positives,
        "negative": int(len(labels) - positives),
        "positive_rate": round(positives / len(labels), 4),
    }


def _vessel_consistency(frame: pd.DataFrame) -> dict[str, int]:
    """How the overall CAD label relates to the three vessel labels."""
    cad = target_series(frame, "CAD").astype(bool)
    vessels = pd.concat([target_series(frame, v) for v in ("LAD", "LCX", "RCA")], axis=1)
    any_vessel = vessels.any(axis=1)
    counts = vessels.sum(axis=1).value_counts().sort_index()
    return {
        "cad_and_any_vessel": int((cad & any_vessel).sum()),
        "cad_without_any_vessel": int((cad & ~any_vessel).sum()),
        "any_vessel_without_cad": int((~cad & any_vessel).sum()),
        **{f"patients_with_{int(k)}_stenotic_vessels": int(n) for k, n in counts.items()},
    }


def _print_summary(report: dict[str, Any]) -> None:
    shape = report["shape"]
    print(f"shape: {shape['rows']} rows x {shape['columns']} columns")
    print(f"model input features: {report['n_features']}")
    print(f"leakage columns present: {report['leakage_columns_present']}")
    print(f"dtype counts: {report['dtype_counts']}")
    print(f"missing values: {report['missing_total']} {report['missing_by_column']}")
    print(
        f"duplicate rows: {report['duplicate_rows']} "
        f"(features only: {report['duplicate_feature_rows']})"
    )
    print(f"constant columns: {report['constant_columns']}")
    print("\ncolumn                   dtype     unique  values / range")
    for name, info in report["columns"].items():
        detail = info.get("value_counts") or f"[{info['min']:g}, {info['max']:g}]"
        print(f"{name:<24} {info['dtype']:<9} {info['n_unique']:>6}  {detail}")
    print("\nclass balance (positive / negative / positive rate):")
    for name, balance in report["class_balance"].items():
        print(
            f"  {name:<4} <- {balance['column']:<5} {balance['positive']:>4} / "
            f"{balance['negative']:>4} / {balance['positive_rate']:.1%}"
        )
    print(f"\nvessels vs CAD: {report['vessels_vs_cad']}")


def main() -> None:
    """Audit the raw dataset, save the JSON report and print a readable summary."""
    report = audit(load_raw())
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    AUDIT_PATH.write_text(json.dumps(report, indent=2) + "\n")
    _print_summary(report)
    print(f"\nsaved {AUDIT_PATH.relative_to(REPORTS_DIR.parent)}")


if __name__ == "__main__":
    main()
