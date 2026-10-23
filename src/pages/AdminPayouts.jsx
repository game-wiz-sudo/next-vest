import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { ArrowLeft, RefreshCw, Search, ShieldCheck, Wallet, Clock3, CheckCircle2, AlertCircle, ExternalLink, Landmark, Mail, UserRound, CalendarDays, ArrowUpRight } from 'lucide-react'
import '../styles/AdminPayouts.css'

const API = 'http://localhost:5000'
const money = (n) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(Number(n || 0))
const date = (v) => v ? new Date(v).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

export default function AdminPayouts() {
  const [payouts, setPayouts] = useState([])
  const [filter, setFilter] = useState('pending')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [workingId, setWorkingId] = useState(null)
  const [notice, setNotice] = useState({ type: '', text: '' })
  const [unauthorized, setUnauthorized] = useState(false)

  const loadPayouts = useCallback(async () => {
    setLoading(true)
    setNotice({ type: '', text: '' })
    try {
      const res = await fetch(`${API}/api/admin/payout-requests${filter === 'all' ? '' : `?status=${filter}`}`, { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401 || res.status === 403) { setUnauthorized(true); setPayouts([]); return }
      if (!res.ok || !data.success) throw new Error(data.message || 'Unable to load payout requests.')
      setUnauthorized(false)
      setPayouts(Array.isArray(data.payouts) ? data.payouts : [])
    } catch (e) {
      setNotice({ type: 'error', text: `${e.message} Check that the backend is running and you are signed in as an admin.` })
    } finally { setLoading(false) }
  }, [filter])

  useEffect(() => { loadPayouts() }, [loadPayouts])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return payouts
    return payouts.filter(p => [p.reference, p.investmentReference, p.fullName, p.email, p.accountId, p.bankName, p.accountName, p.accountNumber, p.planName].some(v => String(v ?? '').toLowerCase().includes(q)))
  }, [payouts, search])
  const pendingCount = payouts.filter(p => p.status === 'pending').length
  const paidCount = payouts.filter(p => p.status === 'paid').length
  const pendingValue = payouts.filter(p => p.status === 'pending').reduce((s, p) => s + Number(p.amount || 0), 0)

  async function markPaid(payout) {
    const ok = window.confirm(`Confirm that ₦${Number(payout.amount).toLocaleString('en-NG')} was successfully transferred to ${payout.accountName} (${payout.bankName}, account ending ${String(payout.accountNumber).slice(-4)})?\n\nOnly continue after the real bank transfer is complete.`)
    if (!ok) return
    setWorkingId(payout.id); setNotice({ type: '', text: '' })
    try {
      const res = await fetch(`${API}/api/admin/payout-requests/${payout.id}/paid`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' } })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401 || res.status === 403) { setUnauthorized(true); throw new Error(data.message || 'Admin access required.') }
      if (!res.ok || !data.success) throw new Error(data.message || 'Could not update payout status.')
      setNotice({ type: 'success', text: `Payout ${payout.reference} marked as PAID.` })
      await loadPayouts()
    } catch (e) { setNotice({ type: 'error', text: e.message }) }
    finally { setWorkingId(null) }
  }

  if (unauthorized) return <main className="nv-admin-page"><section className="nv-admin-gate"><div className="nv-admin-mark"><ShieldCheck size={27}/></div><p className="nv-admin-eyebrow">NEXTVEST CONTROL CENTRE</p><h1>Admin access required</h1><p>Sign in with an account whose role is <b>admin</b>, then return to this page. Payout bank details are restricted to administrators.</p><Link className="nv-admin-primary" to="/login">Go to login <ArrowUpRight size={17}/></Link></section></main>

  return <main className="nv-admin-page">
    <header className="nv-admin-topbar"><Link to="/dashboard" className="nv-admin-brand"><span className="nv-admin-logo">N</span><span>NEXTVEST <small>CONTROL CENTRE</small></span></Link><div className="nv-admin-top-actions"><span className="nv-admin-secure"><ShieldCheck size={15}/> Secure admin session</span><button className="nv-admin-icon-btn" onClick={loadPayouts} disabled={loading} aria-label="Refresh"><RefreshCw size={17} className={loading ? 'nv-spin' : ''}/></button></div></header>
    <div className="nv-admin-content">
      <div className="nv-admin-breadcrumb"><Link to="/dashboard"><ArrowLeft size={15}/> Dashboard</Link><span>/</span><span>Payout management</span></div>
      <section className="nv-admin-heading"><div><p className="nv-admin-eyebrow">TREASURY · PAYOUT OPERATIONS</p><h1>Payout management<span>.</span></h1><p>Review bank details, verify transfers, and keep every payout accountable.</p></div><div className="nv-admin-live"><i/> SYSTEM LIVE <span>·</span> <ShieldCheck size={14}/> Admin only</div></section>
      {notice.text && <div className={`nv-admin-notice ${notice.type}`}><span>{notice.type === 'success' ? <CheckCircle2 size={18}/> : <AlertCircle size={18}/>}</span><p>{notice.text}</p><button onClick={() => setNotice({ type: '', text: '' })}>Dismiss</button></div>}
      <section className="nv-admin-stats">
        <article className="nv-admin-stat"><div className="nv-admin-stat-icon amber"><Clock3 size={20}/></div><span>Pending requests</span><strong>{loading ? '—' : pendingCount}</strong><small>Awaiting transfer confirmation</small></article>
        <article className="nv-admin-stat"><div className="nv-admin-stat-icon green"><CheckCircle2 size={20}/></div><span>Paid requests</span><strong>{loading ? '—' : paidCount}</strong><small>Confirmed by an administrator</small></article>
        <article className="nv-admin-stat"><div className="nv-admin-stat-icon blue"><Wallet size={20}/></div><span>Pending payout value</span><strong>{loading ? '—' : money(pendingValue)}</strong><small>Review before processing</small></article>
      </section>
      <section className="nv-admin-panel">
        <div className="nv-admin-panel-head"><div><h2>Withdrawal requests</h2><p>Up to 200 most recent requests, newest queue priority first.</p></div><button className="nv-admin-refresh" onClick={loadPayouts} disabled={loading}><RefreshCw size={15}/> Refresh</button></div>
        <div className="nv-admin-toolbar"><div className="nv-admin-tabs"><button className={filter === 'pending' ? 'active' : ''} onClick={() => setFilter('pending')}>Pending <span>{filter === 'pending' && !loading ? payouts.length : ''}</span></button><button className={filter === 'paid' ? 'active' : ''} onClick={() => setFilter('paid')}>Paid</button><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All requests</button></div><label className="nv-admin-search"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, reference…"/></label></div>
        {loading ? <div className="nv-admin-empty"><RefreshCw className="nv-spin" size={24}/><strong>Loading payout queue</strong><span>Securing the latest request details…</span></div> : visible.length === 0 ? <div className="nv-admin-empty"><div className="nv-admin-empty-icon"><CheckCircle2 size={25}/></div><strong>{search ? 'No matching requests' : 'Nothing in this queue'}</strong><span>{search ? 'Try a different name, email or reference.' : 'New payout requests will appear here when submitted.'}</span></div> : <div className="nv-admin-list">{visible.map(p => <article className="nv-payout-card" key={p.id}>
          <div className="nv-payout-card-top"><div className="nv-payout-user"><div className="nv-payout-avatar">{String(p.fullName || 'U').trim().charAt(0).toUpperCase()}</div><div><h3>{p.fullName || 'NEXTVEST user'}</h3><span>{p.email || 'No email recorded'} · Account ID {p.accountId}</span></div></div><span className={`nv-status ${p.status === 'paid' ? 'paid' : 'pending'}`}><i/>{p.status}</span></div>
          <div className="nv-payout-amount-row"><div><span>Payout amount</span><strong>{money(p.amount)}</strong></div><div className="nv-payout-ref"><span>Payout reference</span><strong>{p.reference}</strong></div><div className="nv-payout-date"><span><CalendarDays size={14}/> Requested</span><strong>{date(p.createdAt)}</strong></div></div>
          <div className="nv-payout-details"><div><Landmark size={16}/><div><span>Bank</span><strong>{p.bankName}</strong></div></div><div><UserRound size={16}/><div><span>Account name</span><strong>{p.accountName}</strong></div></div><div><Wallet size={16}/><div><span>Account number</span><strong className="nv-account-number">{p.accountNumber}</strong></div></div><div><Mail size={16}/><div><span>Investment</span><strong>{p.planName || 'Investment'} · {p.investmentReference || '—'}</strong></div></div></div>
          <div className="nv-payout-card-footer"><div className="nv-payout-footnote"><ShieldCheck size={15}/>{p.status === 'paid' ? `Paid ${date(p.paidAt)}` : 'Confirm the bank transfer before marking this request paid.'}</div>{p.status === 'pending' ? <button className="nv-mark-paid" onClick={() => markPaid(p)} disabled={workingId === p.id}>{workingId === p.id ? <RefreshCw size={16} className="nv-spin"/> : <CheckCircle2 size={16}/>} {workingId === p.id ? 'Updating…' : 'Confirm transfer & mark paid'}</button> : <span className="nv-paid-stamp"><CheckCircle2 size={16}/> Payment confirmed</span>}</div>
        </article>)}</div>}
        <div className="nv-admin-panel-foot"><span>Showing {visible.length} request{visible.length === 1 ? '' : 's'}</span><span><ShieldCheck size={14}/> Bank details are visible to authorized admins only</span></div>
      </section>
      <footer className="nv-admin-footer"><span>© {new Date().getFullYear()} NEXTVEST</span><span>Private financial operations <span className="nv-footer-dot">·</span> Built for accountability</span></footer>
    </div>
  </main>
}
