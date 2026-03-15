#!/usr/bin/env python3
"""
generate_citations.py
通过 Semantic Scholar API 抓取论文的引用关系，
增量更新 target/citations.json。

citations.json 格式：
{
  "2501.12345": {
    "references": [                   ← 该论文引用了哪些论文
      { "arxivId": "2401.00001", "title": "...", "year": 2024, "authors": "A, B" }
    ],
    "citations": [                    ← 哪些论文引用了该论文
      { "arxivId": "2502.00001", "title": "...", "year": 2025, "authors": "C, D" }
    ],
    "citationCount": 42,              ← 总被引次数（来自 S2）
    "fetched": "2026-03-15"
  }
}
"""

import json, re, sys, time
import urllib.request, urllib.parse
from pathlib import Path
from datetime import datetime, timezone

CACHE_PATH     = Path("./target/cache.json")
CITATIONS_PATH = Path("./target/citations.json")

MAX_NEW_PER_RUN   = 40      # 每次最多处理 N 篇
REQUEST_INTERVAL  = 1.2     # 请求间隔（秒）
MAX_REFS_PER_PAPER = 20     # 每篇论文最多保留 N 条引用
MAX_CITES_PER_PAPER = 15    # 每篇论文最多保留 N 条被引
S2_API_BASE = "https://api.semanticscholar.org/graph/v1/paper/ARXIV:"
S2_FIELDS   = "title,year,authors,externalIds,citationCount"


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
    ids.sort(key=lambda x: x[1], reverse=True)
    return ids


def s2_get(path):
    """调用 Semantic Scholar API"""
    url = f"{S2_API_BASE}{path}"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "3DArxiv/1.0 (academic research tool)"},
        method="GET"
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        if e.code in (404, 400):
            return None
        if e.code == 429:
            print(f"  [Citations] Rate limited, waiting 30s...", file=sys.stderr)
            time.sleep(30)
            return None
        print(f"  [Citations] HTTP {e.code}: {path[:50]}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"  [Citations] Error: {e}", file=sys.stderr)
        return None


def extract_author_str(authors_list, limit=3):
    """把 S2 作者列表转为字符串"""
    if not authors_list: return ""
    names = [a.get("name","") for a in authors_list[:limit] if a.get("name")]
    if len(authors_list) > limit:
        names.append(f"等{len(authors_list)}人")
    return ", ".join(names)


def extract_arxiv_id(external_ids):
    """从 externalIds 里提取 ArXiv ID"""
    if not external_ids: return ""
    return external_ids.get("ArXiv", "")


def fetch_citations(arxiv_id):
    """
    抓取一篇论文的引用关系：
    1. 先获取基础信息（citationCount）
    2. 获取 references（该论文引用的论文）
    3. 获取 citations（引用该论文的论文）
    """
    result = {
        "references":    [],
        "citations":     [],
        "citationCount": 0,
        "fetched":       datetime.now(timezone.utc).strftime("%Y-%m-%d"),
    }

    # ── 基础信息 ──────────────────────────────────────────────
    fields = "citationCount,title,year"
    base = s2_get(f"{arxiv_id}?fields={fields}")
    if not base:
        return None
    result["citationCount"] = base.get("citationCount", 0)

    # ── References（该论文引用的论文）────────────────────────
    time.sleep(REQUEST_INTERVAL * 0.5)
    ref_fields = f"title,year,authors,externalIds"
    refs_raw = s2_get(f"{arxiv_id}/references?fields={ref_fields}&limit={MAX_REFS_PER_PAPER}")
    if refs_raw:
        for item in (refs_raw.get("data") or []):
            cited = item.get("citedPaper", {})
            if not cited.get("title"): continue
            result["references"].append({
                "arxivId": extract_arxiv_id(cited.get("externalIds", {})),
                "title":   cited.get("title", ""),
                "year":    cited.get("year", 0),
                "authors": extract_author_str(cited.get("authors", [])),
            })

    # ── Citations（引用该论文的论文）──────────────────────────
    time.sleep(REQUEST_INTERVAL * 0.5)
    cite_fields = f"title,year,authors,externalIds"
    cites_raw = s2_get(f"{arxiv_id}/citations?fields={cite_fields}&limit={MAX_CITES_PER_PAPER}&sort=year:desc")
    if cites_raw:
        for item in (cites_raw.get("data") or []):
            citing = item.get("citingPaper", {})
            if not citing.get("title"): continue
            result["citations"].append({
                "arxivId": extract_arxiv_id(citing.get("externalIds", {})),
                "title":   citing.get("title", ""),
                "year":    citing.get("year", 0),
                "authors": extract_author_str(citing.get("authors", [])),
            })

    return result


def main():
    if not CACHE_PATH.exists():
        print("[Citations] cache.json not found, skipping.", file=sys.stderr)
        sys.exit(0)

    cache     = load_json(CACHE_PATH, {})
    citations = load_json(CITATIONS_PATH, {})

    all_ids   = collect_arxiv_ids(cache)
    print(f"[Citations] Total papers: {len(all_ids)}")
    print(f"[Citations] Already cached: {len(citations)}")

    # 只处理还没抓取的论文
    pending  = [(aid, pub) for aid, pub in all_ids if aid not in citations]
    to_proc  = pending[:MAX_NEW_PER_RUN]
    print(f"[Citations] To process: {len(to_proc)}/{len(pending)}")

    if not to_proc:
        print("[Citations] Nothing to do.")
        CITATIONS_PATH.write_text(
            json.dumps(citations, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8"
        )
        return

    found = 0
    for i, (arxiv_id, pub) in enumerate(to_proc):
        print(f"  [{i+1}/{len(to_proc)}] {arxiv_id}", end=" ", flush=True)
        data = fetch_citations(arxiv_id)

        if data:
            citations[arxiv_id] = data
            found += 1
            print(f"✓ refs:{len(data['references'])} cites:{len(data['citations'])} cited:{data['citationCount']}")
        else:
            # 记录为空（避免重复请求）
            citations[arxiv_id] = {
                "references": [], "citations": [],
                "citationCount": 0,
                "fetched": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            }
            print("✗ not found")

        # 每 10 篇保存一次
        if (i + 1) % 10 == 0:
            CITATIONS_PATH.write_text(
                json.dumps(citations, ensure_ascii=False, separators=(",", ":")),
                encoding="utf-8"
            )
            print(f"  [checkpoint] saved {len(citations)} entries")

        if i < len(to_proc) - 1:
            time.sleep(REQUEST_INTERVAL)

    CITATIONS_PATH.write_text(
        json.dumps(citations, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8"
    )
    size_kb = CITATIONS_PATH.stat().st_size / 1024
    remaining = len(pending) - len(to_proc)
    print(f"[Citations] Done: {found}/{len(to_proc)} fetched")
    print(f"[Citations] Total: {len(citations)} entries ({size_kb:.0f} KB)")
    if remaining > 0:
        print(f"[Citations] {remaining} pending (next run)")


if __name__ == "__main__":
    main()
