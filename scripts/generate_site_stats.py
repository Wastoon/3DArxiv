#!/usr/bin/env python3
"""
generate_site_stats.py
调用 Umami Cloud API 抓取网站访问统计，
输出 target/site_stats.json 供前端展示。

环境变量：
  UMAMI_API_TOKEN  — Umami Cloud API Key
  UMAMI_WEBSITE_ID — 网站 ID（已硬编码，可通过环境变量覆盖）

site_stats.json 格式：
{
  "generated": "2026-03-15T00:00:00Z",
  "summary": {
    "pageviews": 12345,
    "visitors": 3456,
    "visits": 4567,
    "bounces": 1234,
    "totaltime": 987654
  },
  "daily": [
    { "date": "2026-03-01", "pageviews": 120, "visitors": 45 }
  ],
  "countries": [
    { "country": "CN", "name": "中国", "visitors": 120 },
    { "country": "US", "name": "美国", "visitors": 80 }
  ],
  "browsers": [...],
  "devices": [...],
  "referrers": [...]
}
"""

import json, os, sys, time
import urllib.request, urllib.parse, urllib.error
from pathlib import Path
from datetime import datetime, timezone, timedelta

OUTPUT_PATH  = Path("./target/site_stats.json")

API_BASE     = "https://api.umami.is/v1"
API_TOKEN    = os.environ.get("UMAMI_API_TOKEN", "")
WEBSITE_ID   = os.environ.get("UMAMI_WEBSITE_ID", "67a2d8cc-03f2-427c-80d8-2f9243df7674")

# 统计近 90 天数据
DAYS_RANGE   = 90


# 国家代码 → 中文名（常见国家）
COUNTRY_NAMES = {
    "CN":"中国","US":"美国","JP":"日本","KR":"韩国","DE":"德国",
    "GB":"英国","FR":"法国","CA":"加拿大","AU":"澳大利亚","IN":"印度",
    "SG":"新加坡","HK":"香港","TW":"台湾","RU":"俄罗斯","BR":"巴西",
    "NL":"荷兰","SE":"瑞典","CH":"瑞士","IT":"意大利","ES":"西班牙",
    "PL":"波兰","CZ":"捷克","AT":"奥地利","BE":"比利时","DK":"丹麦",
    "FI":"芬兰","NO":"挪威","PT":"葡萄牙","GR":"希腊","TR":"土耳其",
    "IL":"以色列","AE":"阿联酋","SA":"沙特阿拉伯","ZA":"南非","NG":"尼日利亚",
    "MX":"墨西哥","AR":"阿根廷","CL":"智利","CO":"哥伦比亚",
    "ID":"印度尼西亚","TH":"泰国","VN":"越南","MY":"马来西亚","PH":"菲律宾",
    "PK":"巴基斯坦","BD":"孟加拉国","IR":"伊朗","EG":"埃及",
    "UA":"乌克兰","RO":"罗马尼亚","HU":"匈牙利","SK":"斯洛伐克",
    "NZ":"新西兰","IE":"爱尔兰",
}


def umami_get(path, params=None):
    """调用 Umami Cloud API GET 请求"""
    url = f"{API_BASE}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(
        url,
        headers={
            "x-umami-api-key": API_TOKEN,
            "Accept": "application/json",
        },
        method="GET"
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"  [Stats] HTTP {e.code} {path}: {body[:200]}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"  [Stats] Error {path}: {e}", file=sys.stderr)
        return None


def ts(dt): return int(dt.timestamp() * 1000)


def main():
    if not API_TOKEN:
        print("[Stats] UMAMI_API_TOKEN not set, skipping.", file=sys.stderr)
        sys.exit(0)

    now       = datetime.now(timezone.utc)
    start_dt  = now - timedelta(days=DAYS_RANGE)
    start_ms  = ts(start_dt)
    end_ms    = ts(now)

    params_base = {"startAt": start_ms, "endAt": end_ms}
    wid = WEBSITE_ID

    print(f"[Stats] Fetching data for website {wid}")
    print(f"[Stats] Range: {start_dt.date()} → {now.date()}")

    # ── 1. 总体统计 ──────────────────────────────────────────
    print("[Stats] Fetching summary...")
    summary_raw = umami_get(f"/websites/{wid}/stats", params_base)
    if not summary_raw:
        print("[Stats] Failed to fetch summary", file=sys.stderr)
        sys.exit(0)

    summary = {
        "pageviews": summary_raw.get("pageviews", {}).get("value", 0),
        "visitors":  summary_raw.get("visitors",  {}).get("value", 0),
        "visits":    summary_raw.get("visits",    {}).get("value", 0),
        "bounces":   summary_raw.get("bounces",   {}).get("value", 0),
        "totaltime": summary_raw.get("totaltime", {}).get("value", 0),
    }
    print(f"  PV: {summary['pageviews']}, UV: {summary['visitors']}, Visits: {summary['visits']}")

    # ── 2. 每日 PV/UV 趋势 ───────────────────────────────────
    print("[Stats] Fetching daily pageviews...")
    pv_params = {**params_base, "unit": "day", "timezone": "UTC"}
    pv_raw = umami_get(f"/websites/{wid}/pageviews", pv_params)

    daily = []
    if pv_raw:
        pv_map  = {item["x"][:10]: item["y"] for item in pv_raw.get("pageviews", [])}
        ses_map = {item["x"][:10]: item["y"] for item in pv_raw.get("sessions",  [])}
        all_dates = sorted(set(list(pv_map.keys()) + list(ses_map.keys())))
        for d in all_dates:
            daily.append({
                "date":      d,
                "pageviews": pv_map.get(d, 0),
                "visitors":  ses_map.get(d, 0),
            })
    print(f"  Daily data points: {len(daily)}")

    # ── 3. 国家分布 ──────────────────────────────────────────
    print("[Stats] Fetching country metrics...")
    country_raw = umami_get(f"/websites/{wid}/metrics",
                             {**params_base, "type": "country", "limit": 30})
    countries = []
    if country_raw:
        for item in (country_raw if isinstance(country_raw, list) else []):
            code = (item.get("x") or "").upper()
            countries.append({
                "country":  code,
                "name":     COUNTRY_NAMES.get(code, code),
                "visitors": item.get("y", 0),
            })
    print(f"  Countries: {len(countries)}")

    # ── 4. 浏览器分布 ────────────────────────────────────────
    print("[Stats] Fetching browser metrics...")
    browser_raw = umami_get(f"/websites/{wid}/metrics",
                             {**params_base, "type": "browser", "limit": 10})
    browsers = []
    if browser_raw:
        for item in (browser_raw if isinstance(browser_raw, list) else []):
            browsers.append({"name": item.get("x",""), "count": item.get("y",0)})

    # ── 5. 设备类型 ──────────────────────────────────────────
    print("[Stats] Fetching device metrics...")
    device_raw = umami_get(f"/websites/{wid}/metrics",
                            {**params_base, "type": "device", "limit": 10})
    devices = []
    if device_raw:
        for item in (device_raw if isinstance(device_raw, list) else []):
            devices.append({"name": item.get("x",""), "count": item.get("y",0)})

    # ── 6. 来源网站 ──────────────────────────────────────────
    print("[Stats] Fetching referrer metrics...")
    ref_raw = umami_get(f"/websites/{wid}/metrics",
                         {**params_base, "type": "referrer", "limit": 10})
    referrers = []
    if ref_raw:
        for item in (ref_raw if isinstance(ref_raw, list) else []):
            name = item.get("x","") or "直接访问"
            referrers.append({"name": name, "count": item.get("y",0)})

    # ── 输出 ─────────────────────────────────────────────────
    result = {
        "generated": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "range_days": DAYS_RANGE,
        "summary":   summary,
        "daily":     daily,
        "countries": countries,
        "browsers":  browsers,
        "devices":   devices,
        "referrers": referrers,
    }

    OUTPUT_PATH.write_text(
        json.dumps(result, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    print(f"[Stats] → {OUTPUT_PATH} saved")


if __name__ == "__main__":
    main()
