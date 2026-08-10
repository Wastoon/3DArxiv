#!/usr/bin/env python3
"""Run ArxivFeed one source at a time to respect arXiv API rate limits.

The upstream `arxivfeed` binary fetches every configured source in a tight loop.
arXiv asks API clients to make no more than one request every three seconds, and
may return a plain-text rate-limit response instead of Atom XML. In that case the
binary's XML parser exits with errors such as:

    1:1 Unexpected characters outside the root element: R

This wrapper keeps ArxivFeed's rendering behavior, but rewrites `config.toml`
temporarily so each run contains a single source. A local HTTP server exposes the
incrementally updated `target/cache.json` as the cache for the next run.
"""

from __future__ import annotations

import functools
import http.server
import json
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

import tomllib


ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "config.toml"
TARGET_DIR = ROOT / "target"
CACHE_PATH = TARGET_DIR / "cache.json"

REQUEST_INTERVAL_SECONDS = 5
RETRY_BACKOFF_SECONDS = 30
MAX_ATTEMPTS_PER_SOURCE = 4
TRANSIENT_XML_ERRORS = (
    "Unexpected end of stream",
    "Unexpected characters outside the root element",
    "no root element found",
)


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: Any) -> None:  # noqa: A002 - stdlib signature
        return


def toml_value(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    raise TypeError(f"Unsupported TOML value: {value!r}")


def write_single_source_config(config: dict[str, Any], source: dict[str, Any], cache_url: str) -> None:
    lines: list[str] = []

    for key in (
        "site_title",
        "version",
        "limit_days",
        "target_dir",
        "statics_dir",
        "templates_dir",
        "proxy",
        "target_name",
    ):
        if key in config and config[key] is not None:
            lines.append(f"{key} = {toml_value(config[key])}")

    lines.append(f"cache_url = {toml_value(cache_url)}")
    lines.append("")
    lines.append("[[sources]]")
    for key in ("limit", "category", "title"):
        lines.append(f"{key} = {toml_value(source[key])}")

    scripts = config.get("scripts") or {}
    if scripts:
        lines.append("")
        lines.append("[scripts]")
        for key, value in scripts.items():
            lines.append(f"{key} = {toml_value(value)}")

    CONFIG_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def seed_cache(config: dict[str, Any]) -> None:
    TARGET_DIR.mkdir(parents=True, exist_ok=True)
    cache_url = config.get("cache_url")
    if not cache_url:
        CACHE_PATH.write_text("{}", encoding="utf-8")
        return

    print(f"Seeding local cache from {cache_url}", flush=True)
    try:
        with urllib.request.urlopen(cache_url, timeout=30) as response:
            cache_data = response.read()
        json.loads(cache_data)
        CACHE_PATH.write_bytes(cache_data)
    except (OSError, urllib.error.URLError, json.JSONDecodeError) as exc:
        print(f"Warning: failed to seed cache ({exc}); starting from an empty cache", flush=True)
        CACHE_PATH.write_text("{}", encoding="utf-8")


def start_cache_server() -> tuple[http.server.ThreadingHTTPServer, str]:
    handler = functools.partial(QuietHandler, directory=str(TARGET_DIR))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    host, port = server.server_address
    return server, f"http://{host}:{port}/cache.json"


def is_transient_arxiv_error(output: str) -> bool:
    return any(marker in output for marker in TRANSIENT_XML_ERRORS)


def run_source(config: dict[str, Any], source: dict[str, Any], cache_url: str) -> bool:
    write_single_source_config(config, source, cache_url)
    title = source["title"]
    category = source["category"]
    last_output = ""

    for attempt in range(1, MAX_ATTEMPTS_PER_SOURCE + 1):
        print(
            f"Running ArxivFeed for {title} ({category}), "
            f"attempt {attempt}/{MAX_ATTEMPTS_PER_SOURCE}",
            flush=True,
        )
        completed = subprocess.run(
            ["./arxivfeed"],
            cwd=ROOT,
            check=False,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
        last_output = completed.stdout or ""
        if last_output:
            print(last_output, end="" if last_output.endswith("\n") else "\n", flush=True)
        if completed.returncode == 0:
            return True

        if attempt == MAX_ATTEMPTS_PER_SOURCE:
            if is_transient_arxiv_error(last_output):
                print(
                    f"Warning: skipping {title} after repeated transient arXiv XML responses; "
                    "keeping the previously cached data for this source.",
                    flush=True,
                )
                return False
            raise subprocess.CalledProcessError(completed.returncode, "./arxivfeed")

        backoff = RETRY_BACKOFF_SECONDS * attempt
        print(f"ArxivFeed failed for {title}; retrying in {backoff}s", flush=True)
        time.sleep(backoff)


def main() -> int:
    original_config = CONFIG_PATH.read_text(encoding="utf-8")
    config = tomllib.loads(original_config)
    sources = config.get("sources") or []
    if not sources:
        print("No sources configured; running ArxivFeed directly", flush=True)
        return subprocess.run(["./arxivfeed"], cwd=ROOT, check=False).returncode

    seed_cache(config)
    server, local_cache_url = start_cache_server()
    print(f"Serving incremental cache at {local_cache_url}", flush=True)

    try:
        for index, source in enumerate(sources, start=1):
            run_source(config, source, local_cache_url)
            if index < len(sources):
                print(f"Waiting {REQUEST_INTERVAL_SECONDS}s before the next arXiv API request", flush=True)
                time.sleep(REQUEST_INTERVAL_SECONDS)
    finally:
        CONFIG_PATH.write_text(original_config, encoding="utf-8")
        server.shutdown()
        server.server_close()

    if not CACHE_PATH.exists():
        print("ArxivFeed did not produce target/cache.json", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
