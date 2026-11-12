# Changelog

All notable changes to DataForge are documented here.

## [0.1.0] - Public Beta

### Added

- Local-first spreadsheet workspace with formulas, editing, filtering, sorting, undo/redo, and session persistence.
- CSV, XLSX, JSON, JSONL, SQLite, and Parquet workflows.
- Native DuckDB/SQLite execution and full browser SQL through DuckDB-WASM.
- Multi-table workspace SQL with JOIN support.
- Join/merge UI, repeatable transformation pipelines, pivot summaries, and bar/line/pie/table charts.
- Authenticated reference sync server with version conflict protection and Docker Compose deployment.
- Validated custom connector registry with schema normalization.
- Vitest, Rust, sync-server, and Playwright E2E coverage.
- MIT license and contribution/security documentation.

### Known limitations

- Public cloud identity, managed storage, and production rate limiting are deployment responsibilities.
- Signed installers require maintainer-owned platform certificates in GitHub Actions secrets.
- DuckDB-WASM adds a large browser asset to the production bundle.
