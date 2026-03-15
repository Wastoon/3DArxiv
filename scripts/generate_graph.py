#!/usr/bin/env python3
"""
generate_graph.py  v2 — Semantic Knowledge Graph
流程：
  1. 读取 cache.json 获取本周新论文
  2. 对每篇新论文：用 Gemini embedding 计算向量，ArXiv 搜索历史相关论文
  3. 新论文之间 + 新论文与历史论文之间做相似度计算
  4. 增量更新 data/embeddings.json
  5. 输出 target/graph.json

环境变量：GEMINI_API_KEY（无则降级为 TF-IDF）
"""

import json, re, sys, math, time, os
import urllib.request, urllib.parse, urllib.error
from pathlib import Path
from datetime import datetime, timezone
from collections import defaultdict

CACHE_PATH   = Path("./target/cache.json")
EMBED_PATH   = Path("./data/embeddings.json")
OUTPUT_PATH  = Path("./target/graph.json")

GEMINI_API_KEY       = os.environ.get("GEMINI_API_KEY", "")
EMBED_API_URL        = "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent"

MAX_NEW_PER_RUN      = 30
ARXIV_SEARCH_RESULTS = 8
SIMILARITY_THRESHOLD = 0.60
NEW_SIM_THRESH       = 0.65
MAX_HIST_PER_NEW     = 4
MAX_TOTAL_NODES      = 1500
ARXIV_INTERVAL       = 3.5
EMBED_INTERVAL       = 0.12

TAG_RULES = [
    ("VLA",          ["vision-language-action","vla"]),
    ("Humanoid",     ["humanoid","bipedal","whole-body","loco-manipulation"]),
    ("Manipulation", ["manipulation","dexterous","grasping","in-hand"]),
    ("Navigation",   ["navigation","path planning","obstacle avoidance","autonomous driving"]),
    ("NeRF/3DGS",    ["nerf","neural radiance","3d gaussian","gaussian splatting"]),
    ("Diffusion",    ["diffusion model","diffusion policy","denoising"]),
    ("Sim-to-Real",  ["sim-to-real","sim2real","domain randomization"]),
    ("RL",           ["reinforcement learning","policy gradient","ppo","sac"]),
    ("Transformer",  ["transformer","attention mechanism","vision transformer"]),
    ("Dataset",      ["dataset","benchmark","annotation"]),
    ("Survey",       ["survey","review","overview","taxonomy"]),
]
CONF_PAT = re.compile(
    r'\b(CVPR|ICCV|ECCV|NeurIPS|ICLR|ICML|ICRA|IROS|RSS|CoRL|AAAI|IJCAI|3DV|RA-L|RAL|WACV)\b',
    re.IGNORECASE
)

# ── 工具 ─────────────────────────────────────────────────
def load_json(path, default):
    if not path.exists(): return default
    try:    return json.loads(path.read_text(encoding="utf-8"))
    except: return default

def assign_tags(text):
    low = text.lower()
    return [t for t,kws in TAG_RULES if any(k in low for k in kws)]

def extract_conf(comment):
    if not comment: return ""
    m = CONF_PAT.search(str(comment))
    return m.group(0).strip() if m else ""

def clean_id(url):
    aid = re.sub(r".*/abs/","",url).rstrip("/")
    return re.sub(r"v\d+$","",aid)

# ── 收集新论文 ────────────────────────────────────────────
def collect_new_papers(cache):
    papers, seen = [], set()
    for date_key, subjects in cache.items():
        if not isinstance(subjects, dict): continue
        for subject, paper_list in subjects.items():
            if not isinstance(paper_list, list): continue
            for p in paper_list:
                pid = p.get("id","")
                if not pid or pid in seen: continue
                seen.add(pid)
                raw  = p.get("authors",[])
                alist = raw if isinstance(raw,list) else []
                title = p.get("title","")
                summ  = p.get("summary","")
                comm  = p.get("comment") or ""
                papers.append({
                    "id": pid, "arxivId": clean_id(pid),
                    "title": title, "authors": ", ".join(alist),
                    "authors_list": alist, "summary": summ,
                    "subject": subject,
                    "date": (p.get("published",date_key) or date_key)[:10],
                    "tags": assign_tags(title+" "+summ),
                    "hasConf": bool(extract_conf(comm)),
                    "confName": extract_conf(comm),
                    "nodeType": "new",
                })
    papers.sort(key=lambda x:x.get("date",""), reverse=True)
    return papers

# ── ArXiv 搜索 ────────────────────────────────────────────
def build_query(paper):
    title = re.sub(r'\$[^$]*\$','',paper["title"])
    title = re.sub(r'[^\w\s]',' ',title)
    STOP = {"a","an","the","is","in","of","to","and","or","for","with","on","at","by",
            "via","towards","using","based","new","novel","learning","deep","neural",
            "network","model","method","approach","framework","system"}
    words = [w for w in title.lower().split() if len(w)>3 and w not in STOP]
    return " ".join(words[:4]) or title[:50]

def arxiv_search(query, max_results=8):
    print(f"  [ArXiv] querying: {query[:50]}", flush=True)
    params = urllib.parse.urlencode({
        "search_query": f"ti:{query} AND cat:cs.*",
        "start": 0, "max_results": max_results,
        "sortBy": "relevance", "sortOrder": "descending",
    })
    url = f"https://export.arxiv.org/api/query?{params}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent":"3DArxiv/2.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            xml = r.read().decode("utf-8")
    except Exception as e:
        print(f"  [ArXiv] failed: {e}", file=sys.stderr)
        return []

    papers = []
    for entry in re.findall(r"<entry>(.*?)</entry>", xml, re.DOTALL):
        def tag(name):
            m = re.search(rf"<{name}[^>]*>(.*?)</{name}>", entry, re.DOTALL)
            return m.group(1).strip() if m else ""
        pid_m = re.search(r"<id>(.*?)</id>", entry)
        if not pid_m: continue
        pid = re.sub(r"v\d+$","", pid_m.group(1).strip().rstrip("/"))
        if "arxiv.org" not in pid: continue
        title   = re.sub(r"\s+"," ", tag("title"))
        summary = re.sub(r"\s+"," ", tag("summary"))[:600]
        pub     = tag("published")[:10]
        authors = re.findall(r"<n>(.*?)</n>", entry)
        papers.append({
            "id": pid, "arxivId": clean_id(pid),
            "title": title, "summary": summary,
            "authors": ", ".join(authors), "authors_list": authors,
            "date": pub, "tags": assign_tags(title+" "+summary),
            "hasConf": False, "confName": "",
            "subject": "Historical", "nodeType": "historical",
        })
    return papers

# ── Gemini Embedding ──────────────────────────────────────
def get_embedding(text):
    print(f"  [Embed] calling API...", flush=True)
    if not GEMINI_API_KEY: return None
    payload = json.dumps({
        "content": {"parts": [{"text": text[:2000]}]},
    }).encode("utf-8")
    url = EMBED_API_URL
    req = urllib.request.Request(url, data=payload,
        headers={"Content-Type":"application/json","x-goog-api-key":GEMINI_API_KEY},
        method="POST")
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            res = json.loads(r.read())
            vec = res.get("embedding",{}).get("values",[])
            if not vec: return None
            norm = math.sqrt(sum(v*v for v in vec)) or 1.0
            return [v/norm for v in vec]
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8","replace")
        print(f"  [Embed] HTTP {e.code}: {body[:120]}", file=sys.stderr)
        if e.code == 429:
            print("  [Embed] Rate limited, stopping this run.", file=sys.stderr)
            raise SystemExit(0)
        return None
    except Exception as e:
        print(f"  [Embed] {e}", file=sys.stderr)
        return None

def cosine(a, b):
    return sum(x*y for x,y in zip(a,b))

# ── TF-IDF 降级 ───────────────────────────────────────────
def tfidf_vecs(papers):
    STOP = {"a","an","the","is","in","it","of","to","and","or","for","with","on","at",
            "by","from","this","that","we","our","are","be","as","has","have","can",
            "not","but","also","which","they","was","its","more","into","using","based",
            "show","propose","paper","approach","method","model","results","new","use"}
    def tok(t): return [w for w in re.findall(r"[a-zA-Z]{3,}",t.lower()) if w not in STOP]
    corpus = []
    for p in papers:
        tokens = tok(p["title"]+" "+p.get("summary",""))
        tf = defaultdict(float)
        for t in tokens: tf[t]+=1
        total = max(len(tokens),1)
        corpus.append({t:v/total for t,v in tf.items()})
    n = len(corpus)
    df = defaultdict(int)
    for doc in corpus:
        for t in doc: df[t]+=1
    idf = {t: math.log((n+1)/(c+1))+1 for t,c in df.items()}
    vecs = []
    for doc in corpus:
        vec = {t:tf*idf[t] for t,tf in doc.items()}
        norm = math.sqrt(sum(v*v for v in vec.values())) or 1.0
        vecs.append({t:v/norm for t,v in vec.items()})
    return vecs

def cosine_sp(a,b):
    if len(a)>len(b): a,b=b,a
    return sum(v*b.get(t,0.0) for t,v in a.items())

# ── 主流程 ────────────────────────────────────────────────
def main():
    print("[Graph] Script started", flush=True)
    print(f"[Graph] GEMINI_API_KEY set: {bool(GEMINI_API_KEY)}", flush=True)
    print(f"[Graph] CACHE_PATH exists: {CACHE_PATH.exists()}", flush=True)
    print(f"[Graph] EMBED_PATH exists: {EMBED_PATH.exists()}", flush=True)

    if not CACHE_PATH.exists():
        print("[Graph] cache.json not found", file=sys.stderr); sys.exit(0)

    cache      = load_json(CACHE_PATH, {})
    emb_cache  = load_json(EMBED_PATH, {})
    new_papers = collect_new_papers(cache)

    print(f"[Graph] New papers: {len(new_papers)}", flush=True)
    print(f"[Graph] Embedding cache: {len(emb_cache)} entries", flush=True)
    print(f"[Graph] Mode: {'Gemini Embedding' if GEMINI_API_KEY else 'TF-IDF'}", flush=True)

    uncached = [p for p in new_papers if p["id"] not in emb_cache]
    to_proc  = uncached[:MAX_NEW_PER_RUN]
    print(f"[Graph] To process: {len(to_proc)}/{len(uncached)} uncached")

    historical_papers = {}
    hist_emb = {}

    if GEMINI_API_KEY:
        # Step 1: embed new papers
        print(f"[Graph] Embedding {len(to_proc)} new papers...")
        for i, p in enumerate(to_proc):
            text = f"{p['title']}. {p.get('summary','')[:500]}"
            vec  = get_embedding(text)
            if vec:
                emb_cache[p["id"]] = {"vec": vec, "title": p["title"], "date": p["date"]}
            if i < len(to_proc)-1: time.sleep(EMBED_INTERVAL)

        # Step 2: ArXiv search + embed historical
        print(f"[Graph] Searching historical papers for {len(to_proc)} new papers...")
        for i, p in enumerate(to_proc):
            query = build_query(p)
            print(f"  [{i+1}/{len(to_proc)}] '{query}'")
            results = arxiv_search(query, ARXIV_SEARCH_RESULTS)
            new_ids = {n["id"] for n in new_papers}
            results = [h for h in results if h["id"] not in new_ids]
            for h in results:
                if h["id"] not in emb_cache and h["id"] not in hist_emb:
                    text = f"{h['title']}. {h.get('summary','')[:500]}"
                    vec  = get_embedding(text)
                    if vec: hist_emb[h["id"]] = vec
                    time.sleep(EMBED_INTERVAL)
                historical_papers[h["id"]] = h
            time.sleep(ARXIV_INTERVAL)

    # Step 3: build edges
    all_nodes_map = {p["id"]: p for p in new_papers}
    for hid,h in historical_papers.items():
        if hid not in all_nodes_map: all_nodes_map[hid] = h

    edges = []
    seen_e = set()
    def add_edge(s,t,etype,w,label=""):
        key = tuple(sorted([s,t]))+(etype,)
        if key not in seen_e:
            seen_e.add(key)
            e = {"source":s,"target":t,"type":etype,"weight":round(w,4)}
            if label: e["label"] = label
            edges.append(e)

    if GEMINI_API_KEY:
        # new × new
        nwv = [p for p in new_papers if p["id"] in emb_cache]
        print(f"[Graph] new×new similarity ({len(nwv)} papers)...")
        for i in range(len(nwv)):
            for j in range(i+1, len(nwv)):
                sim = cosine(emb_cache[nwv[i]["id"]]["vec"], emb_cache[nwv[j]["id"]]["vec"])
                if sim >= NEW_SIM_THRESH:
                    add_edge(nwv[i]["id"], nwv[j]["id"], "similar", sim)

        # new → historical
        print(f"[Graph] new→historical edges...")
        for p in to_proc:
            if p["id"] not in emb_cache: continue
            pv = emb_cache[p["id"]]["vec"]
            cands = []
            for hid,h in historical_papers.items():
                hv = emb_cache.get(hid,{}).get("vec") or hist_emb.get(hid)
                if not hv: continue
                sim = cosine(pv, hv)
                if sim >= SIMILARITY_THRESHOLD:
                    cands.append((hid, sim))
            cands.sort(key=lambda x:-x[1])
            for hid,sim in cands[:MAX_HIST_PER_NEW]:
                add_edge(p["id"], hid, "historical", sim)
    else:
        # TF-IDF fallback
        vecs = tfidf_vecs(new_papers)
        for i in range(len(new_papers)):
            sims = [(j, cosine_sp(vecs[i],vecs[j])) for j in range(len(new_papers)) if i!=j]
            sims = [(j,s) for j,s in sims if s>=0.28]
            sims.sort(key=lambda x:-x[1])
            for j,s in sims[:6]:
                if i<j: add_edge(new_papers[i]["id"],new_papers[j]["id"],"similar",s)

    # author edges (new papers only)
    author_map = defaultdict(list)
    for p in new_papers:
        for a in p.get("authors_list",[]):
            a=a.strip()
            if len(a)>3: author_map[a].append(p["id"])
    for author,ids in author_map.items():
        if len(ids)<2: continue
        for i in range(len(ids)):
            for j in range(i+1,len(ids)):
                add_edge(ids[i],ids[j],"author",1.0,author)

    # filter: only keep historical nodes that have edges
    connected = set()
    for e in edges: connected.add(e["source"]); connected.add(e["target"])
    new_ids_set = {p["id"] for p in new_papers}
    final_nodes = [n for n in all_nodes_map.values()
                   if n["id"] in new_ids_set or n["id"] in connected]

    if len(final_nodes) > MAX_TOTAL_NODES:
        hist_refs = defaultdict(int)
        for e in edges:
            if e["type"]=="historical": hist_refs[e["target"]]+=1
        newnodes = [n for n in final_nodes if n["nodeType"]=="new"]
        histnodes = sorted([n for n in final_nodes if n["nodeType"]=="historical"],
                            key=lambda n:-hist_refs.get(n["id"],0))
        final_nodes = newnodes + histnodes[:MAX_TOTAL_NODES-len(newnodes)]

    final_ids = {n["id"] for n in final_nodes}
    final_edges = [e for e in edges if e["source"] in final_ids and e["target"] in final_ids]
    clean_nodes = [{k:v for k,v in n.items() if k!="authors_list"} for n in final_nodes]

    # save embedding cache to data/
    for hid,vec in hist_emb.items():
        if hid not in emb_cache and hid in historical_papers:
            h = historical_papers[hid]
            emb_cache[hid] = {"vec":vec,"title":h["title"],"date":h.get("date","")}
    # 压缩向量：保留4位小数，大幅减小文件体积（精度损失<0.01%）
    compressed = {}
    for pid, entry in emb_cache.items():
        compressed[pid] = {
            "vec":   [round(v, 4) for v in entry["vec"]],
            "title": entry["title"],
            "date":  entry["date"],
        }
    EMBED_PATH.parent.mkdir(exist_ok=True)
    EMBED_PATH.write_text(json.dumps(compressed, ensure_ascii=False, separators=(",",":")),
                           encoding="utf-8")
    emb_cache = compressed  # 更新内存中的缓存
    print(f"[Graph] Saved {len(compressed)} embeddings → {EMBED_PATH} "
          f"({EMBED_PATH.stat().st_size//1024} KB)")

    edge_types = defaultdict(int)
    for e in final_edges: edge_types[e["type"]]+=1

    graph = {
        "nodes": clean_nodes,
        "edges": final_edges,
        "meta": {
            "generated":   datetime.now(timezone.utc).isoformat(),
            "paper_count": len(clean_nodes),
            "new_papers":  sum(1 for n in clean_nodes if n.get("nodeType")=="new"),
            "hist_papers": sum(1 for n in clean_nodes if n.get("nodeType")=="historical"),
            "edge_count":  len(final_edges),
            "edge_types":  dict(edge_types),
            "mode":        "gemini-embedding" if GEMINI_API_KEY else "tfidf",
        }
    }
    OUTPUT_PATH.write_text(json.dumps(graph, ensure_ascii=False, separators=(",",":")),
                            encoding="utf-8")
    print(f"[Graph] → {OUTPUT_PATH} ({OUTPUT_PATH.stat().st_size//1024} KB)")
    print(f"[Graph] Nodes: {len(clean_nodes)} "
          f"({graph['meta']['new_papers']} new, {graph['meta']['hist_papers']} historical)")
    print(f"[Graph] Edges: {len(final_edges)} {dict(edge_types)}")

if __name__ == "__main__":
    main()
