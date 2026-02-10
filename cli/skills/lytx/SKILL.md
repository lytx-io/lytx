---
name: lytx
description: Use the lytx CLI to discover endpoints, run SQL queries, and format API output for analysis.
license: Not specified
---

# Lytx CLI Skill

Use this skill when you need to operate the `lytx` Zig CLI in `cli/`.

## Build

```bash
zig build
```

## Common Commands

```bash
# API health and discovery
lytx --base-url <url> --api-key <key> health
lytx --base-url <url> --api-key <key> endpoints

# List accessible sites
lytx --base-url <url> --api-key <key> sites

# Run SQL against a site
lytx --base-url <url> --api-key <key> query site_id=<id> query='SELECT * FROM site_events LIMIT 10'
```

## Output Shaping

Use formatting flags for terminal-friendly results:

- `--compact`
- `--rows-only`
- `--columns a,b,c`
- `--no-status`
- `--json`

Example:

```bash
lytx --base-url <url> --api-key <key> query site_id=<id> query='SELECT * FROM site_events LIMIT 20' --rows-only --columns id,event,created_at --no-status
```

`--columns` affects output display only; SQL still executes exactly as written.

## Auth Precedence

1. `--api-key`
2. `LYTX_API_KEY`
3. `lytx config` saved API key

## Local Runtime Caveat

In local Miniflare environments, Durable Object-backed analytics data may appear inconsistent across workers. If local queries are empty but production has data, verify in production before treating it as a CLI bug.
