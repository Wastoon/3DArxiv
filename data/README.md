# Data Directory

`embeddings.json` is a generated cache used by `scripts/generate_graph.py`.
It is intentionally ignored by Git and persisted in CI with GitHub Actions cache.

For local development, create it only when needed:

```bash
mkdir -p data
echo "{}" > data/embeddings.json
```
