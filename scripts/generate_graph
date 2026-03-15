#!/usr/bin/env python3
"""
generate_graph.py
读取 ./target/cache.json，输出 ./target/graph.json

graph.json 格式（供阶段4 3D 知识图谱前端使用）：
{
  "nodes": [
    {
      "id": "https://arxiv.org/abs/2501.12345",
      "arxivId": "2501.12345",
      "title": "...",
      "authors": "...",
      "subject": "Robotics",
      "date": "2025-01-20",
      "tags": ["VLA", "Manipulation"],
      "hasStar": false,
      "hasConf": true,
      "confName": "CVPR 2025"
    }
  ],
  "edges": [
    { "source": "url_a", "target": "url_b", "type": "similar", "weight": 0.72 },
    { "source": "url_a", "target": "url_c", "type": "author",  "weight": 1.0  }
  ],
  "meta": { "generated": "2025-01-20T12:00:00Z", "paper_count": 300, "edge_count": 450 }
}

边类型：
  "similar" — TF-IDF 摘要余弦相似度 > 阈值
  "author"  — 共同作者
"""

import json, re, sys, math
from pathlib import Path
from datetime import datetime, timezone
from collections import defaultdict

CACHE_PATH  = Path("./target/cache.json")
OUTPUT_PATH = Path("./target/graph.json")

# ── 参数 ──────────────────────────────────────────────
SIMILARITY_THRESHOLD = 0.30   # TF-IDF 余弦相似度阈值（越高边越少越精准）
MAX_SIMILAR_PER_NODE = 8      # 每个节点最多保留 N 条 similar 边（避免图太密）
MAX_PAPERS           = 500    # 最多处理最近 N 篇（防止矩阵太大）

# ── 子方向标签规则（与 index.js 保持一致）────────────────
TAG_RULES = [
    ("VLA",          ["vision-language-action", "vla"]),
    ("Humanoid",     ["humanoid", "bipedal", "whole-body", "loco-manipulation"]),
    ("Manipulation", ["manipulation", "dexterous", "grasping", "in-hand"]),
    ("Navigation",   ["navigation", "path planning", "obstacle avoidance", "autonomous driving"]),
    ("NeRF/3DGS",    ["nerf", "neural radiance", "3d gaussian", "gaussian splatting", "implicit surface"]),
    ("Diffusion",    ["diffusion model", "diffusion policy", "score matching", "denoising"]),
    ("Sim-to-Real",  ["sim-to-real", "sim2real", "domain randomization"]),
    ("RL",           ["reinforcement learning", "policy gradient", "ppo", "sac", "reward"]),
    ("Transformer",  ["transformer", "attention mechanism", "self-attention", "vision transformer"]),
    ("Dataset",      ["dataset", "benchmark", "annotation"]),
    ("Survey",       ["survey", "review", "overview", "taxonomy"]),
]

CONF_PATTERN = re.compile(
    r'\b(CVPR|ICCV|ECCV|NeurIPS|ICLR|ICML|ICRA|IROS|RSS|CoRL|AAAI|IJCAI|3DV|RA-L|RAL|WACV|BMVC)\b[\s\'\-]*(\d{4})?',
    re.IGNORECASE
)

STAR_PATTERN = re.compile(r'[★☆]')


def load_cache():
    if not CACHE_PATH.exists():
        print(f"[Graph] cache.json not found, skipping.", file=sys.stderr)
        sys.exit(0)
    with open(CACHE_PATH, encoding="utf-8") as f:
        return json.load(f)


def assign_tags(text: str) -> list[str]:
    low = text.lower()
    return [tag for tag, kws in TAG_RULES if any(kw in low for kw in kws)]


def extract_conf(comment: str) -> str:
    if not comment:
        return ""
    m = CONF_PATTERN.search(comment)
    return m.group(0).strip() if m else ""


# ── TF-IDF ────────────────────────────────────────────

def tokenize(text: str) -> list[str]:
    """简单英文分词：小写，去除标点，过滤停用词"""
    STOP = {
        "a","an","the","is","in","it","of","to","and","or","for","with",
        "on","at","by","from","this","that","we","our","are","be","as",
        "has","have","can","not","but","also","which","their","these",
        "they","was","were","been","its","more","into","using","based",
        "show","shows","propose","proposed","presents","present","paper",
        "approach","method","model","models","results","result","problem",
        "new","high","large","small","both","such","two","each","where",
        "when","however","while","given","used","use","well","than","than",
        "how","what","through","between","without","within","across","over",
        "under","around","about","above","below"
    }
    tokens = re.findall(r"[a-zA-Z]{3,}", text.lower())
    return [t for t in tokens if t not in STOP]


def build_tfidf(papers: list[dict]) -> list[dict]:
    """计算每篇论文的 TF-IDF 向量（稀疏字典形式）"""
    corpus = []
    for p in papers:
        tokens = tokenize(p["title"] + " " + p.get("summary", ""))
        tf = defaultdict(float)
        for t in tokens:
            tf[t] += 1.0
        total = max(len(tokens), 1)
        for t in tf:
            tf[t] /= total
        corpus.append(dict(tf))

    # IDF
    n = len(corpus)
    df = defaultdict(int)
    for doc in corpus:
        for t in doc:
            df[t] += 1
    idf = {t: math.log((n + 1) / (cnt + 1)) + 1 for t, cnt in df.items()}

    # TF-IDF + L2 归一化
    vecs = []
    for doc in corpus:
        vec = {t: tf * idf[t] for t, tf in doc.items()}
        norm = math.sqrt(sum(v * v for v in vec.values())) or 1.0
        vecs.append({t: v / norm for t, v in vec.items()})
    return vecs


def cosine(a: dict, b: dict) -> float:
    """稀疏向量余弦相似度"""
    # 只遍历较短的那个向量
    if len(a) > len(b):
        a, b = b, a
    return sum(v * b.get(t, 0.0) for t, v in a.items())


def build_author_edges(papers: list[dict]) -> list[dict]:
    """构建作者共现边"""
    # author → [paper_url, ...]
    author_map = defaultdict(list)
    for p in papers:
        for author in re.split(r",\s*", p.get("authors", "")):
            author = author.strip()
            if len(author) > 3:
                author_map[author].append(p["id"])

    edges = []
    seen = set()
    for author, urls in author_map.items():
        if len(urls) < 2:
            continue
        for i in range(len(urls)):
            for j in range(i + 1, len(urls)):
                key = tuple(sorted([urls[i], urls[j]]))
                if key not in seen:
                    seen.add(key)
                    edges.append({
                        "source": urls[i],
                        "target": urls[j],
                        "type":   "author",
                        "weight": 1.0,
                        "label":  author
                    })
    return edges


def main():
    cache = load_cache()
    days = cache.get("days", [])

    # ── 收集所有论文 ──────────────────────────────────
    papers_raw = []
    seen_ids = set()
    for day in days:
        date_str = day.get("date", "")
        for subj_block in day.get("subjects", []):
            subject = subj_block.get("subject", "")
            for p in subj_block.get("papers", []):
                pid = p.get("id", "")
                if not pid or pid in seen_ids:
                    continue
                seen_ids.add(pid)
                # 提取 arxiv ID
                arxiv_id = re.sub(r".*/abs/", "", pid).rstrip("/")
                arxiv_id = re.sub(r"v\d+$", "", arxiv_id)

                title   = p.get("title", "")
                authors = p.get("authors", "")
                summary = p.get("summary", "")
                comment = p.get("comment", "")
                pub_date = p.get("published", date_str)

                tags      = assign_tags(title + " " + summary)
                conf_name = extract_conf(comment)

                papers_raw.append({
                    "id":       pid,
                    "arxivId":  arxiv_id,
                    "title":    title,
                    "authors":  authors,
                    "summary":  summary,
                    "subject":  subject,
                    "date":     pub_date[:10] if pub_date else "",
                    "tags":     tags,
                    "hasConf":  bool(conf_name),
                    "confName": conf_name,
                })

    # 按日期倒序，只处理最近 MAX_PAPERS 篇
    papers_raw.sort(key=lambda p: p.get("date", ""), reverse=True)
    papers = papers_raw[:MAX_PAPERS]
    print(f"[Graph] Processing {len(papers)} papers (total unique: {len(papers_raw)})")

    # ── 构建节点 ──────────────────────────────────────
    nodes = []
    for p in papers:
        nodes.append({
            "id":       p["id"],
            "arxivId":  p["arxivId"],
            "title":    p["title"],
            "authors":  p["authors"],
            "subject":  p["subject"],
            "date":     p["date"],
            "tags":     p["tags"],
            "hasConf":  p["hasConf"],
            "confName": p["confName"],
        })

    # ── 构建边：相似度 ────────────────────────────────
    print("[Graph] Computing TF-IDF similarity...")
    vecs = build_tfidf(papers)
    n = len(papers)

    # 对每个节点，找相似度最高的 top-K 邻居
    sim_edges = []
    for i in range(n):
        sims = []
        for j in range(n):
            if i == j:
                continue
            s = cosine(vecs[i], vecs[j])
            if s >= SIMILARITY_THRESHOLD:
                sims.append((j, s))
        sims.sort(key=lambda x: -x[1])
        for j, s in sims[:MAX_SIMILAR_PER_NODE]:
            # 去重：只保留 i < j 的方向
            if i < j:
                sim_edges.append({
                    "source": papers[i]["id"],
                    "target": papers[j]["id"],
                    "type":   "similar",
                    "weight": round(s, 4)
                })

    print(f"[Graph] Similarity edges: {len(sim_edges)}")

    # ── 构建边：共同作者 ──────────────────────────────
    author_edges = build_author_edges(papers)
    print(f"[Graph] Author edges: {len(author_edges)}")

    # 合并边
    all_edges = sim_edges + author_edges

    # ── 输出 ──────────────────────────────────────────
    graph = {
        "nodes": nodes,
        "edges": all_edges,
        "meta": {
            "generated":   datetime.now(timezone.utc).isoformat(),
            "paper_count": len(nodes),
            "edge_count":  len(all_edges),
            "sim_edges":   len(sim_edges),
            "author_edges":len(author_edges),
            "threshold":   SIMILARITY_THRESHOLD,
        }
    }

    OUTPUT_PATH.write_text(json.dumps(graph, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    size_kb = OUTPUT_PATH.stat().st_size / 1024
    print(f"[Graph] → {OUTPUT_PATH} ({size_kb:.1f} KB, {len(nodes)} nodes, {len(all_edges)} edges)")


if __name__ == "__main__":
    main()
