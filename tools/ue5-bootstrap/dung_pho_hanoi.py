# -*- coding: utf-8 -*-
"""Ha Noi night-street blockout. Run in Unreal Editor, not system Python.

Requested engine: UE 5.8.4. Actual editor compatibility is checked at runtime;
this source has NOT been executed in Unreal by its author. No runtime gameplay
is generated. All created assets belong to a fresh, numbered content folder.
"""
import json
import math
import random
import re
import traceback
from pathlib import Path

VERSION = "0.1.0"
PREFIX = "/Game/HanoiNightShiftAuto"
MESH_PATHS = {
    "cube": "/Engine/BasicShapes/Cube.Cube",
    "cylinder": "/Engine/BasicShapes/Cylinder.Cylinder",
    "sphere": "/Engine/BasicShapes/Sphere.Sphere",
}
# Linear RGB, roughness, metallic, emission. No external textures or models.
PALETTE = {
    "road": ((0.028, 0.035, 0.043), 0.72, 0.0, 0),
    "pavement": ((0.22, 0.19, 0.16), 0.85, 0.0, 0),
    "curb": ((0.33, 0.31, 0.27), 0.88, 0.0, 0),
    "cream": ((0.47, 0.39, 0.25), 0.88, 0.0, 0),
    "ochre": ((0.40, 0.23, 0.09), 0.90, 0.0, 0),
    "blue": ((0.16, 0.25, 0.27), 0.87, 0.0, 0),
    "sage": ((0.24, 0.30, 0.22), 0.90, 0.0, 0),
    "plaster": ((0.38, 0.34, 0.27), 0.90, 0.0, 0),
    "trim": ((0.50, 0.48, 0.39), 0.75, 0.0, 0),
    "metal": ((0.042, 0.052, 0.052), 0.58, 0.55, 0),
    "rust": ((0.16, 0.07, 0.025), 0.87, 0.35, 0),
    "teal": ((0.023, 0.14, 0.13), 0.70, 0.10, 0),
    "tire": ((0.012, 0.014, 0.016), 0.95, 0.0, 0),
    "glass": ((0.027, 0.065, 0.072), 0.18, 0.18, 0),
    "window": ((0.80, 0.38, 0.10), 0.50, 0.0, 2.5),
    "sign": ((0.19, 0.10, 0.026), 0.80, 0.0, 0.25),
    "leaf": ((0.38, 0.18, 0.025), 0.90, 0.0, 0),
    "leaf_dark": ((0.18, 0.075, 0.012), 0.96, 0.0, 0),
    "bark": ((0.095, 0.052, 0.028), 0.98, 0.0, 0),
    "foliage": ((0.055, 0.12, 0.055), 0.98, 0.0, 0),
    "puddle": ((0.019, 0.033, 0.044), 0.10, 0.16, 0),
    "marking": ((0.48, 0.38, 0.12), 0.82, 0.0, 0),
}


def make_scene_plan():
    """Pure scene data in centimetres; independently inspectable without UE."""
    nodes = []
    rng = random.Random(406032)

    def shape(label, pos, size, material, group="Street", kind="cube",
              yaw=0.0, pitch=0.0, roll=0.0, collision=True, shadow=True,
              tags=()):
        nodes.append(dict(label=label, kind=kind, pos=list(pos), size=list(size),
                          rot=[pitch, yaw, roll], material=material, group=group,
                          collision=collision, shadow=shadow, tags=list(tags)))

    def text(label, message, pos, yaw=0.0, size=28.0, group="Signs"):
        nodes.append(dict(label=label, kind="text", text=message, pos=list(pos),
                          rot=[0.0, yaw, 0.0], text_size=size, group=group))

    shape("Foundation", (0, 0, -30), (6220, 3860, 20), "road")
    shape("Road", (0, 0, -10), (6000, 920, 20), "road")
    for side in (-1, 1):
        shape("Pavement_%s" % side, (0, side * 590, 10),
              (6000, 260, 40), "pavement")
        shape("Curb_%s" % side, (0, side * 465, 9),
              (6000, 12, 18), "curb")
        shape("BackBoundary_%s" % side, (0, side * 1900, 250),
              (6200, 60, 500), "plaster", "Boundaries")
        shape("EndBoundary_%s" % side, (side * 3050, 0, 250),
              (100, 3800, 500), "plaster", "Boundaries")
    for x in range(-2600, 2700, 450):
        shape("RoadMark_%s" % x, (x, 0, 0.6), (180, 7, 1), "marking",
              collision=False, shadow=False)
    for i in range(12):
        shape("Puddle_%02d" % i,
              (rng.uniform(-2700, 2700), rng.choice((-1, 1)) * rng.uniform(290, 410), 0.8),
              (rng.uniform(100, 220), rng.uniform(25, 70), 0.4), "puddle",
              yaw=rng.uniform(-12, 12), collision=False, shadow=False)

    shop_names = (
        "CA PHE GOC PHO", "TAP HOA CO LAN", "PHO DEM", "SUA XE",
        "HIEU SACH", "TIEM MAY", "BANH MI NONG", "NHA TAP THE",
    )
    colors = ("ochre", "sage", "cream", "blue", "sage", "cream", "ochre", "plaster")
    for i in range(8):
        side = -1 if i < 4 else 1
        x = -1500 + (i % 4) * 1000
        height = (880, 1040, 930, 990)[i % 4]
        front = side * 750
        group = "Facades/Shop_%02d" % (i + 1)
        shape("Shop_%02d_Body" % i, (x, side * 1250, height / 2),
              (970, 1000, height), colors[i], group, tags=("HN_Facade",))
        shape("Shop_%02d_Cornice" % i, (x, front - side * 12, height - 25),
              (985, 38, 32), "trim", group)
        shape("Shop_%02d_Threshold" % i, (x, front - side * 8, 35),
              (970, 26, 10), "curb", group, collision=False)
        # Storefront panels sit just outside the body; the inner recess is visual.
        for bay, dx in enumerate((-235, 235)):
            shape("Shop_%02d_Glass_%s" % (i, bay), (x + dx, front - side * 5, 160),
                  (425, 8, 250), "glass" if i % 3 != 1 else "metal", group,
                  collision=False)
            shape("Shop_%02d_DoorFrame_%s" % (i, bay),
                  (x + dx - 215, front - side * 14, 165), (14, 24, 270), "trim", group)
        shape("Shop_%02d_Sign" % i, (x, front - side * 28, 340),
              (910, 28, 95), "teal" if i % 2 == 0 else "sign", group,
              collision=False)
        # TextRender's front normal is local +X. Face inward towards the street.
        inward_yaw = 90.0 if side < 0 else -90.0
        text("Shop_%02d_Name" % i, shop_names[i],
             (x, front - side * 45, 330), inward_yaw, 31, group)
        shape("Shop_%02d_Awning" % i, (x, front - side * 94, 295),
              (960, 185, 12), "teal" if i % 2 == 0 else "ochre", group,
              roll=side * 7, collision=False)
        for floor, z in enumerate((510, 740)):
            for w, dx in enumerate((-300, 0, 300)):
                shape("Shop_%02d_Window_%s_%s" % (i, floor, w),
                      (x + dx, front - side * 5, z), (150, 10, 145),
                      "window" if (i + floor + w) % 4 == 0 else "glass", group,
                      collision=False)
                shape("Shop_%02d_Lintel_%s_%s" % (i, floor, w),
                      (x + dx, front - side * 16, z + 80), (175, 30, 12),
                      "trim", group, collision=False)
            shape("Shop_%02d_BalconySlab_%s" % (i, floor),
                  (x, front - side * 65, z - 87), (900, 120, 15), "trim", group)
            shape("Shop_%02d_BalconyRail_%s" % (i, floor),
                  (x, front - side * 118, z - 8), (900, 7, 8), "metal", group,
                  collision=False)
            for bar in range(8):
                shape("Shop_%02d_Rail_%s_%s" % (i, floor, bar),
                      (x - 420 + bar * 120, front - side * 118, z - 45),
                      (5, 5, 78), "metal", group, collision=False)
        shape("Shop_%02d_AC" % i, (x + 375, front - side * 40, 440),
              (95, 55, 65), "trim", group, collision=False)

    for i, (x, side) in enumerate(((-2300, -1), (-700, 1), (900, -1), (2400, 1))):
        y = side * 630
        group = "Lighting/Lamp_%s" % i
        shape("Lamp_%s_Pole" % i, (x, y, 270), (12, 12, 480), "metal", group,
              kind="cylinder")
        shape("Lamp_%s_Arm" % i, (x, y - side * 65, 505),
              (10, 140, 10), "metal", group, collision=False)
        shape("Lamp_%s_Head" % i, (x, y - side * 135, 495),
              (70, 40, 18), "metal", group, collision=False)
        shape("Lamp_%s_Bulb" % i, (x, y - side * 135, 485),
              (54, 30, 3), "window", group, collision=False, shadow=False)
        nodes.append(dict(label="Lamp_%s_Light" % i, kind="spot",
                          pos=[x, y - side * 135, 480], rot=[-78, -side * 90, 0],
                          intensity=10000, radius=1500, shadows=i in (0, 2),
                          group="Lighting"))

    for i, (x, side) in enumerate(((-2200, 1), (-200, -1), (1800, 1))):
        y = side * 620
        shape("Tree_%s_Planter" % i, (x, y, 50), (130, 130, 40), "curb", "Trees")
        shape("Tree_%s_Trunk" % i, (x, y, 230), (25, 25, 370), "bark", "Trees",
              kind="cylinder")
        for j, (dx, dy, dz) in enumerate(((0, 0, 520), (-85, 5, 445), (65, 35, 465))):
            shape("Tree_%s_Canopy_%s" % (i, j), (x + dx, y + dy, dz),
                  (240, 210, 210), "foliage", "Trees", kind="sphere", collision=False)

    # Two small stools and a table near the cafe, outside the road lane.
    for i, x in enumerate((-1730, -1260)):
        shape("Cafe_Stool_%s" % i, (x, -610, 53), (42, 42, 45), "teal", "Cafe")
    shape("Cafe_Table" , (-1500, -640, 82), (95, 70, 10), "rust", "Cafe")
    shape("Cafe_TableLeg", (-1500, -640, 55), (9, 9, 50), "metal", "Cafe")

    # Decorative cart: shell, handles and wheels. No Q/E gameplay is implied.
    cx, cy = -2050, 230
    for label, dx, dy, dz, sx, sy, sz in (
        ("Base", 0, 0, 44, 105, 75, 8),
        ("Left", 0, -38, 76, 105, 5, 65),
        ("Right", 0, 38, 76, 105, 5, 65),
        ("Front", 52, 0, 76, 5, 75, 65),
        ("Back", -52, 0, 76, 5, 75, 65),
        ("HandleLeft", -78, -31, 96, 55, 5, 5),
        ("HandleRight", -78, 31, 96, 55, 5, 5),
        ("Grip", -105, 0, 96, 5, 66, 5),
    ):
        shape("Cart_" + label, (cx + dx, cy + dy, dz), (sx, sy, sz), "teal",
              "Props/Cart", tags=("HN_Cart_Static",))
    for i, side in enumerate((-1, 1)):
        shape("Cart_Wheel_%s" % i, (cx, cy + side * 44, 27), (48, 13, 48),
              "tire", "Props/Cart", kind="sphere")
    # Painted depot rectangle and legible sign at the starting end of the street.
    for i, (px, py, sx, sy) in enumerate(((-2500, 270, 300, 6), (-2500, 420, 300, 6),
                                        (-2650, 345, 6, 150), (-2350, 345, 6, 150))):
        shape("DepotLine_%s" % i, (px, py, 1), (sx, sy, 1), "marking", "Props/Depot",
              collision=False, shadow=False, tags=("HN_Depot_Static",))
    shape("Depot_Sign", (-2700, 390, 160), (12, 240, 100), "teal", "Props/Depot")
    shape("Depot_Post", (-2700, 390, 70), (12, 12, 140), "metal", "Props/Depot")
    text("Depot_Title", "TAP KET", (-2691, 390, 158), 0, 30, "Props/Depot")
    # Eight groups of nine static leaves; no per-leaf physics or fake collection.
    for cluster, (x, y) in enumerate(((-1800, -230), (-1100, 300), (-500, -310),
                                     (100, 270), (700, -270), (1200, 320),
                                     (1800, -180), (2350, 180))):
        for leaf in range(9):
            shape("Leaf_%s_%s" % (cluster, leaf),
                  (x + rng.uniform(-55, 55), y + rng.uniform(-35, 35), rng.uniform(1.6, 3.2)),
                  (rng.uniform(12, 20), rng.uniform(5, 9), 0.5),
                  "leaf" if leaf % 3 else "leaf_dark", "Props/Leaves",
                  yaw=rng.uniform(-180, 180), pitch=rng.uniform(-5, 5),
                  roll=rng.uniform(-8, 8), collision=False, shadow=False,
                  tags=("HN_Leaf_Static", "HN_Cluster_%s" % cluster))
    return dict(version=VERSION, units="cm", nodes=nodes,
                player_start=dict(pos=[-2400, -60, 112], yaw=0),
                overview_camera=dict(pos=[-2620, 140, 320], rot=[-5, 0, 0]))


class BootstrapError(RuntimeError):
    pass


class Builder:
    def __init__(self, unreal):
        self.u = unreal
        self.warnings = []
        self.actors = []
        self.root = None
        self.map_path = None
        self.meshes = {}
        self.materials = {}
        self.report = dict(bootstrap_version=VERSION, requested_engine="5.8.4",
                           status="preflight", unreal_runtime_verified_by_author=False,
                           gameplay="Third Person template walking only; props are static",
                           warnings=self.warnings)

    def optional(self, description, action):
        try:
            return action()
        except Exception as exc:
            message = "%s: %s" % (description, exc)
            self.warnings.append(message)
            self.u.log_warning("[HanoiBootstrap] " + message)
            return None

    def preflight(self):
        u = self.u
        required = ("EditorAssetLibrary", "EditorLoadingAndSavingUtils", "LevelEditorSubsystem",
                    "EditorActorSubsystem", "UnrealEditorSubsystem", "MaterialEditingLibrary", "MaterialFactoryNew",
                    "MaterialInstanceConstantFactoryNew", "StaticMeshActor", "TextRenderActor",
                    "PlayerStart", "SkyAtmosphere", "SkyLight", "DirectionalLight", "SpotLight")
        missing = [name for name in required if not hasattr(u, name)]
        if missing:
            raise BootstrapError("Missing UE APIs: %s. Enable Python Editor Script Plugin and "
                                 "Editor Scripting Utilities, then restart." % ", ".join(missing))
        self.levels = u.get_editor_subsystem(u.LevelEditorSubsystem)
        self.editor = u.get_editor_subsystem(u.EditorActorSubsystem)
        self.editor_worlds = u.get_editor_subsystem(u.UnrealEditorSubsystem)
        self.world = self.editor_worlds.get_editor_world()
        if not self.world or self.world.get_world_settings() is None:
            raise BootstrapError("Open the Third Person map before running this file.")
        if self.editor_worlds.get_game_world() is not None:
            raise BootstrapError("Stop Play/Simulate before running this file.")
        # Do not discard or silently save user edits when switching to the new map.
        dirty = list(u.EditorLoadingAndSavingUtils.get_dirty_content_packages())
        dirty += list(u.EditorLoadingAndSavingUtils.get_dirty_map_packages())
        if dirty:
            raise BootstrapError("Unsaved packages detected. Use File > Save All, stop Play, then run again.")
        engine = u.SystemLibrary.get_engine_version()
        self.report["actual_engine"] = engine
        if not str(engine).startswith("5."):
            raise BootstrapError("This bootstrap requires Unreal Engine 5; found " + str(engine))
        for key, path in MESH_PATHS.items():
            mesh = u.load_asset(path)
            if mesh is None:
                raise BootstrapError("Engine primitive unavailable: " + path)
            self.meshes[key] = mesh
        self.game_mode = None
        preferred = "/Game/ThirdPerson/Blueprints/BP_ThirdPersonGameMode"
        candidates = [preferred]
        candidates += [p for p in u.EditorAssetLibrary.list_assets("/Game", recursive=True)
                       if "gamemode" in p.lower() and "thirdperson" in p.lower()]
        for path in dict.fromkeys(candidates):
            if not u.EditorAssetLibrary.does_asset_exist(path):
                continue
            blueprint = u.load_asset(path)
            if blueprint and hasattr(blueprint, "generated_class"):
                cls = blueprint.generated_class()
                pawn = u.get_default_object(cls).get_editor_property("default_pawn_class")
                if pawn and isinstance(u.get_default_object(pawn), u.Character):
                    self.game_mode = cls
                    self.report["game_mode"] = cls.get_path_name()
                    break
        if self.game_mode is None:
            raise BootstrapError("No Third Person GameMode with a Character pawn found. "
                                 "Use the Third Person template; do not delete its Blueprints.")
        for number in range(1, 1000):
            root = PREFIX + "_%03d" % number
            if not u.EditorAssetLibrary.does_directory_exist(root):
                self.root = root
                self.map_path = root + "/Maps/LV_HanoiNight"
                break
        if not self.root:
            raise BootstrapError("No unused numbered content folder remains.")
        self.report.update(content_root=self.root, map=self.map_path)

    def new_level(self):
        u = self.u
        for suffix in ("", "/Maps", "/Materials"):
            if not u.EditorAssetLibrary.make_directory(self.root + suffix):
                raise BootstrapError("Could not create content directory: " + self.root + suffix)
        if not self.levels.new_level(self.map_path):
            raise BootstrapError("Level creation failed: " + self.map_path)
        self.world = self.editor_worlds.get_editor_world()
        self.world.get_world_settings().set_editor_property("default_game_mode", self.game_mode)

    def make_materials(self):
        u = self.u
        tools = u.AssetToolsHelpers.get_asset_tools()
        folder = self.root + "/Materials"
        material = tools.create_asset("M_HanoiSurface", folder, u.Material, u.MaterialFactoryNew())
        if material is None:
            raise BootstrapError("Could not create base material.")
        lib = u.MaterialEditingLibrary
        tint = lib.create_material_expression(material, u.MaterialExpressionVectorParameter, -650, -160)
        tint.set_editor_property("parameter_name", "Tint")
        tint.set_editor_property("default_value", u.LinearColor(0.3, 0.3, 0.3, 1))
        for name, value, prop, y in (("Roughness", 0.8, u.MaterialProperty.MP_ROUGHNESS, 50),
                                     ("Metallic", 0.0, u.MaterialProperty.MP_METALLIC, 180)):
            expr = lib.create_material_expression(material, u.MaterialExpressionScalarParameter, -650, y)
            expr.set_editor_property("parameter_name", name)
            expr.set_editor_property("default_value", value)
            if not lib.connect_material_property(expr, "", prop):
                raise BootstrapError("Cannot connect material property: " + name)
        glow = lib.create_material_expression(material, u.MaterialExpressionScalarParameter, -650, 320)
        glow.set_editor_property("parameter_name", "Glow")
        glow.set_editor_property("default_value", 0.0)
        multiply = lib.create_material_expression(material, u.MaterialExpressionMultiply, -300, 300)
        if not (lib.connect_material_property(tint, "", u.MaterialProperty.MP_BASE_COLOR)
                and lib.connect_material_expressions(tint, "", multiply, "A")
                and lib.connect_material_expressions(glow, "", multiply, "B")
                and lib.connect_material_property(multiply, "", u.MaterialProperty.MP_EMISSIVE_COLOR)):
            raise BootstrapError("Cannot connect surface/emissive nodes.")
        lib.recompile_material(material)
        for key, (color, roughness, metallic, emission) in PALETTE.items():
            instance = tools.create_asset("MI_" + key, folder, u.MaterialInstanceConstant,
                                          u.MaterialInstanceConstantFactoryNew())
            if instance is None:
                raise BootstrapError("Cannot create material instance: " + key)
            lib.set_material_instance_parent(instance, material)
            if not lib.set_material_instance_vector_parameter_value(instance, "Tint", u.LinearColor(*color, 1.0)):
                raise BootstrapError("Cannot assign tint parameter: " + key)
            for param, value in (("Roughness", roughness), ("Metallic", metallic), ("Glow", emission)):
                if not lib.set_material_instance_scalar_parameter_value(instance, param, value):
                    raise BootstrapError("Cannot assign material parameter: " + key + "/" + param)
            self.materials[key] = instance

    def spawn(self, cls, label, pos, rot=(0, 0, 0), group="Environment"):
        u = self.u
        actor = self.editor.spawn_actor_from_class(cls, u.Vector(*pos),
                    u.Rotator(pitch=rot[0], yaw=rot[1], roll=rot[2]))
        if actor is None:
            raise BootstrapError("Actor creation failed: " + label)
        actor.set_actor_label("HN_" + label)
        actor.set_folder_path("HanoiBootstrap/" + group)
        self.actors.append(actor)
        return actor

    def build_node(self, node):
        u = self.u
        kind = node["kind"]
        if kind in MESH_PATHS:
            actor = self.spawn(u.StaticMeshActor, node["label"], node["pos"], node["rot"], node["group"])
            component = actor.static_mesh_component
            component.set_static_mesh(self.meshes[kind])
            component.set_material(0, self.materials[node["material"]])
            component.set_collision_profile_name("BlockAll" if node["collision"] else "NoCollision")
            component.set_editor_property("cast_shadow", node["shadow"])
            actor.set_actor_scale3d(u.Vector(*(s / 100.0 for s in node["size"])))
            actor.set_editor_property("tags", [u.Name(t) for t in node["tags"]])
        elif kind == "text":
            actor = self.spawn(u.TextRenderActor, node["label"], node["pos"], node["rot"], node["group"])
            component = actor.get_component_by_class(u.TextRenderComponent)
            component.set_text(u.Text(node["text"]))
            component.set_world_size(node["text_size"])
            component.set_text_render_color(u.Color(240, 228, 196, 255))
            # UE's reflected enum retains the historical spelling "Aligment".
            self.optional("Text centering", lambda: component.set_horizontal_alignment(
                u.HorizTextAligment.EHTA_CENTER))
        elif kind == "spot":
            actor = self.spawn(u.SpotLight, node["label"], node["pos"], node["rot"], node["group"])
            light = actor.get_component_by_class(u.SpotLightComponent)
            light.set_editor_property("intensity_units", u.LightUnits.LUMENS)
            light.set_editor_property("intensity", float(node["intensity"]))
            light.set_editor_property("attenuation_radius", float(node["radius"]))
            light.set_editor_property("inner_cone_angle", 35.0)
            light.set_editor_property("outer_cone_angle", 64.0)
            light.set_editor_property("use_temperature", True)
            light.set_editor_property("temperature", 3000.0)
            light.set_editor_property("cast_shadows", node["shadows"])
        else:
            raise BootstrapError("Unknown node kind: " + str(kind))

    def sky(self):
        u = self.u
        self.spawn(u.SkyAtmosphere, "SkyAtmosphere", (0, 0, 0), group="Lighting")
        moon = self.spawn(u.DirectionalLight, "Moon", (0, 0, 1400), (-24, -35, 0), "Lighting")
        light = moon.get_component_by_class(u.DirectionalLightComponent)
        light.set_editor_property("intensity", 0.6)
        light.set_editor_property("light_color", u.Color(170, 195, 255, 255))
        self.optional("Atmosphere sun index", lambda: light.set_editor_property("atmosphere_sun_light", False))
        sky = self.spawn(u.SkyLight, "SkyLight", (0, 0, 800), group="Lighting")
        skylight = sky.get_component_by_class(u.SkyLightComponent)
        skylight.set_editor_property("intensity", 0.25)
        self.optional("Sky capture mode", lambda: skylight.set_editor_property("real_time_capture", False))
        self.optional("Recapture sky", lambda: skylight.recapture_sky())
        if hasattr(u, "ExponentialHeightFog"):
            def fog_setup():
                fog = self.spawn(u.ExponentialHeightFog, "HeightFog", (0, 0, -100), group="Lighting")
                comp = fog.get_component_by_class(u.ExponentialHeightFogComponent)
                comp.set_editor_property("fog_density", 0.012)
                comp.set_editor_property("volumetric_fog", False)
            self.optional("Height fog", fog_setup)
        if hasattr(u, "PostProcessVolume"):
            def exposure_setup():
                volume = self.spawn(u.PostProcessVolume, "Exposure", (0, 0, 100), group="Lighting")
                volume.set_editor_property("unbound", True)
                settings = volume.get_editor_property("settings")
                extended = u.SystemLibrary.get_console_variable_int_value(
                    "r.DefaultFeature.AutoExposure.ExtendDefaultLuminanceRange") != 0
                # Fixed EV100=2 in the current extended range; old range uses luminance.
                value = 2.0 if extended else 0.5
                for name in ("min", "max"):
                    settings.set_editor_property("override_auto_exposure_%s_brightness" % name, True)
                    settings.set_editor_property("auto_exposure_%s_brightness" % name, value)
                settings.set_editor_property("override_motion_blur_amount", True)
                settings.set_editor_property("motion_blur_amount", 0.0)
                volume.set_editor_property("settings", settings)
            self.optional("Exposure settings (field names can vary by UE version)", exposure_setup)

    def save_report(self, status, error=None):
        self.report.update(status=status, actor_count=len(self.actors), error=error)
        try:
            directory = Path(self.u.Paths.convert_relative_path_to_full(
                self.u.Paths.project_saved_dir())) / "HanoiNightBootstrap"
            directory.mkdir(parents=True, exist_ok=True)
            name = self.root.rsplit("/", 1)[-1] if self.root else "preflight"
            path = directory / (name + "_report.json")
            path.write_text(json.dumps(self.report, indent=2, ensure_ascii=False), encoding="utf-8")
            self.u.log("[HanoiBootstrap] Report: " + str(path))
        except Exception as exc:
            self.u.log_warning("[HanoiBootstrap] Could not write diagnostic report: " + str(exc))

    def run(self):
        u = self.u
        try:
            self.preflight()
            plan = make_scene_plan()
            self.new_level()
            with u.ScopedSlowTask(len(plan["nodes"]) + 3, "Dung doan pho Ha Noi...") as progress:
                progress.make_dialog(True)
                self.make_materials()
                progress.enter_progress_frame(1)
                for node in plan["nodes"]:
                    if progress.should_cancel():
                        raise BootstrapError("Cancelled. Only the new generated folder/map may be partial.")
                    self.build_node(node)
                    progress.enter_progress_frame(1)
                self.sky()
                start = plan["player_start"]
                self.spawn(u.PlayerStart, "PlayerStart", start["pos"], (0, start["yaw"], 0), "Start")
                progress.enter_progress_frame(1)
                if not u.EditorAssetLibrary.save_directory(self.root, only_if_is_dirty=False, recursive=True):
                    raise BootstrapError("Could not save all generated assets.")
                if not self.levels.save_current_level():
                    raise BootstrapError("Could not save generated map.")
                progress.enter_progress_frame(1)
            self.save_report("generated_unverified_in_play")
            camera = plan["overview_camera"]
            if hasattr(u, "EditorLevelLibrary"):
                self.optional("Viewport camera", lambda: u.EditorLevelLibrary.set_level_viewport_camera_info(
                    u.Vector(*camera["pos"]), u.Rotator(pitch=camera["rot"][0], yaw=camera["rot"][1], roll=0)))
            message = ("Da tao: %s\nNhan Play de di thu bang nhan vat Third Person.\n"
                       "Xe/la la mau tinh; chua co gameplay quet-hot.\n"
                       "Kiem tra Output Log va report neu co canh bao." % self.map_path)
            u.log("[HanoiBootstrap] " + message)
            if hasattr(u, "EditorDialog"):
                self.optional("Completion dialog", lambda: u.EditorDialog.show_message(
                    "Ha Noi - Ca dem: blockout", message, u.AppMsgType.OK))
        except Exception as exc:
            self.save_report("failed", str(exc))
            u.log_error("[HanoiBootstrap] " + traceback.format_exc())
            if hasattr(u, "EditorDialog"):
                self.optional("Failure dialog", lambda: u.EditorDialog.show_message(
                    "Ha Noi bootstrap - chua hoan tat", str(exc) + "\nXem Output Log.", u.AppMsgType.OK))
            raise


def main():
    try:
        import unreal
    except ImportError as exc:
        raise RuntimeError("Run this file via Unreal Editor > Tools > Execute Python Script, not Windows Python.") from exc
    Builder(unreal).run()


if __name__ == "__main__":
    main()
