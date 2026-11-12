import * as duckdb from '@duckdb/duckdb-wasm'
import wasmUrl from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url'
import workerUrl from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url'
import type { Row } from '@/stores/dataStore'

export type BrowserTable = { name: string; rows: Row[] }

let databasePromise: Promise<duckdb.AsyncDuckDB> | null = null

async function getDatabase() {
  if (!databasePromise) {
    databasePromise = (async () => {
      const worker = new Worker(workerUrl)
      const database = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(), worker)
      await database.instantiate(wasmUrl)
      return database
    })()
  }
  return databasePromise
}

const quoteIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`

export async function executeBrowserSql(tables: BrowserTable[], sql: string): Promise<Row[]> {
  const database = await getDatabase()
  const connection = await database.connect()
  try {
    for (const [index, table] of tables.entries()) {
      const fileName = `dataforge-session-${index}.json`
      const buffer = new TextEncoder().encode(JSON.stringify(table.rows))
      await database.registerFileBuffer(fileName, buffer)
      await connection.query(`DROP TABLE IF EXISTS ${quoteIdentifier(table.name)}`)
      await connection.query(`CREATE TABLE ${quoteIdentifier(table.name)} AS SELECT * FROM read_json_auto('${fileName}')`)
    }
    const result = await connection.query(sql)
    return result.toArray().map((row) => row.toJSON() as Row)
  } finally {
    await connection.close()
  }
}
