#!/usr/bin/env python3
"""
notify_telegram.py
读取 ./target/cache.json，把当天最新论文中的精选论文
（顶级作者 ★ 或顶会论文）推送到 Telegram。

环境变量（从 GitHub Secrets 注入）：
  TELEGRAM_BOT_TOKEN  — Bot Token
  TELEGRAM_CHAT_ID    — Chat ID（个人或群组）
"""

import json, os, re, sys
from datetime import datetime, timezone
from pathlib import Path
import urllib.request
import urllib.parse
import urllib.error

CACHE_PATH = Path("./target/cache.json")

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
CHAT_ID   = os.environ.get("TELEGRAM_CHAT_ID", "")

# 顶会列表（与 config.rhai 保持一致）
CONF_PATTERN = re.compile(
    r'\b(CVPR|ICCV|ECCV|NeurIPS|NIPS|ICLR|ICML|ICRA|IROS|RSS|CoRL|AAAI|IJCAI|'
    r'3DV|RA-L|RAL|WACV|BMVC|Science Robotics|Nature Machine Intelligence|PAMI|TRO|T-RO)\b',
    re.IGNORECASE
)

# config.rhai 里的顶级作者列表
TOP_AUTHORS = {
    "Shaojie Shen","Luca Carlone","Yoshua Bengio","Frank Dellaert","Wolfram Burgard",
    "Davide Scaramuzza","Marc Pollefeys","Andrew Davison","Daniel Cremers","Heng Yang",
    "Fei Gao","Fu Zhang","Yue Wang","Hang Zhao","Timothy D. Barfoot","Kasra Khosoussi",
    "Kaiming He","Shoudong Huang","Guoquan Huang","Jonathan P. How",
    "Guofeng Zhang","Cyrill Stachniss","Javier Civera","Jose Luis Blanco Claraco",
    "Marco Pavone","Sanja Fidler","Yann LeCun","Raquel Urtasun",
    "Sergey Levine","Chelsea Finn","Jitendra Malik","Danijar Hafner","David Ha",
    "Andreas Geiger","Philipp Krähenbühl","Abhinav Gupta","Animesh Garg",
}

# 顶级机构列表（与 config.rhai 保持一致）
TOP_LABS = {"NVIDIA","DeepMind","OpenAI","Google Research","Stanford","MIT","Berkeley","CMU","ETH","Oxford","Meta AI","Tesla"}

MAX_PAPERS_PER_MSG = 15   # 每条消息最多推送论文数，避免消息过长
SITE_URL = "https://wastoon.github.io/3DArxiv/"


def load_cache():
    if not CACHE_PATH.exists():
        print(f"[TG] cache.json not found", file=sys.stderr)
        sys.exit(0)
    with open(CACHE_PATH, encoding="utf-8") as f:
        return json.load(f)


def is_featured(paper: dict) -> tuple[bool, bool, str]:
    """
    返回 (has_top_author, has_top_conf, conf_name)
    has_top_author: 作者列表中含顶级作者或顶级机构
    has_top_conf:   comment 中含顶级会议名
    """
    authors = paper.get("authors", [])
    if isinstance(authors, list):
        authors_str = " ".join(authors)
    else:
        authors_str = str(authors)

    has_top_author = any(a in TOP_AUTHORS for a in (authors if isinstance(authors, list) else []))
    has_top_lab    = any(lab.lower() in authors_str.lower() for lab in TOP_LABS)

    comment  = paper.get("comment") or ""
    conf_m   = CONF_PATTERN.search(comment)
    conf_name = conf_m.group(0) if conf_m else ""
    has_top_conf = bool(conf_name)

    return (has_top_author or has_top_lab), has_top_conf, conf_name


def get_latest_date_papers(cache: dict) -> tuple[str, list]:
    """
    找出 cache.json 中最新的日期，返回 (date_str, [所有论文])
    每篇论文附加 subject 和 featured 信息
    """
    if not cache:
        return "", []

    # 按日期降序排列，取最新一天
    sorted_dates = sorted(cache.keys(), reverse=True)
    latest_key   = sorted_dates[0]
    date_str     = latest_key[:10]  # "2026-03-15"

    papers = []
    subjects = cache[latest_key]
    if not isinstance(subjects, dict):
        return date_str, []

    seen_ids = set()
    for subject, paper_list in subjects.items():
        if not isinstance(paper_list, list):
            continue
        for p in paper_list:
            pid = p.get("id", "")
            if not pid or pid in seen_ids:
                continue
            seen_ids.add(pid)

            has_star, has_conf, conf_name = is_featured(p)

            authors = p.get("authors", [])
            authors_str = ", ".join(authors[:4]) if isinstance(authors, list) else str(authors)
            if isinstance(authors, list) and len(authors) > 4:
                authors_str += f" 等{len(authors)}人"

            papers.append({
                "id":          pid,
                "title":       p.get("title", ""),
                "authors_str": authors_str,
                "subject":     subject,
                "has_star":    has_star,
                "has_conf":    has_conf,
                "conf_name":   conf_name,
                "comment":     p.get("comment") or "",
            })

    return date_str, papers


def escape_md(text: str) -> str:
    """Telegram MarkdownV2 转义"""
    for ch in r'\_*[]()~`>#+-=|{}.!':
        text = text.replace(ch, f'\\{ch}')
    return text


def build_messages(date_str: str, papers: list) -> list[str]:
    """
    把精选论文构建成 Telegram MarkdownV2 消息列表
    超长时自动分割成多条
    """
    # 按优先级排序：双星 > 单星 > 顶会
    def priority(p):
        if p["has_star"] and p["has_conf"]:  return 0
        if p["has_star"]:                     return 1
        if p["has_conf"]:                     return 2
        return 3

    featured = [p for p in papers if p["has_star"] or p["has_conf"]]
    featured.sort(key=priority)
    total_today = len(papers)

    if not featured:
        # 今日无精选，发一条简短通知
        msg = (
            f"📡 *3DArxiv 每日速报* \\| {escape_md(date_str)}\n\n"
            f"今日共收录 *{total_today}* 篇论文，暂无精选论文。\n\n"
            f"[👉 查看全部论文]({escape_md(SITE_URL)})"
        )
        return [msg]

    messages = []
    # 头部
    header = (
        f"📡 *3DArxiv 每日速报* \\| {escape_md(date_str)}\n"
        f"今日共 *{total_today}* 篇 \\| 精选 *{len(featured)}* 篇\n"
        f"{'─' * 20}\n\n"
    )

    current = header
    count   = 0

    for p in featured:
        # 星标
        if p["has_star"] and p["has_conf"]:
            star = "★★"
        elif p["has_star"]:
            star = "★"
        else:
            star = "📌"

        # 顶会标签
        conf_tag = f" `{escape_md(p['conf_name'])}`" if p["conf_name"] else ""

        # arxiv 短 ID
        arxiv_id = re.sub(r".*/abs/", "", p["id"]).rstrip("/")
        arxiv_id = re.sub(r"v\d+$", "", arxiv_id)

        title_esc   = escape_md(p["title"])
        authors_esc = escape_md(p["authors_str"])
        subject_esc = escape_md(p["subject"])
        link        = escape_md(p["id"])

        entry = (
            f"{star}{conf_tag} [{title_esc}]({link})\n"
            f"👥 {authors_esc}\n"
            f"🏷 {subject_esc}\n\n"
        )

        # Telegram 消息上限约 4096 字符，留一些余量
        if len(current) + len(entry) > 3800 or count >= MAX_PAPERS_PER_MSG:
            current += f"[👉 查看全部论文]({escape_md(SITE_URL)})"
            messages.append(current)
            current = f"📡 *3DArxiv 续* \\| {escape_md(date_str)}\n{'─' * 20}\n\n"
            count   = 0

        current += entry
        count   += 1

    current += f"[👉 查看全部论文]({escape_md(SITE_URL)})"
    messages.append(current)
    return messages


def send_message(text: str):
    """调用 Telegram Bot API 发送 MarkdownV2 消息"""
    url  = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    data = json.dumps({
        "chat_id":    CHAT_ID,
        "text":       text,
        "parse_mode": "MarkdownV2",
        "disable_web_page_preview": True,
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read())
            if result.get("ok"):
                print(f"[TG] Message sent (len={len(text)})")
            else:
                print(f"[TG] API error: {result}", file=sys.stderr)
                sys.exit(1)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"[TG] HTTP {e.code}: {body}", file=sys.stderr)
        sys.exit(1)


def main():
    if not BOT_TOKEN or not CHAT_ID:
        print("[TG] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set, skipping.", file=sys.stderr)
        sys.exit(0)

    cache = load_cache()
    date_str, papers = get_latest_date_papers(cache)

    if not papers:
        print(f"[TG] No papers found for latest date, skipping.", file=sys.stderr)
        sys.exit(0)

    featured_count = sum(1 for p in papers if p["has_star"] or p["has_conf"])
    print(f"[TG] Date: {date_str}, total: {len(papers)}, featured: {featured_count}")

    messages = build_messages(date_str, papers)
    print(f"[TG] Sending {len(messages)} message(s)...")

    for msg in messages:
        send_message(msg)

    print("[TG] Done.")


if __name__ == "__main__":
    main()
