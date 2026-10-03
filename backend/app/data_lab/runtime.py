from __future__ import annotations

import json
import logging
import queue
import shutil
import subprocess
import threading
from collections import deque
from pathlib import Path

from app.data_lab import config

logger = logging.getLogger(__name__)

CONTAINER_PREFIX = "dhruvsetu-lab-"
CONTAINER_LABEL = "dhruvsetu.data-lab=session"


class LabUnavailable(Exception):
    """The analysis runtime could not be started. The message is safe to show."""


class LabSessionEnded(Exception):
    """The container for a session is no longer running."""


def build_run_command(
    docker: str,
    session_id: str,
    dataset_path: Path,
    file_type: str,
) -> list[str]:
    """Build the command for one session container.

    The container gets no network, a read-only root filesystem, and exactly
    one mount: the dataset file, read-only. Nothing else from the host is
    visible inside it.
    """
    source = str(dataset_path)
    if "," in source:
        raise LabUnavailable("The dataset file path cannot be used for a session.")

    return [
        docker,
        "run",
        "--rm",
        "--interactive",
        "--name",
        f"{CONTAINER_PREFIX}{session_id}",
        "--label",
        CONTAINER_LABEL,
        "--network",
        "none",
        "--read-only",
        "--tmpfs",
        f"/tmp:rw,nosuid,nodev,size={config.TEMP_SIZE}",
        "--tmpfs",
        f"/workspace:rw,nosuid,nodev,noexec,size={config.WORKSPACE_SIZE},uid=1000,gid=1000,mode=0700",
        "--mount",
        f"type=bind,source={source},target={config.DATA_DIRECTORY}/dataset.{file_type},readonly",
        "--memory",
        config.CONTAINER_MEMORY,
        "--memory-swap",
        config.CONTAINER_MEMORY,
        "--cpus",
        config.CONTAINER_CPUS,
        "--pids-limit",
        config.CONTAINER_PROCESS_LIMIT,
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges",
        "--env",
        f"LAB_IDLE_SECONDS={config.idle_timeout_minutes() * 60}",
        config.image_name(),
    ]


class LabProcess:
    """One running session container and the line channel to its kernel bridge."""

    def __init__(self, docker: str, session_id: str, command: list[str]) -> None:
        self._docker = docker
        self._name = f"{CONTAINER_PREFIX}{session_id}"
        self._process = subprocess.Popen(
            command,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
        )
        self._replies: queue.Queue[dict | None] = queue.Queue()
        self._errors: deque[str] = deque(maxlen=20)
        threading.Thread(target=self._read_replies, daemon=True).start()
        threading.Thread(target=self._read_errors, daemon=True).start()

    def _read_replies(self) -> None:
        for line in self._process.stdout:
            try:
                reply = json.loads(line)
            except ValueError:
                continue
            if isinstance(reply, dict):
                self._replies.put(reply)
        self._replies.put(None)

    def _read_errors(self) -> None:
        for line in self._process.stderr:
            self._errors.append(line.rstrip())

    @property
    def alive(self) -> bool:
        return self._process.poll() is None

    def error_tail(self) -> str:
        return " | ".join(self._errors)

    def wait_ready(self, timeout: float) -> None:
        reply = self._next_reply(timeout)
        if reply is None or reply.get("event") != "ready":
            raise LabSessionEnded("The session did not start")

    def execute(self, code: str, timeout: int) -> dict:
        if not self.alive:
            raise LabSessionEnded("The session has ended")
        try:
            self._process.stdin.write(
                json.dumps({"op": "execute", "code": code, "timeout": timeout}) + "\n"
            )
            self._process.stdin.flush()
        except (BrokenPipeError, OSError, ValueError) as error:
            raise LabSessionEnded("The session has ended") from error

        reply = self._next_reply(timeout + config.REPLY_GRACE_SECONDS)
        if reply is None:
            raise LabSessionEnded("The session has ended")
        return reply

    def _next_reply(self, timeout: float) -> dict | None:
        try:
            return self._replies.get(timeout=timeout)
        except queue.Empty:
            # No answer in time: the container is stopped, never left running.
            self.stop()
            return None

    def stop(self) -> None:
        if self.alive:
            try:
                self._process.stdin.write(json.dumps({"op": "shutdown"}) + "\n")
                self._process.stdin.flush()
                self._process.stdin.close()
                self._process.wait(timeout=5)
            except (BrokenPipeError, OSError, ValueError, subprocess.TimeoutExpired):
                pass
        if self.alive:
            subprocess.run(
                [self._docker, "kill", self._name],
                capture_output=True,
                timeout=20,
                check=False,
            )
            try:
                self._process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self._process.kill()


def start_container(session_id: str, dataset_path: Path, file_type: str) -> LabProcess:
    docker = shutil.which("docker")
    if docker is None:
        raise LabUnavailable("Docker is not installed, so analysis sessions cannot start.")

    try:
        check = subprocess.run(
            [docker, "image", "inspect", config.image_name()],
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        raise LabUnavailable("Docker did not respond, so the session could not start.") from error
    if check.returncode != 0:
        if "daemon" in check.stderr.lower():
            raise LabUnavailable("Docker is not running, so analysis sessions cannot start.")
        raise LabUnavailable(
            "The Data Lab image has not been built. Run: docker compose build data-lab"
        )

    process = LabProcess(
        docker, session_id, build_run_command(docker, session_id, dataset_path, file_type)
    )
    try:
        process.wait_ready(config.STARTUP_TIMEOUT_SECONDS)
    except LabSessionEnded as error:
        logger.warning("Data Lab session failed to start: %s", process.error_tail())
        process.stop()
        raise LabUnavailable("The analysis session could not be started.") from error
    return process
