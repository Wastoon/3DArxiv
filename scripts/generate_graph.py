#!/usr/bin/env python3
"""
generate_graph.py
读取 ./target/cache.json，输出 ./target/graph.json

cache.json 真实格式：
{
  "2026-03-12T00:00:00Z": {
    "Robotics": [
      { "id": "...", "authors": ["A","B"], "comment": null, ... }
    ]
  }
}
"""

import json, re, sys, math
from pathlib import Path
from datetime import datetime, timezone
from collections import defaultdict

CACHE_PATH  = Path("./target/cache.json")
OUTPUT_PATH = Path("./target/graph.json")

SIMILARITY_THRESHOLD = 0.30
MAX_SIMILAR_PER_NODE = 8
MAX_PAPERS           = 500

TAG_RULES = [
    ("VLA",          ["vision-language-action", "vla"]),
    ("Humanoid",     ["humanoid", "bipedal", "whole-body", "loco-manipulation"]),
    ("Manipulation", ["manipulation", "dexterous", "grasping", "in-hand"]),
    ("Navigation",   ["navigation", "path planning", "obstacle avoidance", "autonomous driving"]),
    ("NeRF/3DGS",    ["nerf", "neural radiance", "3d gaussian", "gaussian splatting"]),
    ("Diffusion",    ["diffusion model", "diffusion policy", "score matching", "denoising"]),
    ("Sim-to-Real",  ["sim-to-real", "sim2real", "domain randomization"]),
    ("RL",           ["reinforcement learning", "policy gradient", "ppo", "sac", "reward"]),
    ("Transformer",  ["transformer", "attention mechanism", "vision transformer"]),
    ("Dataset",      ["dataset", "benchmark", "annotation"]),
    ("Survey",       ["survey", "review", "overview", "taxonomy"]),
]

CONF_PATTERN = re.compile(
    r'\b(CVPR|ICCV|ECCV|NeurIPS|ICLR|ICML|ICRA|IROS|RSS|CoRL|AAAI|IJCAI|3DV|RA-L|RAL|WACV)\b[\s\'\-]*(\d{4})?',
    re.IGNORECASE
)


def load_cache():
    if not CACHE_PATH.exists():
        print(f"[Graph] cache.json not found", file=sys.stderr)
        sys.exit(0)
    with open(CACHE_PATH, encoding="utf-8") as f:
        return json.load(f)


def assign_tags(text: str) -> list:
    low = text.lower()
    return [tag for tag, kws in TAG_RULES if any(kw in low for kw in kws)]


def extract_conf(comment) -> str:
    if not comment:
        return ""
    m = CONF_PATTERN.search(str(comment))
    return m.group(0).strip() if m else ""


def tokenize(text: str) -> list:
    STOP = {
        "a","an","the","is","in","it","of","to","and","or","for","with","on","at",
        "by","from","this","that","we","our","are","be","as","has","have","can","not",
        "but","also","which","their","these","they","was","were","been","its","more",
        "into","using","based","show","propose","proposed","presents","present","paper",
        "approach","method","model","models","results","result","new","high","large",
        "both","such","two","each","where","when","however","while","given","used",
        "use","well","than","how","what","through","between","without","within"
    }
    tokens = re.findall(r"[a-zA-Z]{3,}", text.lower())
    return [t for t in tokens if t not in STOP]


def build_tfidf(papers: list) -> list:
    corpus = []
    for p in papers:
        tokens = tokenize(p["title"] + " " + p.get("summary", ""))
        tf = defaultdict(float)
        for t in tokens:
            tf[t] += 1.0
        total = max(len(tokens), 1)
        corpus.append({t: v / total for t, v in tf.items()})

    n = len(corpus)
    df = defaultdict(int)
    for doc in corpus:
        for t in doc:
            df[t] += 1
    idf = {t: math.log((n + 1) / (cnt + 1)) + 1 for t, cnt in df.items()}

    vecs = []
    for doc in corpus:
        vec = {t: tf * idf[t] for t, tf in doc.items()}
        norm = math.sqrt(sum(v * v for v in vec.values())) or 1.0
        vecs.append({t: v / norm for t, v in vec.items()})
    return vecs


def cosine(a: dict, b: dict) -> float:
    if len(a) > len(b):
        a, b = b, a
    return sum(v * b.get(t, 0.0) for t, v in a.items())


def build_author_edges(papers: list) -> list:
    author_map = defaultdict(list)
    for p in papers:
        for author in p.get("authors_list", []):
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

                arxiv_id = re.sub(r".*/abs/", "", pid).rstrip("/")
                arxiv_id = re.sub(r"v\d+$", "", arxiv_id)

                # authors 是列表
                raw_authors = p.get("authors", [])
                authors_list = raw_authors if isinstance(raw_authors, list) else []
                authors_str  = ", ".join(authors_list)

                title   = p.get("title", "")
                summary = p.get("summary", "")
                comment = p.get("comment") or ""

                papers.append({
                    "id":          pid,
                    "arxivId":     arxiv_id,
                    "title":       title,
                    "authors":     authors_str,
                    "authors_list": authors_list,
                    "summary":     summary,
                    "subject":     subject,
                    "date":        (p.get("published", date_key) or date_key)[:10],
                    "tags":        assign_tags(title + " " + summary),
                    "hasConf":     bool(extract_conf(comment)),
                    "confName":    extract_conf(comment),
                })

    papers.sort(key=lambda x: x.get("date", ""), reverse=True)
    return papers[:MAX_PAPERS]


def main():
    cache  = load_cache()
    papers = collect_papers(cache)
    print(f"[Graph] Processing {len(papers)} papers")

    # 节点（去掉 authors_list，前端不需要）
    nodes = [{k: v for k, v in p.items() if k != "authors_list"} for p in papers]

    # 相似度边
    print("[Graph] Computing TF-IDF similarity...")
    vecs = build_tfidf(papers)
    n = len(papers)
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
            if i < j:
                sim_edges.append({
                    "source": papers[i]["id"],
                    "target": papers[j]["id"],
                    "type":   "similar",
                    "weight": round(s, 4)
                })
    print(f"[Graph] Similarity edges: {len(sim_edges)}")

    # 作者边
    author_edges = build_author_edges(papers)
    print(f"[Graph] Author edges: {len(author_edges)}")

    graph = {
        "nodes": nodes,
        "edges": sim_edges + author_edges,
        "meta": {
            "generated":    datetime.now(timezone.utc).isoformat(),
            "paper_count":  len(nodes),
            "edge_count":   len(sim_edges) + len(author_edges),
            "sim_edges":    len(sim_edges),
            "author_edges": len(author_edges),
            "threshold":    SIMILARITY_THRESHOLD,
        }
    }

    OUTPUT_PATH.write_text(json.dumps(graph, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    size_kb = OUTPUT_PATH.stat().st_size / 1024
    print(f"[Graph] → {OUTPUT_PATH} ({size_kb:.1f} KB, {len(nodes)} nodes, {len(sim_edges)+len(author_edges)} edges)")


if __name__ == "__main__":
    main()
