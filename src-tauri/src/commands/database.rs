use duckdb::Connection as DuckDbConnection;
use rusqlite::Connection as SqliteConnection;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Number, Value as JsonValue};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Health {
    pub status: &'static str,
    pub duckdb_available: bool,
    pub sqlite_available: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryRequest {
    pub sql: String,
    pub database_path: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Map<String, JsonValue>>,
}

#[tauri::command]
pub fn healthcheck() -> Health {
    Health { status: "ready", duckdb_available: true, sqlite_available: true }
}

// These query commands deliberately keep values serialized as JSON strings at the boundary.
// Typed conversions and Arrow batches belong in the next backend pass, after the toolchain is live.
#[tauri::command]
pub fn query_duckdb(request: QueryRequest) -> Result<QueryResult, String> {
    let connection = match request.database_path {
        Some(path) => DuckDbConnection::open(path),
        None => DuckDbConnection::open_in_memory(),
    }.map_err(|error| error.to_string())?;
    query_duckdb_rows(&connection, &request.sql)
}

#[tauri::command]
pub fn query_sqlite(request: QueryRequest) -> Result<QueryResult, String> {
    let path = request.database_path.ok_or("databasePath is required for SQLite queries")?;
    let connection = SqliteConnection::open(path).map_err(|error| error.to_string())?;
    query_sqlite_rows(&connection, &request.sql)
}

fn query_duckdb_rows(connection: &DuckDbConnection, sql: &str) -> Result<QueryResult, String> {
    let mut statement = connection.prepare(sql).map_err(|error| error.to_string())?;
    let columns = statement.column_names().iter().map(ToString::to_string).collect::<Vec<_>>();
    let mut rows = statement.query([]).map_err(|error| error.to_string())?;
    let mut output = Vec::new();
    while let Some(row) = rows.next().map_err(|error| error.to_string())? {
        let mut record = Map::new();
        for (index, column) in columns.iter().enumerate() {
            let value: duckdb::types::Value = row.get(index).map_err(|error| error.to_string())?;
            record.insert(column.clone(), duckdb_value_to_json(value));
        }
        output.push(record);
    }
    Ok(QueryResult { columns, rows: output })
}

fn query_sqlite_rows(connection: &SqliteConnection, sql: &str) -> Result<QueryResult, String> {
    let mut statement = connection.prepare(sql).map_err(|error| error.to_string())?;
    let columns = statement.column_names().iter().map(ToString::to_string).collect::<Vec<_>>();
    let mut rows = statement.query([]).map_err(|error| error.to_string())?;
    let mut output = Vec::new();
    while let Some(row) = rows.next().map_err(|error| error.to_string())? {
        let mut record = Map::new();
        for (index, column) in columns.iter().enumerate() {
            let value: rusqlite::types::Value = row.get(index).map_err(|error| error.to_string())?;
            record.insert(column.clone(), sqlite_value_to_json(value));
        }
        output.push(record);
    }
    Ok(QueryResult { columns, rows: output })
}

fn float_to_json(value: f64) -> JsonValue {
    Number::from_f64(value).map(JsonValue::Number).unwrap_or(JsonValue::Null)
}

fn duckdb_value_to_json(value: duckdb::types::Value) -> JsonValue {
    use duckdb::types::Value as DuckValue;
    match value {
        DuckValue::Null => JsonValue::Null,
        DuckValue::Boolean(value) => JsonValue::Bool(value),
        DuckValue::TinyInt(value) => JsonValue::from(value),
        DuckValue::SmallInt(value) => JsonValue::from(value),
        DuckValue::Int(value) => JsonValue::from(value),
        DuckValue::BigInt(value) => JsonValue::from(value),
        DuckValue::UTinyInt(value) => JsonValue::from(value),
        DuckValue::USmallInt(value) => JsonValue::from(value),
        DuckValue::UInt(value) => JsonValue::from(value),
        DuckValue::UBigInt(value) => JsonValue::from(value),
        DuckValue::Float(value) => float_to_json(value.into()),
        DuckValue::Double(value) => float_to_json(value),
        DuckValue::Text(value) | DuckValue::Enum(value) => JsonValue::String(value),
        DuckValue::Blob(value) | DuckValue::Geometry(value) => JsonValue::Array(value.into_iter().map(JsonValue::from).collect()),
        DuckValue::HugeInt(value) => JsonValue::String(value.to_string()),
        DuckValue::UHugeInt(value) => JsonValue::String(value.to_string()),
        value => JsonValue::String(format!("{value:?}")),
    }
}

fn sqlite_value_to_json(value: rusqlite::types::Value) -> JsonValue {
    use rusqlite::types::Value as SqliteValue;
    match value {
        SqliteValue::Null => JsonValue::Null,
        SqliteValue::Integer(value) => JsonValue::from(value),
        SqliteValue::Real(value) => float_to_json(value),
        SqliteValue::Text(value) => JsonValue::String(value),
        SqliteValue::Blob(value) => JsonValue::Array(value.into_iter().map(JsonValue::from).collect()),
    }
}

pub fn sqlite_value_to_json_pub(value: rusqlite::types::Value) -> JsonValue { sqlite_value_to_json(value) }

#[cfg(test)]
mod tests {
    use super::{duckdb_value_to_json, sqlite_value_to_json};
    use serde_json::json;

    #[test]
    fn sqlite_values_keep_json_types() {
        assert_eq!(sqlite_value_to_json(rusqlite::types::Value::Integer(42)), json!(42));
        assert_eq!(sqlite_value_to_json(rusqlite::types::Value::Real(1.5)), json!(1.5));
        assert_eq!(sqlite_value_to_json(rusqlite::types::Value::Text("DataForge".into())), json!("DataForge"));
        assert_eq!(sqlite_value_to_json(rusqlite::types::Value::Null), serde_json::Value::Null);
    }

    #[test]
    fn duckdb_values_keep_json_types() {
        assert_eq!(duckdb_value_to_json(duckdb::types::Value::Boolean(true)), json!(true));
        assert_eq!(duckdb_value_to_json(duckdb::types::Value::BigInt(42)), json!(42));
        assert_eq!(duckdb_value_to_json(duckdb::types::Value::Text("DataForge".into())), json!("DataForge"));
        assert_eq!(duckdb_value_to_json(duckdb::types::Value::Null), serde_json::Value::Null);
    }
}
