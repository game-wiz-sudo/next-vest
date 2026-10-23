const express = require('express')
const path = require('path')
const crypto = require('crypto')
async function paystackRequest(endpoint, options = {}) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY

  if (!secretKey || !secretKey.startsWith('sk_')) {
    const error = new Error('Paystack is not configured. Check PAYSTACK_SECRET_KEY in server/.env.')
    error.statusCode = 503
    throw error
  }

  if (
    process.env.NODE_ENV !== 'production' &&
    secretKey.startsWith('sk_live_')
  ) {
    const error = new Error('Live Paystack keys are blocked during local development. Use a test secret key.')
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
    console.error(
      'Paystack API request failed:',
      result.message || response.status
    )

    const error = new Error('Paystack could not process this request. Please try again.')
    error.statusCode = 502
    throw error
  }

  return result.data
}
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const dotenv = require('dotenv')
const rateLimit = require('express-rate-limit')

const { getDatabase } = require('./database.cjs')
const {
  createWalletTransactionEngine,
} = require('./transaction-engine.pg.cjs')

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
    'Please configure a JWT_SECRET of at least 32 characters.'
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
    'Configure CLIENT_URL. Production requires HTTPS.'
  )
}

if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
  throw new Error(
    'Please configure RESEND_API_KEY and EMAIL_FROM.'
  )
}

const db = getDatabase()

const walletTransactionEngine =
  createWalletTransactionEngine(db)


// =========================================
// USER QUERIES
// =========================================

async function findUserByEmail(email) {
  const result = await db.query(
    `SELECT id, full_name, email, password_hash, role,
            account_status, email_verified, created_at
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [email]
  )

  return result.rows[0] || null
}

async function findUserById(id) {
  const result = await db.query(
    `SELECT id, full_name, email, password_hash, role,
            account_status, email_verified, created_at
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [id]
  )

  return result.rows[0] || null
}

function publicUser(user) {
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    emailVerified: user.email_verified === 1,
    createdAt: user.created_at,
  }
}


// =========================================
// AUTHENTICATION HELPERS
// =========================================

const COOKIE_NAME = 'nextvest_session'

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
}

function setAuthCookie(res, user) {
  const token = jwt.sign(
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

  res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS)
}

async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME]

    if (!token) {
      return res.status(401).json({
        message: 'Please sign in to continue.',
      })
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'nextvest-api',
      audience: 'nextvest-client',
    })

    const user = await findUserById(payload.sub)

    if (!user || user.account_status !== 'active') {
      res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS)

      return res.status(401).json({
        message: 'Your session is invalid. Please sign in again.',
      })
    }

    if (user.email_verified !== 1) {
      res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS)

      return res.status(403).json({
        message: 'Please verify your email address before continuing.',
        emailVerificationRequired: true,
      })
    }

    req.user = user
    next()
  } catch (error) {
    if (
      error.name === 'JsonWebTokenError' ||
      error.name === 'TokenExpiredError' ||
      error.name === 'NotBeforeError'
    ) {
      res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS)

      return res.status(401).json({
        message: 'Your session has expired. Please sign in again.',
      })
    }

    next(error)
  }
}


// =========================================
// EMAIL VERIFICATION
// =========================================

function hashVerificationCode(userId, code) {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(`${userId}:${code}`)
    .digest('hex')
}

let resendClientPromise

async function sendVerificationEmail(user) {
  if (!resendClientPromise) {
    resendClientPromise = import('resend')
      .then(({ Resend }) => new Resend(process.env.RESEND_API_KEY))
  }

  const resend = await resendClientPromise

  const code = crypto.randomInt(100000, 1000000).toString()
  const codeHash = hashVerificationCode(user.id, code)
  const now = Date.now()
  const expiresAt = now + 10 * 60 * 1000

  const safeName = String(user.full_name)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

  const client = await db.connect()

  try {
    await client.query('BEGIN')

    const emailResult = await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: user.email,
      subject: 'Your NEXTVEST verification code',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
          <h2>Verify your NEXTVEST account</h2>
          <p>Hello ${safeName},</p>
          <p>Your six-digit verification code is:</p>
          <p style="font-size:30px;font-weight:bold;letter-spacing:8px">${code}</p>
          <p>This code expires in 10 minutes.</p>
          <p>If you did not create this account, you can ignore this email.</p>
        </div>
      `,
    })

    if (emailResult?.error) {
      throw new Error(
        `Verification email delivery failed: ${emailResult.error.message || 'Resend rejected the request.'}`
      )
    }

    await client.query(
      `DELETE FROM email_verification_tokens
       WHERE user_id = $1 AND used_at IS NULL`,
      [user.id]
    )

    await client.query(
      `INSERT INTO email_verification_tokens
         (user_id, token_hash, expires_at, used_at, created_at)
       VALUES ($1, $2, $3, NULL, $4)`,
      [user.id, codeHash, expiresAt, now]
    )

    await client.query('COMMIT')

    return { success: true }
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {}

    console.error('NEXTVEST verification email failed:', error.message)

    throw error
  } finally {
    client.release()
  }
}



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

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    application: 'NEXTVEST API',
    message: 'PostgreSQL backend is running.',
  })
})

app.get('/api/health/database', async (req, res, next) => {
  try {
    await db.query('SELECT 1')

    res.json({
      status: 'ok',
      database: 'PostgreSQL',
    })
  } catch (error) {
    next(error)
  }
})


// =========================================
// VERIFY EMAIL
// =========================================

app.post('/api/auth/verify-email', async (req, res, next) => {
  const client = await db.connect()

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
    const user = await findUserByEmail(cleanEmail)

    if (!user || user.email_verified === 1) {
      return res.status(400).json({
        message: 'This verification code is invalid or has expired. Request a new code.',
        canResendVerification: true,
      })
    }

    const codeHash = hashVerificationCode(user.id, code)
    const now = Date.now()

    await client.query('BEGIN')

    const verificationResult = await client.query(
      `UPDATE email_verification_tokens
       SET used_at = $1
       WHERE user_id = $2
         AND token_hash = $3
         AND used_at IS NULL
         AND expires_at > $1
       RETURNING id`,
      [now, user.id, codeHash]
    )

    if (verificationResult.rowCount !== 1) {
      await client.query('ROLLBACK')

      return res.status(400).json({
        message: 'This verification code is invalid or has expired. Request a new code.',
        canResendVerification: true,
      })
    }

    const updatedUser = await client.query(
      `UPDATE users
       SET email_verified = 1
       WHERE id = $1 AND email_verified = 0
       RETURNING id`,
      [user.id]
    )

    if (updatedUser.rowCount !== 1) {
      await client.query('ROLLBACK')

      return res.status(400).json({
        message: 'This verification code is invalid or has expired. Request a new code.',
        canResendVerification: true,
      })
    }

    await client.query('COMMIT')

    return res.json({
      message: 'Your email address has been verified successfully. You can now sign in.',
      emailVerified: true,
    })
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {}

    next(error)
  } finally {
    client.release()
  }
})

app.post('/api/auth/resend-verification', async (req, res, next) => {
  try {
    const { email } = req.body || {}

    if (
      typeof email !== 'string' ||
      email.trim().length === 0 ||
      email.trim().length > 254
    ) {
      return res.status(400).json({
        message: 'Please enter a valid email address.',
      })
    }

    const cleanEmail = email.trim().toLowerCase()
    const user = await findUserByEmail(cleanEmail)

    // Use the same response for missing and already-verified accounts.
    if (!user || user.email_verified === 1) {
      return res.json({
        message:
          'If your account requires verification, a verification email will be sent.',
      })
    }

    await sendVerificationEmail(user)

    return res.json({
      message:
        'If your account requires verification, a verification email will be sent.',
    })
  } catch (error) {
    console.error(
      'Verification resend failed:',
      error.message
    )

    if (error.message.startsWith('Verification email delivery failed:')) {
      return res.status(503).json({
        message:
          'We could not send your verification email. Please try again later.',
      })
    }

    return next(error)
  }
})


// =========================================
// LOGIN
// =========================================

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {}

    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      email.trim().length > 254 ||
      password.length === 0
    ) {
      return res.status(400).json({
        message: 'Please enter your email and password.',
      })
    }

    const cleanEmail = email.trim().toLowerCase()
    const user = await findUserByEmail(cleanEmail)

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
        message: 'Please verify your email address before signing in.',
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

// =========================================
// ADMIN LOGIN (dedicated; standard user login remains unchanged)
// =========================================
app.post('/api/admin/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {}
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return res.status(400).json({ success: false, message: 'Enter your administrator email and password.' })
    }

    const user = await findUserByEmail(email.trim().toLowerCase())
    // Use the same response for wrong credentials and non-admin accounts.
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ success: false, message: 'Invalid administrator email or password.' })
    }
    if (user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'This account does not have administrator access.' })
    }
    if (user.account_status !== 'active') {
      return res.status(403).json({ success: false, message: 'This administrator account is not active.' })
    }
    if (user.email_verified !== 1) {
      return res.status(403).json({ success: false, message: 'Verify this email address before signing in.', emailVerificationRequired: true })
    }

    setAuthCookie(res, user)
    return res.json({ success: true, message: 'Administrator authenticated.', user: publicUser(user) })
  } catch (error) {
    return next(error)
  }
})

// =========================================
// CURRENT USER
// =========================================

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({
    user: publicUser(req.user),
  })
})

// =========================================
// LOGOUT
// =========================================

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS)

  res.json({
    message: 'You have been signed out.',
  })
})

// =========================================
// PAYSTACK DEPOSITS
// =========================================

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

      await db.query(
        `INSERT INTO paystack_payments
          (user_id, reference, amount_kobo, status)
         VALUES ($1, $2, $3, 'pending')`,
        [req.user.id, reference, amountKobo]
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
            callback_url:
              process.env.PAYSTACK_CALLBACK_URL ||
              `${process.env.CLIENT_URL}/payment/callback`,
            metadata: {
              userId: String(req.user.id),
              purpose: 'NEXTVEST wallet deposit',
            },
          }),
        })
      } catch (error) {
        await db.query(
          `UPDATE paystack_payments
           SET status = 'failed',
               updated_at = TO_CHAR(
                 CURRENT_TIMESTAMP AT TIME ZONE 'UTC',
                 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
               )
           WHERE reference = $1 AND status = 'pending'`,
          [reference]
        )

        throw error
      }

      if (
        !payment.authorization_url ||
        payment.reference !== reference
      ) {
        await db.query(
          `UPDATE paystack_payments
           SET status = 'failed',
               updated_at = TO_CHAR(
                 CURRENT_TIMESTAMP AT TIME ZONE 'UTC',
                 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
               )
           WHERE reference = $1 AND status = 'pending'`,
          [reference]
        )

        return res.status(502).json({
          message: 'Paystack did not return a valid checkout session.',
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

app.post(
  '/api/payments/paystack/verify',
  requireAuth,
  async (req, res, next) => {
    const client = await db.connect()

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

      const paymentResult = await db.query(
        `SELECT id, user_id, reference, amount_kobo, status
         FROM paystack_payments
         WHERE reference = $1
         LIMIT 1`,
        [reference]
      )

      const paymentRecord = paymentResult.rows[0]

      if (
        !paymentRecord ||
        Number(paymentRecord.user_id) !== Number(req.user.id)
      ) {
        return res.status(404).json({
          message: 'This payment could not be found for your account.',
        })
      }

      if (paymentRecord.status === 'completed') {
        const walletResult = await db.query(
          `SELECT balance_kobo, currency
           FROM wallets
           WHERE user_id = $1`,
          [req.user.id]
        )

        const wallet = walletResult.rows[0]

        return res.json({
          message: 'This payment has already been added to your wallet.',
          verified: true,
          alreadyCredited: true,
          reference,
          wallet: {
            balance: Number(wallet?.balance_kobo || 0) / 100,
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

      const paidEmail = String(
        verifiedPayment.customer?.email || ''
      ).trim().toLowerCase()

      const expectedEmail = String(
        req.user.email || ''
      ).trim().toLowerCase()

      if (
        verifiedPayment.status !== 'success' ||
        verifiedPayment.reference !== reference ||
        Number(verifiedPayment.amount) !== Number(paymentRecord.amount_kobo) ||
        verifiedPayment.currency !== 'NGN' ||
        paidEmail !== expectedEmail
      ) {
        return res.status(400).json({
          message: 'Paystack has not confirmed this deposit. Your wallet has not been credited.',
          verified: false,
        })
      }

      await client.query('BEGIN')

      const lockedResult = await client.query(
        `SELECT id, user_id, reference, amount_kobo, status
         FROM paystack_payments
         WHERE reference = $1
         FOR UPDATE`,
        [reference]
      )

      const lockedPayment = lockedResult.rows[0]

      if (
        !lockedPayment ||
        Number(lockedPayment.user_id) !== Number(req.user.id)
      ) {
        const error = new Error('Payment record could not be found.')
        error.statusCode = 404
        throw error
      }

      if (lockedPayment.status === 'completed') {
        await client.query('COMMIT')

        const walletResult = await db.query(
          `SELECT balance_kobo, currency
           FROM wallets
           WHERE user_id = $1`,
          [req.user.id]
        )

        const wallet = walletResult.rows[0]

        return res.json({
          message: 'This payment has already been added to your wallet.',
          verified: true,
          alreadyCredited: true,
          reference,
          wallet: {
            balance: Number(wallet?.balance_kobo || 0) / 100,
            currency: wallet?.currency || 'NGN',
          },
        })
      }

      if (
        lockedPayment.status !== 'pending' ||
        Number(lockedPayment.amount_kobo) !== Number(verifiedPayment.amount)
      ) {
        const error = new Error('This payment is no longer eligible for crediting.')
        error.statusCode = 409
        throw error
      }

      /*
       * The transaction engine manages its own database transaction.
       * Its unique transaction reference prevents a second wallet credit.
       */
      const result = await walletTransactionEngine.postTransactionWithClient(
  client,
  {
    userId: Number(req.user.id),
    reference,
    type: 'deposit',
    direction: 'credit',
    amountKobo: Number(lockedPayment.amount_kobo),
    description: 'Paystack wallet deposit',
  }
)

const updateResult = await client.query(
  `UPDATE paystack_payments
   SET status = 'completed',
       updated_at = TO_CHAR(
         CURRENT_TIMESTAMP AT TIME ZONE 'UTC',
         'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
       )
   WHERE reference = $1
     AND user_id = $2
     AND status = 'pending'`,
  [reference, req.user.id]
)

if (updateResult.rowCount !== 1) {
  const error = new Error('Payment status could not be updated safely.')
  error.statusCode = 409
  throw error
}

await client.query('COMMIT')

      const walletResult = await db.query(
        `SELECT balance_kobo, currency
         FROM wallets
         WHERE user_id = $1`,
        [req.user.id]
      )

      const wallet = walletResult.rows[0]

      return res.json({
        message: result.duplicate
          ? 'This payment has already been added to your wallet.'
          : 'Payment verified successfully. Your wallet has been credited.',
        verified: true,
        alreadyCredited: result.duplicate,
        reference,
        amount: Number(lockedPayment.amount_kobo) / 100,
        wallet: {
          balance: Number(wallet?.balance_kobo || 0) / 100,
          currency: wallet?.currency || 'NGN',
        },
      })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      next(error)
    } finally {
      client.release()
    }
  }
)

// =========================================
// REGISTER
// =========================================

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

    if (cleanName.length < 2 || cleanName.length > 100) {
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

    const existingUser = await findUserByEmail(cleanEmail)

    if (existingUser) {
      return res.status(409).json({
        message:
          'An account with this email may already exist. Try signing in or requesting verification.',
      })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    let user

    try {
      const result = await db.query(
        `INSERT INTO users
           (full_name, email, password_hash, role,
            account_status, email_verified, created_at)
         VALUES ($1, $2, $3, 'user', 'active', 0, $4)
         RETURNING id, full_name, email, password_hash, role,
                   account_status, email_verified, created_at`,
        [cleanName, cleanEmail, passwordHash, new Date().toISOString()]
      )

      user = result.rows[0]
    } catch (error) {
      if (error.code === '23505') {
        return res.status(409).json({
          message: 'An account with this email may already exist.',
        })
      }

      throw error
    }

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


app.use((err, req, res, next) => {
  console.error('NEXTVEST API error:', err.message)

  if (res.headersSent) {
    return next(err)
  }

  res.status(err.statusCode || 500).json({
    message: err.statusCode
      ? err.message
      : 'An unexpected server error occurred.',
  })
})

// ==========================================
// NEXTVEST WALLET API
// ==========================================

app.get('/api/wallet', requireAuth, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT balance_kobo, currency
       FROM wallets
       WHERE user_id = $1
       LIMIT 1`,
      [req.user.id]
    )

    const wallet = result.rows[0]

    return res.json({
      wallet: {
        balance: Number(wallet?.balance_kobo || 0) / 100,
        currency: wallet?.currency || 'NGN',
      },
    })
  } catch (error) {
    next(error)
  }
})

// ==========================================
// NEXTVEST TRANSACTION HISTORY API
// ==========================================

app.get('/api/transactions', requireAuth, async (req, res, next) => {
  try {
    const requestedLimit = Number.parseInt(req.query.limit, 10)
    const limit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 100)
      : 10

    const result = await db.query(
      `SELECT
         id,
         reference,
         type,
         direction,
         amount_kobo,
         status,
         description,
         created_at
       FROM transactions
       WHERE user_id = $1
       ORDER BY id DESC
       LIMIT $2`,
      [req.user.id, limit]
    )

    const transactions = result.rows.map((transaction) => ({
      id: transaction.id,
      reference: transaction.reference,
      type: transaction.type,
      direction: transaction.direction,
      amount: Number(transaction.amount_kobo) / 100,
      status: transaction.status,
      description: transaction.description,
      created_at: transaction.created_at,
    }))

    return res.json({ transactions })
  } catch (error) {
    next(error)
  }
})

// ==========================================
// NEXTVEST INVESTMENT PLANS API
// ==========================================

app.get('/api/investment-plans', requireAuth, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT
        id,
        name,
        minimum_amount_kobo,
        maximum_amount_kobo,
        duration_days,
        return_rate,
        is_active
      FROM investment_plans
      WHERE is_active = TRUE
      ORDER BY id ASC
    `)

    const plans = result.rows.map((plan) => ({
      id: plan.id,
      name: plan.name,
      minimumInvestment:
        Number(plan.minimum_amount_kobo) / 100,
      maximumInvestment:
        Number(plan.maximum_amount_kobo) / 100,
      durationDays: Number(plan.duration_days),
      returnRate: Number(plan.return_rate),
      currency: 'NGN',
    }))

    return res.json({
      success: true,
      plans,
    })
  } catch (error) {
    next(error)
  }
})

// ============================================
// NEXTVEST: GET USER INVESTMENTS
// ============================================

app.get('/api/investments', requireAuth, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT
          i.id,
          i.reference,
          i.amount_kobo,
          i.return_rate,
          i.expected_return_kobo,
          i.status,
          i.start_at,
          i.maturity_at,
          p.name AS plan_name,
          p.duration_days
       FROM investments i
       JOIN investment_plans p ON p.id = i.plan_id
       WHERE i.user_id = $1
       ORDER BY i.created_at DESC`,
      [req.user.id]
    )

    const investments = result.rows.map((row) => ({
      id: row.id,
      reference: row.reference,
      planName: row.plan_name,
      amount: Number(row.amount_kobo) / 100,
      returnRate: Number(row.return_rate),
      expectedReturn: Number(row.expected_return_kobo) / 100,
      projectedTotal:
        (Number(row.amount_kobo) +
          Number(row.expected_return_kobo)) / 100,
      status: row.status,
      durationDays: Number(row.duration_days),
      startAt: row.start_at,
      maturityAt: row.maturity_at,
      ...(() => {
        const startMs = new Date(row.start_at).getTime()
        const maturityMs = new Date(row.maturity_at).getTime()
        const nowMs = Date.now()
        const totalMs = Math.max(1, maturityMs - startMs)
        const elapsedMs = Math.min(totalMs, Math.max(0, nowMs - startMs))
        const progressPercent = Math.min(100, Math.max(0, elapsedMs / totalMs * 100))
        const expectedReturn = Number(row.expected_return_kobo) / 100
        const accruedReturn = progressPercent >= 100 ? expectedReturn : expectedReturn * progressPercent / 100
        return {
          progressPercent,
          elapsedDays: Math.min(Number(row.duration_days), Math.floor(elapsedMs / 86400000)),
          accruedReturn,
          estimatedCurrentValue: Number(row.amount_kobo) / 100 + accruedReturn,
        }
      })(),
      canWithdraw:
        ['active', 'matured'].includes(row.status) &&
        new Date(row.maturity_at).getTime() <= Date.now(),
    }))

    return res.json({ success: true, investments })
  } catch (error) {
    next(error)
  }
})


// ============================================
// NEXTVEST: CREATE INVESTMENT
// ============================================

app.post('/api/investments', requireAuth, async (req, res, next) => {
  const client = await db.connect()

  try {
    const { planId, amount } = req.body

    const numericAmount = Number(amount)

    if (
      !Number.isSafeInteger(numericAmount) ||
      numericAmount < 5000
    ) {
      return res.status(400).json({
        success: false,
        message: 'The minimum investment is ₦5,000.',
      })
    }

    const amountKobo = numericAmount * 100

    if (!Number.isSafeInteger(amountKobo)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid investment amount.',
      })
    }

    await client.query('BEGIN')

    const planResult = await client.query(
      `SELECT id, name, minimum_amount_kobo,
              maximum_amount_kobo, duration_days, return_rate
       FROM investment_plans
       WHERE id = $1 AND is_active = TRUE`,
      [planId]
    )

    if (planResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(400).json({
        success: false,
        message: 'The selected investment plan is unavailable.',
      })
    }

    const plan = planResult.rows[0]

    if (
      amountKobo < Number(plan.minimum_amount_kobo) ||
      amountKobo > Number(plan.maximum_amount_kobo)
    ) {
      await client.query('ROLLBACK')
      return res.status(400).json({
        success: false,
        message: 'The amount is outside this plan’s investment limits.',
      })
    }

    const walletResult = await client.query(
      `SELECT balance_kobo
       FROM wallets
       WHERE user_id = $1
       FOR UPDATE`,
      [req.user.id]
    )

    if (
      walletResult.rows.length === 0 ||
      Number(walletResult.rows[0].balance_kobo) < amountKobo
    ) {
      await client.query('ROLLBACK')
      return res.status(400).json({
        success: false,
        message: 'Insufficient wallet balance.',
      })
    }

    const reference = walletTransactionEngine.createReference('NVINV')

    const durationDays = Number(plan.duration_days)
    const startDate = new Date()
    const maturityDate = new Date(
      startDate.getTime() + durationDays * 24 * 60 * 60 * 1000
    )

    // Rates remain at the plan's configured value.
    // No earnings are assumed or guaranteed by this route.
    const returnRate = Number(plan.return_rate)
    const expectedReturnKobo = Math.round(
      amountKobo * returnRate / 100
    )

    const transaction = await walletTransactionEngine.postTransactionWithClient(
      client,
      {
        userId: Number(req.user.id),
        reference,
        type: 'investment',
        direction: 'debit',
        amountKobo,
        description: `${plan.name} investment`,
      }
    )

    const investmentResult = await client.query(
      `INSERT INTO investments (
          user_id,
          plan_id,
          reference,
          amount_kobo,
          return_rate,
          expected_return_kobo,
          status,
          start_at,
          maturity_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8)
       RETURNING id, reference, amount_kobo, status, start_at, maturity_at`,
      [
        req.user.id,
        plan.id,
        reference,
        amountKobo,
        returnRate,
        expectedReturnKobo,
        startDate.toISOString(),
        maturityDate.toISOString(),
      ]
    )

    await client.query('COMMIT')

    return res.status(201).json({
      success: true,
      message: 'Investment created successfully.',
      investment: {
        ...investmentResult.rows[0],
        planName: plan.name,
        amount: amountKobo / 100,
        expectedReturn: expectedReturnKobo / 100,
        projectedTotal: (amountKobo + expectedReturnKobo) / 100,
        durationDays,
      },
      walletBalance: Number(transaction.balanceKobo) / 100,
    })
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {}

    if (error.message === 'Insufficient wallet balance') {
      return res.status(400).json({
        success: false,
        message: 'Insufficient wallet balance.',
      })
    }

    return next(error)
  } finally {
    client.release()
  }
})

// ==========================================
// NEXTVEST: GET USER INVESTMENTS
// ==========================================

app.get('/api/investments', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
          i.id,
          i.reference,
          i.plan_id,
          p.name AS plan_name,
          i.amount_kobo,
          i.return_rate,
          i.expected_return_kobo,
          i.status,
          i.start_at,
          i.maturity_at,
          CASE
            WHEN i.maturity_at <= CURRENT_TIMESTAMP::text
              AND i.status IN ('active', 'matured')
            THEN TRUE
            ELSE FALSE
          END AS can_withdraw
       FROM investments i
       JOIN investment_plans p ON p.id = i.plan_id
       WHERE i.user_id = $1
       ORDER BY i.created_at DESC`,
      [req.user.id]
    );

    const investments = result.rows.map((item) => ({
      id: item.id,
      reference: item.reference,
      planId: item.plan_id,
      planName: item.plan_name,
      amount: Number(item.amount_kobo) / 100,
      returnRate: Number(item.return_rate),
      expectedReturn: Number(item.expected_return_kobo) / 100,
      status: item.status,
      startAt: item.start_at,
      maturityAt: item.maturity_at,
      canWithdraw: item.can_withdraw,
    }));

    return res.json({
      success: true,
      investments,
    });
  } catch (error) {
    console.error('Get investments error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to load your investments.',
    });
  }
});


// ==========================================
// NEXTVEST: CREATE AN INVESTMENT
// ==========================================

app.post('/api/investments', requireAuth, async (req, res) => {
  let client;

  try {
    const planId = Number(req.body.planId);
    const amount = Number(req.body.amount);

    if (
      !Number.isSafeInteger(planId) ||
      planId <= 0 ||
      !Number.isSafeInteger(amount) ||
      amount < 5000
    ) {
      return res.status(400).json({
        success: false,
        message: 'Select a valid plan and enter an amount of at least ₦5,000.',
      });
    }

    const amountKobo = amount * 100;

    if (!Number.isSafeInteger(amountKobo)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid investment amount.',
      });
    }

    client = await db.connect();

    await client.query('BEGIN');

    // Load and validate the selected plan.
    const planResult = await client.query(
      `SELECT id, name, minimum_amount_kobo,
              maximum_amount_kobo, duration_days, return_rate
       FROM investment_plans
       WHERE id = $1 AND is_active = TRUE
       FOR SHARE`,
      [planId]
    );

    if (planResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Investment plan not found or unavailable.',
      });
    }

    const plan = planResult.rows[0];
    const minimumKobo = Number(plan.minimum_amount_kobo);
    const maximumKobo = Number(plan.maximum_amount_kobo);

    if (amountKobo < minimumKobo || amountKobo > maximumKobo) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: `Investment amount must be between ₦${minimumKobo / 100} and ₦${maximumKobo / 100}.`,
      });
    }

    // Lock the wallet to prevent simultaneous spending.
    const walletResult = await client.query(
      `SELECT balance_kobo
       FROM wallets
       WHERE user_id = $1
       FOR UPDATE`,
      [req.user.id]
    );

    if (walletResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Your wallet was not found.',
      });
    }

    const balanceKobo = Number(walletResult.rows[0].balance_kobo);

    if (balanceKobo < amountKobo) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Insufficient wallet balance. Please deposit funds first.',
      });
    }

    // Calculate the maturity date.
    const startDate = new Date();
    const maturityDate = new Date(startDate);

    maturityDate.setUTCDate(
      maturityDate.getUTCDate() + Number(plan.duration_days)
    );

    const startAt = startDate.toISOString();
    const maturityAt = maturityDate.toISOString();

    // Keep the configured return rate; do not invent a guaranteed return.
    const returnRate = Number(plan.return_rate);

    const expectedReturnKobo = Math.round(
      amountKobo * (returnRate / 100)
    );

    const reference =
      walletTransactionEngine.createReference('NVINV');

    // Debit the wallet using the existing transaction engine.
    await walletTransactionEngine.postTransactionWithClient(client, {
     userId: Number(req.user.id),
      reference,
      type: 'investment',
      direction: 'debit',
      amountKobo,
      description: `${plan.name} investment`,
    });

    // Record the investment.
    const investmentResult = await client.query(
      `INSERT INTO investments (
          user_id,
          plan_id,
          reference,
          amount_kobo,
          return_rate,
          expected_return_kobo,
          status,
          start_at,
          maturity_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8)
       RETURNING id, reference, amount_kobo,
                 return_rate, expected_return_kobo,
                 status, start_at, maturity_at`,
      [
        req.user.id,
        plan.id,
        reference,
        amountKobo,
        returnRate,
        expectedReturnKobo,
        startAt,
        maturityAt,
      ]
    );

    // Read the updated wallet balance before committing.
    const updatedWallet = await client.query(
      `SELECT balance_kobo
       FROM wallets
       WHERE user_id = $1`,
      [req.user.id]
    );

    await client.query('COMMIT');

    const investment = investmentResult.rows[0];

    return res.status(201).json({
      success: true,
      message: 'Your investment was created successfully.',
      investment: {
        id: investment.id,
        reference: investment.reference,
        planId: plan.id,
        planName: plan.name,
        amount: Number(investment.amount_kobo) / 100,
        returnRate: Number(investment.return_rate),
        expectedReturn:
          Number(investment.expected_return_kobo) / 100,
        status: investment.status,
        startAt: investment.start_at,
        maturityAt: investment.maturity_at,
      },
      walletBalance:
        Number(updatedWallet.rows[0].balance_kobo) / 100,
    });
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Investment rollback error:', rollbackError.message);
      }
    }

    console.error('Create investment error:', error.message);

    if (error.message.toLowerCase().includes('insufficient wallet balance')) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient wallet balance.',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Unable to create your investment. Please try again.',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});


// ==========================================
// NEXTVEST PAYOUT REQUESTS (BANK TRANSFER VIA SUPPORT)
// Requires the payout_requests table from nextvest-payout-migration.sql.
// Marking a request paid records an externally verified transfer; it does not
// debit or credit the wallet again.
// ==========================================

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Administrator access is required.',
    })
  }
  return next()
}

function cleanText(value, maxLength = 120) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function makePayoutReference() {
  return `NVPAY_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`
}

// User submits bank details for one matured investment.
app.post('/api/payout-requests', requireAuth, async (req, res) => {
  const client = await db.connect()

  try {
    const investmentId = Number(req.body?.investmentId)
    const bankName = cleanText(req.body?.bankName, 100)
    const accountName = cleanText(req.body?.accountName, 120)
    const accountNumber = cleanText(req.body?.accountNumber, 20)

    if (!Number.isSafeInteger(investmentId) || investmentId < 1) {
      return res.status(400).json({ success: false, message: 'Select a valid matured investment.' })
    }
    if (bankName.length < 2 || accountName.length < 2 || !/^\d{10}$/.test(accountNumber)) {
      return res.status(400).json({ success: false, message: 'Enter a bank name, account name, and valid 10-digit Nigerian account number.' })
    }

    await client.query('BEGIN')

    const investmentResult = await client.query(
      `SELECT i.id, i.user_id, i.reference, i.amount_kobo,
              i.expected_return_kobo, i.status, i.maturity_at,
              p.name AS plan_name
       FROM investments i
       JOIN investment_plans p ON p.id = i.plan_id
       WHERE i.id = $1 AND i.user_id = $2
       FOR UPDATE OF i`,
      [investmentId, req.user.id]
    )

    const investment = investmentResult.rows[0]
    if (!investment) {
      await client.query('ROLLBACK')
      return res.status(404).json({ success: false, message: 'Investment not found.' })
    }

    if (!['active', 'matured'].includes(investment.status) || new Date(investment.maturity_at).getTime() > Date.now()) {
      await client.query('ROLLBACK')
      return res.status(400).json({ success: false, message: 'This investment has not matured yet.' })
    }

    const existingResult = await client.query(
      `SELECT id, reference, status
       FROM payout_requests
       WHERE investment_id = $1
       LIMIT 1`,
      [investment.id]
    )
    if (existingResult.rows.length) {
      await client.query('ROLLBACK')
      return res.status(409).json({ success: false, message: 'A payout request already exists for this investment.', payout: existingResult.rows[0] })
    }

    const amountKobo = Number(investment.amount_kobo) + Number(investment.expected_return_kobo)
    if (!Number.isSafeInteger(amountKobo) || amountKobo <= 0) {
      await client.query('ROLLBACK')
      return res.status(400).json({ success: false, message: 'The payout amount is invalid. Please contact support.' })
    }

    const payoutReference = makePayoutReference()
    const inserted = await client.query(
      `INSERT INTO payout_requests (
         user_id, investment_id, investment_reference, reference,
         amount_kobo, bank_name, account_name, account_number, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
       RETURNING id, reference, amount_kobo, bank_name, account_name,
                 account_number, status, created_at`,
      [req.user.id, investment.id, investment.reference, payoutReference,
       amountKobo, bankName, accountName, accountNumber]
    )

    await client.query('COMMIT')

    const payout = inserted.rows[0]
    const message = [
      'Hello NEXTVEST Support, I am requesting the payout for my matured investment.',
      `Account ID: ${req.user.id}`,
      `Registered Email: ${req.user.email}`,
      `Investment Plan: ${investment.plan_name}`,
      `Investment Reference: ${investment.reference}`,
      `Investment Amount: ₦${(Number(investment.amount_kobo) / 100).toLocaleString('en-NG')}`,
      `Requested Payout: ₦${(amountKobo / 100).toLocaleString('en-NG')}`,
      `Bank Name: ${bankName}`,
      `Account Name: ${accountName}`,
      `Account Number: ${accountNumber}`,
      `Payout Reference: ${payoutReference}`,
      'Status: Pending',
      'Please review and process this payout request. Thank you.'
    ].join('\n')

    return res.status(201).json({
      success: true,
      message: 'Payout request submitted. Send the prefilled message to NEXTVEST Support to continue.',
      payout: {
        id: payout.id,
        reference: payout.reference,
        investmentReference: investment.reference,
        planName: investment.plan_name,
        amount: amountKobo / 100,
        bankName,
        accountName,
        accountNumber: `******${accountNumber.slice(-4)}`,
        status: payout.status,
        createdAt: payout.created_at,
        telegramUrl: `https://t.me/nextvest_support?text=${encodeURIComponent(message)}`,
      },
    })
  } catch (error) {
    try { await client.query('ROLLBACK') } catch {}
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'A payout request already exists for this investment.' })
    }
    console.error('Create payout request error:', error.message)
    return res.status(500).json({ success: false, message: 'Unable to submit your payout request right now.' })
  } finally {
    client.release()
  }
})

// User sees the status of their own payout requests; bank account is masked.
app.get('/api/payout-requests', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, reference, investment_reference, amount_kobo,
              bank_name, account_name, RIGHT(account_number, 4) AS account_last4,
              status, created_at, paid_at
       FROM payout_requests
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    )
    return res.json({
      success: true,
      payouts: result.rows.map(row => ({
        id: row.id,
        reference: row.reference,
        investmentReference: row.investment_reference,
        amount: Number(row.amount_kobo) / 100,
        bankName: row.bank_name,
        accountName: row.account_name,
        accountNumber: `******${row.account_last4}`,
        status: row.status,
        createdAt: row.created_at,
        paidAt: row.paid_at,
      })),
    })
  } catch (error) {
    console.error('Get payout requests error:', error.message)
    return res.status(500).json({ success: false, message: 'Unable to load payout requests.' })
  }
})

// Admin-only: list payout requests. Full bank details are visible only here.
app.get('/api/admin/payout-requests', requireAuth, requireAdmin, async (req, res) => {
  try {
    const status = ['pending', 'paid'].includes(req.query.status) ? req.query.status : null
    const result = await db.query(
      `SELECT pr.id, pr.reference, pr.investment_reference, pr.amount_kobo,
              pr.bank_name, pr.account_name, pr.account_number, pr.status,
              pr.created_at, pr.paid_at, u.id AS account_id,
              u.full_name, u.email, i.plan_id, ip.name AS plan_name
       FROM payout_requests pr
       JOIN users u ON u.id = pr.user_id
       JOIN investments i ON i.id = pr.investment_id
       JOIN investment_plans ip ON ip.id = i.plan_id
       WHERE ($1::text IS NULL OR pr.status = $1)
       ORDER BY CASE WHEN pr.status = 'pending' THEN 0 ELSE 1 END,
                pr.created_at ASC
       LIMIT 200`,
      [status]
    )
    return res.json({ success: true, payouts: result.rows.map(row => ({
      id: row.id,
      reference: row.reference,
      investmentReference: row.investment_reference,
      amount: Number(row.amount_kobo) / 100,
      bankName: row.bank_name,
      accountName: row.account_name,
      accountNumber: row.account_number,
      status: row.status,
      createdAt: row.created_at,
      paidAt: row.paid_at,
      accountId: row.account_id,
      fullName: row.full_name,
      email: row.email,
      planName: row.plan_name,
    })) })
  } catch (error) {
    console.error('Admin payout list error:', error.message)
    return res.status(500).json({ success: false, message: 'Unable to load payout requests.' })
  }
})

// Admin marks a payout paid only after confirming the external bank transfer.
app.patch('/api/admin/payout-requests/:id/paid', requireAuth, requireAdmin, async (req, res) => {
  const payoutId = Number(req.params.id)
  if (!Number.isSafeInteger(payoutId) || payoutId < 1) {
    return res.status(400).json({ success: false, message: 'Invalid payout request ID.' })
  }
  try {
    const result = await db.query(
      `UPDATE payout_requests
       SET status = 'paid', paid_at = CURRENT_TIMESTAMP,
           paid_by_user_id = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'pending'
       RETURNING id, reference, status, paid_at`,
      [payoutId, req.user.id]
    )
    if (!result.rows.length) {
      return res.status(409).json({ success: false, message: 'Payout request was not found or is already processed.' })
    }
    return res.json({ success: true, message: 'Payout marked as paid. Confirm the bank transfer was completed before using this action.', payout: result.rows[0] })
  } catch (error) {
    console.error('Mark payout paid error:', error.message)
    return res.status(500).json({ success: false, message: 'Unable to update payout status.' })
  }
})

const server = app.listen(PORT, () => {
  console.log(`NEXTVEST PostgreSQL backend listening on port ${PORT}`)
})

function shutdown(signal) {
  console.log(`Received ${signal}. Shutting down PostgreSQL backend...`)

  server.close(async () => {
    try {
      await db.end()
      process.exit(0)
    } catch (error) {
      console.error('Shutdown error:', error.message)
      process.exit(1)
    }
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

console.log('PostgreSQL server startup completed.')