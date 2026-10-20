"""Offline adapter regression checks with a fake editor, NOT UE compatibility tests."""
import unittest
from types import SimpleNamespace
from unittest.mock import Mock

import dung_pho_hanoi as bootstrap


class Expression:
    def __init__(self, kind):
        self.kind = kind
        self.properties = {}

    def set_editor_property(self, name, value):
        self.properties[name] = value


class MaterialTests(unittest.TestCase):
    def make_builder(self, failed_asset=None, failed_expression=None, failed_connection=None):
        assets = {}

        def create_asset(name, folder, cls, factory):
            if name == failed_asset:
                return None
            asset = SimpleNamespace(name=name, inputs={}, expressions=[])
            assets[name] = asset
            return asset

        def create_expression(material, kind, x, y):
            if (material.name, len(material.expressions)) == failed_expression:
                return None
            expr = Expression(kind)
            expr.material = material
            material.expressions.append(expr)
            return expr

        def connect(expr, output, prop):
            self.assertEqual(output, "")
            if (expr.material.name, prop) == failed_connection:
                return False
            expr.material.inputs[prop] = expr
            return True

        lib = SimpleNamespace(create_material_expression=create_expression,
                              connect_material_property=connect, recompile_material=Mock())
        # Intentionally no MaterialInstance or parameter APIs: generation must
        # succeed even when the old Tint override path is unavailable.
        unreal = SimpleNamespace(
            AssetToolsHelpers=SimpleNamespace(get_asset_tools=lambda: SimpleNamespace(create_asset=create_asset)),
            Material=object, MaterialFactoryNew=lambda: object(), MaterialEditingLibrary=lib,
            MaterialExpressionConstant3Vector="vector", MaterialExpressionConstant="scalar",
            MaterialProperty=SimpleNamespace(MP_BASE_COLOR="base", MP_ROUGHNESS="rough",
                                             MP_METALLIC="metal", MP_EMISSIVE_COLOR="emissive"),
            LinearColor=lambda r, g, b, a: (r, g, b, a),
        )
        builder = bootstrap.Builder(unreal)
        builder.root = "/Game/TestOnly_001"
        return builder, assets, lib

    def test_entire_scene_palette_has_connected_inputs_without_instance_setters(self):
        builder, assets, lib = self.make_builder()
        builder.make_materials()
        used = {n["material"] for n in bootstrap.make_scene_plan()["nodes"] if "material" in n}
        self.assertTrue(used <= builder.materials.keys())
        self.assertEqual(set(builder.materials), set(bootstrap.PALETTE))
        for material in assets.values():
            self.assertEqual(set(material.inputs), {"base", "rough", "metal", "emissive"})
            self.assertEqual(material.inputs["base"].kind, "vector")
            self.assertEqual(material.inputs["rough"].kind, "scalar")
        road = assets["M_road"].inputs
        self.assertEqual(road["base"].properties["constant"], (0.028, 0.035, 0.043, 1.0))
        self.assertEqual(road["rough"].properties["r"], 0.72)
        self.assertEqual(road["metal"].properties["r"], 0.0)
        self.assertEqual(road["emissive"].properties["constant"], (0.0, 0.0, 0.0, 1.0))
        window = assets["M_window"].inputs
        self.assertEqual(window["emissive"].properties["constant"], (2.0, 0.95, 0.25, 1.0))
        self.assertEqual(builder.report["material_count"], 22)
        self.assertEqual(lib.recompile_material.call_count, 22)

    def test_failed_asset_is_not_registered(self):
        builder, _, _ = self.make_builder(failed_asset="M_road")
        with self.assertRaisesRegex(bootstrap.BootstrapError, "Cannot create material: road"):
            builder.make_materials()
        self.assertEqual(builder.materials, {})

    def test_missing_expression_stops_with_material_and_channel(self):
        builder, _, _ = self.make_builder(failed_expression=("M_road", 0))
        with self.assertRaisesRegex(bootstrap.BootstrapError, "road/BaseColor"):
            builder.make_materials()
        self.assertEqual(builder.report["material_count"], 0)

    def test_every_failed_channel_stops_before_registering_material(self):
        for prop in ("base", "rough", "metal", "emissive"):
            with self.subTest(channel=prop):
                builder, _, lib = self.make_builder(failed_connection=("M_road", prop))
                with self.assertRaisesRegex(bootstrap.BootstrapError, "Cannot connect material input: road/"):
                    builder.make_materials()
                self.assertEqual(builder.materials, {})
                lib.recompile_material.assert_not_called()


if __name__ == "__main__":
    unittest.main()
