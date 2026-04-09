# Rich Digest Pipeline — Design Spec

**Date:** 2026-04-09
**Location:** VPS at `~/.openclaw/workspace/knowledge-graph/`
**Status:** Approved

## Overview

Add a universal LLM digest enrichment step to the knowledge graph ingestion pipeline, and enhance the GitHub stars adapter to fetch deep repo data via GraphQL. This ensures all signal sources produce rich, analyzed digests for entity extraction and clustering — not just the sources that happen to have rich APIs (Fireflies).

## Problem

The pipeline has a quality bottleneck at `Source.transform()`:
- **Fireflies** gets rich digests from the Fireflies API (meeting summaries with strategy details, partner names, dollar amounts)
- **GitHub stars** concatenates `description + "Language: X" + README[:300]` — produces thin entities like "Python", "Agent Skills"
- **Telegram** truncates to 500 chars
- **Granola** parses markdown headers

Entity extraction (Gemini Flash) only sees the `digest` field. Thin digest = thin entities = weak graph connections.

## Design

### 1. Universal Rich Digest Step (`pipeline/digest.py`)

New pipeline module called between `transform()` and `extract_entities()`.

**Function:** `enrich_digest(signal: Signal) -> None` (mutates signal in place)

**Flow:**
1. Skip if `len(signal.digest) > 500` — already rich (e.g. Fireflies)
2. Read `signal.metadata.get("raw_content_text", signal.digest)` as input
3. Send to LLM with structured prompt requesting JSON output:
   - `digest`: 2-3 sentence rich summary
   - `key_insight`: single most important takeaway
   - `tags`: list of domain/topic tags
4. Parse JSON response, overwrite `signal.digest`, `signal.key_insight`, merge into `signal.tags`
5. On LLM failure: log warning, keep original digest unchanged

**Model:** Uses configured model from `config.json` `models.digest` key. Defaults to extraction model (`gemini-3-flash-preview`) if not set.

**LLM helper:** Reuses `_call_llm()` from `pipeline/extract.py`. Extract it to a shared `pipeline/llm.py` or import directly.

### 2. Enhanced GitHub Stars Adapter

**Replace per-repo README REST call with GraphQL query.** One query per new starred repo returns:

| Data | Field | Cap |
|------|-------|-----|
| Full README | `object(expression: "HEAD:README.md")` | 4000 chars |
| package.json / pyproject.toml | `object(expression: "HEAD:package.json")` | 2000 chars |
| Root directory listing | `object(expression: "HEAD:")` as Tree | entries list |
| Language breakdown | `languages(first: 10)` | by size |
| Topics | `repositoryTopics(first: 20)` | all |
| Recent releases | `releases(first: 3)` | name + body |
| Recent commits | `defaultBranchRef.target.history(first: 5)` | messages |
| Metadata | stars, forks, license, homepage, primaryLanguage | all |

**GraphQL query:** Single query fetching all of the above. Cost: 1 rate limit point per repo. Well within 5000 points/hour limit.

**`transform()` builds `raw_content_text`:** Structured text block:
```
Repository: {owner}/{name}
Description: {description}
Stars: {stars} | Language: {primary_language} | License: {license}
Topics: {topics joined}
Languages: {language breakdown}
Dependencies: {parsed from package.json/pyproject.toml}
Root files: {directory listing}
Recent commits: {last 5 messages}
Latest release: {name}: {body truncated}

README:
{readme text, max 4000 chars}
```

**`poll()` changes:** Stars list still fetched via REST (starred endpoint needs the star+json accept header). Per-repo `_fetch_readme_excerpt()` replaced with `_fetch_repo_intel()` using GraphQL.

**`digest` field:** Stays thin in `transform()` — the universal digest step enriches it.

### 3. Adapter raw_content_text Contract

New convention: adapters that want rich digest enrichment set `signal.metadata["raw_content_text"]` to a human-readable text block in their `transform()` method.

- **GitHub stars:** Full structured text (README, deps, tree, commits)
- **Telegram:** Full message text (not truncated)
- **Fireflies:** Not needed — digest already rich, skip condition triggers
- **Granola:** Not needed now — can be added later
- **Future adapters:** Just set `raw_content_text` and get rich digests for free

No changes to `RawSignal` or `Signal` dataclasses. Uses existing `metadata` dict.

### 4. Orchestrator Changes

In `orchestrator.py` `_run_ingest()`, add `enrich_digest(signal)` call after transform, before embedding and entity extraction:

```python
from pipeline.digest import enrich_digest

# In the signal processing loop, before embedding:
enrich_digest(signal)
```

### 5. Config Addition

Add to `config.json` `models` section:
```json
"digest": "openrouter/google/gemini-3-flash-preview"
```

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `pipeline/digest.py` | Create | Universal LLM digest enrichment |
| `sources/github_stars.py` | Modify | GraphQL query + raw_content_text |
| `sources/telegram_forward.py` | Modify | Set raw_content_text to full message |
| `orchestrator.py` | Modify | Call enrich_digest() before extract |
| `config.json` | Modify | Add digest model config |

## Cost

- LLM digest call: ~5-10K input tokens per signal, ~200 output tokens. At Gemini Flash pricing: ~$0.001 per signal.
- GitHub GraphQL: 1 point per repo (5000/hour limit).
- Skipped for signals with existing rich digests (>500 chars).
- At typical volume (few new signals per day): negligible cost.
