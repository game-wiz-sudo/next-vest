
require('dotenv').config({
  path: require('path').join(__dirname, '.env'),
})

const { getDatabase } = require('./database.cjs')

async function testConnection() {
  let pool

  try {
    pool = getDatabase()

    console.log('Connecting to PostgreSQL...')

    const client = await pool.connect()

    try {
      const result = await client.query(
        'SELECT NOW() AS current_time, current_database() AS database_name'
      )

      console.log('PostgreSQL connection successful!')
      console.log('Database:', result.rows[0].database_name)
      console.log('Database time:', result.rows[0].current_time)
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('PostgreSQL connection failed.')
    console.error('Error code:', error.code || 'Not provided')
    console.error('Error message:', error.message)
  } finally {
    if (pool) {
      await pool.end().catch(() => {})
    }
  }
}

testConnection()

