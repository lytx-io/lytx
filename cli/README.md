# lytx CLI

Zig CLI for calling the Lytx API using OpenAPI discovery with convenient hybrid commands.

## Build and Run

```bash
zig build
lytx help
```

## Authentication

Auth precedence:

1. `--api-key`
2. `LYTX_API_KEY`
3. `lytx config` saved value

Set a default key and base URL locally:

```bash
lytx config set api-key <your-key>
lytx config set base-url https://api.lytx.io
```

## Core Commands

```bash
# OpenAPI discovery
lytx endpoints
lytx openapi

# Generic OpenAPI call
lytx call GET /do/sites

# Hybrid shortcuts
lytx health
lytx sites
lytx events site_id=26 limit=10
lytx query site_id=26 query='SELECT * FROM site_events LIMIT 10'
```

## Output Controls

Use these flags to clean up and shape output for terminal workflows:

- `--compact`: hide response metadata wrappers around table data when possible
- `--rows-only`: print only primary data arrays (for example `rows`/`events`)
- `--columns a,b,c`: show only selected columns in table output
- `--no-status`: hide `HTTP ...` header line
- `--json`: print JSON instead of table/scalar output

Example (clean tabular output):

```bash
lytx \
  --base-url https://api.lytx.io \
  --api-key <your-key> \
  query site_id=26 query='SELECT * FROM site_events ORDER BY created_at DESC LIMIT 10' \
  --rows-only --columns id,event,created_at,page_url --no-status
```

Note: `--columns` filters displayed fields only; it does not change SQL execution.

## Shell Completion

```bash
lytx completion bash
lytx completion zsh
lytx completion fish
```

Load the output into your shell config as needed.

## Local API Example

```bash
lytx --base-url http://localhost:8788 --api-key <your-key> health
```

## Local Durable Object Caveat

When running against local Miniflare, Durable Object state can appear inconsistent across workers.
This can make analytics/query endpoints return empty event data even when site metadata exists.

If this happens locally but production returns data, treat it as an environment/state-sharing limitation in local Miniflare rather than a CLI issue.
