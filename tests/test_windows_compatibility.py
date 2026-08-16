from __future__ import annotations

import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import local_app_launcher as launcher
import local_editor_server as server


class WindowsShortcutTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary_directory.cleanup)
        self.root = Path(self.temporary_directory.name)
        (self.root / "local_app_launcher.py").write_text("# launcher", encoding="utf-8")
        self.python = self.root / "python.exe"
        self.pythonw = self.root / "pythonw.exe"
        self.python.write_text("", encoding="utf-8")
        self.pythonw.write_text("", encoding="utf-8")
        (self.root / "windows").mkdir()
        (self.root / "windows" / "criar_atalho.ps1").write_text("# atalho", encoding="utf-8")
        self.service = server.EditorService(self.root)

    def test_windows_shortcut_uses_powershell_known_desktop_and_pythonw(self) -> None:
        completed = subprocess.CompletedProcess(
            args=[], returncode=0, stdout="C:\\Users\\Teste\\Desktop\\Cifras 2IPB Caratinga.lnk\n", stderr=""
        )
        with (
            mock.patch("local_editor_server._is_windows", return_value=True),
            mock.patch("local_editor_server.sys.executable", str(self.python)),
            mock.patch("local_editor_server.subprocess.run", return_value=completed) as run,
        ):
            shortcut = self.service.create_desktop_shortcut(8765)

        self.assertEqual(str(shortcut), "C:\\Users\\Teste\\Desktop\\Cifras 2IPB Caratinga.lnk")
        args = run.call_args.args[0]
        kwargs = run.call_args.kwargs
        self.assertEqual(args[0], "powershell.exe")
        self.assertEqual(args[-2], "-File")
        self.assertEqual(Path(args[-1]), self.root / "windows" / "criar_atalho.ps1")
        self.assertEqual(kwargs["env"]["CIFRAS_PYTHON"], str(self.pythonw))
        self.assertIn("--port 8765", kwargs["env"]["CIFRAS_ARGUMENTS"])
        self.assertEqual(kwargs["env"]["CIFRAS_ROOT"], str(self.root))

    def test_windows_shortcut_reports_powershell_failure(self) -> None:
        completed = subprocess.CompletedProcess(args=[], returncode=1, stdout="", stderr="bloqueado")
        with (
            mock.patch("local_editor_server._is_windows", return_value=True),
            mock.patch("local_editor_server.subprocess.run", return_value=completed),
        ):
            with self.assertRaises(server.EditorError) as context:
                self.service.create_desktop_shortcut(8000)
        self.assertEqual(context.exception.code, "shortcut_failed")
        self.assertIn("Windows", context.exception.message)


class LauncherCompatibilityTests(unittest.TestCase):
    def test_background_options_are_platform_specific(self) -> None:
        with mock.patch("local_app_launcher.sys.platform", "win32"):
            windows = launcher.background_process_options()
        with mock.patch("local_app_launcher.sys.platform", "linux"):
            linux = launcher.background_process_options()

        self.assertIn("creationflags", windows)
        self.assertTrue(windows["close_fds"])
        self.assertNotIn("start_new_session", windows)
        self.assertEqual(linux, {"start_new_session": True})

    def test_running_server_is_not_started_twice(self) -> None:
        with (
            mock.patch("local_app_launcher.is_running", return_value=True),
            mock.patch("local_app_launcher.subprocess.Popen") as popen,
            mock.patch("local_app_launcher.webbrowser.open") as browser,
        ):
            result = launcher.main(["--root", str(Path.cwd()), "--port", "8123"])

        self.assertEqual(result, 0)
        popen.assert_not_called()
        browser.assert_called_once_with("http://127.0.0.1:8123/configuracoes.html")

    def test_launcher_uses_system_temp_and_background_options(self) -> None:
        with tempfile.TemporaryDirectory() as temp_directory:
            with (
                mock.patch("local_app_launcher.is_running", side_effect=[False, True]),
                mock.patch("local_app_launcher.tempfile.gettempdir", return_value=temp_directory),
                mock.patch("local_app_launcher.background_process_options", return_value={"sentinel": True}),
                mock.patch("local_app_launcher.subprocess.Popen") as popen,
                mock.patch("local_app_launcher.webbrowser.open"),
            ):
                result = launcher.main(["--root", str(Path.cwd()), "--port", "8124"])

            self.assertEqual(result, 0)
            self.assertTrue((Path(temp_directory) / "cifras-2ipb-servidor.log").exists())
            self.assertTrue(popen.call_args.kwargs["sentinel"])

    def test_windows_installer_contains_required_fallbacks(self) -> None:
        source = (Path(__file__).resolve().parents[1] / "windows" / "instalar_e_rodar.bat").read_text(
            encoding="utf-8"
        )
        for required in (
            "py -3 -c",
            "python -c",
            "Python.Python.3.12",
            "winget install",
            "venv\\Scripts\\pythonw.exe",
            "https://www.python.org/downloads/windows/",
        ):
            with self.subTest(required=required):
                self.assertIn(required, source)

    def test_linux_installer_has_python_and_venv_fallbacks(self) -> None:
        source = (Path(__file__).resolve().parents[1] / "linux" / "instalar_e_rodar.sh").read_text(
            encoding="utf-8"
        )
        for required in (
            "python3 -m venv",
            "apt-get install",
            "dnf install",
            "pacman -Sy",
            "local_app_launcher.py",
        ):
            with self.subTest(required=required):
                self.assertIn(required, source)


if __name__ == "__main__":
    unittest.main()
