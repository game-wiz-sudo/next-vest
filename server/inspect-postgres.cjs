require('dotenv').config({
  path: require('path').join(__dirname, '.env'),
})

const { getDatabase } = require('./database.cjs')

async function inspectDatabase() {
  const pool = getDatabase()

  try {
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `)

    console.log('Connected to PostgreSQL successfully.')
    console.log('\nExisting public tables:')

    if (result.rows.length === 0) {
      console.log('No tables found. The database appears empty.')
    } else {
      for (const row of result.rows) {
        console.log('-', row.table_name)
      }
    }
  } catch (error) {
    console.error('Inspection failed:', error.message)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

inspectDatabase()
