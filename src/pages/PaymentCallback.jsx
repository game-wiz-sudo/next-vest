import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

const API_BASE = 'http://localhost:5000'

function PaymentCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('checking')
  const [message, setMessage] = useState('Verifying your payment with Paystack…')

  useEffect(() => {
    let active = true

    async function verifyPayment() {
      const reference = searchParams.get('reference') || searchParams.get('trxref')

      if (!reference) {
        setStatus('error')
        setMessage('No payment reference was provided. Your wallet has not been credited.')
        return
      }

      try {
        const response = await fetch(`${API_BASE}/api/payments/paystack/verify`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reference }),
        })

        const data = await response.json().catch(() => ({}))

        if (!response.ok || data.verified !== true) {
          throw new Error(data.message || 'We could not verify this payment. Your wallet has not been credited.')
        }

        if (active) {
          setStatus('success')
          setMessage(data.message || 'Payment verified successfully. Your wallet has been credited.')
        }
      } catch (error) {
        if (active) {
          setStatus('error')
          setMessage(error.message || 'Unable to verify the payment. Please check your transactions before trying again.')
        }
      }
    }

    verifyPayment()

    return () => {
      active = false
    }
  }, [searchParams])

  const isChecking = status === 'checking'
  const isSuccess = status === 'success'

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px', background: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <section style={{ width: 'min(100%, 460px)', padding: '32px', border: '1px solid #e2e8f0', borderRadius: '22px', background: '#fff', boxShadow: '0 20px 60px rgba(15, 23, 42, 0.08)', textAlign: 'center' }}>
        <div style={{ width: '58px', height: '58px', display: 'grid', placeItems: 'center', margin: '0 auto 20px', borderRadius: '18px', background: isChecking ? '#eff6ff' : isSuccess ? '#dcfce7' : '#fef2f2', color: isChecking ? '#2563eb' : isSuccess ? '#047857' : '#b91c1c', fontSize: '28px', fontWeight: 800 }}>
          {isChecking ? '…' : isSuccess ? '✓' : '!' }
        </div>
        <p style={{ margin: '0 0 8px', color: '#059669', fontSize: '12px', fontWeight: 800, letterSpacing: '1.4px' }}>NEXTVEST</p>
        <h1 style={{ margin: '0 0 12px', color: '#0f172a', fontSize: '25px' }}>
          {isChecking ? 'Checking payment' : isSuccess ? 'Payment confirmed' : 'Payment not confirmed'}
        </h1>
        <p role="status" style={{ margin: 0, color: '#64748b', fontSize: '14px', lineHeight: 1.7 }}>{message}</p>
        {isChecking ? (
          <p style={{ margin: '22px 0 0', color: '#64748b', fontSize: '12px' }}>Please keep this page open while we check with the payment provider.</p>
        ) : (
          <button type="button" onClick={() => navigate('/dashboard', { replace: true })} style={{ width: '100%', marginTop: '24px', padding: '14px 18px', border: 0, borderRadius: '12px', background: '#059669', color: '#fff', fontWeight: 750, fontSize: '14px', cursor: 'pointer' }}>
            Return to dashboard
          </button>
        )}
        {!isChecking && !isSuccess && <p style={{ margin: '16px 0 0', color: '#64748b', fontSize: '12px' }}>If you completed payment, check your transactions or contact support before trying another deposit.</p>}
        <div style={{ marginTop: '18px' }}><Link to="/dashboard" style={{ color: '#047857', fontSize: '13px', fontWeight: 650, textDecoration: 'none' }}>Go to dashboard</Link></div>
      </section>
    </main>
  )
}

export default PaymentCallback
