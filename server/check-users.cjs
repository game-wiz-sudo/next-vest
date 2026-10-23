
require('dotenv').config({ path: require('path').join(__dirname, '.env') })

const { getDatabase } = require('./database.cjs')

async function checkUsers() {
    const db = getDatabase()

    try {
        const result = await db.query(`
            SELECT id, full_name, email, email_verified, created_at
            FROM users
            ORDER BY id DESC
            LIMIT 10
        `)

        console.table(result.rows)
    } catch (error) {
        console.error('Database check failed:', error.message)
    } finally {
        await db.end()
    }
}

checkUsers()

