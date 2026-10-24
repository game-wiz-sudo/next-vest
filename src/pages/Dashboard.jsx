import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '')

if (!API_BASE_URL) {
  console.error('VITE_API_URL is missing from your environment variables.')
}

import {
  LayoutDashboard,
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Clock3,
  CheckCircle2,
  CircleDollarSign,
  Bell,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Plus,
  Search,
  Settings,
  Headphones,
  ShieldCheck,
  CalendarDays,
  Activity,
  LogOut,
  MoreHorizontal,
  Eye,
  EyeOff,
  Landmark,
  CircleHelp,
} from 'lucide-react'

import '../styles/Dashboard.css'

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 2,
  }).format(amount)


// Linear estimate for display only; final amounts remain governed by the
// investment's stored return rate and maturity timestamp.
const getInvestmentProgress = (investment, now = Date.now()) => {
  const start = new Date(investment.startAt).getTime()
  const maturity = new Date(investment.maturityAt).getTime()
  const totalMs = Math.max(1, maturity - start)
  const elapsedMs = Math.min(totalMs, Math.max(0, now - start))
  const progress = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100))
  const elapsedDays = Math.min(
    Number(investment.durationDays || Math.ceil(totalMs / 86400000)),
    Math.floor(elapsedMs / 86400000)
  )
  const expectedReturn = Number(investment.expectedReturn || 0)
  const accruedReturn = progress >= 100 ? expectedReturn : expectedReturn * progress / 100
  return {
    progressPercent: progress,
    elapsedDays,
    accruedReturn,
    estimatedCurrentValue: Number(investment.amount || 0) + accruedReturn,
  }
}

function Dashboard() {
  const navigate = useNavigate()

  const [currentUser, setCurrentUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [wallet, setWallet] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [investments, setInvestments] = useState([])
  const [investmentPlans, setInvestmentPlans] = useState([])
  const [financialDataLoading, setFinancialDataLoading] = useState(true)
  const [showInvestmentModal, setShowInvestmentModal] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [investmentAmount, setInvestmentAmount] = useState('5000')
  const [investmentLoading, setInvestmentLoading] = useState(false)
  const [investmentError, setInvestmentError] = useState('')
  const [investmentMessage, setInvestmentMessage] = useState('')
  const [selectedInvestment, setSelectedInvestment] = useState(null)

  const [menuOpen, setMenuOpen] = useState(false)
  const [balanceVisible, setBalanceVisible] = useState(true)
  const [activeTab, setActiveTab] = useState('Overview')
  const [showNotifications, setShowNotifications] = useState(false)

  const [showDepositModal, setShowDepositModal] = useState(false)
  const [depositAmount, setDepositAmount] = useState('1000')
  const [depositLoading, setDepositLoading] = useState(false)
  const [depositError, setDepositError] = useState('')
  const [payouts, setPayouts] = useState([])
  const [showPayoutModal, setShowPayoutModal] = useState(false)
  const [payoutInvestment, setPayoutInvestment] = useState(null)
  const [payoutBankName, setPayoutBankName] = useState('')
  const [payoutAccountName, setPayoutAccountName] = useState('')
  const [payoutAccountNumber, setPayoutAccountNumber] = useState('')
  const [payoutLoading, setPayoutLoading] = useState(false)
  const [payoutError, setPayoutError] = useState('')
  const [payoutMessage, setPayoutMessage] = useState('')
  const [clockNow, setClockNow] = useState(Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 60 * 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadCurrentUser() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/auth/me`,
          {
            method: 'GET',
            credentials: 'include',
          }
        )

        if (!response.ok) {
          navigate('/login', { replace: true })
          return
        }

        const data = await response.json()

        if (isMounted) {
          setCurrentUser(data.user)
        }

        try {
          const [walletResponse, transactionsResponse, plansResponse, investmentsResponse, payoutsResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/api/wallet`, {
              method: 'GET',
              credentials: 'include',
            }),
            fetch(`${API_BASE_URL}/api/transactions?limit=10`, {
              method: 'GET',
              credentials: 'include',
            }),
            fetch(`${API_BASE_URL}/api/investment-plans`, {
              method: 'GET',
              credentials: 'include',
            }),
            fetch(`${API_BASE_URL}/api/investments`, {
              method: 'GET',
              credentials: 'include',
            }),
            fetch(`${API_BASE_URL}/api/payout-requests`, { method: 'GET', credentials: 'include' }),
          ])

          if (!walletResponse.ok || !transactionsResponse.ok) {
            throw new Error('Unable to load your financial information.')
          }

          const [walletData, transactionData] = await Promise.all([
            walletResponse.json(),
            transactionsResponse.json(),
          ])
          const plansData = plansResponse.ok ? await plansResponse.json() : { plans: [] }
          const investmentsData = investmentsResponse.ok ? await investmentsResponse.json() : { investments: [] }
          const payoutsData = payoutsResponse.ok ? await payoutsResponse.json() : { payouts: [] }

          if (isMounted) {
            setWallet(walletData.wallet)
            setTransactions(transactionData.transactions || [])
            setInvestmentPlans(plansData.plans || [])
            setInvestments(investmentsData.investments || [])
            setPayouts(payoutsData.payouts || [])
            if ((plansData.plans || []).length > 0) {
              setSelectedPlanId(String(plansData.plans[0].id))
            }
          }
        } catch (financialError) {
          console.error('NEXTVEST financial data could not be loaded:', financialError)
        }
      } catch (error) {
        navigate('/login', { replace: true })
      } finally {
        if (isMounted) {
          setAuthLoading(false)
          setFinancialDataLoading(false)
        }
      }
    }

    loadCurrentUser()

    return () => {
      isMounted = false
    }
  }, [navigate])

  async function handleLogout() {
    setIsLoggingOut(true)

    try {
      await fetch(
        `${API_BASE_URL}/api/auth/logout`,
        {
          method: 'POST',
          credentials: 'include',
        }
      )
    } catch (error) {
      // Continue to the login page if the server connection drops.
    } finally {
      navigate('/login', { replace: true })
    }
  }

  function handleDemoAction(action) {
    if (action === 'Deposit') {
      setDepositError('')
      setShowDepositModal(true)
      return
    }

    if (action === 'Investment' || action === 'Investment plans') {
      setInvestmentError('')
      setInvestmentMessage('')
      setShowInvestmentModal(true)
      return
    }

    alert(
      `${action} is not connected yet. This feature will be enabled after its secure backend integration is complete.`
    )
  }

  async function createInvestment(event) {
    event.preventDefault()
    setInvestmentError('')
    setInvestmentMessage('')

    const amount = Number(investmentAmount)
    const plan = investmentPlans.find((item) => String(item.id) === String(selectedPlanId))

    if (!plan) {
      setInvestmentError('Please select an available investment plan.')
      return
    }

    if (!Number.isSafeInteger(amount) || amount < plan.minimumInvestment || amount > plan.maximumInvestment) {
      setInvestmentError(`Enter a whole-number amount between ${formatCurrency(plan.minimumInvestment)} and ${formatCurrency(plan.maximumInvestment)}.`)
      return
    }

    setInvestmentLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/investments`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: Number(selectedPlanId), amount }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Could not create this investment.')
      }

      setInvestmentMessage(data.message || 'Investment created successfully.')
      if (data.walletBalance !== undefined) {
        setWallet((previous) => ({ ...(previous || {}), balance: data.walletBalance }))
      }

      const [investmentsResponse, walletResponse, transactionsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/investments`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/api/wallet`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/api/transactions?limit=10`, { credentials: 'include' }),
      ])
      if (investmentsResponse.ok) {
        const result = await investmentsResponse.json()
        setInvestments(result.investments || [])
      }
      if (walletResponse.ok) {
        const result = await walletResponse.json()
        setWallet(result.wallet)
      }
      if (transactionsResponse.ok) {
        const result = await transactionsResponse.json()
        setTransactions(result.transactions || [])
      }
      setShowInvestmentModal(false)
    } catch (error) {
      setInvestmentError(error.message || 'Unable to create your investment. Please try again.')
    } finally {
      setInvestmentLoading(false)
    }
  }

  function openPayoutForm(investment) {
    const existing = payouts.find((item) => String(item.investmentReference) === String(investment.reference))
    if (existing) {
      setPayoutMessage(`Payout ${existing.reference} is currently ${existing.status.toUpperCase()}.`)
      return
    }
    setPayoutInvestment(investment)
    setPayoutBankName('')
    setPayoutAccountName(currentUser?.fullName || '')
    setPayoutAccountNumber('')
    setPayoutError('')
    setPayoutMessage('')
    setShowPayoutModal(true)
  }

  async function submitPayoutRequest(event) {
    event.preventDefault()
    setPayoutError('')
    if (!payoutInvestment) return
    if (!payoutBankName.trim() || payoutAccountName.trim().length < 2 || !/^\d{10}$/.test(payoutAccountNumber.trim())) {
      setPayoutError('Enter your bank name, account name, and a valid 10-digit Nigerian account number.')
      return
    }
    setPayoutLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/payout-requests`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ investmentId: Number(payoutInvestment.id), bankName: payoutBankName.trim(), accountName: payoutAccountName.trim(), accountNumber: payoutAccountNumber.trim() }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.success) throw new Error(data.message || 'Unable to submit payout request.')
      setPayouts((old) => [data.payout, ...old.filter((item) => item.reference !== data.payout.reference)])
      setShowPayoutModal(false)
      setPayoutMessage(`Payout request ${data.payout.reference} is now PENDING. Send the prefilled Telegram message to NEXTVEST Support. It will be marked PAID only after an administrator confirms the bank transfer.`)
      if (data.payout.telegramUrl) window.open(data.payout.telegramUrl, '_blank', 'noopener,noreferrer')
    } catch (error) {
      setPayoutError(error.message || 'Unable to submit payout request.')
    } finally {
      setPayoutLoading(false)
    }
  }

  async function startPaystackDeposit(event) {
    event.preventDefault()
    setDepositError('')

    const amount = Number(depositAmount)

    if (!Number.isSafeInteger(amount) || amount < 100 || amount > 5000000) {
      setDepositError('Enter a whole-number amount between ₦100 and ₦5,000,000.')
      return
    }

    setDepositLoading(true)

    try {
      const response = await fetch(
        'http://localhost:5000/api/payments/paystack/initialize',
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount }),
        }
      )

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.message || 'Could not start the deposit. Please try again.')
      }

      if (!data.authorizationUrl || !data.reference) {
        throw new Error('Paystack did not return a valid checkout session.')
      }

      window.location.assign(data.authorizationUrl)
    } catch (error) {
      setDepositError(error.message || 'Unable to connect to Paystack. Please try again.')
      setDepositLoading(false)
    }
  }

  const navigation = [
    {
      heading: 'WORKSPACE',
      items: [
        {
          label: 'Overview',
          icon: LayoutDashboard,
        },
        {
          label: 'My investments',
          icon: TrendingUp,
        },
        {
          label: 'Transactions',
          icon: Activity,
        },
      ],
    },
    {
      heading: 'MY FINANCES',
      items: [
        {
          label: 'Wallet',
          icon: Wallet,
        },
        {
          label: 'Deposits',
          icon: ArrowDownToLine,
        },
        {
          label: 'Withdrawals',
          icon: ArrowUpFromLine,
        },
      ],
    },
    {
      heading: 'ACCOUNT',
      items: [
        {
          label: 'Settings',
          icon: Settings,
        },
        {
          label: 'Help & support',
          icon: Headphones,
        },
      ],
    },
  ]

  function handleNavigation(label) {
    setActiveTab(label)
    setMenuOpen(false)

    if (label === 'Overview') {
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      })
      return
    }

    if (label === 'My investments') {
      document.getElementById('investments')?.scrollIntoView({
        behavior: 'smooth',
      })
      return
    }

    if (label === 'Transactions') {
      document.getElementById('transactions')?.scrollIntoView({
        behavior: 'smooth',
      })
      return
    }

    if (label === 'Deposits') {
      handleDemoAction('Deposit')
      return
    }

    if (label === 'Withdrawals') {
      document.getElementById('investments')?.scrollIntoView({ behavior: 'smooth' })
      setPayoutMessage('Choose an investment that has reached its maturity date to request a payout.')
      return
    }

    if (label === 'Wallet') {
      handleDemoAction('Wallet management')
      return
    }

    if (label === 'Settings') {
      handleDemoAction('Account settings')
      return
    }

    if (label === 'Help & support') {
      window.open(
        'https://t.me/nextvest_support',
        '_blank',
        'noopener,noreferrer'
      )
    }
  }

  if (authLoading) {
    return (
      <main className="dashboard-main" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f6f8f7', padding: '24px' }}>
        <p role="status" style={{ color: '#52645c' }}>
          Loading your NEXTVEST account...
        </p>
      </main>
    )
  }

  if (!currentUser) {
    return null
  }

  return (
    <div className="dashboard-shell">

      {/* MOBILE OVERLAY */}

      {menuOpen && (
        <button
          type="button"
          className="dashboard-overlay"
          aria-label="Close navigation menu"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* SIDEBAR */}

      <aside
        className={`dashboard-sidebar ${
          menuOpen ? 'dashboard-sidebar-open' : ''
        }`}
      >
        <div className="dashboard-brand-row">
          <Link to="/" className="dashboard-brand">
            <span className="dashboard-brand-icon">
              <TrendingUp size={22} />
            </span>

            <span>
              NEXT<span>VEST</span>
            </span>
          </Link>

          <button
            type="button"
            className="dashboard-mobile-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <div className="dashboard-sidebar-label">
          YOUR FINANCIAL SPACE
        </div>

        <nav className="dashboard-navigation">
          {navigation.map((group) => (
            <div className="dashboard-nav-group" key={group.heading}>
              <p className="dashboard-nav-heading">
                {group.heading}
              </p>

              {group.items.map((item) => {
                const Icon = item.icon
                const isActive = activeTab === item.label

                return (
                  <button
                    type="button"
                    key={item.label}
                    className={`dashboard-nav-item ${
                      isActive ? 'dashboard-nav-active' : ''
                    }`}
                    onClick={() => handleNavigation(item.label)}
                  >
                    <Icon size={18} strokeWidth={1.8} />

                    <span>{item.label}</span>

                    {isActive && (
                      <span className="dashboard-nav-indicator" />
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="dashboard-sidebar-bottom">
          <div className="dashboard-help-card">
            <div className="dashboard-help-icon">
              <CircleHelp size={19} />
            </div>

            <h4>Need assistance?</h4>

            <p>
              Our support team is available to help you.
            </p>

            <a
              href="https://t.me/nextvest_support"
              target="_blank"
              rel="noreferrer"
              className="dashboard-help-link"
            >
              Contact support
              <ArrowUpRight size={15} />
            </a>
          </div>

          <button
            type="button"
            className="dashboard-back-home"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            <LogOut size={17} />
            {isLoggingOut ? 'Signing out...' : 'Sign out'}
          </button>

          <Link to="/" className="dashboard-back-home">
            <ArrowUpRight size={17} />
            Back to website
          </Link>
        </div>
      </aside>

      {/* MAIN CONTENT */}

      <main className="dashboard-main">

        {/* TOPBAR */}

        <header className="dashboard-topbar">
          <div className="dashboard-topbar-left">
            <button
              type="button"
              className="dashboard-menu-toggle"
              onClick={() => setMenuOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu size={22} />
            </button>

            <div className="dashboard-breadcrumb">
              <span>Workspace</span>
              <ChevronRight size={15} />
              <strong>{activeTab}</strong>
            </div>
          </div>

          <div className="dashboard-topbar-right">
            <div className="dashboard-search">
              <Search size={17} />

              <input
                type="search"
                placeholder="Search dashboard..."
                aria-label="Search dashboard"
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && event.target.value.trim()) {
                    alert(
                      'Search will be connected to dashboard records through the backend.'
                    )
                  }
                }}
              />

              <span className="dashboard-search-shortcut">
                /
              </span>
            </div>

            <div className="dashboard-notification-wrap">
              <button
                type="button"
                className={`dashboard-icon-button ${
                  showNotifications ? 'dashboard-icon-active' : ''
                }`}
                aria-label="Notifications"
                onClick={() =>
                  setShowNotifications(!showNotifications)
                }
              >
                <Bell size={19} />
                <span className="dashboard-notification-dot" />
              </button>

              {showNotifications && (
                <div className="dashboard-notification-panel">
                  <div className="dashboard-notification-heading">
                    <strong>Notifications</strong>

                    <button
                      type="button"
                      onClick={() => setShowNotifications(false)}
                      aria-label="Close notifications"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="dashboard-notification-item">
                    <span className="dashboard-notification-icon">
                      <ShieldCheck size={17} />
                    </span>

                    <div>
                      <strong>Welcome to NEXTVEST</strong>

                      <p>
                        Your dashboard preview is ready.
                      </p>
                    </div>
                  </div>

                  <p className="dashboard-notification-footnote">
                    Live account notifications will be connected later.
                  </p>
                </div>
              )}
            </div>

            <button
              type="button"
              className="dashboard-profile-button"
              onClick={() => handleNavigation('Settings')}
            >
              <span className="dashboard-avatar">
                {(currentUser.fullName || currentUser.email || 'U')
                  .trim()
                  .charAt(0)
                  .toUpperCase()}
              </span>

              <span className="dashboard-profile-details">
                <strong>{currentUser.fullName || 'NEXTVEST User'}</strong>
                <small>{currentUser.email}</small>
              </span>

              <ChevronDown size={16} />
            </button>
          </div>
        </header>

        {/* DASHBOARD BODY */}

        <div className="dashboard-content">

          {/* PAGE INTRO */}

          <section className="dashboard-welcome">
            <div>
              <div className="dashboard-eyebrow">
                <span className="dashboard-live-dot" />
                ACCOUNT OVERVIEW
              </div>

              <h1>
                Your financial overview<span>.</span>
              </h1>

              <p>
                Keep track of your portfolio, account activity, and
                investment progress in one place.
              </p>
            </div>

            <div className="dashboard-welcome-actions">
              <button
                type="button"
                className="dashboard-button dashboard-button-secondary"
                onClick={() => handleDemoAction('Deposit')}
              >
                <Plus size={17} />
                Add funds
              </button>

              <button
                type="button"
                className="dashboard-button dashboard-button-primary"
                onClick={() => handleDemoAction('Investment')}
              >
                Explore investments
                <ArrowUpRight size={17} />
              </button>
            </div>
          </section>

          {/* DEMO NOTICE */}

          <div className="dashboard-demo-notice">
            <ShieldCheck size={18} />

            <p>
              <strong>Live account data:</strong> Your wallet balance, transactions,
              available investment plans, and recorded investments are loaded from your account database.
            </p>
          </div>

          {payoutMessage && (
            <div role="status" style={{ margin: '14px 0', padding: '13px 15px', borderRadius: '12px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', fontSize: '13px', lineHeight: 1.55 }}>
              {payoutMessage}
              <button type="button" onClick={() => setPayoutMessage('')} style={{ float: 'right', border: 0, background: 'transparent', color: 'inherit', fontWeight: 800, cursor: 'pointer' }}>×</button>
            </div>
          )}

          {/* BALANCE CARD */}

          <section className="dashboard-overview-grid">

            <div className="dashboard-balance-card">
              <div className="dashboard-balance-top">
                <div className="dashboard-card-label">
                  <span className="dashboard-card-label-icon">
                    <Wallet size={17} />
                  </span>

                  Available wallet balance
                </div>

                <button
                  type="button"
                  className="dashboard-balance-visibility"
                  onClick={() =>
                    setBalanceVisible(!balanceVisible)
                  }
                  aria-label={
                    balanceVisible ? 'Hide balances' : 'Show balances'
                  }
                >
                  {balanceVisible ? (
                    <Eye size={18} />
                  ) : (
                    <EyeOff size={18} />
                  )}
                </button>
              </div>

              <h2 className="dashboard-balance-amount">
                {balanceVisible
                  ? formatCurrency(wallet?.balance ?? 0)
                  : '₦ ••••••••'}
              </h2>

              <div className="dashboard-balance-footer">
                <span className="dashboard-balance-caption">
                  {financialDataLoading ? 'Loading balance…' : 'Live account balance'}
                </span>

                <span className="dashboard-balance-status">
                  <span />
                  Database wallet
                </span>
              </div>

              <div className="dashboard-balance-actions">
                <button
                  type="button"
                  onClick={() => handleDemoAction('Deposit')}
                >
                  <ArrowDownToLine size={17} />
                  Deposit
                </button>

                <button
                  type="button"
                  onClick={() => { document.getElementById('investments')?.scrollIntoView({ behavior: 'smooth' }); setPayoutMessage('Choose a matured investment below to request a payout.') }}
                >
                  <ArrowUpFromLine size={17} />
                  Withdraw
                </button>
              </div>

              <div className="dashboard-balance-decoration">
                <span />
                <span />
                <span />
              </div>
            </div>

            <div className="dashboard-stat-card">
              <div className="dashboard-stat-top">
                <span className="dashboard-stat-icon dashboard-stat-green">
                  <CircleDollarSign size={20} />
                </span>

                <span className="dashboard-stat-label">
                  Total invested
                </span>
              </div>

              <h3>
                {balanceVisible
                  ? formatCurrency(investments.reduce((total, item) => total + Number(item.amount || 0), 0))
                  : '₦ ••••••••'}
              </h3>

              <div className="dashboard-stat-bottom">
                <span className="dashboard-stat-note">
                  Total amount in your recorded investments
                </span>
              </div>

              <div className="dashboard-stat-decoration">
                <TrendingUp size={76} strokeWidth={0.8} />
              </div>
            </div>

            <div className="dashboard-stat-card">
              <div className="dashboard-stat-top">
                <span className="dashboard-stat-icon dashboard-stat-blue">
                  <Activity size={20} />
                </span>

                <span className="dashboard-stat-label">
                  Active investments
                </span>
              </div>

              <h3>{String(investments.filter((item) => item.status === 'active').length).padStart(2, '0')}</h3>

              <div className="dashboard-stat-bottom">
                <span className="dashboard-stat-note">
                  {investments.length ? 'Recorded investment plans' : 'No investments yet'}
                </span>
              </div>

              <div className="dashboard-stat-decoration">
                <Activity size={76} strokeWidth={0.8} />
              </div>
            </div>

          </section>

          {/* QUICK ACTIONS */}

          <section className="dashboard-quick-actions">
            <button
              type="button"
              className="dashboard-quick-action"
              onClick={() => handleDemoAction('Deposit')}
            >
              <span className="dashboard-quick-icon quick-icon-green">
                <ArrowDownToLine size={20} />
              </span>

              <span>
                <strong>Deposit funds</strong>
                <small>Add money to your wallet</small>
              </span>

              <ChevronRight size={18} />
            </button>

            <button
              type="button"
              className="dashboard-quick-action"
              onClick={() => handleDemoAction('Investment')}
            >
              <span className="dashboard-quick-icon quick-icon-blue">
                <TrendingUp size={20} />
              </span>

              <span>
                <strong>Invest now</strong>
                <small>Explore available plans</small>
              </span>

              <ChevronRight size={18} />
            </button>

            <button
              type="button"
              className="dashboard-quick-action"
              onClick={() => { document.getElementById('investments')?.scrollIntoView({ behavior: 'smooth' }); setPayoutMessage('Choose a matured investment below to request a payout.') }}
            >
              <span className="dashboard-quick-icon quick-icon-purple">
                <Landmark size={20} />
              </span>

              <span>
                <strong>Withdraw funds</strong>
                <small>Request an eligible withdrawal</small>
              </span>

              <ChevronRight size={18} />
            </button>
          </section>

          {/* PORTFOLIO AND TRANSACTIONS */}

          <section className="dashboard-main-grid">

            {/* INVESTMENTS */}

            <div
              className="dashboard-panel"
              id="investments"
            >
              <div className="dashboard-panel-heading">
                <div>
                  <h2>My investments</h2>

                  <p>
                    Track your investment amounts, plans, and maturity dates.
                  </p>
                </div>

                <button
                  type="button"
                  className="dashboard-view-all"
                  onClick={() => handleNavigation('My investments')}
                >
                  View all
                  <ArrowUpRight size={15} />
                </button>
              </div>

              <div className="dashboard-investment-list">
                {investments.length === 0 ? (
                  <div className="dashboard-empty-state">
                    You have no investments yet. Explore the available plans to get started.
                  </div>
                ) : investments.map((investment) => (
                  <article
                    className="dashboard-investment-item"
                    key={investment.id}
                  >
                    <div className="dashboard-investment-top">
                      <div className="dashboard-investment-icon">
                        <TrendingUp size={19} />
                      </div>

                      <div className="dashboard-investment-info">
                        <h3>{investment.planName}</h3>

                        <p>Investment reference: {investment.reference}</p>
                      </div>

                      <span className="dashboard-investment-status">
                        <span />
                        {investment.status}
                      </span>
                    </div>

                    <div className="dashboard-investment-amount-row">
                      <div>
                        <span>Invested amount</span>

                        <strong>
                          {balanceVisible
                            ? formatCurrency(investment.amount)
                            : '₦ ••••••••'}
                        </strong>
                      </div>

                      <div className="dashboard-investment-duration">
                        <span>Duration</span>

                        <strong>{Math.max(0, Math.ceil((new Date(investment.maturityAt) - new Date(investment.startAt)) / 86400000))} days</strong>
                      </div>
                    </div>

                    {(() => {
                      const progress = getInvestmentProgress(investment, clockNow)
                      return (
                        <>
                          <div className="dashboard-progress-header">
                            <span>Estimated return earned so far</span>
                            <strong>{balanceVisible ? formatCurrency(progress.accruedReturn) : '₦ ••••••••'}</strong>
                          </div>
                          <div className="dashboard-progress-track" role="progressbar" aria-label={`${investment.planName} maturity progress`} aria-valuenow={Math.round(progress.progressPercent)} aria-valuemin={0} aria-valuemax={100}>
                            <span style={{ width: `${progress.progressPercent}%` }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: '7px', fontSize: '12px', color: '#64748b', flexWrap: 'wrap' }}>
                            <span>Day {progress.elapsedDays} of {investment.durationDays}</span>
                            <strong>{Math.floor(progress.progressPercent)}% complete</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: '8px', fontSize: '13px', flexWrap: 'wrap' }}>
                            <span>Estimated current value</span>
                            <strong>{balanceVisible ? formatCurrency(progress.estimatedCurrentValue) : '₦ ••••••••'}</strong>
                          </div>
                        </>
                      )
                    })()}

                    <div className="dashboard-investment-bottom">
                      <span>
                        <CalendarDays size={14} />
                        Maturity: {new Date(investment.maturityAt).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>

                      <button
                        type="button"
                        onClick={() => setSelectedInvestment(investment)}
                        aria-label={`View ${investment.planName} details`}
                      >
                        Details
                        <ChevronRight size={15} />
                      </button>
                    </div>
                    {(() => {
                      const existingPayout = payouts.find((item) => String(item.investmentReference) === String(investment.reference))
                      const eligible = Boolean(investment.canWithdraw) && !existingPayout
                      return (
                        <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                          {existingPayout && <span style={{ fontSize: '12px', color: existingPayout.status === 'paid' ? '#059669' : '#b45309', fontWeight: 800 }}>Payout: {existingPayout.status.toUpperCase()} · {existingPayout.reference}</span>}
                          <button type="button" disabled={!eligible} onClick={() => openPayoutForm(investment)} style={{ marginLeft: 'auto', padding: '11px 15px', border: 0, borderRadius: '10px', fontWeight: 800, color: eligible ? '#fff' : '#64748b', background: eligible ? '#059669' : '#e2e8f0', cursor: eligible ? 'pointer' : 'not-allowed' }}>
                            {existingPayout ? (existingPayout.status === 'paid' ? 'Payout completed' : 'Payout pending') : (investment.canWithdraw ? 'Withdraw matured investment' : 'Withdrawal locked until maturity')}
                          </button>
                        </div>
                      )
                    })()}
                  </article>
                ))}
              </div>

              <button
                type="button"
                className="dashboard-explore-button"
                onClick={() => handleDemoAction('Investment plans')}
              >
                <Plus size={17} />
                Explore investment plans
              </button>
            </div>

            {/* TRANSACTIONS */}

            <div
              className="dashboard-panel"
              id="transactions"
            >
              <div className="dashboard-panel-heading">
                <div>
                  <h2>Recent transactions</h2>

                  <p>
Your latest recorded wallet activity.
                  </p>
                </div>

                <button
                  type="button"
                  className="dashboard-more-button"
                  aria-label="More transaction options"
                  onClick={() =>
                    handleDemoAction('Transaction options')
                  }
                >
                  <MoreHorizontal size={21} />
                </button>
              </div>

              <div className="dashboard-transaction-list">
                {transactions.length === 0 ? (
                  <div className="dashboard-empty-state">
                    {financialDataLoading
                      ? 'Loading transactions…'
                      : 'No transactions have been recorded yet.'}
                  </div>
                ) : transactions.map((transaction) => {
                  const Icon = transaction.type === 'deposit' || transaction.type === 'return'
                    ? ArrowDownToLine
                    : transaction.type === 'withdrawal'
                      ? ArrowUpFromLine
                      : TrendingUp
                  const transactionDate = transaction.createdAt
                    ? new Date(transaction.createdAt).toLocaleDateString('en-NG', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })
                    : 'Date unavailable'
                  const isCredit = transaction.direction
                    ? transaction.direction === 'credit'
                    : Number(transaction.amount) > 0

                  return (
                    <article
                      className="dashboard-transaction-item"
                      key={transaction.id}
                    >
                      <div
                        className={`dashboard-transaction-icon ${
                          isCredit ? 'transaction-positive' : 'transaction-negative'
                        }`}
                      >
                        <Icon size={17} />
                      </div>

                      <div className="dashboard-transaction-info">
                        <strong>{transaction.description}</strong>

                        <span>
                          {transactionDate} · {transaction.type}
                        </span>

                        <small>{transaction.reference}</small>
                      </div>

                      <div className="dashboard-transaction-right">
                        <strong
                          className={
                            isCredit
                              ? 'transaction-amount-positive'
                              : 'transaction-amount-negative'
                          }
                        >
                          {isCredit ? '+' : '−'}
                          {formatCurrency(Math.abs(Number(transaction.amount)))}
                        </strong>

                        <span className="dashboard-transaction-status">
                          <CheckCircle2 size={12} />
                          {transaction.status}
                        </span>
                      </div>
                    </article>
                  )
                })}
              </div>

              <button
                type="button"
                className="dashboard-transaction-footer"
                onClick={() => handleNavigation('Transactions')}
              >
                View transaction history
                <ArrowUpRight size={16} />
              </button>
            </div>

          </section>

          {/* BOTTOM INFORMATION */}

          <section className="dashboard-bottom-grid">

            <div className="dashboard-information-card">
              <div className="dashboard-information-icon">
                <ShieldCheck size={21} />
              </div>

              <div>
                <h3>Protect your account</h3>

                <p>
                  Keep your account details private and use a strong,
                  unique password. Additional security features will
                  be available after backend integration.
                </p>

                <button
                  type="button"
                  onClick={() => handleNavigation('Settings')}
                >
                  Account settings
                  <ArrowUpRight size={15} />
                </button>
              </div>
            </div>

            <div className="dashboard-information-card">
              <div className="dashboard-information-icon information-icon-blue">
                <Headphones size={21} />
              </div>

              <div>
                <h3>Need help?</h3>

                <p>
                  Have a question about your account or need
                  assistance navigating the platform?
                </p>

                <a
                  href="https://t.me/nextvest_support"
                  target="_blank"
                  rel="noreferrer"
                >
                  Contact support
                  <ArrowUpRight size={15} />
                </a>
              </div>
            </div>

          </section>

          {/* FOOTER */}

          <footer className="dashboard-footer">
            <div>
              © {new Date().getFullYear()} NEXTVEST.

              <span>
                Account dashboard.
              </span>
            </div>

            <div className="dashboard-footer-links">
              <a href="mailto:support.customers911@gmail.com">
                Support
              </a>

              <span>·</span>

              <Link to="/">
                Main website
              </Link>
            </div>
          </footer>

        </div>
      </main>

      {showInvestmentModal && (
        <div
          className="nextvest-investment-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !investmentLoading) {
              setShowInvestmentModal(false)
              setInvestmentError('')
            }
          }}
        >
          <section
            className="nextvest-investment-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="nextvest-investment-title"
          >
            <div className="nextvest-investment-header">
              <div className="nextvest-investment-heading">
                <p className="investment-eyebrow">NEXTVEST INVESTMENTS</p>
                <h2 id="nextvest-investment-title">Choose an investment plan</h2>
                <p className="investment-intro">
                  Choose a plan and invest from your available wallet balance.
                </p>
              </div>
              <button
                className="investment-close"
                type="button"
                onClick={() => {
                  if (!investmentLoading) {
                    setShowInvestmentModal(false)
                    setInvestmentError('')
                  }
                }}
                disabled={investmentLoading}
                aria-label="Close investment dialog"
              >
                ×
              </button>
            </div>

            {(() => {
              const plan = investmentPlans.find((item) => String(item.id) === String(selectedPlanId))
              const amount = Number(investmentAmount)
              const validAmount = plan && Number.isFinite(amount) && amount >= plan.minimumInvestment && amount <= plan.maximumInvestment
              const expectedReturn = validAmount ? amount * Number(plan.returnRate || 0) / 100 : 0
              return (
                <div className="investment-live-estimate" aria-live="polite" style={{ margin: '0 0 16px', padding: '15px', borderRadius: '12px', background: '#effcf6', border: '1px solid #c6f3dc', color: '#14533b' }}>
                  <div style={{ fontSize: '12px', marginBottom: '5px' }}>Estimated amount at maturity</div>
                  <strong style={{ display: 'block', fontSize: '24px' }}>{formatCurrency(validAmount ? amount + expectedReturn : 0)}</strong>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: '8px', fontSize: '12px', flexWrap: 'wrap' }}>
                    <span>Estimated return: {formatCurrency(expectedReturn)}</span>
                    <span>{plan ? `${plan.durationDays} days` : 'Select a plan'}</span>
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: '11px', lineHeight: 1.5 }}>Projection uses the plan's configured rate and is not a guarantee of profit. Confirm all terms before investing.</p>
                </div>
              )
            })()}

            <form className="nextvest-investment-form" onSubmit={createInvestment}>
              <label htmlFor="nextvest-investment-plan">Investment plan</label>
              <select
                id="nextvest-investment-plan"
                value={selectedPlanId}
                onChange={(event) => {
                  setSelectedPlanId(event.target.value)
                  setInvestmentError('')
                }}
                required
                disabled={investmentLoading || investmentPlans.length === 0}
              >
                {investmentPlans.length === 0 && <option value="">No plans available</option>}
                {investmentPlans.map((plan) => (
                  <option key={plan.id} value={String(plan.id)}>
                    {plan.name} — {plan.durationDays} days ({formatCurrency(plan.minimumInvestment)} to {formatCurrency(plan.maximumInvestment)})
                  </option>
                ))}
              </select>

              {(() => {
                const plan = investmentPlans.find((item) => String(item.id) === String(selectedPlanId))
                return plan ? (
                  <div className="investment-plan-details">
                    <div className="investment-plan-details-title">{plan.name} plan</div>
                    <div className="investment-plan-detail-row">
                      <span>Duration</span><strong>{plan.durationDays} days</strong>
                    </div>
                    <div className="investment-plan-detail-row">
                      <span>Configured return rate</span><strong>{Number(plan.returnRate)}%</strong>
                    </div>
                    <div className="investment-plan-detail-row">
                      <span>Minimum</span><strong>{formatCurrency(plan.minimumInvestment)}</strong>
                    </div>
                    <div className="investment-plan-detail-row">
                      <span>Maximum</span><strong>{formatCurrency(plan.maximumInvestment)}</strong>
                    </div>
                    <p className="investment-plan-note">
                      Returns depend on the rate configured for this plan. No return is promised by this display.
                    </p>
                  </div>
                ) : null
              })()}

              <label htmlFor="nextvest-investment-amount">Investment amount (NGN)</label>
              <div className="investment-amount-field">
                <span aria-hidden="true">₦</span>
                <input
                  id="nextvest-investment-amount"
                  type="number"
                  min="5000"
                  step="1"
                  inputMode="numeric"
                  value={investmentAmount}
                  onChange={(event) => setInvestmentAmount(event.target.value)}
                  disabled={investmentLoading}
                  required
                />
              </div>
              <p className="investment-wallet-balance">
                Available wallet balance <strong>{formatCurrency(wallet?.balance ?? 0)}</strong>
              </p>

              {investmentError && <p className="investment-feedback investment-feedback-error" role="alert">{investmentError}</p>}
              {investmentMessage && <p className="investment-feedback investment-feedback-success" role="status">{investmentMessage}</p>}

              <button className="investment-submit" type="submit" disabled={investmentLoading || investmentPlans.length === 0}>
                {investmentLoading ? 'Processing investment…' : 'Invest from wallet'}
              </button>
              <p className="investment-security-note">Your investment request is processed through your authenticated account.</p>
            </form>
          </section>
        </div>
      )}

      {showDepositModal && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !depositLoading) {
              setShowDepositModal(false)
              setDepositError('')
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'grid',
            placeItems: 'center',
            padding: '20px',
            background: 'rgba(15, 23, 42, 0.62)',
            backdropFilter: 'blur(5px)',
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="nextvest-deposit-title"
            style={{
              width: 'min(100%, 440px)',
              padding: '28px',
              borderRadius: '20px',
              background: '#ffffff',
              boxShadow: '0 24px 80px rgba(0,0,0,0.24)',
              color: '#0f172a',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
              <div>
                <p style={{ margin: '0 0 8px', color: '#059669', fontSize: '12px', fontWeight: 800, letterSpacing: '1.2px' }}>NEXTVEST WALLET</p>
                <h2 id="nextvest-deposit-title" style={{ margin: 0, fontSize: '24px', fontWeight: 750 }}>Add funds</h2>
                <p style={{ margin: '8px 0 0', color: '#64748b', lineHeight: 1.5, fontSize: '14px' }}>Choose an amount to continue to Paystack checkout.</p>
              </div>
              <button
                type="button"
                onClick={() => { setShowDepositModal(false); setDepositError('') }}
                disabled={depositLoading}
                aria-label="Close deposit dialog"
                style={{ border: 0, background: '#f1f5f9', borderRadius: '10px', width: '36px', height: '36px', cursor: depositLoading ? 'not-allowed' : 'pointer', fontSize: '22px', color: '#334155' }}
              >
                ×
              </button>
            </div>

            <form onSubmit={startPaystackDeposit} style={{ marginTop: '24px' }}>
              <label htmlFor="nextvest-deposit-amount" style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 700, color: '#334155' }}>Deposit amount (NGN)</label>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '0 14px', background: '#fff' }}>
                <span style={{ color: '#64748b', fontSize: '18px', fontWeight: 700 }}>₦</span>
                <input
                  id="nextvest-deposit-amount"
                  type="number"
                  min="100"
                  max="5000000"
                  step="1"
                  inputMode="numeric"
                  value={depositAmount}
                  onChange={(event) => setDepositAmount(event.target.value)}
                  disabled={depositLoading}
                  required
                  style={{ width: '100%', minWidth: 0, border: 0, outline: 0, padding: '15px 10px', fontSize: '20px', fontWeight: 700, color: '#0f172a', background: 'transparent' }}
                />
              </div>
              <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#64748b' }}>Minimum ₦100 · Maximum ₦5,000,000</p>

              {depositError && (
                <p role="alert" style={{ margin: '14px 0 0', padding: '11px 12px', borderRadius: '10px', color: '#b91c1c', background: '#fef2f2', fontSize: '13px', lineHeight: 1.5 }}>
                  {depositError}
                </p>
              )}

              <div style={{ marginTop: '20px', padding: '12px', borderRadius: '10px', background: '#f8fafc', color: '#475569', fontSize: '12px', lineHeight: 1.55 }}>
                You will be redirected to Paystack to complete payment. Your NEXTVEST wallet is credited only after the backend verifies the transaction.
              </div>

              <button
                type="submit"
                disabled={depositLoading}
                style={{ width: '100%', marginTop: '18px', border: 0, borderRadius: '12px', padding: '14px 16px', background: depositLoading ? '#6ee7b7' : '#059669', color: '#fff', fontWeight: 750, fontSize: '15px', cursor: depositLoading ? 'wait' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
              >
                {depositLoading ? 'Connecting to Paystack…' : <>Continue to Paystack <ArrowUpRight size={17} /></>}
              </button>
            </form>
          </section>
        </div>
      )}

      {showPayoutModal && payoutInvestment && (
        <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !payoutLoading) setShowPayoutModal(false) }} style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'grid', placeItems: 'center', padding: '18px', background: 'rgba(2, 12, 7, .72)', backdropFilter: 'blur(5px)' }}>
          <section role="dialog" aria-modal="true" aria-labelledby="nextvest-payout-title" style={{ width: 'min(100%, 460px)', maxHeight: '90vh', overflowY: 'auto', padding: '25px', borderRadius: '18px', background: '#fff', color: '#0f172a', boxShadow: '0 24px 80px rgba(0,0,0,.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
              <div><p style={{ margin: '0 0 7px', color: '#059669', fontSize: '11px', fontWeight: 900, letterSpacing: '1px' }}>NEXTVEST PAYOUT</p><h2 id="nextvest-payout-title" style={{ margin: 0 }}>Bank account details</h2><p style={{ color: '#64748b', fontSize: '13px', lineHeight: 1.5 }}>Investment: {payoutInvestment.planName}<br />Projected payout: {formatCurrency(Number(payoutInvestment.amount || 0) + Number(payoutInvestment.expectedReturn || 0))}</p></div>
              <button type="button" disabled={payoutLoading} onClick={() => setShowPayoutModal(false)} aria-label="Close payout form" style={{ border: 0, borderRadius: '9px', padding: '7px 11px', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={submitPayoutRequest}>
              <label style={{ display: 'block', margin: '12px 0 6px', fontSize: '13px', fontWeight: 750 }}>Bank name</label><input value={payoutBankName} onChange={(e) => setPayoutBankName(e.target.value)} required maxLength={100} placeholder="e.g. Access Bank" style={{ boxSizing: 'border-box', width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px' }} />
              <label style={{ display: 'block', margin: '12px 0 6px', fontSize: '13px', fontWeight: 750 }}>Account name</label><input value={payoutAccountName} onChange={(e) => setPayoutAccountName(e.target.value)} required maxLength={120} placeholder="Name on your bank account" style={{ boxSizing: 'border-box', width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px' }} />
              <label style={{ display: 'block', margin: '12px 0 6px', fontSize: '13px', fontWeight: 750 }}>10-digit account number</label><input value={payoutAccountNumber} onChange={(e) => setPayoutAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))} required inputMode="numeric" pattern="[0-9]{10}" maxLength={10} placeholder="0123456789" style={{ boxSizing: 'border-box', width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px' }} />
              {payoutError && <p role="alert" style={{ padding: '10px', borderRadius: '9px', color: '#b91c1c', background: '#fef2f2', fontSize: '13px' }}>{payoutError}</p>}
              <p style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.55 }}>Your request is saved as Pending first. Telegram opens with a message for support. Your status changes to Paid only after an administrator confirms the bank transfer.</p>
              <button type="submit" disabled={payoutLoading} style={{ width: '100%', marginTop: '8px', padding: '14px', border: 0, borderRadius: '11px', background: payoutLoading ? '#94a3b8' : '#059669', color: '#fff', fontWeight: 850, cursor: payoutLoading ? 'wait' : 'pointer' }}>{payoutLoading ? 'Submitting request…' : 'Submit request & open Telegram'}</button>
            </form>
          </section>
        </div>
      )}

      {selectedInvestment && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedInvestment(null)
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1200,
            display: 'grid',
            placeItems: 'center',
            padding: '20px',
            background: 'rgba(2, 8, 6, 0.78)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="investment-details-title"
            style={{
              width: 'min(100%, 520px)',
              maxHeight: 'min(86vh, 760px)',
              overflowY: 'auto',
              padding: '26px',
              border: '1px solid rgba(87, 240, 189, 0.18)',
              borderRadius: '22px',
              color: '#f2fff8',
              background: 'linear-gradient(145deg, #0d1913, #07100c)',
              boxShadow: '0 30px 100px rgba(0,0,0,.48)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
              <div>
                <p style={{ margin: '0 0 8px', color: '#35dca5', fontSize: '11px', fontWeight: 800, letterSpacing: '1.5px' }}>
                  NEXTVEST · INVESTMENT DETAILS
                </p>
                <h2 id="investment-details-title" style={{ margin: 0, fontSize: '25px', fontWeight: 800 }}>
                  {selectedInvestment.planName}
                </h2>
                <p style={{ margin: '8px 0 0', color: '#91a99b', fontSize: '12px', overflowWrap: 'anywhere' }}>
                  Ref: {selectedInvestment.reference}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvestment(null)}
                aria-label="Close investment details"
                style={{
                  flex: '0 0 auto', width: '38px', height: '38px',
                  border: '1px solid #24392e', borderRadius: '12px',
                  color: '#d9eee3', background: '#12231a',
                  fontSize: '23px', cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>

            <div style={{
              marginTop: '22px', padding: '19px', borderRadius: '16px',
              border: '1px solid rgba(8,197,138,.18)',
              background: 'linear-gradient(135deg, rgba(8,197,138,.12), rgba(8,197,138,.025))',
            }}>
              <span style={{ color: '#9bb3a5', fontSize: '12px' }}>Principal invested</span>
              <div style={{ marginTop: '7px', color: '#f5fff9', fontSize: '30px', fontWeight: 850 }}>
                {formatCurrency(selectedInvestment.amount)}
              </div>
              <span style={{
                display: 'inline-flex', marginTop: '12px', padding: '6px 10px',
                borderRadius: '999px', color: '#55e8b1',
                background: 'rgba(8,197,138,.12)', fontSize: '11px',
                fontWeight: 750, textTransform: 'capitalize',
              }}>
                {selectedInvestment.status}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px', marginTop: '16px' }}>
              {[
                ['Return rate configured', `${Number(selectedInvestment.returnRate ?? 0)}%`],
                ['Expected return at maturity', formatCurrency(selectedInvestment.expectedReturn ?? 0)],
                ['Estimated return so far', formatCurrency(getInvestmentProgress(selectedInvestment, clockNow).accruedReturn)],
                ['Estimated current value', formatCurrency(getInvestmentProgress(selectedInvestment, clockNow).estimatedCurrentValue)],
                ['Total projected value', formatCurrency(selectedInvestment.projectedTotal ?? (Number(selectedInvestment.amount || 0) + Number(selectedInvestment.expectedReturn || 0)))],
                ['Duration', `${Math.max(0, Number(selectedInvestment.durationDays ?? Math.ceil((new Date(selectedInvestment.maturityAt) - new Date(selectedInvestment.startAt)) / 86400000)))} days`],
                ['Investment date', selectedInvestment.startAt ? new Date(selectedInvestment.startAt).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not available'],
                ['Maturity date', selectedInvestment.maturityAt ? new Date(selectedInvestment.maturityAt).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not available'],
              ].map(([label, value]) => (
                <div key={label} style={{
                  minWidth: 0, padding: '14px', borderRadius: '13px',
                  border: '1px solid #1d3026', background: 'rgba(255,255,255,.025)',
                }}>
                  <div style={{ marginBottom: '7px', color: '#8ea598', fontSize: '11px' }}>{label}</div>
                  <strong style={{ display: 'block', color: '#e9f7ef', fontSize: '14px', overflowWrap: 'anywhere' }}>{value}</strong>
                </div>
              ))}
            </div>

            {Number(selectedInvestment.returnRate ?? 0) === 0 && (
              <p style={{
                margin: '16px 0 0', padding: '12px 13px', borderRadius: '12px',
                color: '#d8c99b', background: 'rgba(180, 137, 39, .09)',
                border: '1px solid rgba(180, 137, 39, .18)', fontSize: '12px', lineHeight: 1.6,
              }}>
                This plan is currently configured with a 0% return rate, so the system calculates an expected return of ₦0.00. Update the plan terms/configuration only after deciding and documenting the actual rate; this screen does not invent a return.
              </p>
            )}

            <button
              type="button"
              onClick={() => setSelectedInvestment(null)}
              style={{
                width: '100%', marginTop: '20px', padding: '14px 16px',
                border: 0, borderRadius: '12px', color: '#032016',
                background: 'linear-gradient(90deg, #08c58a, #57f0bd)',
                fontSize: '14px', fontWeight: 850, cursor: 'pointer',
              }}
            >
              Done
            </button>
          </section>
        </div>
      )}
    </div>
  )
}

export default Dashboard