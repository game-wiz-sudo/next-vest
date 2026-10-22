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
  ShieldCheck,
} from 'lucide-react'

import '../styles/Auth.css'

function Login() {
  const navigate = useNavigate()

  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()

    setError('')
    setIsSubmitting(true)

    try {
      const response = await fetch(
        'http://localhost:5000/api/auth/login',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            password,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        setError(
          data.message ||
          data.error ||
          'Login failed. Please check your details and try again.'
        )
        return
      }

      navigate('/dashboard')
    } catch (error) {
      setError(
        'Unable to connect to NEXTVEST. Please ensure the backend server is running.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-background-glow" />

      <div className="auth-container">
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
            <span className="auth-kicker">WELCOME BACK</span>

            <h1>Good to see you.</h1>

            <p>
              Sign in to access your account and manage your investment
              activity.
            </p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="login-email">Email address</label>

              <div className="auth-input-wrap">
                <Mail size={18} />

                <input
                  id="login-email"
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
              <div className="auth-label-row">
                <label htmlFor="login-password">Password</label>

                <button
                  type="button"
                  className="auth-text-button"
                  onClick={() =>
                    navigate('/forgot-password')
                  }
                >
                  Forgot password?
                </button>
              </div>

              <div className="auth-input-wrap">
                <LockKeyhole size={18} />

                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
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
            </div>

            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="auth-submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}

              {!isSubmitting && <ArrowRight size={18} />}
            </button>
          </form>

          <div className="auth-security">
            <ShieldCheck size={17} />

            <span>
              Your account security matters. Never share your password.
            </span>
          </div>

          <div className="auth-switch">
            Don't have an account?

            <Link to="/register">Create one</Link>
          </div>
        </div>

        <p className="auth-footer">
          © {new Date().getFullYear()} NEXTVEST. All rights reserved.
        </p>
      </div>
    </main>
  )
}

export default Login