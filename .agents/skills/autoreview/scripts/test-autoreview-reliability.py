#!/usr/bin/env python3
# SPDX-License-Identifier: MIT

from __future__ import annotations

import argparse
import contextlib
import importlib.machinery
import importlib.util
import io
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock


SCRIPT_DIR = Path(__file__).resolve().parent
LOADER = importlib.machinery.SourceFileLoader("autoreview_module", str(SCRIPT_DIR / "autoreview"))
SPEC = importlib.util.spec_from_loader(LOADER.name, LOADER)
assert SPEC is not None
AUTOREVIEW = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = AUTOREVIEW
LOADER.exec_module(AUTOREVIEW)


class AutoreviewReliabilityTests(unittest.TestCase):
    @staticmethod
    def valid_report() -> str:
        return AUTOREVIEW.json.dumps(
            {
                "findings": [],
                "overall_correctness": "patch is correct",
                "overall_explanation": "No actionable findings.",
                "overall_confidence": 0.9,
            }
        )

    def test_all_thermos_rubrics_preserve_canonical_output_contract(self) -> None:
        rubric_dir = SCRIPT_DIR.parent / "rubrics"
        for path in sorted(rubric_dir.glob("thermos*.md")):
            with self.subTest(path=path.name):
                AUTOREVIEW.validate_extra_prompt(path.read_text())

    def test_conflicting_markdown_output_instruction_fails_preflight(self) -> None:
        with self.assertRaises(AUTOREVIEW.ReviewError) as caught:
            AUTOREVIEW.validate_extra_prompt("Return the review as Markdown.")
        self.assertEqual(caught.exception.code, AUTOREVIEW.ReviewErrorCode.PROMPT_CONFLICT)

    def test_negated_markdown_output_instruction_is_allowed(self) -> None:
        AUTOREVIEW.validate_extra_prompt("Do not return the review as Markdown.")

    def test_negated_markdown_does_not_hide_positive_table_conflict(self) -> None:
        with self.assertRaises(AUTOREVIEW.ReviewError) as caught:
            AUTOREVIEW.validate_extra_prompt("Do not return Markdown; output the findings as a table.")
        self.assertEqual(caught.exception.code, AUTOREVIEW.ReviewErrorCode.PROMPT_CONFLICT)

    def test_bundle_split_is_bounded_and_lossless(self) -> None:
        bundle = "# Header\n" + "".join(f"## file-{index}\n{'x' * 4000}\n" for index in range(8))
        parts = AUTOREVIEW.split_bundle(bundle, 10_000)
        self.assertGreater(len(parts), 1)
        self.assertTrue(all(len(part) <= 10_000 for part in parts))
        self.assertEqual("".join(part.rstrip() for part in parts).count("## file-"), 8)

    def test_generated_and_binary_paths_are_summarized(self) -> None:
        self.assertTrue(AUTOREVIEW.should_summarize_patch("pnpm-lock.yaml"))
        self.assertTrue(AUTOREVIEW.should_summarize_patch("docs/screenshot.png"))
        self.assertFalse(AUTOREVIEW.should_summarize_patch("src/service.ts"))

    def test_failure_classification_distinguishes_transport_schema_and_sandbox(self) -> None:
        cases = {
            AUTOREVIEW.ReviewErrorCode.ENGINE_TRANSPORT_ERROR: "stream disconnected before completion",
            AUTOREVIEW.ReviewErrorCode.ENGINE_SCHEMA_ERROR: "malformed JSON for strict Codex output schema",
            AUTOREVIEW.ReviewErrorCode.ENGINE_SANDBOX_ERROR: "attempt to write a readonly database",
        }
        for expected, output in cases.items():
            with self.subTest(expected=expected):
                error = AUTOREVIEW.classify_engine_failure("codex", 1, output)
                self.assertEqual(error.code, expected)

    def test_timeout_terminates_process_group(self) -> None:
        with self.assertRaises(AUTOREVIEW.ReviewError) as caught:
            AUTOREVIEW.run_with_heartbeat(
                [sys.executable, "-c", "import time; time.sleep(30)"],
                SCRIPT_DIR,
                label="fixture",
                heartbeat_seconds=1,
                timeout_seconds=1,
            )
        self.assertEqual(caught.exception.code, AUTOREVIEW.ReviewErrorCode.ENGINE_TIMEOUT)

    def test_timeout_is_not_delayed_by_long_heartbeat(self) -> None:
        started = time.monotonic()
        with self.assertRaises(AUTOREVIEW.ReviewError) as caught:
            AUTOREVIEW.run_with_heartbeat(
                [sys.executable, "-c", "import time; time.sleep(5)"],
                SCRIPT_DIR,
                label="long-heartbeat-fixture",
                heartbeat_seconds=60,
                timeout_seconds=1,
            )
        elapsed = time.monotonic() - started
        self.assertEqual(caught.exception.code, AUTOREVIEW.ReviewErrorCode.ENGINE_TIMEOUT)
        self.assertLess(elapsed, 2.5)

    def test_stream_timeout_terminates_process_group(self) -> None:
        with self.assertRaises(AUTOREVIEW.ReviewError) as caught:
            AUTOREVIEW.run_with_heartbeat(
                [sys.executable, "-c", "import time; print('started', flush=True); time.sleep(30)"],
                SCRIPT_DIR,
                label="stream-fixture",
                heartbeat_seconds=1,
                timeout_seconds=1,
                stream_output=True,
            )
        self.assertEqual(caught.exception.code, AUTOREVIEW.ReviewErrorCode.ENGINE_TIMEOUT)

    def test_run_state_reaches_terminal_status_outside_repository(self) -> None:
        with tempfile.TemporaryDirectory() as repo_dir, tempfile.TemporaryDirectory() as state_dir:
            state = AUTOREVIEW.ReviewRunState(Path(state_dir), "codex", "abc")
            state.update(status="passed", pid=None, completed_at=AUTOREVIEW.utc_now())
            payload = AUTOREVIEW.json.loads(state.path.read_text())
            self.assertEqual(payload["status"], "passed")
            self.assertFalse(state.path.is_relative_to(Path(repo_dir)))
            self.assertEqual(state.path.stat().st_mode & 0o777, 0o600)

    def test_status_marks_orphaned_running_process_incomplete(self) -> None:
        with tempfile.TemporaryDirectory() as state_dir:
            state = AUTOREVIEW.ReviewRunState(Path(state_dir), "claude", "abc")
            state.data.pop("controller_pid", None)
            state.update(status="running", pid=999_999_999)
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(AUTOREVIEW.show_run_status(Path(state_dir), state.run_id), 0)
            payload = AUTOREVIEW.json.loads(state.path.read_text())
            self.assertEqual(payload["status"], "incomplete")
            self.assertEqual(payload["error_code"], AUTOREVIEW.ReviewErrorCode.ENGINE_TRANSPORT_ERROR.value)

    def test_status_keeps_run_active_while_controller_is_alive(self) -> None:
        with tempfile.TemporaryDirectory() as state_dir:
            state = AUTOREVIEW.ReviewRunState(Path(state_dir), "claude", "abc")
            state.update(status="running", pid=999_999_999)
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(AUTOREVIEW.show_run_status(Path(state_dir), state.run_id), 3)
            payload = AUTOREVIEW.json.loads(state.path.read_text())
            self.assertEqual(payload["status"], "running")

    def test_duplicate_retrying_run_is_rejected_while_controller_is_alive(self) -> None:
        with tempfile.TemporaryDirectory() as state_dir:
            state = AUTOREVIEW.ReviewRunState(Path(state_dir), "codex", "same-bundle")
            state.update(status="retrying", pid=None)
            with self.assertRaises(AUTOREVIEW.ReviewError) as caught:
                AUTOREVIEW.ReviewRunState(Path(state_dir), "codex", "same-bundle")
            self.assertEqual(caught.exception.code, AUTOREVIEW.ReviewErrorCode.PREFLIGHT_ERROR)

    def test_duplicate_live_run_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as state_dir:
            state = AUTOREVIEW.ReviewRunState(Path(state_dir), "codex", "same-bundle")
            state.update(status="running", pid=AUTOREVIEW.os.getpid())
            with self.assertRaises(AUTOREVIEW.ReviewError) as caught:
                AUTOREVIEW.ReviewRunState(Path(state_dir), "codex", "same-bundle")
            self.assertEqual(caught.exception.code, AUTOREVIEW.ReviewErrorCode.PREFLIGHT_ERROR)

    def test_transport_failure_retries_then_persists_pass(self) -> None:
        transport = AUTOREVIEW.ReviewError(
            AUTOREVIEW.ReviewErrorCode.ENGINE_TRANSPORT_ERROR,
            "fixture transport failure",
        )
        args = argparse.Namespace(engine="codex")
        with tempfile.TemporaryDirectory() as repo_dir, tempfile.TemporaryDirectory() as state_dir:
            with mock.patch.object(AUTOREVIEW, "run_engine", side_effect=[transport, transport, self.valid_report()]) as engine:
                with mock.patch.object(AUTOREVIEW.time, "sleep"):
                    with contextlib.redirect_stdout(io.StringIO()):
                        report = AUTOREVIEW.run_reviewer(args, Path(repo_dir), "prompt", set(), [], Path(state_dir))
            self.assertEqual(engine.call_count, 3)
            self.assertEqual(report["overall_correctness"], "patch is correct")
            states = list(Path(state_dir).glob("*.json"))
            self.assertEqual(len(states), 1)
            self.assertEqual(AUTOREVIEW.json.loads(states[0].read_text())["status"], "passed")

    def test_non_json_result_gets_one_repair_pass(self) -> None:
        args = argparse.Namespace(engine="claude")
        with tempfile.TemporaryDirectory() as repo_dir, tempfile.TemporaryDirectory() as state_dir:
            with mock.patch.object(AUTOREVIEW, "run_engine", side_effect=["plain text", self.valid_report()]) as engine:
                with contextlib.redirect_stdout(io.StringIO()):
                    report = AUTOREVIEW.run_reviewer(args, Path(repo_dir), "prompt", set(), [], Path(state_dir))
            self.assertEqual(engine.call_count, 2)
            self.assertIn("Convert the candidate review", engine.call_args_list[1].args[2])
            self.assertEqual(report["findings"], [])

    def test_schema_invalid_json_gets_one_repair_pass(self) -> None:
        args = argparse.Namespace(engine="claude")
        invalid_report = AUTOREVIEW.json.dumps({"findings": []})
        with tempfile.TemporaryDirectory() as repo_dir, tempfile.TemporaryDirectory() as state_dir:
            with mock.patch.object(AUTOREVIEW, "run_engine", side_effect=[invalid_report, self.valid_report()]) as engine:
                with contextlib.redirect_stdout(io.StringIO()):
                    report = AUTOREVIEW.run_reviewer(args, Path(repo_dir), "prompt", set(), [], Path(state_dir))
            self.assertEqual(engine.call_count, 2)
            self.assertIn("Convert the candidate review", engine.call_args_list[1].args[2])
            self.assertEqual(report["overall_correctness"], "patch is correct")

    def test_repair_pass_retries_transport_failure(self) -> None:
        args = argparse.Namespace(engine="claude")
        transport = AUTOREVIEW.ReviewError(
            AUTOREVIEW.ReviewErrorCode.ENGINE_TRANSPORT_ERROR,
            "fixture transport failure",
        )
        with tempfile.TemporaryDirectory() as repo_dir, tempfile.TemporaryDirectory() as state_dir:
            with mock.patch.object(AUTOREVIEW, "run_engine", side_effect=["plain text", transport, self.valid_report()]) as engine:
                with mock.patch.object(AUTOREVIEW.time, "sleep"):
                    with contextlib.redirect_stdout(io.StringIO()):
                        report = AUTOREVIEW.run_reviewer(args, Path(repo_dir), "prompt", set(), [], Path(state_dir))
            self.assertEqual(engine.call_count, 3)
            self.assertEqual(report["findings"], [])

    def test_preflight_rejects_unsupported_no_tools_before_engine_execution(self) -> None:
        with tempfile.TemporaryDirectory() as repo_dir, tempfile.TemporaryDirectory() as state_dir:
            args = argparse.Namespace(
                state_dir=state_dir,
                codex_bin=sys.executable,
                claude_bin=sys.executable,
                droid_bin=sys.executable,
                copilot_bin=sys.executable,
            )
            reviewer = argparse.Namespace(engine="codex", tools=False, codex_bin=sys.executable)
            with self.assertRaises(AUTOREVIEW.ReviewError) as caught:
                AUTOREVIEW.preflight_review(args, [reviewer], Path(repo_dir), "")
            self.assertEqual(caught.exception.code, AUTOREVIEW.ReviewErrorCode.UNSUPPORTED_OPTION)

    def test_preflight_rejects_invalid_canonical_schema(self) -> None:
        with tempfile.TemporaryDirectory() as repo_dir, tempfile.TemporaryDirectory() as state_dir:
            args = argparse.Namespace(state_dir=state_dir)
            with self.assertRaises(AUTOREVIEW.ReviewError) as caught:
                AUTOREVIEW.preflight_review(args, [], Path(repo_dir), "", {"type": "array", "required": []})
            self.assertEqual(caught.exception.code, AUTOREVIEW.ReviewErrorCode.PREFLIGHT_ERROR)

    def test_compact_diff_omits_lockfile_body(self) -> None:
        with tempfile.TemporaryDirectory() as repo_dir:
            repo = Path(repo_dir)
            subprocess.run(["git", "init", "--quiet"], cwd=repo, check=True)
            subprocess.run(["git", "config", "user.name", "Fixture"], cwd=repo, check=True)
            subprocess.run(["git", "config", "user.email", "fixture@example.com"], cwd=repo, check=True)
            (repo / "pnpm-lock.yaml").write_text("lockfileVersion: '9.0'\n")
            subprocess.run(["git", "add", "pnpm-lock.yaml"], cwd=repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "-m", "initial"], cwd=repo, check=True)
            (repo / "pnpm-lock.yaml").write_text("secret-marker-that-must-not-enter-the-bundle\n")
            bundle = AUTOREVIEW.local_bundle(repo)
            self.assertIn("generated, lock, or binary patch omitted", bundle)
            self.assertNotIn("secret-marker-that-must-not-enter-the-bundle", bundle)

    def test_local_bundle_omits_untracked_lockfile_body(self) -> None:
        with tempfile.TemporaryDirectory() as repo_dir:
            repo = Path(repo_dir)
            subprocess.run(["git", "init", "--quiet"], cwd=repo, check=True)
            (repo / "pnpm-lock.yaml").write_text("secret-marker-that-must-not-enter-the-bundle\n")
            bundle = AUTOREVIEW.local_bundle(repo)
            self.assertIn("generated, lock, or binary file omitted", bundle)
            self.assertNotIn("secret-marker-that-must-not-enter-the-bundle", bundle)

    def test_local_bundle_does_not_follow_untracked_symlink(self) -> None:
        with tempfile.TemporaryDirectory() as repo_dir, tempfile.TemporaryDirectory() as external_dir:
            repo = Path(repo_dir)
            subprocess.run(["git", "init", "--quiet"], cwd=repo, check=True)
            external = Path(external_dir) / "secret.txt"
            external.write_text("external-secret-marker\n")
            (repo / "external-link").symlink_to(external)
            bundle = AUTOREVIEW.local_bundle(repo)
            self.assertIn("symlink target", bundle)
            self.assertNotIn("external-secret-marker", bundle)


if __name__ == "__main__":
    unittest.main()
