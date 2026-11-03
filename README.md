# Meridian Electronics

A full-stack electronics store built with Angular, Express and SQLite. A portfolio project with a working shopping flow, account management and persistent data.

**Demo store:** catalog items and orders are for demonstration. No real payment, delivery or operator notification is performed.

## Features

- Responsive storefront, searchable catalog, category/brand filters and price sorting.
- Product details, stock availability and catalog pagination.
- Registration, sign-in, sign-out, profile editing and password changes.
- Per-account wishlist and cart, checkout and order history.
- Custom PC requests with budget and requirements.
- Server-calculated order totals and atomic stock updates.

## Stack

Angular 22 · TypeScript · SCSS · Node.js 24 · Express 5 · SQLite

## Quick start

Use Node.js 24.15 or later in the 24.x release line.

```sh
npm ci
npm run build
npm start
```

Open `http://localhost:3000` and create a local test account. There are no bundled users or passwords. SQLite is initialized automatically at `data/meridian.sqlite`.

For development, use `npm run dev`: Angular runs on port 4200 and proxies API requests to port 3000. On Windows PowerShell, use `npm.cmd` if script execution is restricted.

## Configuration

Environment variables are documented in `.env.example`. Set them in your shell or use Node's `--env-file` support; the app does not automatically load `.env`.

| Variable     | Default                 | Purpose                                   |
| ------------ | ----------------------- | ----------------------------------------- |
| `PORT`       | `3000`                  | Server port                               |
| `DB_PATH`    | `data/meridian.sqlite`  | SQLite file                               |
| `APP_ORIGIN` | `http://localhost:3000` | Allowed browser origin                    |
| `NODE_ENV`   | development             | Production enables Secure session cookies |

## Checks

```sh
npm test
npm run build
npm run format:check
```

The API integration suite uses an in-memory database. It checks account isolation, authentication, cart validation, stock updates, server-calculated totals, rollback, profile changes, password rotation and logout. Passwords containing leading/trailing spaces are preserved through authentication.

## Design choices

- Passwords use salted scrypt hashes; only hashed session tokens are stored.
- Session cookies use HttpOnly and SameSite=Lax; production adds Secure.
- Parameterized SQL, request size limits, origin checks and rate limits protect the API.
- Checkout updates order records and stock in a single SQLite transaction.
- Loading failures expose a retry action instead of an empty catalog.

## Project layout

`src/app/` contains standalone Angular components, signal-based state and API access. `server/` contains the HTTP API, schema and seed catalog. `tests/` contains the isolated API integration suite. `public/` holds storefront assets.

## Scope and next steps

This is a portfolio demo, not a production commerce service. Payment processing, email verification/recovery, delivery integration, admin inventory/order management and order cancellation are not implemented. Orders remain in their initial state. SQLite is intended for one server process.

Production would require HTTPS, persistent storage, correctly configured proxy trust, backups and monitoring. Do not commit live databases, user exports or credentials.

See [the original Russian setup notes](docs/README.ru.md) for additional context. Product images and brand marks are retained from the original project; no ownership of third-party marks is claimed.
