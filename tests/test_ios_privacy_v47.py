import importlib.util
import plistlib
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("reparado_ios_privacy", ROOT / "scripts/install-ios-privacy.py")
privacy = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(privacy)


class IOSPrivacyTests(unittest.TestCase):
    def test_template_is_valid_and_has_required_reason(self):
        data = plistlib.loads(privacy.TEMPLATE.read_bytes())
        self.assertTrue(privacy.require_reason(data))
        self.assertNotIn("NSPrivacyCollectedDataTypes", data)

    def test_merge_preserves_existing_reason_and_collection_data(self):
        existing = {
            "NSPrivacyTracking": False,
            "NSPrivacyCollectedDataTypes": [{"NSPrivacyCollectedDataType": "NSPrivacyCollectedDataTypeEmailAddress"}],
            "NSPrivacyAccessedAPITypes": [{
                "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryUserDefaults",
                "NSPrivacyAccessedAPITypeReasons": ["CA92.1"]
            }, {
                "NSPrivacyAccessedAPIType": privacy.CATEGORY,
                "NSPrivacyAccessedAPITypeReasons": ["3B52.1"]
            }]
        }
        required = plistlib.loads(privacy.TEMPLATE.read_bytes())
        result = privacy.merge_manifest(existing, required)
        self.assertFalse(result["NSPrivacyTracking"])
        self.assertEqual(result["NSPrivacyCollectedDataTypes"], existing["NSPrivacyCollectedDataTypes"])
        self.assertEqual(result["NSPrivacyAccessedAPITypes"][0], existing["NSPrivacyAccessedAPITypes"][0])
        self.assertEqual(result["NSPrivacyAccessedAPITypes"][1]["NSPrivacyAccessedAPITypeReasons"], ["3B52.1","C617.1"])
        self.assertEqual(privacy.merge_manifest(result, required), result)

    def test_generated_manifest_and_built_bundle_checks(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / "ios/App"
            (folder / "App.xcodeproj").mkdir(parents=True)
            (folder / "App.xcodeproj/project.pbxproj").write_text("fake project", encoding="utf8")
            manifest = privacy.install(folder)
            self.assertTrue(manifest.is_file())
            self.assertEqual(manifest, privacy.install(folder))
            with self.assertRaisesRegex(ValueError, "raíz del bundle"):
                privacy.verify_bundle(Path(tmp) / "NotBundled.app")
            bundle = Path(tmp) / "Built.app"
            bundle.mkdir()
            (bundle / "PrivacyInfo.xcprivacy").write_bytes(manifest.read_bytes())
            privacy.verify_bundle(bundle)

    def test_fail_closed_if_native_project_not_generated(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(FileNotFoundError):
                privacy.install(Path(tmp))


if __name__ == "__main__":
    unittest.main()
