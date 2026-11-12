mod commands;

use commands::{export_query, export_rows, healthcheck, list_sqlite_tables, preview_file, preview_sqlite, query_duckdb, query_sqlite, Health, QueryRequest, QueryResult};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            healthcheck,
            query_duckdb,
            query_sqlite,
            preview_file,
            preview_sqlite,
            list_sqlite_tables,
            export_query,
            export_rows
        ])
        .run(tauri::generate_context!())
        .expect("error while running DataForge");
}

// Kept public so the command contract can be covered by Rust integration tests.
pub type HealthResponse = Health;
pub type LocalQueryRequest = QueryRequest;
pub type LocalQueryResult = QueryResult;
