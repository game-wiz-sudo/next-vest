import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  TrendingUp,
  UserRound,
  ShieldCheck,
} from 'lucide-react'

import '../styles/Auth.css'

function Register() {
  const navigate = useNavigate()

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()

    setError('')
    setSuccess('')

    if (fullName.trim().length < 2) {
      setError('Please enter your full name.')
      return
    }

    if (password.length < 12) {
      setError('Your password must contain at least 12 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Your passwords do not match.')
      return
    }

    if (!acceptedTerms) {
      setError('Please accept the terms to continue.')
      return
    }

    setIsSubmitting(true)

    try {
      const registeredEmail = email.trim().toLowerCase()

      const response = await fetch(
        `${API_BASE_URL}/api/auth/register`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fullName: fullName.trim(),
            email: registeredEmail,
            password,
            confirmPassword,
            acceptedTerms,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        setError(
          data.message ||
          data.error ||
          'Registration failed. Please try again.'
        )
        return
      }

      setSuccess(
        data.message ||
        'Your account has been created. Check your email for your verification code.'
      )

      setFullName('')
      setEmail('')
      setPassword('')
      setConfirmPassword('')
      setAcceptedTerms(false)

      setSuccess(
  data.message || 'Your NEXTVEST account has been created successfully.'
)

setFullName('')
setEmail('')
setPassword('')
setConfirmPassword('')
setAcceptedTerms(false)

navigate('/login', {
  state: {
    message: 'Your account has been created successfully. Please sign in.',
  },
})
    } catch (error) {
      setError(
        'Unable to connect to NEXTVEST. Please make sure the backend server is running and try again.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-background-glow" />

      <div className="auth-container auth-container-register">
        <Link to="/" className="auth-back">
          <ArrowLeft size={17} />
          Back to homepage
        </Link>

        <div className="auth-card">
          <Link to="/" className="auth-brand">
            <span className="auth-brand-icon">
              <TrendingUp size={23} />
            </span>

            <span>
              NEXT<span>VEST</span>
            </span>
          </Link>

          <div className="auth-heading">
            <span className="auth-kicker">GET STARTED</span>

            <h1>Create your account.</h1>

            <p>
              Set up your account to begin exploring the NEXTVEST platform.
            </p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="register-name">Full name</label>

              <div className="auth-input-wrap">
                <UserRound size={18} />

                <input
                  id="register-name"
                  type="text"
                  placeholder="Enter your full name"
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="register-email">Email address</label>

              <div className="auth-input-wrap">
                <Mail size={18} />

                <input
                  id="register-email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="register-password">Create password</label>

              <div className="auth-input-wrap">
                <LockKeyhole size={18} />

                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="At least 12 characters"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={12}
                  required
                />

                <button
                  type="button"
                  className="auth-eye-button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={
                    showPassword ? 'Hide password' : 'Show password'
                  }
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>

              <span className="auth-field-hint">
                Use at least 12 characters. Avoid passwords you've used
                elsewhere.
              </span>
            </div>

            <div className="auth-field">
              <label htmlFor="confirm-password">Confirm password</label>

              <div className="auth-input-wrap">
                <LockKeyhole size={18} />

                <input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Enter your password again"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  required
                />

                <button
                  type="button"
                  className="auth-eye-button"
                  onClick={() =>
                    setShowConfirmPassword(!showConfirmPassword)
                  }
                  aria-label={
                    showConfirmPassword ? 'Hide password' : 'Show password'
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            <label className="auth-terms">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) =>
                  setAcceptedTerms(event.target.checked)
                }
              />

              <span>
                I have read and agree to the platform's terms and privacy
                policy.
              </span>
            </label>

            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}

            {success && (
              <div className="auth-success" role="status">
                {success}
              </div>
            )}

            <button
              type="submit"
              className="auth-submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating account...' : 'Create account'}

              {!isSubmitting && <ArrowRight size={18} />}
            </button>
          </form>

          <div className="auth-security">
            <ShieldCheck size={17} />

            <span>
              Your password is securely hashed before it is stored.
            </span>
          </div>

          <div className="auth-switch">
            Already have an account?

            <Link to="/login">Sign in</Link>
          </div>
        </div>

        <p className="auth-footer">
          © {new Date().getFullYear()} NEXTVEST. All rights reserved.
        </p>
      </div>
    </main>
  )
}

export default Register
