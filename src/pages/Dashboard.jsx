import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

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

const investments = []

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 2,
  }).format(amount)

function Dashboard() {
  const navigate = useNavigate()

  const [currentUser, setCurrentUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [wallet, setWallet] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [financialDataLoading, setFinancialDataLoading] = useState(true)

  const [menuOpen, setMenuOpen] = useState(false)
  const [balanceVisible, setBalanceVisible] = useState(true)
  const [activeTab, setActiveTab] = useState('Overview')
  const [showNotifications, setShowNotifications] = useState(false)

  const [showDepositModal, setShowDepositModal] = useState(false)
  const [depositAmount, setDepositAmount] = useState('1000')
  const [depositLoading, setDepositLoading] = useState(false)
  const [depositError, setDepositError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadCurrentUser() {
      try {
        const response = await fetch(
          'http://localhost:5000/api/auth/me',
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
          const [walletResponse, transactionsResponse] = await Promise.all([
            fetch('http://localhost:5000/api/wallet', {
              method: 'GET',
              credentials: 'include',
            }),
            fetch('http://localhost:5000/api/transactions?limit=10', {
              method: 'GET',
              credentials: 'include',
            }),
          ])

          if (!walletResponse.ok || !transactionsResponse.ok) {
            throw new Error('Unable to load your financial information.')
          }

          const [walletData, transactionData] = await Promise.all([
            walletResponse.json(),
            transactionsResponse.json(),
          ])

          if (isMounted) {
            setWallet(walletData.wallet)
            setTransactions(transactionData.transactions || [])
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
        'http://localhost:5000/api/auth/logout',
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

    alert(
      `${action} is not connected yet. This feature will be enabled after its secure backend integration is complete.`
    )
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
      handleDemoAction('Withdrawal')
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
              <strong>Account data:</strong> Your wallet balance and transaction
              history are loaded from your account database. Investment cards
              are still illustrative until the investment engine is connected.
            </p>
          </div>

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
                  onClick={() => handleDemoAction('Withdrawal')}
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
                  ? formatCurrency(0)
                  : '₦ ••••••••'}
              </h3>

              <div className="dashboard-stat-bottom">
                <span className="dashboard-stat-note">
Investment records will appear here when enabled
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

              <h3>00</h3>

              <div className="dashboard-stat-bottom">
                <span className="dashboard-stat-note">
                  No live investments yet
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
              onClick={() => handleDemoAction('Withdrawal')}
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
                    Investment records will appear here once the investment engine is connected.
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
                    Investment records will appear here after the investment system is connected.
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
                        <h3>{investment.name}</h3>

                        <p>{investment.category}</p>
                      </div>

                      <span className="dashboard-investment-status">
                        <span />
                        {investment.status}
                      </span>
                    </div>

                    <div className="dashboard-investment-amount-row">
                      <div>
                        <span>Illustrative amount</span>

                        <strong>
                          {balanceVisible
                            ? formatCurrency(investment.invested)
                            : '₦ ••••••••'}
                        </strong>
                      </div>

                      <div className="dashboard-investment-duration">
                        <span>Duration</span>

                        <strong>{investment.duration}</strong>
                      </div>
                    </div>

                    <div className="dashboard-progress-header">
                      <span>Illustrative timeline</span>

                      <strong>{investment.progress}%</strong>
                    </div>

                    <div
                      className="dashboard-progress-track"
                      role="progressbar"
                      aria-label={`${investment.name} illustrative timeline`}
                      aria-valuenow={investment.progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <span
                        style={{
                          width: `${investment.progress}%`,
                        }}
                      />
                    </div>

                    <div className="dashboard-investment-bottom">
                      <span>
                        <CalendarDays size={14} />
                        Maturity: {investment.maturity}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          handleDemoAction(
                            `${investment.name} details`
                          )
                        }
                        aria-label={`View ${investment.name} details`}
                      >
                        Details
                        <ChevronRight size={15} />
                      </button>
                    </div>
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

                  return (
                    <article
                      className="dashboard-transaction-item"
                      key={transaction.id}
                    >
                      <div
                        className={`dashboard-transaction-icon ${
                          transaction.amount > 0
                            ? 'transaction-positive'
                            : 'transaction-negative'
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
                            transaction.amount > 0
                              ? 'transaction-amount-positive'
                              : 'transaction-amount-negative'
                          }
                        >
                          {transaction.amount > 0 ? '+' : '−'}
                          {formatCurrency(
                            Math.abs(transaction.amount)
                          )}
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
    </div>
  )
}

export default Dashboard