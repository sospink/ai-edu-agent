"""检查课程与广场的外层 CLI 覆盖参数顺序。"""
import importlib.util
from pathlib import Path
import unittest
from unittest import mock

spec = importlib.util.spec_from_file_location(
    "harness_entrypoint",
    Path(__file__).resolve().parents[2] / "services/course-harness/entrypoint.py",
)
entrypoint = importlib.util.module_from_spec(spec)
spec.loader.exec_module(entrypoint)


class EntrypointTests(unittest.TestCase):
    def test_profiles_put_patches_before_web_options(self):
        for profile, count in [("course", 1), ("ai-square", 2)]:
            with self.subTest(profile=profile), mock.patch.dict(
                entrypoint.os.environ,
                {"EDU_WORKSPACE_PROFILE": profile, "EDU_PUBLIC_URL": "http://example.invalid/",
                 "EDU_TRUSTED_HOST": "example.invalid"},
            ):
                args = entrypoint.build_args("172.18.0.2")
                patches = [i for i, arg in enumerate(args) if arg == "--patch"]
                self.assertEqual(len(patches), count)
                self.assertTrue(all(i < args.index("--host") for i in patches))
                self.assertEqual(args[patches[0] + 1], "/opt/course-harness/course.patch.yml")
                self.assertEqual(args[args.index("--host") + 1], "172.18.0.2")
                if profile == "ai-square":
                    self.assertEqual(args[patches[1] + 1], "/opt/ai-square/square.patch.yml")


if __name__ == "__main__":
    unittest.main()
