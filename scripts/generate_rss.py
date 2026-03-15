#!/usr/bin/env python3
"""
generate_rss.py
读取 ./target/cache.json，输出 ./target/rss.xml

cache.json 真实格式：
{
  "2026-03-12T00:00:00Z": {
    "Robotics": [
      { "id": "...", "authors": ["A","B"], "comment": null, ... }
    ]
  }
}
"""

import json, html, sys
from datetime import datetime, timezone
from pathlib import Path

CACHE_PATH  = Path("./target/cache.json")
OUTPUT_PATH = Path("./target/rss.xml")

SITE_TITLE = "3DArxiv"
SITE_LINK  = "https://wastoon.github.io/3DArxiv/"
SITE_DESC  = "3D Vision & Robotics ArXiv daily digest"
MAX_ITEMS  = 200


def load_cache():
    if not CACHE_PATH.exists():
        print(f"[RSS] cache.json not found at {CACHE_PATH}", file=sys.stderr)
        sys.exit(0)
    with open(CACHE_PATH, encoding="utf-8") as f:
        return json.load(f)


def rfc822(dt_str: str) -> str:
    if not dt_str:
        return datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")
    try:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.strftime("%a, %d %b %Y %H:%M:%S +0000")
    except Exception:
        return datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")


def collect_papers(cache: dict) -> list:
    """遍历真实格式: { "ISO日期": { "领域": [ 论文, ... ] } }"""
    papers = []
    seen_ids = set()

    for date_key, subjects in cache.items():
        if not isinstance(subjects, dict):
            continue
        for subject, paper_list in subjects.items():
            if not isinstance(paper_list, list):
                continue
            for p in paper_list:
                pid = p.get("id", "")
                if not pid or pid in seen_ids:
                    continue
                seen_ids.add(pid)

                # authors 是列表，转为逗号分隔字符串
                raw_authors = p.get("authors", [])
                authors_str = ", ".join(raw_authors) if isinstance(raw_authors, list) else str(raw_authors)

                papers.append({
                    "id":      pid,
                    "title":   p.get("title", "(no title)"),
                    "authors": authors_str,
                    "summary": p.get("summary", ""),
                    "pdf_url": p.get("pdf_url", "") or "",
                    "comment": p.get("comment") or "",   # null → ""
                    "subject": subject,
                    "date":    p.get("published", date_key),
                })

    papers.sort(key=lambda x: x["date"], reverse=True)
    return papers[:MAX_ITEMS]


def build_rss(papers: list) -> str:
    now_rfc = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")
    items_xml = ""

    for p in papers:
        link    = html.escape(p["id"])
        pub_dt  = rfc822(p["date"])

        desc_parts = []
        if p["authors"]:
            desc_parts.append(f"<p><strong>Authors:</strong> {html.escape(p['authors'])}</p>")
        if p["summary"]:
            desc_parts.append(f"<p>{html.escape(p['summary'])}</p>")
        if p["comment"]:
            desc_parts.append(f"<p><em>Comment: {html.escape(p['comment'])}</em></p>")
        if p["pdf_url"]:
            desc_parts.append(f'<p><a href="{html.escape(p["pdf_url"])}">PDF</a></p>')

        items_xml += f"""
  <item>
    <title>{html.escape(p["title"])}</title>
    <link>{link}</link>
    <guid isPermaLink="true">{link}</guid>
    <pubDate>{pub_dt}</pubDate>
    <category>{html.escape(p["subject"])}</category>
    <description><![CDATA[{"".join(desc_parts)}]]></description>
  </item>"""

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>{html.escape(SITE_TITLE)}</title>
    <link>{html.escape(SITE_LINK)}</link>
    <description>{html.escape(SITE_DESC)}</description>
    <language>zh-cn</language>
    <lastBuildDate>{now_rfc}</lastBuildDate>
    <atom:link href="{html.escape(SITE_LINK)}rss.xml" rel="self" type="application/rss+xml"/>
    <ttl>1440</ttl>
    {items_xml}
  </channel>
</rss>"""


def main():
    cache  = load_cache()
    papers = collect_papers(cache)
    if not papers:
        print("[RSS] Warning: 0 papers — check cache.json structure.", file=sys.stderr)
    rss = build_rss(papers)
    OUTPUT_PATH.write_text(rss, encoding="utf-8")
    print(f"[RSS] Generated {len(papers)} items → {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
