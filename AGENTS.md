# AGENTS.md - Development Guidelines

## Build/Test Commands

- `bun run dev` - Start development server (port 6123)
- `bun run build` - Build for production
- `bun run clean` - Clean build artifacts
- `bun run db:migrate:local` - Apply D1 migrations locally
- `bun run db:init` - Initialize database with default user (see options with --help)
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

The `db/init-db.ts` script creates a default user for development:

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

## Error Handling

- Return proper HTTP status codes and JSON responses
- Use try/catch blocks for async operations
- Log errors with console.error for debugging
