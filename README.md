# global-market-api

NestJS API for `global-market` home/dashboard data.

## Quick Start

1. Copy env:

```bash
cp .env.example .env
```

2. Install deps:

```bash
npm install
```

3. Run dev:

```bash
npm run start:dev
```

## Endpoints

- `GET /api/v1/health`
- `GET /api/v1/home?limit=5&newsLimit=6` (full home payload for SSR/hydration)
- `GET /api/v1/home/summary`
- `GET /api/v1/home/overview`
- `GET /api/v1/home/movers?market=stock&limit=5`
- `GET /api/v1/home/leaders?limit=5`
- `GET /api/v1/home/trending?market=crypto&limit=6`
- `GET /api/v1/home/trending-assets?limit=5` (all trending tabs for home section)
- `GET /api/v1/home/trending-tabs?limit=5` (alias of trending-assets)
- `GET /api/v1/home/vietnam-gold-market` (banner section for Vietnam Gold & Silver)
- `GET /api/v1/home/news?newsLimit=6`

## Architecture

- `src/modules/*`: domain modules (`home`, `health`)
- `src/infrastructure/*`: shared infra (`mongodb`)
- `src/config/*`: env validation/config

This structure keeps domain logic isolated and supports scaling by adding new modules (`markets`, `watchlist`, `insights`, etc.) without coupling to transport or database details.
