# Contributing to Pulse

## Getting Started

1. Clone the repository and install dependencies:

```bash
git clone <repo-url>
cd pulse
npm install
```

2. Start the dev server:

```bash
npm run dev
```

3. Run the test suite to verify your environment:

```bash
npm run test
```

## Development Workflow

### Branch Strategy

- `main` — production branch, deploys automatically
- Feature branches — branch off `main`, name as `feature/<description>` or `fix/<description>`
- PRs require passing CI checks (lint, test, build) before merge

### Before Submitting a PR

Run the full release check locally:

```bash
npm run release-check
```

This runs lint, tests, build, and dependency audit in sequence. All four must pass.

### Commit Messages

Use conventional commit style:

```
feat: add venue search autocomplete
fix: correct pulse score decay timing
chore: update dependencies
docs: improve API architecture section
test: add crew mode integration tests
refactor: extract map clustering into separate module
```

Keep the subject line under 72 characters. Add a body for non-trivial changes explaining the "why".

## Code Style

### TypeScript

- Strict mode is enabled — no `any` types without justification
- Use interfaces for object shapes in `src/lib/types.ts`
- Prefer named exports over default exports
- Use path aliases: `@/components/...`, `@/lib/...`, `@/hooks/...`

### Components

- Components live in `src/components/`
- UI primitives (Shadcn/Radix) live in `src/components/ui/`
- One component per file, filename matches component name
- Use Framer Motion for animations, not CSS transitions
- Follow the dark theme with purple/cyan accent palette

### Styling

- Tailwind CSS 4 utility classes
- CSS variables for theme tokens (defined in `src/index.css`)
- Avoid inline styles — use Tailwind utilities or CSS variables
- Mobile-first responsive design

### State Management

- App-level state through `use-app-state.tsx` and Spark KV hooks
- Server state with TanStack React Query (when connected to backend)
- Local UI state with `useState` / `useReducer`
- Always use functional updates with `useKV` setters

## Testing

### Running Tests

```bash
npm run test          # Run once
npm run test:watch    # Watch mode
npm run test:smoke    # Playwright E2E
```

### Writing Tests

- Unit tests go in `src/lib/__tests__/` for library modules
- Component tests go in `src/components/__tests__/`
- E2E tests go in `e2e/`
- Use Vitest for unit and component tests
- Use Playwright for E2E smoke tests
- Name test files as `<module>.test.ts` or `<module>.test.tsx`

### Test Conventions

- Group related tests with `describe` blocks
- Use clear test names: `it('returns empty array when no venues match filter')`
- Mock external dependencies, don't mock internal modules
- For components, test rendering and user interactions, not implementation details

## Project Structure

When adding new features:

- **Domain logic** goes in `src/lib/` — keep it pure, testable, framework-agnostic
- **React hooks** go in `src/hooks/` — bridge between domain logic and components
- **UI components** go in `src/components/` — consume hooks and render
- **Types** are shared via `src/lib/types.ts` — add new interfaces there

## Common Tasks

### Adding a New Library Module

1. Create `src/lib/my-feature.ts` with exported functions
2. Add types to `src/lib/types.ts` if needed
3. Create `src/lib/__tests__/my-feature.test.ts` with unit tests
4. Verify: `npm run test`

### Adding a New Component

1. Create `src/components/MyComponent.tsx`
2. Import any needed hooks from `src/hooks/`
3. Add component tests in `src/components/__tests__/`
4. Wire into the app via `App.tsx` or the relevant router/page

### Adding a New Hook

1. Create `src/hooks/use-my-hook.ts`
2. Keep hooks focused — one concern per hook
3. Add tests if the hook contains non-trivial logic

## CI/CD

GitHub Actions runs on every push and PR:

- **Lint** — ESLint with TypeScript and React Hooks rules
- **Test** — Vitest unit suite
- **Build** — TypeScript check + Vite production build

Lighthouse CI runs on a schedule for performance monitoring.

## Questions?

Open an issue in the repository for feature discussions, bug reports, or questions about the codebase.
