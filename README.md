# Meal Planner

A Progressive Web App (PWA) for meal planning with recipe management, grocery list generation, and pantry tracking.

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm

### Installation

```bash
pnpm install
```

### Running the Application

Start both the API and web servers:

```bash
# Terminal 1: Start the API server (port 3000)
pnpm --filter @meals/api dev

# Terminal 2: Start the web server (port 3001)
pnpm --filter @meals/web dev
```

Then open http://localhost:3001 in your browser.

### Building for Production

```bash
# Build the web application
pnpm --filter @meals/web build

# Start production server
pnpm --filter @meals/web start
```

## Features

- **Weekly Calendar**: Visual meal planning grid with drag-and-drop support
- **Recipe Library**: Browse, search, and filter recipes by cuisine, time, and more
- **Recipe Import**: Import recipes from URLs (supports schema.org JSON-LD)
- **Grocery List**: Auto-generated shopping list from meal plan with pantry integration
- **Pantry Management**: Track ingredients on hand with expiration dates
- **Shopping Mode**: Simplified interface for in-store use
- **PWA Support**: Offline grocery list access, installable on devices
- **Dark Mode**: Full light/dark theme support
- **Responsive Design**: Works on mobile, tablet, and desktop

## Project Structure

```
packages/
  api/          # Fastify backend API (port 3000)
  web/          # Next.js frontend PWA (port 3001)
  core/         # Shared database and utilities
  data/         # SQLite database
```

## Documentation

- [UI Plan](./UI_PLAN.md) - UI implementation plan and tickets
- [UI PRD](./UI_PRD.md) - Product requirements document
- [QA Test Plan](./QA_PWA.md) - QA testing procedures

## Development

### Database

The SQLite database is stored at `packages/data/meals.db`. Migrations run automatically on API startup.

### Environment Variables

The web app uses `packages/web/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## Known Issues

See the Discovered Issues Log in [UI_PLAN.md](./UI_PLAN.md#9-discovered-issues-log) for current known issues.
