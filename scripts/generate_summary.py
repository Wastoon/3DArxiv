#!/usr/bin/env python3
"""
generate_summary.py
为 cache.json 中的论文调用 Gemini API 生成中文 TL;DR，
结果增量缓存到 ./target/summary.json，避免重复请求。

环境变量：
  GEMINI_API_KEY — Google AI Studio API Key

summary.json 格式：
{
  "http://arxiv.org/abs/2501.12345v1": {
    "tldr": "一句话总结这篇论文做了什么。",
    "generated": "2026-03-15T06:00:00Z"
  }
}
"""

import json, os, sys, time, re
import urllib.request, urllib.error
from pathlib import Path
from datetime import datetime, timezone

CACHE_PATH   = Path("./target/cache.json")
SUMMARY_PATH = Path("./target/summary.json")

API_KEY   = os.environ.get("GEMINI_API_KEY", "")
API_URL   = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

# 每次 Actions 最多处理 N 篇新论文（控制 API 用量和运行时间）
MAX_NEW_PER_RUN = 80
# 请求间隔（秒），避免触发速率限制（免费版 15 req/min）
REQUEST_INTERVAL = 4.5


def load_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def collect_papers(cache: dict) -> list:
    """从 cache.json 收集所有论文，返回 [{id, title, summary}, ...]"""
    papers = []
    seen   = set()
    for date_key, subjects in cache.items():
        if not isinstance(subjects, dict):
            continue
        for subject, paper_list in subjects.items():
            if not isinstance(paper_list, list):
                continue
            for p in paper_list:
                pid = p.get("id", "")
                if not pid or pid in seen:
                    continue
                seen.add(pid)
                papers.append({
                    "id":      pid,
                    "title":   p.get("title", ""),
                    "summary": p.get("summary", ""),
                    "date":    (p.get("published", date_key) or date_key)[:10],
                })
    # 按日期倒序，优先处理最新论文
    papers.sort(key=lambda x: x["date"], reverse=True)
    return papers


def call_gemini(title: str, abstract: str) -> str:
    """调用 Gemini 生成一句话中文 TL;DR，失败返回空字符串"""
    prompt = (
        f"请用**一句话中文**总结以下学术论文的核心贡献（不超过50字，直接输出结论，不要有任何前缀如"本文"、"该论文"等）：\n\n"
        f"标题：{title}\n\n"
        f"摘要：{abstract[:800]}"
    )

    payload = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature":    0.3,
            "maxOutputTokens": 120,
        }
    }).encode("utf-8")

    url = f"{API_URL}?key={API_KEY}"
    req = urllib.request.Request(
        url, data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            result = json.loads(resp.read())
            text = (result.get("candidates", [{}])[0]
                         .get("content", {})
                         .get("parts", [{}])[0]
                         .get("text", "")).strip()
            # 去除多余标点和换行
            text = re.sub(r'\s+', ' ', text).strip('。').strip()
            if text:
                return text + '。'
            return ""
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"  [!] HTTP {e.code}: {body[:200]}", file=sys.stderr)
        # 429 速率限制：等待后重试一次
        if e.code == 429:
            print("  [!] Rate limited, waiting 60s...", file=sys.stderr)
            time.sleep(60)
            try:
                with urllib.request.urlopen(req, timeout=20) as resp2:
                    result = json.loads(resp2.read())
                    text = (result.get("candidates", [{}])[0]
                                 .get("content", {})
                                 .get("parts", [{}])[0]
                                 .get("text", "")).strip()
                    text = re.sub(r'\s+', ' ', text).strip('。').strip()
                    return (text + '。') if text else ""
            except Exception:
                pass
        return ""
    except Exception as ex:
        print(f"  [!] Error: {ex}", file=sys.stderr)
        return ""


def main():
    if not API_KEY:
        print("[Summary] GEMINI_API_KEY not set, skipping.", file=sys.stderr)
        sys.exit(0)

    if not CACHE_PATH.exists():
        print("[Summary] cache.json not found, skipping.", file=sys.stderr)
        sys.exit(0)

    cache   = load_json(CACHE_PATH, {})
    summaries = load_json(SUMMARY_PATH, {})

    papers  = collect_papers(cache)
    total   = len(papers)

    # 找出还没有摘要的论文
    pending = [p for p in papers if p["id"] not in summaries and p["summary"]]
    print(f"[Summary] Total: {total}, already done: {total - len(pending)}, pending: {len(pending)}")

    if not pending:
        print("[Summary] All papers already have summaries, nothing to do.")
        # 仍然写一次文件（确保 summary.json 存在）
        SUMMARY_PATH.write_text(
            json.dumps(summaries, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )
        return

    # 只处理最新的 MAX_NEW_PER_RUN 篇
    to_process = pending[:MAX_NEW_PER_RUN]
    print(f"[Summary] Processing {len(to_process)} papers (limit={MAX_NEW_PER_RUN})...")

    success = 0
    for i, paper in enumerate(to_process):
        short_title = paper["title"][:60] + ("…" if len(paper["title"]) > 60 else "")
        print(f"  [{i+1}/{len(to_process)}] {short_title}")

        tldr = call_gemini(paper["title"], paper["summary"])

        if tldr:
            summaries[paper["id"]] = {
                "tldr":      tldr,
                "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            }
            success += 1
            print(f"    ✓ {tldr[:80]}")
        else:
            print(f"    ✗ failed (will retry next run)")

        # 每处理 10 篇保存一次，防止中途失败丢失进度
        if (i + 1) % 10 == 0:
            SUMMARY_PATH.write_text(
                json.dumps(summaries, ensure_ascii=False, indent=2),
                encoding="utf-8"
            )
            print(f"  [checkpoint] saved {len(summaries)} entries")

        # 控制请求速率
        if i < len(to_process) - 1:
            time.sleep(REQUEST_INTERVAL)

    # 最终保存
    SUMMARY_PATH.write_text(
        json.dumps(summaries, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    remaining = len(pending) - len(to_process)
    print(f"[Summary] Done: {success}/{len(to_process)} succeeded.")
    if remaining > 0:
        print(f"[Summary] {remaining} papers still pending, will be processed in future runs.")
    print(f"[Summary] Total entries in summary.json: {len(summaries)}")


if __name__ == "__main__":
    main()
