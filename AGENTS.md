# AGENTS.md - Development Guidelines

## Build/Test Commands

- `bun run dev` - Start development server (port 6123)
- `bun run build` - Build for production
- `bun run clean` - Clean build artifacts
- `bun run db:migrate:local` - Apply D1 migrations locally
- `bun run db:init` - Initialize database with default user (see options with --help)
- `bun run db:seed` - Generate sample sites and analytics data (see options with --help)
- `bun run db:studio` - Open Drizzle Studio
- `bun run cf-types` - Generate Cloudflare types
- `bun run deploy` - Deploy to Cloudflare Workers

## Code Style Guidelines

- **Framework**: RedwoodSDK with Cloudflare Workers, React Server Components
- **TypeScript**: Strict mode enabled, use proper types
- **Imports**: Use path aliases: `@/*` (src), `@lib/*` (lib), `@db/*` (db), `@generated/*` (generated)
- **Components**: Server components by default, add `"use client"` only when needed
- **Server Functions**: Mark with `"use server"` directive
- **Styling**: TailwindCSS with CSS variables for theming
- **Database**: Drizzle ORM with SQLite (D1) and PostgreSQL adapters
- **Naming**: camelCase for variables/functions, PascalCase for components/types

## RedwoodSDK Rules (from .rules file)

- Use `route()` for routing, `render()` for document templates
- Interruptors for middleware (auth, validation, logging)
- Server components can be async and fetch data directly
- Access context via `requestInfo` in server functions
- Co-locate routes in `src/app/pages/<section>/routes.ts`
- Use `prefix()` to organize route groups

## Database Initialization

The `cli/init-db.ts` script creates a default user for development:

```bash
# Create default user with local database
bun run db:init --email admin@example.com --password mypassword

# Create user with custom name
bun run db:init --email admin@example.com --password mypassword --name "John Doe"

# Use remote database instead of local
bun run db:init --email admin@example.com --password mypassword --remote

# See all options
bun run db:init --help
```

The script automatically:

- Creates a user with email/password authentication
- Sets up a team for the user
- Adds the user to the team
- Uses better-auth compatible credential provider
- Hashes passwords using scrypt with better-auth compatible parameters (N=16384, r=16, p=1)

## Sample Data Generation

The `cli/seed-data.ts` script generates realistic sample sites and analytics data for testing:

```bash
# Generate sample data for team ID 1
bun run db:seed --team-id 1

# Create 2 sites with 50 events each over the last 7 days
bun run db:seed --team-id 1 --sites 2 --events 50 --days 7

# Populate existing site with events (skips site creation)
bun run db:seed --team-id 1 --site-id 3 --events 100

# Use remote database instead of local
bun run db:seed --team-id 1 --remote

# See all options
bun run db:seed --help
```

The script automatically generates:

- Multiple sample websites with realistic domains and names
- Diverse analytics events (page views, form fills, phone calls)
- Realistic visitor data (browsers, OS, devices, locations)
- Time-distributed events over specified date range
- Proper relationships between sites, teams, and events

## Error Handling

- Return proper HTTP status codes and JSON responses
- Use try/catch blocks for async operations
- Log errors with console.error for debugging
