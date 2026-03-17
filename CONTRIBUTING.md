# Contributing to xbook

Contributions are welcome! Here's how to get started.

## Prerequisites

- Node.js 20+
- npm

## Development Setup

1. Fork and clone the repo:

```bash
git clone https://github.com/<your-username>/xbook.git
cd xbook
```

2. Install dependencies:

```bash
npm install
cd web && npm install && cd ..
```

3. Copy the environment template and fill in your credentials:

```bash
cp .env.example .env.local
```

4. Start the web dev server:

```bash
cd web && npm run dev
```

5. Build the CLI:

```bash
npm run build
```

## Project Structure

```
xbook/
├── src/           CLI commands and core logic
├── shared/        Types and utilities shared between CLI and web
├── web/           Next.js web interface
│   ├── app/       Pages and API routes
│   ├── components UI components (shadcn/ui)
│   └── lib/       Server actions and DB singleton
└── tests/         Vitest test suite
```

## Running Tests

```bash
npm test              # CLI and shared tests
cd web && npm test    # Web app tests
```

## Code Style

- TypeScript strict mode
- ESLint for linting
- Prefer simple, focused changes over large refactors

## Pull Request Process

1. Fork the repo and create a feature branch from `main`
2. Make your changes with tests where applicable
3. Run both test suites to verify nothing is broken
4. Open a PR against `main` with a clear description of the change

## Reporting Bugs

Please open a [GitHub issue](https://github.com/joedanz/xbook/issues) with:

- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node version, Docker vs local)
