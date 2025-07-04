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

6. **Start development server**

   ```bash
   bun run dev
   ```

   Your LYTX instance will be available at `http://localhost:6123`

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

4. **Deploy to Cloudflare Workers**
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
- `bun run db:studio` - Open Drizzle Studio
- `bun run cf-types` - Generate Cloudflare types
- `bun run deploy` - Deploy to Cloudflare Workers

### Database Management

LYTX supports both D1 (SQLite) and PostgreSQL through Drizzle ORM:

- **D1 (Primary)**: For edge deployment on Cloudflare
- **PostgreSQL**: For high-volume analytics via Hyperdrive

### Project Structure

```
├── db/                    # Database schemas and migrations
│   ├── d1/               # D1 (SQLite) configuration
│   └── postgres/         # PostgreSQL configuration
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
