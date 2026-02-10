# Alchemy Migration Scripts

This directory contains Alchemy scripts for operational tasks that need to run within the Cloudflare Workers environment.

## Migration Script: D1/Postgres to Durable Objects

### Why Alchemy?

The original CLI migration script had a critical flaw - it couldn't actually write to durable objects because CLI scripts run outside the Workers environment. Alchemy solves this by running code directly in your Workers environment with access to all bindings.

### Usage

```bash
# Install Alchemy (if not already installed)
npm install -g @alchemy/cli

# Migrate a single site
SITE_ID=123 BATCH_SIZE=50 VERIFY=true alchemy deploy

# Migrate all sites for a team
TEAM_ID=5 ALL_SITES=true BATCH_SIZE=25 VERIFY=true alchemy deploy

# Dry run to see what would be migrated
SITE_ID=123 DRY_RUN=true alchemy deploy

# Migrate with verification
SITE_ID=123 VERIFY=true alchemy deploy

# Custom batch size
SITE_ID=123 BATCH_SIZE=25 alchemy deploy
```

### Features

- ✅ **Actually works** - Runs in Workers environment with durable object access
- ✅ **Uses existing infrastructure** - Leverages `writeToDurableObject()` function
- ✅ **Batch processing** - Configurable batch sizes to avoid memory issues
- ✅ **Dry run mode** - Preview migrations without making changes
- ✅ **Verification** - Check migration success with health checks
- ✅ **Error handling** - Comprehensive error reporting and recovery
- ✅ **Progress tracking** - Real-time progress updates
- ✅ **Interactive** - Run commands and see immediate results

### Advantages over CLI + Worker Approach

| Aspect | CLI + Worker | Alchemy |
|--------|-------------|---------|
| Setup | Complex (separate configs, deployment) | Simple (single script) |
| Environment | HTTP calls between CLI and worker | Direct Workers environment access |
| Debugging | Difficult (multiple moving parts) | Easy (single execution context) |
| Cleanup | Manual (remove temporary worker) | None needed |
| Testing | Complex (deploy worker first) | Simple (run directly) |

### Production Migration Process

1. **Test in staging**:
   ```bash
   alchemy run migrate-to-durable-objects.ts --site-id=123 --dry-run
   ```

2. **Migrate pilot sites**:
   ```bash
   alchemy run migrate-to-durable-objects.ts --site-id=123 --verify
   ```

3. **Batch migrate remaining sites**:
   ```bash
   alchemy run migrate-to-durable-objects.ts --team-id=5 --all-sites --batch-size=25
   ```

### Safety Features

- **Dry run mode**: Preview changes without executing
- **Batch processing**: Avoid memory issues with large datasets
- **Error recovery**: Continue processing other sites if one fails
- **Verification**: Health checks to confirm migration success
- **Progress tracking**: Real-time updates on migration status

### Error Handling

The script handles various error scenarios:
- Site not found
- Durable object write failures
- Batch processing errors
- Verification failures
- Network issues

All errors are logged with context for debugging.

### Monitoring

The script provides detailed output:
- Sites found and processed
- Batch processing progress
- Success/failure counts
- Total events migrated
- Verification results
- Error summaries

This makes it easy to track migration progress and identify any issues.

---

## Other Alchemy Scripts

Add additional operational scripts here as needed:
- Data validation scripts
- Performance testing scripts
- Cleanup and maintenance scripts
- Health check scripts