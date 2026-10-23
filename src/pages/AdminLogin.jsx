import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/AdminLogin.css'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to sign in.')
      navigate('/admin/payouts', { replace: true })
    } catch (err) {
      setError(err.message || 'Connection failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="nv-admin-login">
      <div className="nv-admin-glow nv-admin-glow-one" />
      <div className="nv-admin-glow nv-admin-glow-two" />
      <section className="nv-admin-login-card">
        <a className="nv-admin-brand" href="/" aria-label="NEXTVEST home"><span className="nv-admin-brand-mark">N</span><span>NEXT<span>VEST</span></span></a>
        <div className="nv-admin-eyebrow"><span className="nv-admin-live-dot" /> SECURE ADMIN PORTAL</div>
        <h1>Welcome back.</h1>
        <p className="nv-admin-subtitle">Sign in to manage payouts and oversee the NEXTVEST platform.</p>
        {error && <div className="nv-admin-error" role="alert">{error}</div>}
        <form onSubmit={handleSubmit}>
          <label htmlFor="admin-email">Administrator email</label>
          <input id="admin-email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@example.com" required maxLength={254} />
          <label htmlFor="admin-password">Password</label>
          <div className="nv-admin-password-wrap">
            <input id="admin-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required />
            <button type="button" className="nv-admin-show" onClick={() => setShowPassword(v => !v)}>{showPassword ? 'Hide' : 'Show'}</button>
          </div>
          <button className="nv-admin-submit" type="submit" disabled={busy}>{busy ? 'Verifying access…' : 'Access control centre'} <span aria-hidden="true">→</span></button>
        </form>
        <div className="nv-admin-security"><span>⌑</span><div><strong>Protected access</strong><small>Only active accounts with the admin role can enter.</small></div></div>
        <a className="nv-admin-back" href="/">← Back to NEXTVEST</a>
      </section>
      <footer className="nv-admin-footer">NEXTVEST CONTROL CENTRE <span>•</span> AUTHORIZED PERSONNEL ONLY</footer>
    </main>
  )
}
