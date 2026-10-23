require('dotenv').config({
  path: require('path').join(__dirname, '.env'),
})

const fs = require('fs')
const path = require('path')
const { getDatabase } = require('./database.cjs')

async function setupDatabase() {
  const pool = getDatabase()

  try {
    const schemaPath = path.join(__dirname, 'schema.sql')
    const schema = fs.readFileSync(schemaPath, 'utf8')

    await pool.query('BEGIN')

    try {
      await pool.query(schema)
      await pool.query('COMMIT')
    } catch (error) {
      await pool.query('ROLLBACK')
      throw error
    }

    console.log('PostgreSQL schema created successfully.')

    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `)

    console.log('\nTables in your database:')

    for (const row of result.rows) {
      console.log('-', row.table_name)
    }
  } catch (error) {
    console.error('Schema setup failed:', error.message)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

setupDatabase()