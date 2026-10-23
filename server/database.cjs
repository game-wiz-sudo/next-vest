
const { Pool } = require('pg')

let pool

function getDatabase() {
  if (pool) {
    return pool
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured.')
  }

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  })

  pool.on('error', (error) => {
    console.error('Unexpected PostgreSQL pool error:', error.message)
  })

  return pool
}

module.exports = { getDatabase }

