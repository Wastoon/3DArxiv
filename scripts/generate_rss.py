#!/usr/bin/env python3
"""
generate_rss.py
读取 ./target/cache.json，输出 ./target/rss.xml
RSS 2.0 标准格式，兼容所有主流 RSS 阅读器
"""

import json, os, sys, html
from datetime import datetime, timezone
from pathlib import Path

CACHE_PATH = Path("./target/cache.json")
OUTPUT_PATH = Path("./target/rss.xml")

SITE_TITLE   = "3DArxiv"
SITE_LINK    = "https://wastoon.github.io/3DArxiv/"
SITE_DESC    = "3D Vision & Robotics ArXiv daily digest"
MAX_ITEMS    = 200   # 最多输出最近 200 篇，避免 RSS 文件过大


def load_cache(path: Path):
    if not path.exists():
        print(f"[RSS] cache.json not found at {path}, skipping.", file=sys.stderr)
        sys.exit(0)
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def rfc822(dt_str: str) -> str:
    """把 ISO 8601 日期字符串转为 RFC 822 格式（RSS 规范）"""
    try:
        # cache.json 里的格式通常是 "2024-03-12T00:00:00Z" 或 "2024-03-12"
        dt_str = dt_str.replace("Z", "+00:00")
        if "T" in dt_str:
            dt = datetime.fromisoformat(dt_str)
        else:
            dt = datetime.fromisoformat(dt_str + "T00:00:00+00:00")
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.strftime("%a, %d %b %Y %H:%M:%S +0000")
    except Exception:
        return datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")


def build_rss(cache: dict) -> str:
    """遍历 cache.json，收集所有论文，按日期倒序排列，生成 RSS XML"""
    papers = []

    # cache.json 结构: { "days": [ { "date": "...", "subjects": [ { "subject": "...", "papers": [...] } ] } ] }
    days = cache.get("days", [])
    for day in days:
        date_str = day.get("date", "")
        for subject_block in day.get("subjects", []):
            subject = subject_block.get("subject", "")
            for paper in subject_block.get("papers", []):
                papers.append({
                    "title":    paper.get("title", "(no title)"),
                    "authors":  paper.get("authors", ""),
                    "summary":  paper.get("summary", ""),
                    "id":       paper.get("id", ""),       # arxiv URL
                    "pdf_url":  paper.get("pdf_url", ""),
                    "comment":  paper.get("comment", ""),
                    "subject":  subject,
                    "date":     paper.get("published", date_str),
                    "updated":  paper.get("updated", date_str),
                })

    # 去重（同一篇论文可能出现在多个领域）
    seen = set()
    unique = []
    for p in papers:
        if p["id"] not in seen:
            seen.add(p["id"])
            unique.append(p)

    # 按发布日期倒序
    unique.sort(key=lambda p: p["date"], reverse=True)
    unique = unique[:MAX_ITEMS]

    # 构建 XML
    now_rfc = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")

    items_xml = ""
    for p in unique:
        title   = html.escape(p["title"])
        authors = html.escape(p["authors"])
        link    = html.escape(p["id"])
        pdf     = html.escape(p["pdf_url"])
        subj    = html.escape(p["subject"])
        comment = html.escape(p["comment"]) if p["comment"] else ""
        pub_dt  = rfc822(p["date"])
        guid    = link  # arxiv URL 作为全局唯一 ID

        # description: 摘要 + 作者 + comment（HTML 格式）
        desc_parts = []
        if authors:
            desc_parts.append(f"<p><strong>Authors:</strong> {authors}</p>")
        if p["summary"]:
            desc_parts.append(f"<p>{html.escape(p['summary'])}</p>")
        if comment:
            desc_parts.append(f"<p><em>Comment: {comment}</em></p>")
        if pdf:
            desc_parts.append(f'<p><a href="{pdf}">📄 PDF</a></p>')
        description = "<![CDATA[" + "".join(desc_parts) + "]]>"

        items_xml += f"""
  <item>
    <title>{title}</title>
    <link>{link}</link>
    <guid isPermaLink="true">{guid}</guid>
    <pubDate>{pub_dt}</pubDate>
    <category>{subj}</category>
    <description>{description}</description>
  </item>"""

    rss = f"""<?xml version="1.0" encoding="UTF-8"?>
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
    return rss


def main():
    cache = load_cache(CACHE_PATH)
    rss_content = build_rss(cache)
    OUTPUT_PATH.write_text(rss_content, encoding="utf-8")
    # Count items for log
    item_count = rss_content.count("<item>")
    print(f"[RSS] Generated {item_count} items → {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
