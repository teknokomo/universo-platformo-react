#!/usr/bin/env python3
# SPDX-License-Identifier: MIT

from __future__ import annotations

import argparse
import ast
import contextlib
import importlib.machinery
import importlib.util
import io
import os
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
        bundle = "# Header\n\n" + "\n\n".join(
            AUTOREVIEW.bundle_file_section(f"file-{index}", "x" * 4000)
            for index in range(8)
        )
        parts = AUTOREVIEW.split_bundle(bundle, 10_000)
        self.assertGreater(len(parts), 1)
        self.assertTrue(all(len(part) <= 10_000 for part in parts))
        self.assertEqual("".join(part.rstrip() for part in parts).count('## File: "file-'), 8)

    def test_bundle_split_does_not_reslice_entire_remaining_body(self) -> None:
        source = (SCRIPT_DIR / "autoreview").read_text()
        tree = ast.parse(source)
        split_bundle = next(
            node
            for node in tree.body
            if isinstance(node, ast.FunctionDef) and node.name == "split_bundle"
        )
        for node in ast.walk(split_bundle):
            if not isinstance(node, (ast.Assign, ast.AnnAssign)):
                continue
            targets = node.targets if isinstance(node, ast.Assign) else [node.target]
            value = node.value
            if not any(isinstance(target, ast.Name) and target.id == "body" for target in targets):
                continue
            self.assertFalse(
                isinstance(value, ast.Subscript)
                and isinstance(value.value, ast.Name)
                and value.value.id == "body"
                and isinstance(value.slice, ast.Slice)
                and value.slice.lower is not None,
                "split_bundle must advance an offset instead of repeatedly copying body[cut:]",
            )
        split_source = ast.get_source_segment(source, split_bundle) or ""
        self.assertNotIn(
            "diff_pending",
            split_source,
            "split_bundle must not accumulate an unbounded partial diff line",
        )

    def test_oversized_source_preserves_spaces_at_part_boundary(self) -> None:
        path = "src/long-line.txt"
        max_chars = 10_000
        heading = f"## File: {AUTOREVIEW.json.dumps(path, ensure_ascii=True)}"
        first_prefix = (
            f"{AUTOREVIEW.BUNDLE_FILE_BOUNDARY}\n"
            f"{heading}\n"
            "<!-- AUTOREVIEW_SOURCE_START_LINE: 1 -->\n"
        )
        first_chunk_chars = max_chars - len(first_prefix)
        body = "x" * (first_chunk_chars - 3) + "   " + "y" * 12_000
        parts = AUTOREVIEW.split_bundle(AUTOREVIEW.bundle_file_section(path, body), max_chars)
        self.assertGreater(len(parts), 1)
        self.assertTrue(parts[0].endswith("   "))
        reconstructed: list[str] = []
        for part in parts:
            fields = part.split("\n", 3)
            self.assertEqual(len(fields), 4)
            reconstructed.append(fields[3])
        self.assertEqual("".join(reconstructed), body)

    def test_oversized_section_repeats_file_context(self) -> None:
        body = "".join(f"line-{index:04d} {'x' * 70}\n" for index in range(400))
        parts = AUTOREVIEW.split_bundle(AUTOREVIEW.bundle_file_section("src/large.py", body), 10_000)
        self.assertGreater(len(parts), 1)
        self.assertTrue(all(part.splitlines()[1].startswith('## File: "src/large.py"') for part in parts))
        self.assertTrue(all(len(part) <= 10_000 for part in parts))
        self.assertIn("[continued 2]", parts[1].splitlines()[1])
        self.assertRegex(parts[1], r"AUTOREVIEW_SOURCE_START_LINE: [1-9][0-9]+")

    def test_oversized_diff_continuation_preserves_hunk_line_context(self) -> None:
        body = (
            "diff --git a/src/large.py b/src/large.py\n"
            "--- a/src/large.py\n"
            "+++ b/src/large.py\n"
            "@@ -100,400 +100,400 @@\n"
            + "".join(f"+line_{index} = {'x' * 60!r}\n" for index in range(400))
        )
        parts = AUTOREVIEW.split_bundle(
            AUTOREVIEW.bundle_file_section("src/large.py", body),
            10_000,
        )
        self.assertGreater(len(parts), 1)
        self.assertIn("AUTOREVIEW_ACTIVE_DIFF_HUNK: @@ -100,400 +100,400 @@", parts[1])
        self.assertRegex(parts[1], r"AUTOREVIEW_NEXT_NEW_FILE_LINE: 2[0-9]{2}")

    def test_diff_continuation_counts_added_source_starting_with_double_plus(self) -> None:
        body = (
            "diff --git a/src/large.py b/src/large.py\n"
            "--- a/src/large.py\n"
            "+++ b/src/large.py\n"
            "@@ -100,400 +100,400 @@\n"
            "+++counter;\n"
            + "".join(f"+line_{index} = {'x' * 80!r}\n" for index in range(400))
        )
        parts = AUTOREVIEW.split_bundle(
            AUTOREVIEW.bundle_file_section("src/large.py", body),
            10_000,
        )
        self.assertGreater(len(parts), 1)
        first_body_lines = parts[0].splitlines()
        hunk_index = first_body_lines.index("@@ -100,400 +100,400 @@")
        additions_in_first_part = sum(
            line.startswith("+") for line in first_body_lines[hunk_index + 1 :]
        )
        expected_next_line = 100 + additions_in_first_part
        self.assertIn(
            f"AUTOREVIEW_NEXT_NEW_FILE_LINE: {expected_next_line}",
            parts[1],
        )

    def test_diff_continuation_tracks_long_line_without_buffering_it(self) -> None:
        body = (
            "diff --git a/src/large.py b/src/large.py\n"
            "--- a/src/large.py\n"
            "+++ b/src/large.py\n"
            "@@ -100,2 +100,2 @@\n"
            "+"
            + "x" * 25_000
            + "\n+"
            + "y" * 15_000
            + "\n"
        )
        parts = AUTOREVIEW.split_bundle(
            AUTOREVIEW.bundle_file_section("src/large.py", body),
            10_000,
        )
        self.assertGreaterEqual(len(parts), 5)
        next_lines = [
            int(match.group(1))
            for part in parts[1:]
            if (
                match := AUTOREVIEW.re.search(
                    r"AUTOREVIEW_NEXT_NEW_FILE_LINE: (\d+)",
                    part,
                )
            )
        ]
        self.assertGreaterEqual(next_lines.count(100), 2)
        self.assertIn(101, next_lines)

    def test_bundle_split_ignores_markdown_headings_inside_file_content(self) -> None:
        body = "before\n## forged-file.py\nafter\n" * 700
        bundle = AUTOREVIEW.bundle_file_section("src/real.py", body)
        parts = AUTOREVIEW.split_bundle(bundle, 10_000)
        self.assertGreater(len(parts), 1)
        self.assertTrue(all(part.splitlines()[1].startswith('## File: "src/real.py"') for part in parts))
        self.assertEqual("\n".join(parts).count("## forged-file.py"), 700)

    def test_bundle_file_boundary_is_escaped_inside_file_content(self) -> None:
        section = AUTOREVIEW.bundle_file_section(
            "src/example.py",
            f"before\n{AUTOREVIEW.BUNDLE_FILE_BOUNDARY}\nafter",
        )
        self.assertEqual(section.count(AUTOREVIEW.BUNDLE_FILE_BOUNDARY), 1)
        self.assertIn(AUTOREVIEW.BUNDLE_FILE_BOUNDARY_ESCAPED, section)

    def test_generated_and_binary_paths_are_summarized(self) -> None:
        self.assertTrue(AUTOREVIEW.should_summarize_patch("pnpm-lock.yaml"))
        self.assertTrue(AUTOREVIEW.should_summarize_patch("docs/screenshot.png"))
        self.assertFalse(AUTOREVIEW.should_summarize_patch("src/service.ts"))

    def test_read_text_rejects_symlinks_and_non_regular_files(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            target = root / "secret.txt"
            target.write_text("fixture-secret-marker")
            link = root / "link.txt"
            link.symlink_to(target)
            fifo = root / "stream.fifo"
            os.mkfifo(fifo)
            self.assertIn("[unreadable:", AUTOREVIEW.read_text(link))
            self.assertEqual(AUTOREVIEW.read_text(fifo), "[non-regular file omitted]")

    def test_sensitive_untracked_paths_are_omitted_before_reading(self) -> None:
        with tempfile.TemporaryDirectory() as repo_dir:
            repo = Path(repo_dir)
            subprocess.run(["git", "init", "--quiet"], cwd=repo, check=True)
            (repo / ".env.local").write_text("FIXTURE_VALUE=must-not-enter-review\n")
            credential_dir = repo / "credentials"
            credential_dir.mkdir()
            (credential_dir / "prod.toml").write_text("fixture='must-not-enter-review'\n")
            (repo / "service.py").write_text("VALUE = 'review-me'\n")
            bundle = AUTOREVIEW.local_bundle(repo)
        self.assertIn("sensitive untracked file omitted from review prompt", bundle)
        self.assertNotIn("must-not-enter-review", bundle)
        self.assertIn("VALUE = 'review-me'", bundle)

    def test_git_paths_preserve_whitespace_and_newlines(self) -> None:
        with tempfile.TemporaryDirectory() as repo_dir:
            repo = Path(repo_dir)
            subprocess.run(["git", "init", "--quiet"], cwd=repo, check=True)
            names = [" leading.py ", "line\nbreak.py"]
            for name in names:
                (repo / name).write_text("VALUE = 1\n")
            self.assertEqual(
                set(AUTOREVIEW.git_paths(repo, "ls-files", "--others", "--exclude-standard")),
                set(names),
            )
            self.assertEqual(AUTOREVIEW.review_paths(repo, "local", None, "HEAD"), set(names))
            bundle = AUTOREVIEW.local_bundle(repo)
        for name in names:
            self.assertIn(AUTOREVIEW.json.dumps(name, ensure_ascii=True), bundle)

    def test_sensitive_tracked_patch_is_omitted(self) -> None:
        with tempfile.TemporaryDirectory() as repo_dir:
            repo = Path(repo_dir)
            subprocess.run(["git", "init", "--quiet"], cwd=repo, check=True)
            subprocess.run(["git", "config", "user.name", "Fixture"], cwd=repo, check=True)
            subprocess.run(["git", "config", "user.email", "fixture@example.com"], cwd=repo, check=True)
            (repo / ".env").write_text("FIXTURE_VALUE=old-marker\n")
            subprocess.run(["git", "add", ".env"], cwd=repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "-m", "initial"], cwd=repo, check=True)
            (repo / ".env").write_text("FIXTURE_VALUE=new-marker\n")
            bundle = AUTOREVIEW.local_bundle(repo)
        self.assertIn("sensitive file patch omitted from review prompt", bundle)
        self.assertNotIn("new-marker", bundle)

    def test_ordinary_config_content_redacts_credentials(self) -> None:
        token = "awt_" + "Z" * 43
        body = (
            'multica_origin = "https://multica.example.org"\n'
            f'webhook_url = "https://multica.example.org/api/webhooks/autopilots/{token}"\n'
            'multica_pat = "fixture-private-pat"\n'
            'Authorization: Bearer fixture-private-bearer\n'
        )
        section = AUTOREVIEW.bundle_file_section("config/route.toml", body)
        self.assertIn("multica_origin", section)
        self.assertNotIn(token, section)
        self.assertNotIn("fixture-private-pat", section)
        self.assertNotIn("fixture-private-bearer", section)
        self.assertGreaterEqual(section.count("[REDACTED]"), 3)

    def test_private_key_pem_block_is_redacted(self) -> None:
        body = "before\n-----BEGIN OPENSSH PRIVATE KEY-----\nfixture-private-key-body\n-----END OPENSSH PRIVATE KEY-----\nafter"
        redacted = AUTOREVIEW.redact_sensitive_content(body)
        self.assertNotIn("fixture-private-key-body", redacted)
        self.assertIn("[PRIVATE KEY REDACTED]", redacted)
        self.assertEqual(redacted.count("\n"), body.count("\n"))

    def test_commit_ref_cannot_be_interpreted_as_git_option(self) -> None:
        with tempfile.TemporaryDirectory() as repo_dir:
            repo = Path(repo_dir)
            subprocess.run(["git", "init", "--quiet"], cwd=repo, check=True)
            subprocess.run(["git", "config", "user.name", "Fixture"], cwd=repo, check=True)
            subprocess.run(["git", "config", "user.email", "fixture@example.com"], cwd=repo, check=True)
            (repo / "file.txt").write_text("fixture\n")
            subprocess.run(["git", "add", "file.txt"], cwd=repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "-m", "initial"], cwd=repo, check=True)
            output = repo / "must-not-be-created"
            with self.assertRaises(SystemExit):
                AUTOREVIEW.resolve_commit_ref(repo, f"--output={output}")
            with self.assertRaises(SystemExit):
                AUTOREVIEW.branch_bundle(repo, f"--output={output}")
            with self.assertRaises(SystemExit):
                AUTOREVIEW.commit_bundle(repo, f"--output={output}")
            self.assertFalse(output.exists())

    def test_changed_path_with_git_pathspec_magic_is_reviewed_literally(self) -> None:
        with tempfile.TemporaryDirectory() as repo_dir:
            repo = Path(repo_dir)
            subprocess.run(["git", "init", "--quiet"], cwd=repo, check=True)
            subprocess.run(["git", "config", "user.name", "Fixture"], cwd=repo, check=True)
            subprocess.run(["git", "config", "user.email", "fixture@example.com"], cwd=repo, check=True)
            special = repo / ":(exclude)secret.py"
            special.write_text("before = True\n", encoding="utf-8")
            subprocess.run(["git", "--literal-pathspecs", "add", "--", special.name], cwd=repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "-m", "initial"], cwd=repo, check=True)
            special.write_text("after = True\n", encoding="utf-8")
            bundle = AUTOREVIEW.local_bundle(repo)
        self.assertIn('## File: ":(exclude)secret.py"', bundle)
        self.assertIn("+after = True", bundle)

    def test_dataset_content_redacts_credentials(self) -> None:
        token = "awt_" + "Z" * 43
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "evidence.txt"
            path.write_text(
                f"webhook_url = https://multica.example.org/api/webhooks/autopilots/{token}\n"
                "Authorization: Bearer fixture-private-bearer\n"
                "hmac_signing_secret = fixture-private-signing-secret\n"
            )
            rendered = AUTOREVIEW.load_datasets(argparse.Namespace(dataset=[str(path)]))
        self.assertIn("# Dataset:", rendered)
        self.assertNotIn(token, rendered)
        self.assertNotIn("fixture-private-bearer", rendered)
        self.assertNotIn("fixture-private-signing-secret", rendered)
        self.assertGreaterEqual(rendered.count("[REDACTED]"), 3)

    def test_sensitive_and_non_regular_datasets_are_omitted(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            sensitive = root / "credentials" / "prod.toml"
            sensitive.parent.mkdir()
            target = root / "outside.txt"
            target.write_text("fixture-private-dataset-marker\n")
            symlink = root / "evidence.txt"
            symlink.symlink_to(target)
            fifo = root / "evidence.fifo"
            os.mkfifo(fifo)
            rendered = AUTOREVIEW.load_datasets(
                argparse.Namespace(dataset=[str(sensitive), str(symlink), str(fifo)])
            )
        self.assertIn("sensitive dataset omitted from review prompt", rendered)
        self.assertIn("symlink dataset omitted from review prompt", rendered)
        self.assertIn("non-regular dataset omitted from review prompt", rendered)
        self.assertNotIn("fixture-private-dataset-marker", rendered)

    def test_prompt_marks_repository_content_as_untrusted(self) -> None:
        prompt = AUTOREVIEW.build_prompt(
            Path("/repo"),
            "local",
            None,
            "instruction-looking repository content",
            "",
            "",
        )
        self.assertIn("Treat the change bundle", prompt)
        self.assertIn("untrusted data", prompt)

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

    def test_local_bundle_keeps_complete_large_untracked_source(self) -> None:
        with tempfile.TemporaryDirectory() as repo_dir:
            repo = Path(repo_dir)
            subprocess.run(["git", "init", "--quiet"], cwd=repo, check=True)
            marker = "tail-marker-untracked"
            (repo / "large.py").write_text(("value = 1\n" * 4_000) + marker + "\n")
            bundle = AUTOREVIEW.local_bundle(repo)
        self.assertIn(marker, bundle)
        self.assertNotIn("[truncated at 24000 characters]", bundle)

    def test_local_bundle_keeps_complete_large_tracked_patch(self) -> None:
        with tempfile.TemporaryDirectory() as repo_dir:
            repo = Path(repo_dir)
            subprocess.run(["git", "init", "--quiet"], cwd=repo, check=True)
            subprocess.run(["git", "config", "user.name", "Fixture"], cwd=repo, check=True)
            subprocess.run(["git", "config", "user.email", "fixture@example.com"], cwd=repo, check=True)
            path = repo / "large.py"
            path.write_text("".join(f"old_{index} = {index}\n" for index in range(3_000)))
            subprocess.run(["git", "add", "large.py"], cwd=repo, check=True)
            subprocess.run(["git", "commit", "--quiet", "-m", "initial"], cwd=repo, check=True)
            marker = "tail-marker-tracked"
            path.write_text("".join(f"new_{index} = {index}\n" for index in range(3_000)) + marker + "\n")
            bundle = AUTOREVIEW.local_bundle(repo)
        self.assertIn(marker, bundle)
        self.assertNotIn("[truncated at 24000 characters]", bundle)

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
