# LYTX

**Privacy-first web analytics & tag manager for your site**

> ⚠️ **Early Alpha Warning**: This version is currently in early alpha development and is **not ready for production use**. Features may be incomplete, unstable, or subject to breaking changes. Use at your own risk.

LYTX is an open-source web analytics and tag manager built for the privacy-driven site owner. Fully compliant with GDPR, CCPA and PECR, LYTX is the cookieless approach to gaining actionable stats about your visitor experience without slowing down your site.

## Background

I've been using LYTX in production for a while now across many of my client websites on Cloudflare, and wanted to share it with the open-source community. My main production version has been running on Hono but i've recently moved it over to Redwood SDK for better SSR support and easier frontend usage/deployment.

## Features

- 🔒 **Privacy-first**: No cookies, GDPR/CCPA/PECR compliant
- ⚡ **Lightning fast**: Built on Cloudflare Workers edge network
- 📊 **Real-time analytics**: Live visitor tracking and insights
- 🏷️ **Tag management**: Built-in tag manager for marketing pixels
- 🌍 **Global edge deployment**: Runs on Cloudflare's global network
- 📱 **Device & location tracking**: Detailed visitor insights
- 🎯 **Event tracking**: Custom event monitoring
- 📈 **Beautiful dashboards**: Modern, responsive analytics interface

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Framework**: RedwoodSDK with React Server Components
- **Database**: Cloudflare D1 (SQLite) with Drizzle ORM
- **Storage**: Cloudflare KV for sessions and configuration
- **Styling**: TailwindCSS
- **Charts**: Nivo for data visualizations
- **Auth**: Better Auth for user management

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) installed
- [Cloudflare account](https://cloudflare.com/) with Workers enabled
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) installed

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/lytx-io/lytx.git
   cd lytx
   ```

2. **Install dependencies**

   ```bash
   bun install
   ```

3. **Initial setup**

   ```bash
   bun run initial-setup
   ```

   This will:
   - Copy example configuration files
   - Generate Cloudflare types
   - Apply database migrations locally

4. **Configure Cloudflare resources**

   Edit `wrangler.jsonc` and replace the placeholder values:
   - `database_id`: Your D1 database ID
   - KV namespace IDs for `LYTX_EVENTS`, `lytx_config`, and `lytx_sessions`

5. **Set up environment variables**

   Edit `.dev.vars` with your configuration:

   ```bash
   BETTER_AUTH_SECRET=your-secret-key
   BETTER_AUTH_URL=http://localhost:6123
   ```

6. **Create a default user for testing**

   ```bash
   bun run db:init --email admin@example.com --password mypassword --name "Admin User"
   ```

   This creates a user account with:
   - Secure password hashing using scrypt (better-auth compatible)
   - Automatic team setup
   - Ready-to-use login credentials

7. **Start development server**

   ```bash
   bun run dev
   ```

   Your LYTX instance will be available at `http://localhost:6123`

8. **Login and test**

   Visit `http://localhost:6123` and login with the credentials you created in step 6.

## Deployment

### Production Deployment

1. **Create Cloudflare resources**

   ```bash
   # Create D1 database
   wrangler d1 create lytx-core-db

   # Create KV namespaces
   wrangler kv:namespace create "LYTX_EVENTS"
   wrangler kv:namespace create "lytx_config"
   wrangler kv:namespace create "lytx_sessions"
   ```

2. **Update wrangler.jsonc** with your actual resource IDs

3. **Apply database migrations**

   ```bash
   bun run db:migrate:prd
   ```

4. **Create a production admin user**

   ```bash
   bun run db:init --email admin@yourdomain.com --password your-secure-password --remote
   ```

5. **Deploy to Cloudflare Workers**
   ```bash
   bun run deploy
   ```

## Usage

### Adding LYTX to Your Website

Once deployed, add the LYTX tracking script to your website:

```html
<script
  async
  src="https://your-lytx-domain.workers.dev/script.js"
  data-site-id="your-site-id"
></script>
```

### Dashboard Access

Visit your deployed LYTX instance to:

- View real-time analytics
- Set up new sites
- Configure tracking events
- Manage tag manager settings
- Export analytics data

## Development

### Available Scripts

- `bun run dev` - Start development server (port 6123)
- `bun run build` - Build for production
- `bun run clean` - Clean build artifacts
- `bun run db:migrate:local` - Apply D1 migrations locally
- `bun run db:init` - Initialize database with default user (see `--help` for options)
- `bun run db:seed` - Generate sample sites and analytics data (see `--help` for options)
- `bun run db:studio` - Open Drizzle Studio
- `bun run cf-types` - Generate Cloudflare types
- `bun run deploy` - Deploy to Cloudflare Workers

### Database Management

LYTX supports multiple database backends through Drizzle ORM:

- **D1 (Primary)**: For edge deployment on Cloudflare
- **PostgreSQL**: For high-volume analytics via Hyperdrive
- **SingleStore**: For high-performance analytics and real-time processing via Hyperdrive

#### Creating Users

Use the `db:init` script (located in `cli/init-db.ts`) to create users for development or production:

```bash
# Create user for local development
bun run db:init --email admin@example.com --password mypassword

# Create user with custom name
bun run db:init --email admin@example.com --password mypassword --name "John Doe"

# Create user on remote database (production)
bun run db:init --email admin@yourdomain.com --password secure-password --remote

# See all available options
bun run db:init --help
```

The script automatically:

- Hashes passwords securely using scrypt (better-auth compatible)
- Creates a team for the user
- Sets up proper database relationships

#### Generating Sample Data

Use the `db:seed` script (located in `cli/seed-data.ts`) to populate your database with realistic test data:

```bash
# Generate sample data for team ID 1 (use the team ID from your created user)
bun run db:seed --team-id 1

# Create 2 sites with 50 events each over the last 7 days
bun run db:seed --team-id 1 --sites 2 --events 50 --days 7

# Populate existing site with events (skips site creation)
bun run db:seed --team-id 1 --site-id 3 --events 100

# Generate data on remote database (production)
bun run db:seed --team-id 1 --remote

# See all available options
bun run db:seed --help
```

The script generates:

- Multiple sample websites with realistic domains and names
- Diverse analytics events (page views, form fills, phone calls)
- Realistic visitor data (browsers, OS, devices, locations)
- Time-distributed events over specified date range

#### SingleStore Configuration

For high-performance analytics with SingleStore, configure the following environment variables:

```bash
# SingleStore connection details
SINGLESTORE_HOST=your-singlestore-host
SINGLESTORE_USER=your-username
SINGLESTORE_PASSWORD=your-password
SINGLESTORE_DATABASE=your-database
SINGLESTORE_PORT=3306

# Or use a connection string
SINGLESTORE_CONNECTION_STRING=mysql://user:password@host:port/database
```

SingleStore provides:

- High-performance analytics queries
- Real-time data processing
- Scalable architecture for large datasets
- MySQL-compatible interface with enhanced performance
- **Cloudflare Hyperdrive support**: Can be used via Cloudflare Hyperdrive for edge-optimized database connections

### Project Structure

```
├── cli/                   # Command-line tools and scripts
│   ├── init-db.ts        # Database initialization script
│   └── seed-data.ts      # Sample data generation script
├── db/                    # Database schemas and migrations
│   ├── d1/               # D1 (SQLite) configuration
│   ├── postgres/         # PostgreSQL configuration
│   └── singlestore/      # SingleStore configuration
├── src/
│   ├── app/              # React components and pages
│   ├── session/          # Authentication and session management
│   ├── templates/        # Tracking pixel and vendor integrations
│   └── utilities/        # Helper functions
├── lib/                  # Shared utilities
└── wrangler.jsonc        # Cloudflare Workers configuration
```

## Contributing

We welcome contributions! Please see our [contributing guidelines](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Privacy & Compliance

LYTX is designed with privacy at its core:

- **No cookies**: Uses cookieless tracking methods
- **GDPR compliant**: Respects user privacy preferences
- **CCPA compliant**: Supports California privacy regulations
- **PECR compliant**: Follows EU privacy and electronic communications rules
- **Data minimization**: Collects only necessary analytics data
- **Edge processing**: Data processed at the edge for better privacy

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

**Important**: While this software is open-source under MIT license, you may not use this code to create and resell LYTX itself as a SaaS product. The license permits modification and distribution for your own use, but not for creating competing commercial LYTX services.

## Support

- 📖 [Documentation](https://github.com/your-username/lytx/wiki)
- 🐛 [Issue Tracker](https://github.com/your-username/lytx/issues)
- 💬 [Discussions](https://github.com/your-username/lytx/discussions)

## Roadmap

- [ ] Enhanced tag manager features
- [ ] More vendor integrations
- [ ] Advanced funnel analytics
- [ ] A/B testing capabilities
- [ ] API for custom integrations
- [ ] Mobile app analytics
- [ ] Real-time alerts and notifications

---

Built with ❤️ for the privacy-conscious web
