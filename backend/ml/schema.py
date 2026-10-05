"""Typed access to ``feature_schema.json``, the single definition of every model input.

Adding or changing an input feature means editing the JSON file only: preprocessing, the API
request model and the frontend form are all derived from it.
"""

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

SCHEMA_PATH = Path(__file__).with_name("feature_schema.json")

FeatureKind = Literal["numeric", "binary", "ordinal", "categorical"]
CODED_KINDS: frozenset[str] = frozenset({"binary", "ordinal"})


@dataclass(frozen=True)
class Option:
    """One allowed raw value of a non-numeric feature and its display label."""

    value: str | int
    label: str


@dataclass(frozen=True)
class FeatureSpec:
    """One model input. ``options`` order defines the integer code of binary/ordinal values."""

    name: str
    label: str
    group: str
    kind: FeatureKind
    unit: str | None = None
    minimum: float | None = None
    maximum: float | None = None
    step: float | None = None
    options: tuple[Option, ...] = ()
    description: str | None = None

    @property
    def codes(self) -> dict[str | int, int]:
        """Raw value -> integer code (position in ``options``)."""
        return {option.value: code for code, option in enumerate(self.options)}

    @property
    def values(self) -> tuple[str | int, ...]:
        return tuple(option.value for option in self.options)


@dataclass(frozen=True)
class FeatureSchema:
    """All input features, their display groups, and columns deliberately left out."""

    groups: dict[str, str]
    features: tuple[FeatureSpec, ...]
    excluded: dict[str, str]

    def names(self, *kinds: FeatureKind) -> list[str]:
        """Feature names in schema order, optionally restricted to the given kinds."""
        return [f.name for f in self.features if not kinds or f.kind in kinds]

    def by_name(self) -> dict[str, FeatureSpec]:
        return {feature.name: feature for feature in self.features}


@lru_cache(maxsize=1)
def load_schema(path: Path = SCHEMA_PATH) -> FeatureSchema:
    """Parse and validate the schema file."""
    raw = json.loads(path.read_text(encoding="utf-8"))
    groups = {group["id"]: group["label"] for group in raw["groups"]}
    features = tuple(_parse_feature(item, raw["option_sets"]) for item in raw["features"])
    _validate(features, groups)
    return FeatureSchema(groups=groups, features=features, excluded=dict(raw["excluded"]))


def _parse_feature(item: dict[str, Any], option_sets: dict[str, list[dict]]) -> FeatureSpec:
    options = item.get("options", [])
    if isinstance(options, str):
        options = option_sets[options]
    return FeatureSpec(
        name=item["name"],
        label=item["label"],
        group=item["group"],
        kind=item["type"],
        unit=item.get("unit"),
        minimum=item.get("min"),
        maximum=item.get("max"),
        step=item.get("step"),
        options=tuple(Option(option["value"], option["label"]) for option in options),
        description=item.get("description"),
    )


def _validate(features: tuple[FeatureSpec, ...], groups: dict[str, str]) -> None:
    names = [feature.name for feature in features]
    if len(names) != len(set(names)):
        raise ValueError("Duplicate feature names in schema")
    for feature in features:
        if feature.group not in groups:
            raise ValueError(f"{feature.name}: unknown group '{feature.group}'")
        if feature.kind == "numeric":
            if feature.minimum is None or feature.maximum is None:
                raise ValueError(f"{feature.name}: numeric features need min and max")
        elif len(feature.options) < 2 or (feature.kind == "binary" and len(feature.options) != 2):
            raise ValueError(f"{feature.name}: invalid options for kind '{feature.kind}'")
