"""验证发布包路径边界，测试不连接服务器。"""
import importlib.util
import io
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest import mock

spec = importlib.util.spec_from_file_location("release42", Path(__file__).with_name("release42.py"))
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class ArchiveTests(unittest.TestCase):
    def unpack(self, names, special=None, required=None):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            archive = root / "bundle.tar.gz"
            with tarfile.open(archive, "w:gz") as out:
                for name in names:
                    entry = tarfile.TarInfo(name)
                    entry.size = 2
                    if special:
                        entry.type = special
                        entry.linkname = "/etc/passwd"
                    out.addfile(entry, io.BytesIO(b"ok"))
            destination = root / "out"
            destination.mkdir()
            release.extract(archive, destination, required)
            return sorted(str(p.relative_to(destination)) for p in destination.rglob("*") if p.is_file())

    def test_normal(self):
        self.assertEqual(self.unpack(["./index.html", "./assets/app.js"]), ["assets/app.js", "index.html"])

    def test_paths_and_duplicates(self):
        for names in [["../escape"], ["/etc/escape"], ["a/../../escape"], ["a\\b"], ["a", "./a"]]:
            with self.subTest(names=names), self.assertRaises(ValueError):
                self.unpack(names)

    def test_links(self):
        for kind in [tarfile.SYMTYPE, tarfile.LNKTYPE, tarfile.CHRTYPE]:
            with self.subTest(kind=kind), self.assertRaises(ValueError):
                self.unpack(["link"], kind)

    def test_manifest(self):
        self.assertEqual(self.unpack(["REVISION"], required={"REVISION"}), ["REVISION"])
        with self.assertRaises(ValueError):
            self.unpack(["unexpected"], required={"REVISION"})


class DeployTests(unittest.TestCase):
    def exercise(self, fail):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            state, frontend, backend = root / "state", root / "web", root / "server"
            state.mkdir()
            frontend.mkdir()
            (frontend / "index.html").write_bytes(b"old html")
            (frontend / "old.js").write_bytes(b"old asset")
            backend.write_bytes(b"old binary")
            package = root / "package"
            package.mkdir()
            (package / "edu-backend-go").write_bytes(b"\x7fELF\x02\x01" + b"\0" * 12 + b"\x3e\x00new")
            sha = "a" * 40
            (package / "REVISION").write_text(sha)
            with tarfile.open(package / "frontend.tar.gz", "w:gz") as out:
                entry = tarfile.TarInfo("index.html")
                entry.size = len(b"new html")
                out.addfile(entry, io.BytesIO(b"new html"))
            with tarfile.open(state / (sha + ".tar.gz"), "w:gz") as out:
                for name in ["edu-backend-go", "frontend.tar.gz", "REVISION"]:
                    out.add(package / name, arcname=name)

            def command(*args):
                if args[0] == "rsync":
                    source, destination = Path(args[-2]), Path(args[-1])
                    for path in source.rglob("*"):
                        if path.is_file() and "--exclude=" + path.name not in args:
                            target = destination / path.relative_to(source)
                            target.parent.mkdir(parents=True, exist_ok=True)
                            target.write_bytes(path.read_bytes())

            with mock.patch.multiple(release, STATE=state, FRONTEND=frontend, BACKEND=backend, BACKUPS=root / "backups"), \
                    mock.patch.object(release, "run", side_effect=command), \
                    mock.patch.object(release, "health", side_effect=[RuntimeError("injected failure"), None] if fail else [None]), \
                    mock.patch.object(release.urllib.request, "urlopen", return_value=io.BytesIO(b"new html")):
                if fail:
                    with self.assertRaises(RuntimeError):
                        release.deploy(sha)
                    self.assertEqual(backend.read_bytes(), b"old binary")
                    self.assertEqual((frontend / "index.html").read_bytes(), b"old html")
                    self.assertFalse((frontend / "release.json").exists())
                else:
                    release.deploy(sha)
                    self.assertEqual((frontend / "index.html").read_bytes(), b"new html")
                    self.assertIn(sha, (frontend / "release.json").read_text())
                self.assertEqual((frontend / "old.js").read_bytes(), b"old asset")

    def test_success_preserves_old_assets(self):
        self.exercise(False)

    def test_health_failure_restores_previous_release(self):
        self.exercise(True)


if __name__ == "__main__":
    unittest.main()
