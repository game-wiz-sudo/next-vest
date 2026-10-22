const crypto = require('crypto')

const ALLOWED_TYPES = new Set([
  'deposit',
  'withdrawal',
  'investment',
  'return',
  'adjustment',
])

const ALLOWED_DIRECTIONS = new Set(['credit', 'debit'])

function createWalletTransactionEngine(db) {
  if (!db || typeof db.prepare !== 'function' || typeof db.transaction !== 'function') {
    throw new TypeError('A better-sqlite3 database connection is required.')
  }

  const findExistingTransaction = db.prepare(`
    SELECT id, user_id, reference, type, direction, amount_kobo,
           status, description, created_at
    FROM transactions
    WHERE reference = ?
  `)

  const findWallet = db.prepare(`
    SELECT user_id, balance_kobo, currency
    FROM wallets
    WHERE user_id = ?
  `)

  const createTransaction = db.prepare(`
    INSERT INTO transactions (
      user_id, reference, type, direction, amount_kobo,
      status, description
    )
    VALUES (?, ?, ?, ?, ?, 'completed', ?)
  `)

  const creditWallet = db.prepare(`
    UPDATE wallets
    SET balance_kobo = balance_kobo + ?,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE user_id = ?
      AND balance_kobo <= ?
  `)

  const debitWallet = db.prepare(`
    UPDATE wallets
    SET balance_kobo = balance_kobo - ?,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE user_id = ?
      AND balance_kobo >= ?
  `)

  const createLedgerEntry = db.prepare(`
    INSERT INTO wallet_ledger_entries (
      transaction_id, user_id, delta_kobo, balance_after_kobo
    )
    VALUES (?, ?, ?, ?)
  `)

  const findPostedTransaction = db.prepare(`
    SELECT id, user_id, reference, type, direction, amount_kobo,
           status, description, created_at
    FROM transactions
    WHERE id = ?
  `)

  const postTransactionAtomic = db.transaction((input) => {
    const {
      userId,
      reference,
      type,
      direction,
      amountKobo,
      description,
    } = input

    const existing = findExistingTransaction.get(reference)

    if (existing) {
      const sameRequest =
        existing.user_id === userId &&
        existing.type === type &&
        existing.direction === direction &&
        existing.amount_kobo === amountKobo &&
        existing.description === description &&
        existing.status === 'completed'

      if (!sameRequest) {
        const error = new Error('This transaction reference has already been used.')
        error.code = 'REFERENCE_CONFLICT'
        throw error
      }

      const wallet = findWallet.get(userId)

      return {
        transaction: existing,
        balanceKobo: wallet ? wallet.balance_kobo : null,
        duplicate: true,
      }
    }

    db.prepare('INSERT OR IGNORE INTO wallets (user_id) VALUES (?)').run(userId)

    const walletBefore = findWallet.get(userId)

    if (!walletBefore) {
      const error = new Error('Wallet not found for this user.')
      error.code = 'WALLET_NOT_FOUND'
      throw error
    }

    const maxSafeBalance = Number.MAX_SAFE_INTEGER - amountKobo
    const updateResult = direction === 'credit'
      ? creditWallet.run(amountKobo, userId, maxSafeBalance)
      : debitWallet.run(amountKobo, userId, amountKobo)

    if (updateResult.changes !== 1) {
      const error = new Error(
        direction === 'debit'
          ? 'Insufficient wallet balance.'
          : 'The resulting wallet balance would exceed the supported limit.'
      )
      error.code = direction === 'debit' ? 'INSUFFICIENT_FUNDS' : 'BALANCE_LIMIT'
      throw error
    }

    const inserted = createTransaction.run(
      userId,
      reference,
      type,
      direction,
      amountKobo,
      description
    )

    const balanceAfter = findWallet.get(userId).balance_kobo
    const deltaKobo = direction === 'credit' ? amountKobo : -amountKobo

    createLedgerEntry.run(
      inserted.lastInsertRowid,
      userId,
      deltaKobo,
      balanceAfter
    )

    return {
      transaction: findPostedTransaction.get(inserted.lastInsertRowid),
      balanceKobo: balanceAfter,
      duplicate: false,
    }
  })

  function postTransaction(input) {
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

    if (typeof reference !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(reference)) {
      throw new TypeError('Reference must be 8–100 safe characters.')
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

    if (typeof description !== 'string' || !description.trim() || description.trim().length > 200) {
      throw new TypeError('Description must contain 1–200 characters.')
    }

    return postTransactionAtomic({
      userId,
      reference,
      type,
      direction,
      amountKobo,
      description: description.trim(),
    })
  }

  function createReference(prefix = 'NV') {
    const safePrefix = String(prefix).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 20) || 'NV'
    return `${safePrefix}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`
  }

  return {
    postTransaction,
    createReference,
  }
}

module.exports = { createWalletTransactionEngine }
