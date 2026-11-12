# DataForge roadmap

Status: Public Beta — core local workflows are implemented and verified locally.

## Completed

- Spreadsheet editing, formulas, undo/redo, filtering, sorting, formatting, and local session persistence.
- CSV, XLSX, JSON, JSON Lines, SQLite, and Parquet preview/import paths.
- SQL Studio with native SQLite/DuckDB execution when running in Tauri and browser fallback during web development.
- Arrow record-batch paging for large native files with incremental “Load next 500 rows”.
- Native CSV, JSON, and Parquet query export commands.
- Native Save As export for edited sheet rows in Tauri, with browser-download fallback on web.
- SQLite catalog listing with table selection and paged preview.
- Automated Vitest coverage for CSV/JSON parsers and formula evaluation.
- Basic data cleaning actions: remove empty rows, remove duplicates, fill empty cells, and rename columns.
- Lightweight revenue chart grouped by region/status for quick exploration.
- Configurable chart builder with dimension, numeric metric, bar, line, pie, and table views.
- Multi-tab workspace with independent datasets, selection, and close actions.
- Left join between open tabs by a shared key, with collision-safe column names.
- Pivot summaries with `SUM` and `COUNT`, opened as a new tab.
- Browser SQL fallback with `SELECT`, `WHERE`, `GROUP BY`, `COUNT`, `SUM`, `ORDER BY`, and `LIMIT` support.
- Full browser SQL path via DuckDB-WASM, including all open workspace tabs as queryable tables and JOINs, with the local parser retained as a fallback.
- Multi-tab session persistence and export-all-tabs JSON.
- Column transforms: trim, uppercase, lowercase, numeric conversion, and split by delimiter.
- Repeatable transform pipeline with persisted steps and replay/clear actions.
- Open-source baseline documents: MIT license, contribution guide, security policy, and code of conduct.
- Connector registry wired into the import pipeline, allowing custom connectors to override or add file formats without changing core parsers.
- Connector registration validation and dataset normalization to keep third-party connector output inside the workspace schema contract.
- HTTP sync provider, Share action, and an authenticated reference sync server with atomic file persistence.
- Automated sync-server authentication and round-trip tests in CI.
- Optimistic version checks and conflict responses for shared workspace writes, with Load/Share controls in the UI.
- Container deployment assets with persistent volume, health check, and graceful shutdown for the reference sync service.
- Playwright E2E smoke tests and GitHub Actions CI/release workflows with signing secret hooks.
- Release workflow preflight plus platform signing setup: Apple notarization, Windows certificate import, and Linux AppImage GPG signing.
- Release workflow post-build signature verification for macOS, Windows, and Linux artifacts.
- E2E smoke suite verified locally against installed Google Chrome (3/3 passing, including full browser SQL).
- Dependency audit completed with zero known vulnerabilities; a 100 MB import guard is also enforced.
- Native command tests, Arrow conversion tests, TypeScript build, and clippy validation.

## Verify before every release

```bash
npm install
npm run verify
npm run tauri dev
```

Release acceptance:

1. Open a CSV, SQLite, or Parquet file and confirm the first page appears.
2. Load another page and confirm row count increases without replacing existing rows.
3. Run a query using `FROM sales` and confirm it executes against the opened source in Tauri.
4. Edit a cell, undo, redo, filter, sort, and export the result.
5. Restart the app and confirm the local session is restored.

## Next production milestones

- Replace the reference file store with managed database/object storage, identity, rate limiting, and conflict resolution for public cloud deployment.
- Configure the repository signing secrets and publish the first real signed artifacts from the release workflow.
- Add a connector package loading policy and a maintained connector catalog if third-party plugins are enabled.

## Free public-beta plan

- Publish the repository under MIT with changelog, templates, and the included synthetic example dataset.
- Use GitHub Actions on the public repository for CI and E2E verification.
- Keep cloud sync optional and self-hostable through Docker Compose.
- Collect feedback through GitHub Issues before paying for managed infrastructure or signing certificates.

Security note: ExcelJS is loaded only when XLSX is used, and dependency audit currently reports zero known vulnerabilities. XLSX imports remain untrusted input and are limited to 100 MB.
