#!/usr/bin/env python3
"""
generate_figures.py
通过 Semantic Scholar API 获取论文首图 URL，
增量更新 target/figures.json。

figures.json 格式：
  { "2501.12345": "https://...图片URL..." }

Semantic Scholar API 免费，无需 API Key，
每秒最多 10 次请求（有 Key 可提升到 100/s）。
"""

import json, re, sys, time
import urllib.request, urllib.parse
from pathlib import Path
from datetime import datetime, timezone

CACHE_PATH   = Path("./target/cache.json")
FIGURES_PATH = Path("./target/figures.json")

MAX_NEW_PER_RUN  = 80     # 每次最多处理 N 篇新论文
REQUEST_INTERVAL = 0.15   # 请求间隔（秒），10 req/s 以内
S2_API_BASE      = "https://api.semanticscholar.org/graph/v1/paper/ARXIV:"
S2_FIELDS        = "openAccessPdf,tldr,figures"


def load_json(path, default):
    if not path.exists(): return default
    try:    return json.loads(path.read_text(encoding="utf-8"))
    except: return default


def clean_id(url):
    aid = re.sub(r".*/abs/", "", url).rstrip("/")
    return re.sub(r"v\d+$", "", aid)


def collect_arxiv_ids(cache):
    ids, seen = [], set()
    for date_key, subjects in cache.items():
        if not isinstance(subjects, dict): continue
        for subject, papers in subjects.items():
            if not isinstance(papers, list): continue
            for p in papers:
                pid = p.get("id", "")
                if not pid or pid in seen: continue
                seen.add(pid)
                arxiv_id = clean_id(pid)
                pub = (p.get("published", date_key) or date_key)[:10]
                ids.append((arxiv_id, pub))
    # 按日期倒序，优先处理最新论文
    ids.sort(key=lambda x: x[1], reverse=True)
    return ids


def fetch_figure(arxiv_id):
    """
    调用 Semantic Scholar API，返回首图 URL 或 None。
    优先返回 figures 字段中的第一张图片，
    降级返回 openAccessPdf 链接（让前端显示 PDF 图标）。
    """
    url = f"{S2_API_BASE}{arxiv_id}?fields=figures,openAccessPdf"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "3DArxiv/1.0 (academic research tool)"},
        method="GET"
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read())

            # 优先用 figures 字段
            figures = data.get("figures", [])
            if figures:
                # 取第一张图的 URL
                fig_url = figures[0].get("url", "")
                if fig_url:
                    return fig_url

            # 降级：无图但有 PDF，返回 None（前端不显示图片）
            return None

    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None  # 论文不在 S2 数据库，正常情况
        if e.code == 429:
            print(f"  [Figures] Rate limited, waiting 5s...", file=sys.stderr)
            time.sleep(5)
            return None
        print(f"  [Figures] HTTP {e.code} for {arxiv_id}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"  [Figures] Error for {arxiv_id}: {e}", file=sys.stderr)
        return None


def main():
    if not CACHE_PATH.exists():
        print("[Figures] cache.json not found, skipping.", file=sys.stderr)
        sys.exit(0)

    cache   = load_json(CACHE_PATH, {})
    figures = load_json(FIGURES_PATH, {})

    all_ids = collect_arxiv_ids(cache)
    print(f"[Figures] Total papers: {len(all_ids)}")
    print(f"[Figures] Already cached: {len(figures)}")

    # 只处理还没有缓存的论文
    pending = [(aid, pub) for aid, pub in all_ids if aid not in figures]
    to_proc = pending[:MAX_NEW_PER_RUN]
    print(f"[Figures] To process: {len(to_proc)}/{len(pending)}")

    if not to_proc:
        print("[Figures] Nothing to do.")
        # 确保文件存在
        FIGURES_PATH.write_text(
            json.dumps(figures, ensure_ascii=False, separators=(",",":")),
            encoding="utf-8"
        )
        return

    found = 0
    for i, (arxiv_id, pub) in enumerate(to_proc):
        fig_url = fetch_figure(arxiv_id)

        # 无论是否找到图片都记录（避免重复查询）
        # None → 存空字符串表示"已查询但无图"
        figures[arxiv_id] = fig_url or ""

        if fig_url:
            found += 1
            print(f"  [{i+1}/{len(to_proc)}] ✓ {arxiv_id}")
        else:
            print(f"  [{i+1}/{len(to_proc)}]   {arxiv_id} (no figure)")

        # 每 20 篇保存一次，防止中途失败丢失进度
        if (i + 1) % 20 == 0:
            FIGURES_PATH.write_text(
                json.dumps(figures, ensure_ascii=False, separators=(",",":")),
                encoding="utf-8"
            )
            print(f"  [checkpoint] saved {len(figures)} entries")

        if i < len(to_proc) - 1:
            time.sleep(REQUEST_INTERVAL)

    # 最终保存（过滤掉空值，只保留有图片的记录以减小文件体积）
    figures_with_img = {k: v for k, v in figures.items() if v}
    # 保留空值记录用于去重（避免重复请求），但分开存储
    FIGURES_PATH.write_text(
        json.dumps(figures, ensure_ascii=False, separators=(",",":")),
        encoding="utf-8"
    )

    size_kb = FIGURES_PATH.stat().st_size / 1024
    remaining = len(pending) - len(to_proc)
    print(f"[Figures] Done: {found}/{len(to_proc)} found figure URLs")
    print(f"[Figures] Total cached: {len(figures)} entries ({size_kb:.0f} KB)")
    if remaining > 0:
        print(f"[Figures] {remaining} papers still pending (next run)")


if __name__ == "__main__":
    main()
