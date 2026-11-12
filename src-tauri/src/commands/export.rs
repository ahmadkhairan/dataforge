use serde::Deserialize;
use serde_json::{Map, Value};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportRequest {
    pub path: String,
    pub sql: String,              // SELECT * FROM read_csv_auto(...) etc, or arbitrary query
    pub format: String,           // csv | parquet | json
    pub database_path: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportRowsRequest {
    pub path: String,
    pub columns: Vec<String>,
    pub rows: Vec<Map<String, Value>>,
    pub format: String,
}

#[tauri::command]
pub fn export_query(request: ExportRequest) -> Result<String, String> {
    let conn = match &request.database_path {
        Some(p) => duckdb::Connection::open(p).map_err(|e| e.to_string())?,
        None => duckdb::Connection::open_in_memory().map_err(|e| e.to_string())?,
    };
    let safe_path = request.path.replace('\'', "''");
    let export_sql = match request.format.as_str() {
        "parquet" => format!("COPY ({}) TO '{}' (FORMAT PARQUET)", request.sql, safe_path),
        "csv" => format!("COPY ({}) TO '{}' (HEADER, DELIMITER ',')", request.sql, safe_path),
        "json" => format!("COPY ({}) TO '{}' (FORMAT JSON, ARRAY true)", request.sql, safe_path),
        _ => return Err("Unsupported format: use csv | parquet | json".into()),
    };
    conn.execute(&export_sql, []).map_err(|e| e.to_string())?;
    Ok(request.path)
}

#[tauri::command]
pub fn export_rows(request: ExportRowsRequest) -> Result<String, String> {
    let output = match request.format.as_str() {
        "json" => serde_json::to_vec_pretty(&request.rows).map_err(|e| e.to_string())?,
        "csv" => {
            let mut writer = csv::Writer::from_writer(Vec::new());
            writer.write_record(&request.columns).map_err(|e| e.to_string())?;
            for row in &request.rows {
                writer.write_record(request.columns.iter().map(|column| match row.get(column) {
                    Some(Value::Null) | None => String::new(),
                    Some(value) => value.to_string().trim_matches('"').to_string(),
                })).map_err(|e| e.to_string())?;
            }
            writer.into_inner().map_err(|e| e.to_string())?
        }
        _ => return Err("Unsupported format: use csv | json".into()),
    };
    std::fs::write(&request.path, output).map_err(|e| e.to_string())?;
    Ok(request.path)
}
