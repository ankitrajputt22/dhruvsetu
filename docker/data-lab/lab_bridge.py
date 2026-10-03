"""Bridge between the DhruvSetu backend and a Jupyter kernel.

This script runs inside the Data Lab container. It starts one IPython kernel,
reads one JSON request per line from standard input, runs the code in the
kernel, and writes one JSON reply per line. It has no network access and no
other way to reach the host.
"""
from __future__ import annotations

import json
import os
import queue
import re
import select
import subprocess
import sys
import time

from jupyter_client import KernelManager

TABLE_MIME = "application/vnd.dhruvsetu.table+json"
ANSI = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")

MAX_TEXT_CHARS = 20_000
MAX_OUTPUTS = 30
MAX_IMAGES = 4
MAX_IMAGE_BASE64_CHARS = 1_400_000
MAX_TRACEBACK_CHARS = 6_000
INTERRUPT_GRACE_SECONDS = 5

IDLE_SECONDS = int(os.environ.get("LAB_IDLE_SECONDS", "1800"))

# Runs once in every new kernel. It shows DataFrames as plain table data
# instead of HTML and sends matplotlib figures back as PNG images.
SETUP_CODE = r'''
def _dhruvsetu_setup():
    import math
    import os

    import matplotlib
    import numpy as np
    import pandas as pd
    from IPython import get_ipython
    from IPython.core.formatters import BaseFormatter
    from traitlets import ObjectName, Unicode

    max_rows, max_columns, max_cell = 50, 30, 200

    def clip(text):
        text = str(text)
        return text if len(text) <= max_cell else text[: max_cell - 1] + "…"

    def cell(value):
        if value is None:
            return None
        try:
            if pd.isna(value):
                return None
        except (TypeError, ValueError):
            pass
        if isinstance(value, (bool, np.bool_)):
            return str(bool(value))
        if isinstance(value, (int, np.integer)):
            number = int(value)
            return number if abs(number) < 2**53 else str(number)
        if isinstance(value, (float, np.floating)):
            number = float(value)
            return number if math.isfinite(number) else str(number)
        return clip(value)

    def table(frame):
        if isinstance(frame, pd.Series):
            frame = frame.to_frame(name="value" if frame.name is None else frame.name)
        total_rows, total_columns = frame.shape
        shown = frame.iloc[:max_rows, :max_columns]
        index_name = shown.index.name
        return {
            "columns": [clip(column) for column in shown.columns],
            "index": [clip(label) for label in shown.index],
            "index_name": None if index_name is None else clip(index_name),
            "rows": [[cell(value) for value in row] for row in shown.itertuples(index=False, name=None)],
            "total_rows": int(total_rows),
            "total_columns": int(total_columns),
        }

    class TableFormatter(BaseFormatter):
        format_type = Unicode("application/vnd.dhruvsetu.table+json")
        print_method = ObjectName("_repr_dhruvsetu_table_")
        _return_type = dict

    shell = get_ipython()
    formatter = TableFormatter(parent=shell.display_formatter)
    formatter.for_type(pd.DataFrame, table)
    formatter.for_type(pd.Series, table)
    shell.display_formatter.formatters[formatter.format_type] = formatter
    if formatter.format_type not in shell.display_formatter.active_types:
        shell.display_formatter.active_types.append(formatter.format_type)

    shell.run_line_magic("matplotlib", "inline")
    matplotlib.rcParams["figure.figsize"] = (6.4, 4.0)
    matplotlib.rcParams["figure.dpi"] = 100
    os.chdir("/workspace")


_dhruvsetu_setup()
del _dhruvsetu_setup
'''


class Outputs:
    """Collects cell output and keeps it within fixed limits."""

    def __init__(self) -> None:
        self.items: list[dict] = []
        self.text_chars = 0
        self.images = 0
        self.truncated = False

    def _add(self, item: dict) -> None:
        if len(self.items) >= MAX_OUTPUTS:
            self.truncated = True
            return
        self.items.append(item)

    def add_text(self, stream: str, text: str) -> None:
        text = ANSI.sub("", text)
        room = MAX_TEXT_CHARS - self.text_chars
        if room <= 0:
            self.truncated = True
            return
        if len(text) > room:
            text = text[:room]
            self.truncated = True
        self.text_chars += len(text)
        last = self.items[-1] if self.items else None
        if last and last["type"] == "text" and last["stream"] == stream:
            last["text"] += text
        else:
            self._add({"type": "text", "stream": stream, "text": text})

    def add_bundle(self, data: dict) -> None:
        if isinstance(data.get(TABLE_MIME), dict):
            self._add({"type": "table", **data[TABLE_MIME]})
        elif isinstance(data.get("image/png"), str):
            image = data["image/png"].replace("\n", "")
            if self.images >= MAX_IMAGES or len(image) > MAX_IMAGE_BASE64_CHARS:
                self.truncated = True
                self.add_text("stderr", "An image was left out because it was too large.\n")
            else:
                self.images += 1
                self._add({"type": "image", "media_type": "image/png", "data": image})
        elif isinstance(data.get("text/plain"), str):
            # HTML and other rich output is never passed on, only its plain text.
            self.add_text("result", data["text/plain"])

    def add_error(self, name: str, message: str, traceback: list[str]) -> None:
        text = ANSI.sub("", "\n".join(traceback))
        if len(text) > MAX_TRACEBACK_CHARS:
            text = "…" + text[-MAX_TRACEBACK_CHARS:]
            self.truncated = True
        self._add(
            {
                "type": "error",
                "name": str(name)[:200],
                "message": ANSI.sub("", str(message))[:2000],
                "traceback": text,
            }
        )


class Lab:
    def __init__(self) -> None:
        self.manager = KernelManager(kernel_name="python3")
        self.client = None

    def start(self) -> None:
        # The kernel's own output streams are closed off so nothing it prints
        # at the process level can reach the reply channel.
        self.manager.start_kernel(
            cwd="/workspace",
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        self._connect()

    def _connect(self) -> None:
        self.client = self.manager.client()
        self.client.start_channels()
        self.client.wait_for_ready(timeout=60)
        reply = self._run(SETUP_CODE, timeout=60, silent=True)
        if reply["status"] != "ok":
            raise RuntimeError("The analysis kernel could not be prepared")

    def restart(self) -> None:
        if self.client is not None:
            self.client.stop_channels()
        self.manager.restart_kernel(now=True)
        self._connect()

    def shutdown(self) -> None:
        try:
            if self.client is not None:
                self.client.stop_channels()
            self.manager.shutdown_kernel(now=True)
        except Exception:
            pass

    def execute(self, code: str, timeout: float) -> dict:
        try:
            return self._run(code, timeout=timeout, silent=False)
        except KernelStopped as stopped:
            self.restart()
            return {
                "status": stopped.status,
                "outputs": stopped.outputs.items + [stopped.error],
                "truncated": stopped.outputs.truncated,
                "execution_count": None,
                "state_lost": True,
            }

    def _run(self, code: str, *, timeout: float, silent: bool) -> dict:
        outputs = Outputs()
        message_id = self.client.execute(
            code,
            silent=silent,
            store_history=not silent,
            allow_stdin=False,
            stop_on_error=True,
        )
        deadline = time.monotonic() + timeout
        status = "ok"
        execution_count = None
        timed_out = False

        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                if timed_out:
                    raise KernelStopped("timeout", outputs, _timeout_error(timeout, True))
                # First ask the kernel to stop the cell and give it a moment.
                timed_out = True
                self.manager.interrupt_kernel()
                deadline = time.monotonic() + INTERRUPT_GRACE_SECONDS
                continue

            try:
                message = self.client.get_iopub_msg(timeout=min(remaining, 0.5))
            except queue.Empty:
                if not self.manager.is_alive():
                    raise KernelStopped("kernel_died", outputs, _kernel_died_error())
                continue

            if message["parent_header"].get("msg_id") != message_id:
                continue
            kind = message["msg_type"]
            content = message["content"]
            if kind == "stream":
                outputs.add_text(content.get("name", "stdout"), content.get("text", ""))
            elif kind in ("execute_result", "display_data"):
                outputs.add_bundle(content.get("data", {}))
            elif kind == "execute_input":
                execution_count = content.get("execution_count")
            elif kind == "error":
                if timed_out:
                    outputs.items.append(_timeout_error(timeout, False))
                else:
                    status = "error"
                    outputs.add_error(
                        content.get("ename", "Error"),
                        content.get("evalue", ""),
                        content.get("traceback", []),
                    )
            elif kind == "status" and content.get("execution_state") == "idle":
                break

        try:
            self.client.get_shell_msg(timeout=2)
        except queue.Empty:
            pass

        if timed_out:
            status = "timeout"
            if not any(item.get("name") == "Timeout" for item in outputs.items):
                outputs.items.append(_timeout_error(timeout, False))
        return {
            "status": status,
            "outputs": outputs.items,
            "truncated": outputs.truncated,
            "execution_count": execution_count,
            "state_lost": False,
        }


class KernelStopped(Exception):
    def __init__(self, status: str, outputs: Outputs, error: dict) -> None:
        super().__init__(status)
        self.status = status
        self.outputs = outputs
        self.error = error


def _timeout_error(timeout: float, state_lost: bool) -> dict:
    message = f"The cell ran longer than {int(timeout)} seconds and was stopped."
    if state_lost:
        message += " The session was restarted, so variables were cleared."
    return {"type": "error", "name": "Timeout", "message": message, "traceback": ""}


def _kernel_died_error() -> dict:
    return {
        "type": "error",
        "name": "SessionRestarted",
        "message": (
            "The analysis kernel stopped, possibly because it ran out of memory. "
            "The session was restarted, so variables were cleared."
        ),
        "traceback": "",
    }


def _read_lines(idle_seconds: int):
    """Yield request lines from standard input. Stops on end of input or idle."""
    buffer = b""
    while True:
        while b"\n" not in buffer:
            ready, _, _ = select.select([0], [], [], idle_seconds)
            if not ready:
                return
            chunk = os.read(0, 65536)
            if not chunk:
                return
            buffer += chunk
        line, buffer = buffer.split(b"\n", 1)
        yield line


def main() -> None:
    # Replies go to a private copy of standard output. The normal standard
    # output is then closed off so stray prints cannot corrupt the replies.
    replies = os.fdopen(os.dup(1), "w", encoding="utf-8")
    os.dup2(os.open(os.devnull, os.O_WRONLY), 1)

    def send(payload: dict) -> None:
        replies.write(json.dumps(payload) + "\n")
        replies.flush()

    for path in ("HOME", "IPYTHONDIR", "JUPYTER_RUNTIME_DIR", "MPLCONFIGDIR", "XDG_CACHE_HOME"):
        os.makedirs(os.environ[path], exist_ok=True)

    lab = Lab()
    try:
        lab.start()
    except Exception as error:
        send({"event": "failed", "message": str(error)[:300]})
        lab.shutdown()
        sys.exit(1)
    send({"event": "ready"})

    try:
        for line in _read_lines(IDLE_SECONDS):
            try:
                request = json.loads(line)
            except ValueError:
                continue
            if request.get("op") == "shutdown":
                break
            if request.get("op") != "execute":
                continue
            reply = lab.execute(
                str(request.get("code", "")),
                float(request.get("timeout", 30)),
            )
            reply["id"] = request.get("id")
            send(reply)
    finally:
        lab.shutdown()


if __name__ == "__main__":
    main()
