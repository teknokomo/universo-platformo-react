#!/usr/bin/env python3
# SPDX-License-Identifier: MIT

from __future__ import annotations

import json
import os
import queue
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import time
import uuid
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Callable


DEFAULT_REVIEW_TIMEOUT_SECONDS = 600
TRANSPORT_ATTEMPTS = 3
ACTIVE_RUN_STATUSES = {"running", "retrying", "repairing"}


class ReviewErrorCode(str, Enum):
    ENGINE_TRANSPORT_ERROR = "ENGINE_TRANSPORT_ERROR"
    ENGINE_TIMEOUT = "ENGINE_TIMEOUT"
    ENGINE_SCHEMA_ERROR = "ENGINE_SCHEMA_ERROR"
    ENGINE_AUTH_ERROR = "ENGINE_AUTH_ERROR"
    ENGINE_SANDBOX_ERROR = "ENGINE_SANDBOX_ERROR"
    PROMPT_CONFLICT = "PROMPT_CONFLICT"
    BUNDLE_TOO_LARGE = "BUNDLE_TOO_LARGE"
    UNSUPPORTED_OPTION = "UNSUPPORTED_OPTION"
    PREFLIGHT_ERROR = "PREFLIGHT_ERROR"


class ReviewError(RuntimeError):
    def __init__(self, code: ReviewErrorCode, message: str, *, detail: str = "") -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.detail = detail

    def __str__(self) -> str:
        suffix = f"\n{self.detail}" if self.detail else ""
        return f"[{self.code.value}] {self.message}{suffix}"


def bounded_detail(text: str, limit: int = 4000) -> str:
    if len(text) <= limit:
        return text
    return text[: max(0, limit - 15)] + "\n\n[truncated]"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def write_private_json(path: Path, data: dict[str, Any]) -> None:
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.stem}-", suffix=".tmp", dir=path.parent)
    temp_path = Path(temp_name)
    try:
        with os.fdopen(fd, "w") as handle:
            json.dump(data, handle, indent=2)
            handle.write("\n")
        os.chmod(temp_path, 0o600)
        os.replace(temp_path, path)
    finally:
        temp_path.unlink(missing_ok=True)


def process_is_alive(pid: Any) -> bool:
    if not isinstance(pid, int) or pid < 1:
        return False
    try:
        os.kill(pid, 0)
    except (OSError, ValueError):
        return False
    return True


def resolve_state_dir(repo: Path, override: str | None = None) -> Path:
    if override:
        state_dir = Path(override).expanduser()
    elif os.environ.get("AUTOREVIEW_STATE_DIR"):
        state_dir = Path(os.environ["AUTOREVIEW_STATE_DIR"]).expanduser()
    elif os.environ.get("XDG_STATE_HOME"):
        state_dir = Path(os.environ["XDG_STATE_HOME"]).expanduser() / "autoreview" / "runs"
    else:
        state_dir = Path.home() / ".local" / "state" / "autoreview" / "runs"
    state_dir = state_dir.resolve()
    if state_dir == repo or repo in state_dir.parents:
        raise ReviewError(ReviewErrorCode.PREFLIGHT_ERROR, "review state directory must be outside the repository")
    try:
        state_dir.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=state_dir, prefix=".write-test-", delete=True):
            pass
    except OSError as exc:
        raise ReviewError(
            ReviewErrorCode.ENGINE_SANDBOX_ERROR,
            f"review state directory is not writable: {state_dir}",
            detail=str(exc),
        ) from exc
    return state_dir


class ReviewRunState:
    def __init__(self, state_dir: Path, engine: str, bundle_hash: str) -> None:
        for candidate in state_dir.glob("*.json"):
            try:
                existing = json.loads(candidate.read_text())
            except (OSError, json.JSONDecodeError):
                continue
            if (
                existing.get("engine") == engine
                and existing.get("bundle_hash") == bundle_hash
                and existing.get("status") in ACTIVE_RUN_STATUSES
                and process_is_alive(existing.get("controller_pid", existing.get("pid")))
            ):
                raise ReviewError(
                    ReviewErrorCode.PREFLIGHT_ERROR,
                    f"an equivalent review is already running: {existing.get('run_id')}",
                )
        self.run_id = str(uuid.uuid4())
        self.path = state_dir / f"{self.run_id}.json"
        self.data: dict[str, Any] = {
            "run_id": self.run_id,
            "engine": engine,
            "status": "running",
            "started_at": utc_now(),
            "updated_at": utc_now(),
            "controller_pid": os.getpid(),
            "pid": None,
            "bundle_hash": bundle_hash,
            "error_code": None,
        }
        self.write()

    def update(self, **values: Any) -> None:
        self.data.update(values)
        self.data["updated_at"] = utc_now()
        self.write()

    def write(self) -> None:
        write_private_json(self.path, self.data)


PROMPT_CONFLICT_PATTERNS = {
    "Markdown output": re.compile(r"(?im)\b(?:return|respond|output|format)\b[^\n.;]*\bmarkdown\b"),
    "alternate report structure": re.compile(r"(?im)^#{1,6}\s+output report structure\s*$"),
    "table output": re.compile(r"(?im)\b(?:return|respond|output|organize)\b[^\n.;]*\btable\b"),
    "alternate top-level JSON schema": re.compile(r'(?im)^\s*"(?:overview|verdict|action_plan)"\s*:'),
}
NEGATED_OUTPUT_PREFIX = re.compile(r"(?i)(?:do\s+not|don't|never|must\s+not)\s*$")


def validate_extra_prompt(extra_prompt: str) -> None:
    conflicts: list[str] = []
    for name, pattern in PROMPT_CONFLICT_PATTERNS.items():
        for match in pattern.finditer(extra_prompt):
            if name in {"Markdown output", "table output"}:
                line_start = extra_prompt.rfind("\n", 0, match.start()) + 1
                if NEGATED_OUTPUT_PREFIX.search(extra_prompt[line_start : match.start()]):
                    continue
            conflicts.append(name)
            break
    if conflicts:
        raise ReviewError(
            ReviewErrorCode.PROMPT_CONFLICT,
            "additional review instructions conflict with the canonical JSON output contract",
            detail=", ".join(conflicts),
        )


def executable_for_engine(args: Any, engine: str) -> str:
    return str(getattr(args, f"{engine}_bin"))


def preflight_review(
    args: Any,
    reviewers: list[Any],
    repo: Path,
    extra_prompt: str,
    canonical_schema: dict[str, Any] | None = None,
) -> Path:
    validate_extra_prompt(extra_prompt)
    if canonical_schema is not None:
        try:
            json.dumps(canonical_schema)
            required = set(canonical_schema["required"])
        except (KeyError, TypeError, ValueError) as exc:
            raise ReviewError(ReviewErrorCode.PREFLIGHT_ERROR, "canonical review JSON schema is invalid", detail=str(exc)) from exc
        expected = {"findings", "overall_correctness", "overall_explanation", "overall_confidence"}
        if canonical_schema.get("type") != "object" or required != expected:
            raise ReviewError(ReviewErrorCode.PREFLIGHT_ERROR, "canonical review JSON schema has an unexpected root contract")
    state_dir = resolve_state_dir(repo, args.state_dir)
    for reviewer in reviewers:
        if not reviewer.tools and reviewer.engine in {"codex", "copilot"}:
            raise ReviewError(
                ReviewErrorCode.UNSUPPORTED_OPTION,
                f"--no-tools is not supported by the {reviewer.engine} engine",
            )
        executable = executable_for_engine(reviewer, reviewer.engine)
        if not shutil.which(executable):
            raise ReviewError(ReviewErrorCode.PREFLIGHT_ERROR, f"review engine executable was not found: {executable}")
    try:
        with tempfile.NamedTemporaryFile(prefix="autoreview-preflight-", delete=True):
            pass
    except OSError as exc:
        raise ReviewError(ReviewErrorCode.ENGINE_SANDBOX_ERROR, "temporary directory is not writable", detail=str(exc)) from exc
    return state_dir


def classify_engine_failure(engine: str, returncode: int, output: str) -> ReviewError:
    lowered = output.lower()
    if any(
        token in lowered
        for token in (
            "stream disconnected",
            "stopped responding",
            "connection reset",
            "failed to connect",
            "service unavailable",
        )
    ) and not any(token in lowered for token in ("malformed json", "strict codex output schema")):
        code = ReviewErrorCode.ENGINE_TRANSPORT_ERROR
    elif any(token in lowered for token in ("unauthorized", "authentication failed", "invalid api key", "http 401")):
        code = ReviewErrorCode.ENGINE_AUTH_ERROR
    elif any(token in lowered for token in ("read-only file system", "readonly database", "permission denied")):
        code = ReviewErrorCode.ENGINE_SANDBOX_ERROR
    elif any(token in lowered for token in ("malformed json", "strict codex output schema", "non-json output")):
        code = ReviewErrorCode.ENGINE_SCHEMA_ERROR
    else:
        code = ReviewErrorCode.ENGINE_TRANSPORT_ERROR
    return ReviewError(code, f"{engine} engine failed with exit code {returncode}", detail=bounded_detail(output))


def stop_process(proc: subprocess.Popen[Any]) -> None:
    if proc.poll() is not None:
        return
    try:
        os.killpg(proc.pid, signal.SIGTERM)
        proc.wait(timeout=5)
    except (ProcessLookupError, subprocess.TimeoutExpired):
        if proc.poll() is None:
            try:
                os.killpg(proc.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            proc.wait(timeout=5)


def show_run_status(state_dir: Path, run_id: str) -> int:
    if not re.fullmatch(r"[0-9a-fA-F-]{36}", run_id):
        raise ReviewError(ReviewErrorCode.PREFLIGHT_ERROR, "invalid review run id")
    path = state_dir / f"{run_id}.json"
    try:
        data = json.loads(path.read_text())
    except FileNotFoundError as exc:
        raise ReviewError(ReviewErrorCode.PREFLIGHT_ERROR, f"review run was not found: {run_id}") from exc
    controller_pid = data.get("controller_pid", data.get("pid"))
    if data.get("status") in ACTIVE_RUN_STATUSES and not process_is_alive(controller_pid):
        data.update(
            status="incomplete",
            updated_at=utc_now(),
            error_code=ReviewErrorCode.ENGINE_TRANSPORT_ERROR.value,
            error="review process ended without a terminal result",
            pid=None,
        )
        write_private_json(path, data)
    print(json.dumps(data, indent=2))
    return 0 if data.get("status") in {"passed", "findings", "failed", "timed_out", "cancelled", "incomplete"} else 3


def run_with_heartbeat(
    args: list[str],
    cwd: Path,
    *,
    input_text: str | None = None,
    label: str,
    heartbeat_seconds: int = 60,
    timeout_seconds: int = DEFAULT_REVIEW_TIMEOUT_SECONDS,
    stream_output: bool = False,
    stream_display: Callable[[str, str], str | None] | None = None,
    run_state: ReviewRunState | None = None,
) -> subprocess.CompletedProcess[str]:
    if stream_output:
        return run_with_stream(
            args,
            cwd,
            input_text=input_text,
            label=label,
            heartbeat_seconds=heartbeat_seconds,
            timeout_seconds=timeout_seconds,
            stream_display=stream_display,
            run_state=run_state,
        )
    started = time.monotonic()
    proc = subprocess.Popen(
        args,
        cwd=cwd,
        stdin=subprocess.PIPE if input_text is not None else None,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        start_new_session=True,
    )
    if run_state:
        run_state.update(pid=proc.pid)
    first_communicate = True
    deadline = started + timeout_seconds
    while True:
        remaining_seconds = deadline - time.monotonic()
        if remaining_seconds <= 0:
            stop_process(proc)
            stdout, stderr = proc.communicate()
            raise ReviewError(
                ReviewErrorCode.ENGINE_TIMEOUT,
                f"{label} review exceeded {timeout_seconds}s and was terminated",
                detail=bounded_detail(stderr or stdout),
            )
        try:
            stdout, stderr = proc.communicate(
                input=input_text if first_communicate else None,
                timeout=min(float(heartbeat_seconds), remaining_seconds),
            )
            return subprocess.CompletedProcess(args, int(proc.returncode or 0), stdout, stderr)
        except subprocess.TimeoutExpired:
            first_communicate = False
            now = time.monotonic()
            elapsed = int(now - started)
            remaining = max(0, int(deadline - now))
            if now >= deadline:
                stop_process(proc)
                stdout, stderr = proc.communicate()
                raise ReviewError(
                    ReviewErrorCode.ENGINE_TIMEOUT,
                    f"{label} review exceeded {timeout_seconds}s and was terminated",
                    detail=bounded_detail(stderr or stdout),
                )
            print(
                f"review still running: {label} elapsed={elapsed}s remaining={remaining}s pid={proc.pid}",
                file=sys.stderr,
                flush=True,
            )
        except KeyboardInterrupt:
            stop_process(proc)
            raise


def run_with_stream(
    args: list[str],
    cwd: Path,
    *,
    input_text: str | None,
    label: str,
    heartbeat_seconds: int,
    timeout_seconds: int,
    stream_display: Callable[[str, str], str | None] | None,
    run_state: ReviewRunState | None,
) -> subprocess.CompletedProcess[str]:
    started = time.monotonic()
    proc = subprocess.Popen(
        args,
        cwd=cwd,
        stdin=subprocess.PIPE if input_text is not None else None,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
        start_new_session=True,
    )
    if run_state:
        run_state.update(pid=proc.pid)
    deadline = started + timeout_seconds
    events: queue.Queue[tuple[str, str | None]] = queue.Queue()
    stdout_parts: list[str] = []
    stderr_parts: list[str] = []

    def read_stream(name: str, stream: Any) -> None:
        try:
            for line in iter(stream.readline, ""):
                events.put((name, line))
        finally:
            events.put((name, None))

    def write_stdin() -> None:
        if proc.stdin is None or input_text is None:
            return
        try:
            proc.stdin.write(input_text)
            proc.stdin.close()
        except BrokenPipeError:
            return

    threads = [
        threading.Thread(target=read_stream, args=("stdout", proc.stdout), daemon=True),
        threading.Thread(target=read_stream, args=("stderr", proc.stderr), daemon=True),
    ]
    for thread in threads:
        thread.start()
    stdin_thread = threading.Thread(target=write_stdin, daemon=True)
    stdin_thread.start()

    def finish_threads() -> None:
        for thread in threads:
            thread.join(timeout=5)
        stdin_thread.join(timeout=1)
        if proc.stdout:
            proc.stdout.close()
        if proc.stderr:
            proc.stderr.close()

    open_streams = 2
    while open_streams:
        now = time.monotonic()
        elapsed = int(now - started)
        remaining_seconds = deadline - now
        if remaining_seconds <= 0:
            stop_process(proc)
            finish_threads()
            raise ReviewError(
                ReviewErrorCode.ENGINE_TIMEOUT,
                f"{label} review exceeded {timeout_seconds}s and was terminated",
                detail=bounded_detail("".join(stderr_parts) or "".join(stdout_parts)),
            )
        try:
            name, line = events.get(timeout=min(float(heartbeat_seconds), remaining_seconds))
        except KeyboardInterrupt:
            stop_process(proc)
            finish_threads()
            raise
        except queue.Empty:
            now = time.monotonic()
            elapsed = int(now - started)
            remaining = max(0, int(deadline - now))
            print(
                f"review still running: {label} elapsed={elapsed}s remaining={remaining}s pid={proc.pid}",
                file=sys.stderr,
                flush=True,
            )
            continue
        if line is None:
            open_streams -= 1
            continue
        if name == "stdout":
            stdout_parts.append(line)
        else:
            stderr_parts.append(line)
        display = stream_display(name, line) if stream_display else line
        if display:
            target = sys.stdout if name == "stdout" else sys.stderr
            target.write(display)
            target.flush()

    finish_threads()
    returncode = proc.wait()
    return subprocess.CompletedProcess(args, returncode, "".join(stdout_parts), "".join(stderr_parts))
