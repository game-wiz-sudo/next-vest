
const express = require('express')
const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const dotenv = require('dotenv')
const rateLimit = require('express-rate-limit')
const { createWalletTransactionEngine } = require('./transaction-engine.cjs')

dotenv.config({
  path: path.join(__dirname, '.env'),
})

const app = express()
const PORT = process.env.PORT || 5000

if (
  typeof process.env.JWT_SECRET !== 'string' ||
  process.env.JWT_SECRET.length < 32
) {
  throw new Error(
    'Please configure a JWT_SECRET of at least 32 characters in server/.env'
  )
}

if (
  !process.env.CLIENT_URL ||
  (
    process.env.NODE_ENV === 'production' &&
    !process.env.CLIENT_URL.startsWith('https://')
  )
) {
  throw new Error(
    'Configure CLIENT_URL in server/.env. Production requires HTTPS.'
  )
}

if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
  throw new Error(
    'Please configure RESEND_API_KEY and EMAIL_FROM in server/.env'
  )
}

/* =========================================
   DATABASE
========================================= */

const db = new Database(
  path.join(__dirname, 'nextvest.db')
)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,

    role TEXT NOT NULL DEFAULT 'user'
      CHECK (role IN ('user', 'admin', 'owner')),

    account_status TEXT NOT NULL DEFAULT 'active'
      CHECK (
        account_status IN (
          'active',
          'suspended',
          'closed'
        )
      ),

    email_verified INTEGER NOT NULL DEFAULT 0
      CHECK (email_verified IN (0, 1)),

    created_at TEXT NOT NULL DEFAULT (
      strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    )
  );

  CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    user_id INTEGER NOT NULL,

    token_hash TEXT NOT NULL UNIQUE,

    expires_at INTEGER NOT NULL,

    used_at INTEGER,

    created_at INTEGER NOT NULL DEFAULT (
      CAST(strftime('%s', 'now') AS INTEGER) * 1000
    ),

    FOREIGN KEY (user_id)
      REFERENCES users(id)
      ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS
    idx_verification_tokens_user
  ON email_verification_tokens(user_id);

  CREATE INDEX IF NOT EXISTS
    idx_verification_tokens_expiry
  ON email_verification_tokens(expires_at);

  CREATE TABLE IF NOT EXISTS wallets (
    user_id INTEGER PRIMARY KEY,
    balance_kobo INTEGER NOT NULL DEFAULT 0 CHECK (balance_kobo >= 0),
    currency TEXT NOT NULL DEFAULT 'NGN' CHECK (currency = 'NGN'),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS transactions (
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

  CREATE INDEX IF NOT EXISTS idx_transactions_user_created
    ON transactions(user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS wallet_ledger_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
    delta_kobo INTEGER NOT NULL,
    balance_after_kobo INTEGER NOT NULL CHECK (balance_after_kobo >= 0),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (transaction_id) REFERENCES transactions(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user_created
    ON wallet_ledger_entries(user_id, created_at DESC);

  INSERT OR IGNORE INTO wallets (user_id)
    SELECT id FROM users;
`)

/* =========================================
   PAYSTACK PAYMENT RECORDS
========================================= */

db.exec(`
  CREATE TABLE IF NOT EXISTS paystack_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    reference TEXT NOT NULL UNIQUE,
    amount_kobo INTEGER NOT NULL CHECK (amount_kobo > 0),
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'completed', 'failed')),
    created_at TEXT NOT NULL DEFAULT (
      strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    ),
    updated_at TEXT NOT NULL DEFAULT (
      strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    ),
    FOREIGN KEY (user_id)
      REFERENCES users(id)
      ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_paystack_payments_user
    ON paystack_payments(user_id, created_at DESC);
`)

const walletTransactionEngine = createWalletTransactionEngine(db)

/* =========================================
   DATABASE QUERIES
========================================= */

const findUserByEmail = db.prepare(`
  SELECT
    id,
    full_name,
    email,
    password_hash,
    role,
    account_status,
    email_verified,
    created_at
  FROM users
  WHERE email = ?
`)

const findUserById = db.prepare(`
  SELECT
    id,
    full_name,
    email,
    role,
    account_status,
    email_verified,
    created_at
  FROM users
  WHERE id = ?
`)

const createUser = db.prepare(`
  INSERT INTO users (
    full_name,
    email,
    password_hash
  )
  VALUES (?, ?, ?)
`)

const createVerificationToken = db.prepare(`
  INSERT INTO email_verification_tokens (
    user_id,
    token_hash,
    expires_at
  )
  VALUES (?, ?, ?)
`)

const invalidatePreviousTokens = db.prepare(`
  UPDATE email_verification_tokens
  SET used_at = ?
  WHERE user_id = ?
    AND used_at IS NULL
`)

const findVerificationToken = db.prepare(`
  SELECT
    token_hash,
    user_id,
    expires_at,
    used_at
  FROM email_verification_tokens
  WHERE token_hash = ?
`)

const markVerificationTokenUsed = db.prepare(`
  UPDATE email_verification_tokens
  SET used_at = ?
  WHERE token_hash = ?
    AND used_at IS NULL
    AND expires_at > ?
`)

const markEmailVerified = db.prepare(`
  UPDATE users
  SET email_verified = 1
  WHERE id = ?
`)

/* =========================================
   MIDDLEWARE
========================================= */

app.disable('x-powered-by')

app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
}))

app.use(express.json({
  limit: '20kb',
}))

app.use(cookieParser())

app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    message: 'Too many requests. Please try again later.',
  },
}))

/* =========================================
   AUTHENTICATION HELPERS
========================================= */

const COOKIE_NAME = 'nextvest_session'

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
}

function createToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '7d',
      issuer: 'nextvest-api',
      audience: 'nextvest-client',
    }
  )
}

function setAuthCookie(res, user) {
  res.cookie(
    COOKIE_NAME,
    createToken(user),
    COOKIE_OPTIONS
  )
}

function publicUser(user) {
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    accountStatus: user.account_status,
    emailVerified: Boolean(user.email_verified),
    createdAt: user.created_at,
  }
}

function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE_NAME]

  if (!token) {
    return res.status(401).json({
      message: 'Please sign in to continue.',
    })
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET,
      {
        issuer: 'nextvest-api',
        audience: 'nextvest-client',
      }
    )

    const user = findUserById.get(
      Number(decoded.sub)
    )

    if (!user) {
      res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS)

      return res.status(401).json({
        message: 'Your session is no longer valid.',
      })
    }

    if (user.account_status !== 'active') {
      res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS)

      return res.status(403).json({
        message: 'Your account is not active.',
      })
    }

    if (user.email_verified !== 1) {
      res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS)

      return res.status(403).json({
        message: 'Please verify your email address.',
      })
    }

    req.user = user

    next()
  } catch (error) {
    res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS)

    return res.status(401).json({
      message: 'Your session is invalid or has expired.',
    })
  }
}

/* =========================================
   EMAIL VERIFICATION HELPERS
========================================= */

let resendClientPromise

async function getResendClient() {
  if (!resendClientPromise) {
    resendClientPromise = import('resend').then(
      ({ Resend }) => {
        return new Resend(process.env.RESEND_API_KEY)
      }
    )
  }

  return resendClientPromise
}

function hashVerificationCode(userId, code) {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(`${userId}:${code}`)
    .digest('hex')
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character])
}

async function sendVerificationEmail(user) {
  // Generate a cryptographically secure six-digit verification code.
  const code = crypto
    .randomInt(0, 1000000)
    .toString()
    .padStart(6, '0')

  // HMAC protects short numeric codes against simple offline guessing
  // if the database is exposed without the JWT secret.
  const codeHash = hashVerificationCode(user.id, code)
  const now = Date.now()
  const expiresAt = now + 10 * 60 * 1000

  const resend = await getResendClient()

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: 'Your NEXTVEST verification code',

    text: [
      `Hello ${user.full_name},`,
      '',
      'Thank you for creating a NEXTVEST account.',
      '',
      `Your email verification code is: ${code}`,
      '',
      'Enter this code on the NEXTVEST verification screen.',
      'This code expires in 10 minutes and can only be used once.',
      '',
      'If you did not create this account, you can ignore this email.',
    ].join('\n'),

    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:28px;color:#17231c">
        <h1 style="color:#059669">NEXTVEST</h1>
        <h2>Verify your email address</h2>
        <p>Hello ${escapeHtml(user.full_name)},</p>
        <p>Thank you for creating a NEXTVEST account. Enter this code on the NEXTVEST verification screen:</p>
        <div style="margin:28px 0;padding:18px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;text-align:center">
          <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#047857">${code}</span>
        </div>
        <p>This code expires in <strong>10 minutes</strong> and can only be used once.</p>
        <p style="font-size:12px;color:#64748b">If you did not create this account, you can ignore this email.</p>
      </div>
    `,
  })

  if (error) {
    console.error(
      'Resend delivery error:',
      error.message
    )

    throw new Error(
      'Unable to send the verification email.'
    )
  }

  // Only replace any previous code after Resend confirms delivery.
  const createCodeTransaction = db.transaction(() => {
    invalidatePreviousTokens.run(now, user.id)
    createVerificationToken.run(user.id, codeHash, expiresAt)
  })

  createCodeTransaction()

  return data
}

/* =========================================
   HEALTH CHECK
========================================= */

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    application: 'NEXTVEST API',
    message: 'Backend server is running.',
  })
})

/* =========================================
   REGISTER
========================================= */

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const {
      fullName,
      email,
      password,
      confirmPassword,
      acceptedTerms,
    } = req.body || {}

    if (
      typeof fullName !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      typeof confirmPassword !== 'string'
    ) {
      return res.status(400).json({
        message: 'Please provide all required fields.',
      })
    }

    const cleanName = fullName.trim()
    const cleanEmail = email.trim().toLowerCase()

    if (
      cleanName.length < 2 ||
      cleanName.length > 100
    ) {
      return res.status(400).json({
        message: 'Please enter a valid full name.',
      })
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) ||
      cleanEmail.length > 254
    ) {
      return res.status(400).json({
        message: 'Please enter a valid email address.',
      })
    }

    if (
      password.length < 12 ||
      Buffer.byteLength(password, 'utf8') > 72
    ) {
      return res.status(400).json({
        message:
          'Your password must contain at least 12 characters and be no longer than 72 UTF-8 bytes.',
      })
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        message: 'Your passwords do not match.',
      })
    }

    if (acceptedTerms !== true) {
      return res.status(400).json({
        message: 'Please accept the terms to continue.',
      })
    }

    if (findUserByEmail.get(cleanEmail)) {
      return res.status(409).json({
        message:
          'An account with this email may already exist. Try signing in or requesting verification.',
      })
    }

    const passwordHash = await bcrypt.hash(
      password,
      12
    )

    let result

    try {
      result = createUser.run(
        cleanName,
        cleanEmail,
        passwordHash
      )
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({
          message:
            'An account with this email may already exist.',
        })
      }

      throw error
    }

    const user = findUserById.get(
      result.lastInsertRowid
    )

    try {
      await sendVerificationEmail(user)

      return res.status(201).json({
        message:
          'Your account has been created. Check your inbox for your six-digit NEXTVEST verification code. The code expires in 10 minutes.',
        emailVerificationRequired: true,
        authenticationEnabled: false,
      })
    } catch (emailError) {
      console.error(
        'Verification email could not be sent:',
        emailError.message
      )

      return res.status(503).json({
        message:
          'Your account was created, but we could not send your verification email. Please request another verification email.',
        emailVerificationRequired: true,
        canResendVerification: true,
      })
    }
  } catch (error) {
    next(error)
  }
})

/* =========================================
   VERIFY EMAIL
========================================= */

app.post(
  '/api/auth/verify-email',
  (req, res, next) => {
    try {
      const { email, code } = req.body || {}

      if (
        typeof email !== 'string' ||
        email.trim().length > 254 ||
        typeof code !== 'string' ||
        !/^\d{6}$/.test(code)
      ) {
        return res.status(400).json({
          message: 'Enter your email address and the six-digit verification code.',
        })
      }

      const cleanEmail = email.trim().toLowerCase()
      const user = findUserByEmail.get(cleanEmail)

      if (!user || user.email_verified === 1) {
        return res.status(400).json({
          message: 'This verification code is invalid or has expired. Request a new code.',
          canResendVerification: true,
        })
      }

      const codeHash = hashVerificationCode(user.id, code)
      const verification = findVerificationToken.get(codeHash)

      if (
        !verification ||
        verification.user_id !== user.id ||
        verification.used_at !== null ||
        verification.expires_at <= Date.now()
      ) {
        return res.status(400).json({
          message: 'This verification code is invalid or has expired. Request a new code.',
          canResendVerification: true,
        })
      }

      const now = Date.now()

      const verifyTransaction = db.transaction(() => {
        const result = markVerificationTokenUsed.run(
          now,
          codeHash,
          now
        )

        if (result.changes !== 1) {
          return false
        }

        markEmailVerified.run(user.id)
        return true
      })

      if (!verifyTransaction()) {
        return res.status(400).json({
          message: 'This verification code is invalid or has expired. Request a new code.',
          canResendVerification: true,
        })
      }

      return res.json({
        message: 'Your email address has been verified successfully. You can now sign in.',
        emailVerified: true,
      })
    } catch (error) {
      next(error)
    }
  }
)

/* =========================================
   RESEND VERIFICATION EMAIL
========================================= */

app.post(
  '/api/auth/resend-verification',
  async (req, res, next) => {
    try {
      const { email } = req.body || {}

      if (
        typeof email !== 'string' ||
        email.trim().length > 254
      ) {
        return res.status(400).json({
          message: 'Please enter a valid email address.',
        })
      }

      const cleanEmail = email.trim().toLowerCase()

      const genericMessage =
        'If an unverified account exists for that address, a verification email will be sent.'

      const user = findUserByEmail.get(cleanEmail)

      if (!user || user.email_verified === 1) {
        return res.json({
          message: genericMessage,
        })
      }

      try {
        await sendVerificationEmail(user)
      } catch (emailError) {
        console.error(
          'Resend verification failed:',
          emailError.message
        )

        return res.status(503).json({
          message:
            'We could not send the verification email right now. Please try again later.',
        })
      }

      return res.json({
        message: genericMessage,
      })
    } catch (error) {
      next(error)
    }
  }
)

/* =========================================
   LOGIN
========================================= */

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {}

    if (
      typeof email !== 'string' ||
      typeof password !== 'string'
    ) {
      return res.status(400).json({
        message: 'Please enter your email and password.',
      })
    }

    const cleanEmail = email.trim().toLowerCase()

    const user = findUserByEmail.get(cleanEmail)

    if (!user) {
      return res.status(401).json({
        message: 'Invalid email or password.',
      })
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    )

    if (!passwordMatches) {
      return res.status(401).json({
        message: 'Invalid email or password.',
      })
    }

    if (user.account_status !== 'active') {
      return res.status(403).json({
        message: 'Your account is not active.',
      })
    }

    if (user.email_verified !== 1) {
      return res.status(403).json({
        message:
          'Please verify your email address before signing in.',
        emailVerificationRequired: true,
        canResendVerification: true,
      })
    }

    setAuthCookie(res, user)

    return res.json({
      message: 'You have signed in successfully.',
      user: publicUser(user),
    })
  } catch (error) {
    next(error)
  }
})

/* =========================================
   CURRENT USER
========================================= */

app.get(
  '/api/auth/me',
  requireAuth,
  (req, res) => {
    res.json({
      user: publicUser(req.user),
    })
  }
)

/* =========================================
   LOGOUT
========================================= */

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(
    COOKIE_NAME,
    COOKIE_OPTIONS
  )

  res.json({
    message: 'You have been signed out.',
  })
})

/* =========================================
   WALLET SUMMARY
========================================= */

app.get('/api/wallet', requireAuth, (req, res, next) => {
  try {
    // Ensure accounts created before this feature also receive a wallet.
    db.prepare('INSERT OR IGNORE INTO wallets (user_id) VALUES (?)')
      .run(req.user.id)

    const wallet = db.prepare(`
      SELECT balance_kobo, currency, updated_at
      FROM wallets
      WHERE user_id = ?
    `).get(req.user.id)

    res.json({
      wallet: {
        balance: wallet.balance_kobo / 100,
        currency: wallet.currency,
        updatedAt: wallet.updated_at,
      },
    })
  } catch (error) {
    next(error)
  }
})

/* =========================================
   TRANSACTION HISTORY
========================================= */

app.get('/api/transactions', requireAuth, (req, res, next) => {
  try {
    const requestedLimit = Number.parseInt(req.query.limit, 10)
    const limit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 50)
      : 10

    const rows = db.prepare(`
      SELECT id, reference, type, direction, amount_kobo,
             status, description, created_at
      FROM transactions
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT ?
    `).all(req.user.id, limit)

    res.json({
      transactions: rows.map((row) => ({
        id: row.id,
        reference: row.reference,
        type: row.type,
        direction: row.direction,
        amount: (row.amount_kobo / 100) * (row.direction === 'credit' ? 1 : -1),
        status: row.status,
        description: row.description,
        createdAt: row.created_at,
      })),
    })
  } catch (error) {
    next(error)
  }
})

/* =========================================
   PAYSTACK PAYMENT HELPERS
========================================= */

async function paystackRequest(endpoint, options = {}) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY

  if (!secretKey || !secretKey.startsWith('sk_')) {
    const error = new Error('Paystack is not configured. Add PAYSTACK_SECRET_KEY to server/.env.')
    error.statusCode = 503
    throw error
  }

  // Prevent accidental live charges while developing locally.
  if (process.env.NODE_ENV !== 'production' && secretKey.startsWith('sk_live_')) {
    const error = new Error('Live Paystack keys are blocked in local development. Use a Paystack test secret key.')
    error.statusCode = 503
    throw error
  }

  const response = await fetch(`https://api.paystack.co${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(15000),
  })

  let result

  try {
    result = await response.json()
  } catch {
    const error = new Error('Paystack returned an invalid response.')
    error.statusCode = 502
    throw error
  }

  if (!response.ok || result.status !== true) {
    console.error('Paystack API request failed:', result.message || response.status)
    const error = new Error('Paystack could not process this request. Please try again.')
    error.statusCode = 502
    throw error
  }

  return result.data
}

const findPaystackPayment = db.prepare(`
  SELECT id, user_id, reference, amount_kobo, status, created_at, updated_at
  FROM paystack_payments
  WHERE reference = ?
`)

const createPaystackPayment = db.prepare(`
  INSERT INTO paystack_payments (user_id, reference, amount_kobo, status)
  VALUES (?, ?, ?, 'pending')
`)

const markPaystackPaymentFailed = db.prepare(`
  UPDATE paystack_payments
  SET status = 'failed',
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE reference = ? AND status = 'pending'
`)

/* =========================================
   INITIALIZE PAYSTACK DEPOSIT
========================================= */

app.post(
  '/api/payments/paystack/initialize',
  requireAuth,
  async (req, res, next) => {
    let reference

    try {
      const amountNaira = req.body?.amount

      if (
        typeof amountNaira !== 'number' ||
        !Number.isSafeInteger(amountNaira) ||
        amountNaira < 100 ||
        amountNaira > 5000000
      ) {
        return res.status(400).json({
          message: 'Enter a whole-number deposit amount between ₦100 and ₦5,000,000.',
        })
      }

      const amountKobo = amountNaira * 100

      if (!Number.isSafeInteger(amountKobo)) {
        return res.status(400).json({
          message: 'The deposit amount is invalid.',
        })
      }

      reference = walletTransactionEngine.createReference('NVDEP')

      createPaystackPayment.run(
        req.user.id,
        reference,
        amountKobo
      )

      let payment

      try {
        payment = await paystackRequest('/transaction/initialize', {
          method: 'POST',
          body: JSON.stringify({
            email: req.user.email,
            amount: amountKobo,
            currency: 'NGN',
            reference,
            callback_url: process.env.PAYSTACK_CALLBACK_URL || `${process.env.CLIENT_URL}/payment/callback`,
            metadata: {
              userId: req.user.id,
              purpose: 'NEXTVEST wallet deposit',
              custom_fields: [
                {
                  display_name: 'NEXTVEST User ID',
                  variable_name: 'nextvest_user_id',
                  value: String(req.user.id),
                },
              ],
            },
          }),
        })
      } catch (error) {
        markPaystackPaymentFailed.run(reference)
        throw error
      }

      if (!payment.authorization_url || payment.reference !== reference) {
        markPaystackPaymentFailed.run(reference)
        return res.status(502).json({
          message: 'Paystack did not return a valid checkout session. Please try again.',
        })
      }

      return res.status(201).json({
        message: 'Payment session created.',
        authorizationUrl: payment.authorization_url,
        reference,
        amount: amountNaira,
        currency: 'NGN',
      })
    } catch (error) {
      next(error)
    }
  }
)

/* =========================================
   VERIFY PAYSTACK DEPOSIT
========================================= */

app.post(
  '/api/payments/paystack/verify',
  requireAuth,
  async (req, res, next) => {
    try {
      const reference = req.body?.reference

      if (
        typeof reference !== 'string' ||
        !/^[A-Za-z0-9_-]{8,100}$/.test(reference)
      ) {
        return res.status(400).json({
          message: 'A valid payment reference is required.',
        })
      }

      const paymentRecord = findPaystackPayment.get(reference)

      if (!paymentRecord || paymentRecord.user_id !== req.user.id) {
        return res.status(404).json({
          message: 'This payment could not be found for your account.',
        })
      }

      if (paymentRecord.status === 'completed') {
        const wallet = db.prepare(`
          SELECT balance_kobo, currency
          FROM wallets
          WHERE user_id = ?
        `).get(req.user.id)

        return res.json({
          message: 'This payment has already been added to your wallet.',
          verified: true,
          alreadyCredited: true,
          reference,
          wallet: {
            balance: (wallet?.balance_kobo || 0) / 100,
            currency: wallet?.currency || 'NGN',
          },
        })
      }

      if (paymentRecord.status !== 'pending') {
        return res.status(400).json({
          message: 'This payment is no longer pending. Please start a new deposit.',
        })
      }

      const verifiedPayment = await paystackRequest(
        `/transaction/verify/${encodeURIComponent(reference)}`
      )

      const paidEmail = String(verifiedPayment.customer?.email || '').trim().toLowerCase()
      const expectedEmail = String(req.user.email || '').trim().toLowerCase()

      if (
        verifiedPayment.status !== 'success' ||
        verifiedPayment.reference !== reference ||
        verifiedPayment.amount !== paymentRecord.amount_kobo ||
        verifiedPayment.currency !== 'NGN' ||
        paidEmail !== expectedEmail
      ) {
        return res.status(400).json({
          message: 'Paystack has not confirmed this deposit. Your wallet has not been credited.',
          verified: false,
        })
      }

      const completePayment = db.transaction(() => {
        const currentPayment = findPaystackPayment.get(reference)

        if (!currentPayment || currentPayment.user_id !== req.user.id) {
          const error = new Error('Payment record could not be found.')
          error.statusCode = 404
          throw error
        }

        if (currentPayment.status === 'completed') {
          return { alreadyCredited: true }
        }

        if (currentPayment.status !== 'pending') {
          const error = new Error('This payment is no longer pending.')
          error.statusCode = 409
          throw error
        }

        const result = walletTransactionEngine.postTransaction({
          userId: req.user.id,
          reference,
          type: 'deposit',
          direction: 'credit',
          amountKobo: paymentRecord.amount_kobo,
          description: 'Paystack wallet deposit',
        })

        const updated = db.prepare(`
          UPDATE paystack_payments
          SET status = 'completed',
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          WHERE reference = ? AND user_id = ? AND status = 'pending'
        `).run(reference, req.user.id)

        if (updated.changes !== 1) {
          const error = new Error('Payment status could not be updated safely.')
          error.statusCode = 409
          throw error
        }

        return {
          alreadyCredited: Boolean(result.duplicate),
          balanceKobo: result.balanceKobo,
        }
      })()

      const wallet = db.prepare(`
        SELECT balance_kobo, currency
        FROM wallets
        WHERE user_id = ?
      `).get(req.user.id)

      return res.json({
        message: completePayment.alreadyCredited
          ? 'This payment has already been added to your wallet.'
          : 'Payment verified successfully. Your wallet has been credited.',
        verified: true,
        alreadyCredited: completePayment.alreadyCredited,
        reference,
        amount: paymentRecord.amount_kobo / 100,
        wallet: {
          balance: (wallet?.balance_kobo || 0) / 100,
          currency: wallet?.currency || 'NGN',
        },
      })
    } catch (error) {
      next(error)
    }
  }
)

/* =========================================
   ERROR HANDLING
========================================= */

app.use((err, req, res, next) => {
  console.error(
    'NEXTVEST API error:',
    err.message
  )

  if (res.headersSent) {
    return next(err)
  }

  res.status(err.statusCode || 500).json({
    message: err.statusCode ? err.message : 'An unexpected server error occurred.',
  })
})

/* =========================================
   START SERVER
========================================= */

const server = app.listen(PORT, () => {
  console.log('')
  console.log('================================')
  console.log('       NEXTVEST API')
  console.log('================================')
  console.log(`Server: http://localhost:${PORT}`)
  console.log(`Health: http://localhost:${PORT}/api/health`)
  console.log('Database: Local SQLite')
  console.log('Wallet engine: Atomic transactions + ledger enabled')
  console.log('Email: Resend (6-digit verification codes)')
  console.log('Payments: Paystack initialization + server-side verification')
  console.log('================================')
  console.log('')
})

function shutdown() {
  server.close(() => {
    db.close()
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

