const assert = require('node:assert/strict')
const Database = require('better-sqlite3')
const { createWalletTransactionEngine } = require('./transaction-engine.cjs')

const db = new Database(':memory:')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    full_name TEXT NOT NULL
  );

  CREATE TABLE wallets (
    user_id INTEGER PRIMARY KEY,
    balance_kobo INTEGER NOT NULL DEFAULT 0 CHECK (balance_kobo >= 0),
    currency TEXT NOT NULL DEFAULT 'NGN' CHECK (currency = 'NGN'),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    reference TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'investment', 'return', 'adjustment')),
    direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
    amount_kobo INTEGER NOT NULL CHECK (amount_kobo > 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'reversed')),
    description TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE wallet_ledger_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
    delta_kobo INTEGER NOT NULL,
    balance_after_kobo INTEGER NOT NULL CHECK (balance_after_kobo >= 0),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (transaction_id) REFERENCES transactions(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  INSERT INTO users (id, full_name) VALUES (1, 'Test User');
  INSERT INTO wallets (user_id, balance_kobo) VALUES (1, 0);
`)

const engine = createWalletTransactionEngine(db)

try {
  const credit = engine.postTransaction({
    userId: 1,
    reference: 'NV_TEST_CREDIT_001',
    type: 'deposit',
    direction: 'credit',
    amountKobo: 500000,
    description: 'Test credit',
  })

  assert.equal(credit.balanceKobo, 500000)
  assert.equal(credit.duplicate, false)

  const duplicate = engine.postTransaction({
    userId: 1,
    reference: 'NV_TEST_CREDIT_001',
    type: 'deposit',
    direction: 'credit',
    amountKobo: 500000,
    description: 'Test credit',
  })

  assert.equal(duplicate.duplicate, true)
  assert.equal(duplicate.balanceKobo, 500000)

  const debit = engine.postTransaction({
    userId: 1,
    reference: 'NV_TEST_DEBIT_001',
    type: 'investment',
    direction: 'debit',
    amountKobo: 200000,
    description: 'Test debit',
  })

  assert.equal(debit.balanceKobo, 300000)

  assert.throws(() => engine.postTransaction({
    userId: 1,
    reference: 'NV_TEST_OVERSPEND_001',
    type: 'withdrawal',
    direction: 'debit',
    amountKobo: 400000,
    description: 'Should fail',
  }), { code: 'INSUFFICIENT_FUNDS' })

  assert.throws(() => engine.postTransaction({
    userId: 1,
    reference: 'NV_TEST_CREDIT_001',
    type: 'deposit',
    direction: 'credit',
    amountKobo: 100000,
    description: 'Different transaction using same reference',
  }), { code: 'REFERENCE_CONFLICT' })

  const finalBalance = db.prepare('SELECT balance_kobo FROM wallets WHERE user_id = 1').get().balance_kobo
  const transactionCount = db.prepare('SELECT COUNT(*) AS count FROM transactions').get().count
  const ledgerCount = db.prepare('SELECT COUNT(*) AS count FROM wallet_ledger_entries').get().count

  assert.equal(finalBalance, 300000)
  assert.equal(transactionCount, 2)
  assert.equal(ledgerCount, 2)

  console.log('PASS: credit updates wallet and records transaction + ledger entry')
  console.log('PASS: repeated identical reference does not credit twice')
  console.log('PASS: debit reduces wallet balance correctly')
  console.log('PASS: insufficient funds are rejected without changing balance')
  console.log('PASS: conflicting reference reuse is rejected')
  console.log('PASS: wallet, transactions, and ledger remain consistent')
} finally {
  db.close()
}

