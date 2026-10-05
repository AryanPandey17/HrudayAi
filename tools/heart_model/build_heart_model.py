"""Build ``frontend/public/models/heart.glb`` from BodyParts3D meshes.

Source: BodyParts3D release 3.0 (Database Center for Life Science), licensed CC BY-SA 2.1 Japan,
as mirrored at https://github.com/Kevin-Mattheus-Moerman/BodyParts3D (assets/BodyParts3D_data/stl).
The output is a derivative work and carries the same licence; see NOTICE.md.

Run from the repo root (no project dependency is added):

    uv run --with trimesh --with fast-simplification --with numpy \
        python tools/heart_model/build_heart_model.py <path-to-BodyParts3D-stl-dir>

then compress with ``npx @gltf-transform/cli meshopt`` (see the Makefile target ``heart-model``).

Every coronary vessel is one named mesh whose name equals a model target (LAD, LCX, RCA), so
the viewer maps predictions to anatomy by name.
"""

import sys
from pathlib import Path

import fast_simplification
import numpy as np
import trimesh

OUTPUT = Path(__file__).resolve().parents[2] / "frontend" / "public" / "models" / "heart_raw.glb"

Box = tuple[tuple[float, float, float], tuple[float, float, float]]

# Regions kept around the heart, in BodyParts3D millimetres (x: patient left, y: posterior, z: up).
# The pulmonary vessels are whole lung trees in the source; only their trunks near the heart
# are kept, otherwise dozens of fine branches clutter the view.
HEART_BOX: Box = ((-46.0, -182.0, 1176.0), (88.0, -58.0, 1338.0))
PULMONARY_ARTERY_BOX: Box = ((-40.0, -178.0, 1262.0), (78.0, -70.0, 1338.0))
PULMONARY_VEIN_BOX: Box = ((-34.0, -128.0, 1228.0), (74.0, -60.0, 1292.0))

# Output mesh name -> (FMA part ids to merge, triangle budget or None to keep, crop box or None)
PARTS: dict[str, tuple[list[str], int | None, Box | None]] = {
    "heart_wall": (["FMA7274"], 42000, None),
    "aorta": (["FMA3736", "FMA3768", "FMA3784"], 3500, HEART_BOX),
    "pulmonary_arteries": (["FMA66326"], 5000, PULMONARY_ARTERY_BOX),
    "pulmonary_veins": (["FMA66643"], 4000, PULMONARY_VEIN_BOX),
    "venae_cavae": (["FMA4720", "FMA10951"], 2000, HEART_BOX),
    "left_main": (["FMA4685"], None, None),
    # Anterior interventricular branch (+ its septal branches)
    "LAD": (["FMA3862nsn", "FMA71670"], 6000, None),
    # Circumflex branch
    "LCX": (["FMA3895"], None, None),
    # Trunk, marginal, posterior interventricular, posterolateral and septal branches
    "RCA": (["FMA3802", "FMA3818", "FMA3840nsn", "FMA76994", "FMA71669"], 9000, None),
}

# After cropping, pieces smaller than this share of the largest piece are stray branch stubs.
MIN_FRAGMENT_SHARE = 0.12
TARGET_HEIGHT = 2.5  # heart wall height in scene units


def load(stl_dir: Path, part_ids: list[str]) -> trimesh.Trimesh:
    return trimesh.util.concatenate([trimesh.load(stl_dir / f"{part}.stl") for part in part_ids])


def crop(mesh: trimesh.Trimesh, box: Box) -> trimesh.Trimesh:
    """Keep faces fully inside ``box`` and drop tiny disconnected fragments."""
    inside = np.all((mesh.vertices >= np.array(box[0])) & (mesh.vertices <= np.array(box[1])), axis=1)
    kept = mesh.submesh([np.flatnonzero(inside[mesh.faces].all(axis=1))], append=True)
    pieces = kept.split(only_watertight=False)
    largest = max(len(piece.faces) for piece in pieces)
    return trimesh.util.concatenate(
        [piece for piece in pieces if len(piece.faces) >= MIN_FRAGMENT_SHARE * largest]
    )


def simplify(mesh: trimesh.Trimesh, budget: int | None) -> trimesh.Trimesh:
    if budget is None or len(mesh.faces) <= budget:
        return mesh
    vertices, faces = fast_simplification.simplify(
        mesh.vertices, mesh.faces, target_count=budget, agg=5
    )
    return trimesh.Trimesh(vertices, faces, process=True)


def to_scene_space(mesh: trimesh.Trimesh, centre: np.ndarray, scale: float) -> trimesh.Trimesh:
    """Millimetre body coordinates -> viewer coordinates (x: patient left, y: up, z: anterior)."""
    v = (mesh.vertices - centre) * scale
    mesh = trimesh.Trimesh(np.column_stack([v[:, 0], v[:, 2], -v[:, 1]]), mesh.faces, process=False)
    mesh.fix_normals()
    return mesh


def main(stl_dir: Path) -> None:
    wall = load(stl_dir, PARTS["heart_wall"][0])
    centre = wall.bounds.mean(axis=0)
    scale = TARGET_HEIGHT / (wall.bounds[1, 2] - wall.bounds[0, 2])

    scene = trimesh.Scene()
    total = 0
    for name, (part_ids, budget, box) in PARTS.items():
        mesh = load(stl_dir, part_ids)
        source_faces = len(mesh.faces)
        if box is not None:
            mesh = crop(mesh, box)
        mesh = to_scene_space(simplify(mesh, budget), centre, scale)
        mesh.vertex_normals  # computed here so the GLB carries smooth normals
        scene.add_geometry(mesh, node_name=name, geom_name=name)
        total += len(mesh.faces)
        print(f"{name:<20} {source_faces:>7} -> {len(mesh.faces):>6} triangles")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    scene.export(OUTPUT)
    print(f"total {total} triangles, scale {scale:.5f} per mm -> {OUTPUT}")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
