
const crypto = require('crypto')

const ALLOWED_TYPES = new Set([
  'deposit',
  'withdrawal',
  'investment',
  'return',
  'adjustment',
])

const ALLOWED_DIRECTIONS = new Set(['credit', 'debit'])

function createWalletTransactionEngine(pool) {
  if (!pool || typeof pool.connect !== 'function') {
    throw new TypeError('A PostgreSQL connection pool is required.')
  }

  async function postTransactionWithClient(client, input) {
    if (!client || typeof client.query !== 'function') {
      throw new TypeError('A PostgreSQL client is required.')
    }

    if (!input || typeof input !== 'object') {
      throw new TypeError('Transaction details are required.')
    }

    const {
      userId,
      reference,
      type,
      direction,
      amountKobo,
      description,
    } = input

    if (!Number.isSafeInteger(userId) || userId < 1) {
      throw new TypeError('A valid user ID is required.')
    }

    if (
      typeof reference !== 'string' ||
      !/^[A-Za-z0-9_-]{8,100}$/.test(reference)
    ) {
      throw new TypeError('Reference must be 8-100 safe characters.')
    }

    if (!ALLOWED_TYPES.has(type)) {
      throw new TypeError('Unsupported transaction type.')
    }

    if (!ALLOWED_DIRECTIONS.has(direction)) {
      throw new TypeError('Transaction direction must be credit or debit.')
    }

    if (!Number.isSafeInteger(amountKobo) || amountKobo <= 0) {
      throw new TypeError('Amount must be a positive whole number of kobo.')
    }

    if (
      typeof description !== 'string' ||
      !description.trim() ||
      description.trim().length > 200
    ) {
      throw new TypeError('Description must contain 1-200 characters.')
    }

    const cleanDescription = description.trim()

    const existingResult = await client.query(
      `SELECT id, user_id, reference, type, direction, amount_kobo,
              status, description, created_at
       FROM transactions
       WHERE reference = $1
       FOR UPDATE`,
      [reference]
    )

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0]

      const sameRequest =
        Number(existing.user_id) === userId &&
        existing.type === type &&
        existing.direction === direction &&
        Number(existing.amount_kobo) === amountKobo &&
        existing.description === cleanDescription &&
        existing.status === 'completed'

      if (!sameRequest) {
        const error = new Error(
          'This transaction reference has already been used.'
        )
        error.code = 'REFERENCE_CONFLICT'
        throw error
      }

      const walletResult = await client.query(
        `SELECT user_id, balance_kobo, currency
         FROM wallets
         WHERE user_id = $1`,
        [userId]
      )

      return {
        transaction: existing,
        balanceKobo: walletResult.rows.length
          ? Number(walletResult.rows[0].balance_kobo)
          : null,
        duplicate: true,
      }
    }

    await client.query(
      `INSERT INTO wallets (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    )

    const walletResult = await client.query(
      `SELECT user_id, balance_kobo, currency
       FROM wallets
       WHERE user_id = $1
       FOR UPDATE`,
      [userId]
    )

    if (walletResult.rows.length === 0) {
      const error = new Error('Wallet not found for this user.')
      error.code = 'WALLET_NOT_FOUND'
      throw error
    }

    const walletBefore = Number(walletResult.rows[0].balance_kobo)

    const nextBalance =
      direction === 'credit'
        ? walletBefore + amountKobo
        : walletBefore - amountKobo

    if (direction === 'debit' && walletBefore < amountKobo) {
      const error = new Error('Insufficient wallet balance.')
      error.code = 'INSUFFICIENT_FUNDS'
      throw error
    }

    if (
      !Number.isSafeInteger(nextBalance) ||
      nextBalance < 0 ||
      nextBalance > Number.MAX_SAFE_INTEGER
    ) {
      const error = new Error(
        direction === 'debit'
          ? 'Insufficient wallet balance.'
          : 'The resulting wallet balance would exceed the supported limit.'
      )

      error.code =
        direction === 'debit' ? 'INSUFFICIENT_FUNDS' : 'BALANCE_LIMIT'

      throw error
    }

    const updatedWallet = await client.query(
      `UPDATE wallets
       SET balance_kobo = $1,
           updated_at = TO_CHAR(
             CURRENT_TIMESTAMP AT TIME ZONE 'UTC',
             'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
           )
       WHERE user_id = $2
       RETURNING balance_kobo`,
      [nextBalance, userId]
    )

    const transactionResult = await client.query(
      `INSERT INTO transactions (
         user_id, reference, type, direction, amount_kobo,
         status, description
       )
       VALUES ($1, $2, $3, $4, $5, 'completed', $6)
       RETURNING id, user_id, reference, type, direction,
                 amount_kobo, status, description, created_at`,
      [userId, reference, type, direction, amountKobo, cleanDescription]
    )

    const transaction = transactionResult.rows[0]
    const balanceAfter = Number(updatedWallet.rows[0].balance_kobo)
    const deltaKobo = direction === 'credit' ? amountKobo : -amountKobo

    await client.query(
      `INSERT INTO wallet_ledger_entries (
         transaction_id, user_id, delta_kobo, balance_after_kobo
       )
       VALUES ($1, $2, $3, $4)`,
      [transaction.id, userId, deltaKobo, balanceAfter]
    )

    return {
      transaction,
      balanceKobo: balanceAfter,
      duplicate: false,
    }
  }

  async function postTransaction(input) {
    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      const result = await postTransactionWithClient(client, input)

      await client.query('COMMIT')

      return result
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})

      if (error.code === '23505') {
        const conflict = new Error(
          'This transaction reference has already been used.'
        )
        conflict.code = 'REFERENCE_CONFLICT'
        throw conflict
      }

      throw error
    } finally {
      client.release()
    }
  }

  function createReference(prefix = 'NV') {
    const safePrefix =
      String(prefix).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 20) || 'NV'

    return `${safePrefix}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`
  }

  return {
    postTransaction,
    postTransactionWithClient,
    createReference,
  }
}

module.exports = { createWalletTransactionEngine }

