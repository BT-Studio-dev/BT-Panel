# BT Panel modules and frontend customization

BT Panel is a Next.js App Router + React + TypeScript application. Modules are currently **compile-time modules**: there is no runtime plugin loader, sandbox or third-party extension SDK yet. This registry provides a consistent place to declare admin navigation metadata while keeping page code and server-side permission checks explicit.

## Module registry

- `src/lib/panel/modules.ts`: typed navigation/module definitions.
- `src/lib/panel/types.ts`: the `PanelView` union, valid view list and restricted admin views.
- `src/components/panel/shell.tsx`: page imports, navigation composition and view rendering.
- `src/components/panel/views/`: React view implementations.
- `src/app/api/`: Next.js Route Handlers for API operations.
- `src/lib/server/`: trusted server-only logic, upstream API adapters and data access.

No optional modules are registered by default. The registry is available for future admin modules.

## Add another module

1. Create a client view under `src/components/panel/views/<module>-view.tsx`. Keep credentials and privileged calls out of client components.
2. Add a literal identifier to `PanelView` and `PANEL_VIEWS` in `src/lib/panel/types.ts`. If it is admin-only, add it to `ADMIN_VIEWS` as well.
3. Add metadata to `PANEL_MODULES` in `src/lib/panel/modules.ts`: identifier, label, icon, section, required role and description.
4. Import the component and render its identifier in `src/components/panel/shell.tsx`.
5. If the module uses data, add Route Handlers under `src/app/api/<module>/`. Use `handle()`, `requireUser()` or `requireAdmin()`, validate request bodies, and return only the fields the caller should see.
6. Put external API clients, database access and secrets in `src/lib/server/`. Never put private tokens into `NEXT_PUBLIC_*` variables or browser components.
7. For new persistent data, define tables in `src/db/schema.ts` and update the matching table initialization in `src/lib/server/data.ts` (or introduce a tested migration strategy before replacing the runtime DDL).
8. Add unit/integration tests, document new environment variables, run `npm run typecheck`, `npm run lint` and `npm run build`, then deploy a reviewed release.

The registry currently controls navigation metadata only. It is **not** a security boundary: every server-side route must enforce authorization independently. Do not load untrusted third-party JavaScript into the Next.js server process.

## Existing UI styling

- `src/app/globals.css`: Tailwind v4 and shared glass-effect component classes.
- `src/lib/panel/theme.ts`: theme variables and theme application.
- `src/lib/panel/catalog.ts`: server-template and wallpaper catalogs.
- `src/components/panel/shell.tsx`: side navigation and page-switching shell.
- `src/components/panel/views/settings-view.tsx`: settings interface.
- `src/app/layout.tsx`: root layout, document language, metadata and fonts.

The codebase does not currently ship a localization framework or dedicated translation catalogs; user-visible strings are mostly authored directly in TypeScript/TSX. To add languages, introduce explicit message catalogs and a locale-selection strategy, then replace hard-coded strings systematically. For right-to-left languages, handle document `lang` and `dir` as well as layout direction.

## Validation checklist

- A non-admin must not see or access admin-only routes.
- Invalid IDs and malformed JSON should return controlled 4xx errors.
- Upstream errors must not disclose secret tokens or full request headers.
- All external requests should have timeouts and avoid caching sensitive responses.
- UI loading, empty, success and failure states should be covered.
- A new module should compile and build without modifying unrelated views.
