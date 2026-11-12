# DataForge

Local-first data workbench for spreadsheet, SQL, transformation, and visualization workflows.

**Public Beta · MIT License · Runs locally without an account**

DataForge is designed for analysts and developers who want to inspect, clean, join, query, and visualize data without uploading files to a hosted service.

## What you can do

- Open CSV, XLSX, JSON, JSONL, SQLite, and Parquet files.
- Edit spreadsheet cells with formulas, undo/redo, filtering, sorting, and session persistence.
- Open multiple datasets, join them from the UI, or query them together with browser DuckDB SQL.
- Build repeatable cleaning pipelines, pivot summaries, and bar/line/pie/table charts.
- Run native DuckDB/SQLite queries in Tauri or DuckDB-WASM in the browser.
- Export results and optionally self-host the authenticated sync reference server.

The included [examples/sales.csv](examples/sales.csv) is a safe first dataset.

## Run

```bash
npm install
npm run dev
```

Build a production bundle with `npm run build`.

Run the complete local verification suite with `npm run verify`. See [ROADMAP.md](ROADMAP.md) for release acceptance checks and remaining production milestones.

For the complete local gate, including server tests, browser E2E tests, and dependency audit, run `npm run verify:all`.

## First workflow

1. Run `npm install` and `npm run dev`.
2. Open `examples/sales.csv` from the **Open** action.
3. Use **Clean data** for transformations, **Chart** for visualization, or **SQL Studio** for queries.
4. Open another CSV to create a second tab and use **Join another tab** or a SQL `JOIN`.
5. Run `npm run tauri dev` when you need native SQLite/Parquet previews.

Data stays local by default. Sync is opt-in and only enabled when `VITE_DATAFORGE_SYNC_URL` is configured.

Tagged desktop releases use `.github/workflows/release.yml`; configure these GitHub Actions secrets before creating a release tag: `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, the six `APPLE_*` secrets, `WINDOWS_CERTIFICATE`, `WINDOWS_CERTIFICATE_PASSWORD`, `LINUX_GPG_PRIVATE_KEY`, `LINUX_GPG_KEY_ID`, and `APPIMAGETOOL_SIGN_PASSPHRASE`. The workflow imports platform keys and intentionally fails when required signing secrets are absent. Linux AppImage signatures must be independently verified by consumers.

Optional workspace sync can be enabled with `VITE_DATAFORGE_SYNC_URL` and `VITE_DATAFORGE_SYNC_TOKEN`. The server should implement `PUT /workspaces/:id` and `GET /workspaces/:id` using the JSON snapshot contract in `src/lib/sync.ts`.

A small authenticated reference server is included for local use or deployment behind HTTPS:

```bash
DATAFORGE_SYNC_TOKEN=change-me npm run sync:server
```

Set `VITE_DATAFORGE_SYNC_URL=http://127.0.0.1:8787` and the same token for the web app. Configure `DATAFORGE_SYNC_DATA_DIR`, `DATAFORGE_SYNC_HOST`, `DATAFORGE_SYNC_PORT`, and `DATAFORGE_SYNC_CORS_ORIGIN` for deployment. Put it behind HTTPS and a real identity/rate-limit layer before exposing it publicly.

For a persistent container deployment, use the included Compose file:

```bash
DATAFORGE_SYNC_TOKEN=change-me docker compose -f server/docker-compose.yml up -d --build
```

The service exposes `/healthz`, stores data in a named persistent volume, and handles SIGTERM for rolling deployments.

Custom connectors can be registered by an embedding app before calling `parseFile`:

```ts
registerConnector({
  id: 'warehouse', label: 'Warehouse export', extensions: ['warehouse'],
  open: async (file) => ({ rows: await readWarehouseFile(file), columns: ['id', 'value'] }),
})
```

Registered connectors are resolved before the built-in CSV, XLSX, JSON, and JSONL parsers. Keep connector code trusted and validate untrusted files before returning rows.

Connector IDs must use letters, numbers, `.`, `_`, or `-`; extensions are normalized case-insensitively and may include a leading dot. The registry returns an unregister function so an embedded app can unload a connector during teardown. Connector results are schema-normalized before entering the workspace.

## Desktop mode (Tauri)

DataForge now includes a Tauri 2 backend under `src-tauri/`. Once the Rust dependency build has completed on the machine, start the native app with:

```bash
npm run tauri dev
```

The Rust command surface exposes health checks plus local DuckDB and SQLite query commands. SQL Studio uses native DuckDB automatically when it is running inside Tauri and retains its local browser preview fallback during web development.

## Quality and support

- [Changelog](CHANGELOG.md)
- [Roadmap](ROADMAP.md)
- [Contributing guide](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)

When reporting a bug, use a minimized or synthetic dataset and include the DataForge version, OS, input format, and reproduction steps. Never attach confidential customer data.

## Implemented MVP

- Spreadsheet grid with keyboard navigation, editable cells, formula bar, formula evaluation (`SUM`, `AVERAGE`, `COUNT`, `MIN`, `MAX`, `IF`, `CONCAT`, `LEFT`, `RIGHT`, `MID`, `IFERROR`, `VLOOKUP`, `XLOOKUP`, arithmetic, and A1 references), undo/redo, row/column insertion, filtering, sorting, and light/dark theme
- CSV, XLSX, JSON, and JSON Lines import; CSV and JSON export; profile summary with null/unique and numeric min/max/mean values
- SQL Studio layout with a local query-result flow for common `GROUP BY region` and `LIMIT` queries, result export, and an action to convert results into a spreadsheet

## Native implementation path

The native implementation path is now covered for the MVP: DuckDB-backed Parquet/CSV/JSON previews, SQLite previews, bounded offset/limit paging for large files, and native DuckDB CSV/JSON/Parquet query exports are available in `src-tauri/`. The UI keeps a simple (`columns` + row records) boundary while pages are loaded incrementally.
