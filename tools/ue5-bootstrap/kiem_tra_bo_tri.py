"""Offline data checks only. This does not mock or execute Unreal Engine APIs."""
import importlib.util
import json
import math
import platform
from pathlib import Path

here = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("hanoi_bootstrap", here / "dung_pho_hanoi.py")
bootstrap = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bootstrap)
plan = bootstrap.make_scene_plan()
nodes = plan["nodes"]
assert plan == bootstrap.make_scene_plan(), "Layout must be deterministic"
assert len({n["label"] for n in nodes}) == len(nodes), "Duplicate actor labels"
for node in nodes:
    assert node["kind"] in {*bootstrap.MESH_PATHS, "text", "spot"}
    assert all(math.isfinite(v) for v in node["pos"] + node["rot"])
    if node["kind"] in bootstrap.MESH_PATHS:
        assert all(math.isfinite(v) and v > 0 for v in node["size"])
        assert node["material"] in bootstrap.PALETTE
        if "HN_Leaf_Static" in node["tags"]:
            assert not node["collision"] and not node["shadow"]
            assert abs(node["pos"][1]) + max(node["size"]) / 2 < 460
    if node["kind"] == "text":
        assert node["text"].isascii(), "3D signs must not depend on an unavailable font atlas"
for rgb, roughness, metallic, emission in bootstrap.PALETTE.values():
    assert all(0 <= v <= 1 for v in rgb)
    assert 0 <= roughness <= 1 and 0 <= metallic <= 1 and emission >= 0
facades = [n for n in nodes if "HN_Facade" in n.get("tags", [])]
leaves = [n for n in nodes if "HN_Leaf_Static" in n.get("tags", [])]
spots = [n for n in nodes if n["kind"] == "spot"]
assert len(facades) == 8 and len(leaves) == 72 and len(spots) == 4
assert sum(n["shadows"] for n in spots) == 2
assert any(n["label"] == "Foundation" for n in nodes), "Prevent falling outside road slab"

def blocked(x, y, z=96, radius=42, half_height=96):
    # Conservative AABBs for unrotated collidable primitives; ground is excluded.
    for node in nodes:
        if not node.get("collision") or node["kind"] not in bootstrap.MESH_PATHS:
            continue
        px, py, pz = node["pos"]
        sx, sy, sz = node["size"]
        if pz + sz / 2 <= 30:
            continue
        assert node["rot"] == [0.0, 0.0, 0.0], "Update clearance check for rotated colliders"
        if (abs(x - px) < radius + sx / 2 and abs(y - py) < radius + sy / 2
                and abs(z - pz) < half_height + sz / 2):
            return node["label"]
    return None

x, y, z = plan["player_start"]["pos"]
assert not blocked(x, y, z), "PlayerStart obstructed"
for x in range(-2800, 2801, 20):
    assert not blocked(x, 0), "Central walking lane obstructed: %s" % blocked(x, 0)
result = dict(python=platform.python_version(), scope="syntax and pure scene data only",
              unreal_editor_executed=False, target_engine_reported_by_user="5.8.4",
              generated_nodes=len(nodes), facade_bodies=len(facades), static_leaves=len(leaves),
              spot_lights=len(spots), shadowed_spots=2, central_lane_checks=281,
              player_start_clear=True, deterministic=True,
              renderer_gameplay_packaging_gpu_fps_verified=False)
(here / "KIEM_CHUNG.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
print(json.dumps(result, ensure_ascii=False))
