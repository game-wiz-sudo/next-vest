import '../App.css'
import { Link } from 'react-router-dom'

import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  Wallet,
  Clock3,
  ChartNoAxesCombined,
  Menu,
  X,
  Check,
  CircleHelp,
  Headphones,
  ChevronDown,
  LockKeyhole,
  TrendingUp,
  Zap,
  Globe,
} from 'lucide-react'
import { useState } from 'react'

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [investment, setInvestment] = useState(100000)
  const [selectedPlan, setSelectedPlan] = useState('growth')

  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      description: 'A starting point for your investment journey.',
      minimum: 10000,
      duration: '30 days',
      rate: 'View terms',
      features: [
        'Simple investment tracking',
        'Dedicated account dashboard',
        'Clear investment terms',
      ],
    },
    {
      id: 'growth',
      name: 'Growth',
      description: 'For investors looking for a structured approach.',
      minimum: 50000,
      duration: '60 days',
      rate: 'View terms',
      features: [
        'Everything in Starter',
        'Detailed portfolio overview',
        'Investment progress tracking',
      ],
      popular: true,
    },
    {
      id: 'premium',
      name: 'Premium',
      description: 'A more comprehensive investment experience.',
      minimum: 100000,
      duration: '90 days',
      rate: 'View terms',
      features: [
        'Everything in Growth',
        'Priority customer support',
        'Detailed account reporting',
      ],
    },
  ]

  const activePlan =
    plans.find((plan) => plan.id === selectedPlan) || plans[1]

  const formatMoney = (amount) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    }).format(amount)

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: 'smooth',
    })

    setMenuOpen(false)
  }

  const handleInvestmentChange = (event) => {
    const value = Number(event.target.value)

    setInvestment(
      Number.isFinite(value) ? Math.max(0, Math.min(value, 100000000)) : 0
    )
  }

  return (
    <div className="app">
      {/* NAVIGATION */}
      <header className="site-header">
        <div className="container nav-container">
          <a
            href="#home"
            className="brand"
            onClick={() => setMenuOpen(false)}
            aria-label="NEXTVEST homepage"
          >
            <span className="brand-icon">
              <TrendingUp size={22} strokeWidth={2.5} />
            </span>

            <span>
              NEXT<span className="brand-highlight">VEST</span>
            </span>
          </a>

          <button
            className="mobile-menu-button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={23} /> : <Menu size={23} />}
          </button>

          <nav className={`nav-links ${menuOpen ? 'nav-open' : ''}`}>
            <a href="#home" onClick={() => setMenuOpen(false)}>
              Home
            </a>

            <a href="#about" onClick={() => setMenuOpen(false)}>
              About
            </a>

            <a href="#plans" onClick={() => setMenuOpen(false)}>
              Investment plans
            </a>

            <a href="#how-it-works" onClick={() => setMenuOpen(false)}>
              How it works
            </a>

            <a href="#faq" onClick={() => setMenuOpen(false)}>
              FAQ
            </a>

            <div className="nav-actions">
              <Link to="/login" className="button button-ghost">
  Log in
</Link>

              <Link to="/register" className="button button-primary nav-cta">
  Get started <ArrowRight size={16} />
</Link>
            </div>
          </nav>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="hero-section" id="home">
          <div className="hero-glow hero-glow-one" />
          <div className="hero-glow hero-glow-two" />

          <div className="container hero-grid">
            <div className="hero-content">
              <div className="eyebrow">
                <span className="status-dot" />
                A smarter approach to investing
              </div>

              <h1>
                Build your future.
                <br />
                <span>Grow with purpose.</span>
              </h1>

              <p className="hero-description">
                Take a more intentional approach to your financial goals.
                Explore structured investment options and track your progress
                with NEXTVEST.
              </p>

              <div className="hero-actions">
                <button
                  className="button button-primary button-large"
                  onClick={() => scrollTo('plans')}
                >
                  Explore investment plans
                  <ArrowRight size={18} />
                </button>

                <button
                  className="button button-outline button-large"
                  onClick={() => scrollTo('how-it-works')}
                >
                  How it works
                </button>
              </div>

              <div className="hero-assurance">
                <div className="assurance-icon">
                  <ShieldCheck size={18} />
                </div>

                <span>
                  Transparent terms. Clear records. Informed decisions.
                </span>
              </div>
            </div>

            {/* PORTFOLIO PREVIEW */}
            <div className="hero-visual">
              <div className="visual-orbit orbit-one" />
              <div className="visual-orbit orbit-two" />

              <div className="portfolio-card">
                <div className="portfolio-top">
                  <div>
                    <span className="small-label">YOUR INVESTMENT OVERVIEW</span>
                    <h3>Plan preview</h3>
                  </div>

                  <div className="portfolio-icon">
                    <ChartNoAxesCombined size={21} />
                  </div>
                </div>

                <div className="portfolio-balance">
                  <span>Illustrative investment amount</span>
                  <h2>₦100,000</h2>
                  <span className="balance-caption">
                    Example only · Not an actual account balance
                  </span>
                </div>

                <div className="chart-container">
                  <div className="chart-labels">
                    <span>Illustrative progress</span>
                    <span>Example</span>
                  </div>

                  <svg
                    className="growth-chart"
                    viewBox="0 0 420 150"
                    preserveAspectRatio="none"
                    role="img"
                    aria-label="Illustrative investment progress line"
                  >
                    <defs>
                      <linearGradient
                        id="chartFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#10b981"
                          stopOpacity="0.28"
                        />
                        <stop
                          offset="100%"
                          stopColor="#10b981"
                          stopOpacity="0"
                        />
                      </linearGradient>
                    </defs>

                    <path
                      d="M0,125 C35,116 45,104 75,110 S125,90 150,94 S190,62 220,78 S260,45 290,56 S340,28 360,36 S395,13 420,16 L420,150 L0,150 Z"
                      fill="url(#chartFill)"
                    />

                    <path
                      d="M0,125 C35,116 45,104 75,110 S125,90 150,94 S190,62 220,78 S260,45 290,56 S340,28 360,36 S395,13 420,16"
                      fill="none"
                      stroke="#34d399"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>

                  <div className="chart-months">
                    <span>Start</span>
                    <span>Progress</span>
                    <span>Review</span>
                  </div>
                </div>

                <div className="portfolio-bottom">
                  <div>
                    <span className="small-label">Investment approach</span>
                    <strong>Structured plans</strong>
                  </div>

                  <div className="portfolio-bottom-icon">
                    <ArrowUpRight size={20} />
                  </div>
                </div>
              </div>

              <div className="floating-card floating-card-top">
                <div className="floating-icon">
                  <LockKeyhole size={17} />
                </div>

                <div>
                  <strong>Account controls</strong>
                  <span>Designed for clarity</span>
                </div>
              </div>

              <div className="floating-card floating-card-bottom">
                <div className="floating-icon floating-icon-light">
                  <Wallet size={18} />
                </div>

                <div>
                  <strong>Track your activity</strong>
                  <span>Keep records in one place</span>
                </div>
              </div>
            </div>
          </div>

          <div className="container hero-bottom">
            <span>PLAN WITH CLARITY</span>
            <span className="hero-bottom-line" />
            <span>INVEST WITH PURPOSE</span>
            <span className="hero-bottom-line" />
            <span>TRACK YOUR PROGRESS</span>
          </div>
        </section>

        {/* BENEFITS */}
        <section className="benefits-section" id="about">
          <div className="container benefits-grid">
            <div className="benefit-item">
              <div className="benefit-icon">
                <ShieldCheck size={22} />
              </div>

              <div>
                <h3>Clear investment terms</h3>
                <p>Understand the conditions before committing funds.</p>
              </div>
            </div>

            <div className="benefit-item">
              <div className="benefit-icon">
                <ChartNoAxesCombined size={22} />
              </div>

              <div>
                <h3>Track your activity</h3>
                <p>Review investment records and progress in one place.</p>
              </div>
            </div>

            <div className="benefit-item">
              <div className="benefit-icon">
                <Headphones size={22} />
              </div>

              <div>
                <h3>Customer support</h3>
                <p>Know where to go when you need assistance.</p>
              </div>
            </div>
          </div>
        </section>

        {/* PLANS */}
        <section className="section plans-section" id="plans">
          <div className="container">
            <div className="section-heading">
              <div>
                <span className="section-kicker">EXPLORE YOUR OPTIONS</span>

                <h2>
                  Find a plan that
                  <br />
                  <span>fits your goals.</span>
                </h2>
              </div>

              <p>
                Compare investment structures, minimum amounts, durations and
                conditions before deciding which option suits you.
              </p>
            </div>

            <div className="plans-grid">
              {plans.map((plan) => (
                <article
                  className={`plan-card ${
                    plan.popular ? 'plan-card-featured' : ''
                  }`}
                  key={plan.id}
                >
                  {plan.popular && (
                    <div className="popular-label">FEATURED OPTION</div>
                  )}

                  <div className="plan-heading">
                    <div className="plan-icon">
                      {plan.id === 'starter' ? (
                        <Zap size={21} />
                      ) : plan.id === 'growth' ? (
                        <TrendingUp size={21} />
                      ) : (
                        <Globe size={21} />
                      )}
                    </div>

                    <h3>{plan.name}</h3>
                  </div>

                  <p className="plan-description">{plan.description}</p>

                  <div className="plan-price">
                    <span>Minimum amount</span>
                    <strong>{formatMoney(plan.minimum)}</strong>
                  </div>

                  <div className="plan-details">
                    <div>
                      <Clock3 size={17} />
                      <span>Illustrative duration</span>
                      <strong>{plan.duration}</strong>
                    </div>

                    <div>
                      <ShieldCheck size={17} />
                      <span>Return terms</span>
                      <strong>{plan.rate}</strong>
                    </div>
                  </div>

                  <div className="plan-divider" />

                  <span className="features-title">PLAN OVERVIEW</span>

                  <ul className="plan-features">
                    {plan.features.map((feature) => (
                      <li key={feature}>
                        <Check size={16} />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <button
                    className={`button plan-button ${
                      plan.popular ? 'button-primary' : 'button-outline'
                    }`}
                    onClick={() => {
                      setSelectedPlan(plan.id)
                      setInvestment(plan.minimum)
                      scrollTo('calculator')
                    }}
                  >
                    Explore this plan
                    <ArrowRight size={16} />
                  </button>
                </article>
              ))}
            </div>

            <p className="plans-disclaimer">
              These are preliminary interface examples, not verified or
              available financial products. Durations are illustrative.
              No investment return is promised here. Actual plans, fees,
              eligibility, risks and withdrawal conditions must be confirmed
              before launch.
            </p>
          </div>
        </section>

        {/* CALCULATOR */}
        <section className="section calculator-section" id="calculator">
          <div className="container calculator-grid">
            <div className="calculator-copy">
              <span className="section-kicker">PLAN AHEAD</span>

              <h2>
                Start with a number.
                <br />
                <span>Build with intention.</span>
              </h2>

              <p>
                Explore how different starting amounts fit your planning
                process. Actual returns, if any, depend on the verified terms
                of a legitimate investment product.
              </p>

              <div className="calculator-assurance">
                <ShieldCheck size={19} />
                <span>
                  No fabricated returns or guaranteed-profit claims.
                </span>
              </div>
            </div>

            <div className="calculator-card">
              <div className="calculator-card-heading">
                <div>
                  <span className="small-label">INVESTMENT PLANNER</span>
                  <h3>Explore an amount</h3>
                </div>

                <div className="calculator-heading-icon">
                  <ArrowDownRight size={20} />
                </div>
              </div>

              <label htmlFor="investment-amount" className="input-label">
                Amount you want to plan with
              </label>

              <div className="amount-input-wrap">
                <span>₦</span>

                <input
                  id="investment-amount"
                  type="number"
                  min="0"
                  max="100000000"
                  step="1000"
                  value={investment}
                  onChange={handleInvestmentChange}
                />
              </div>

              <input
                className="amount-slider"
                type="range"
                min="10000"
                max="1000000"
                step="10000"
                value={Math.max(10000, Math.min(investment, 1000000))}
                onChange={(event) =>
                  setInvestment(Number(event.target.value))
                }
                aria-label="Adjust planned amount"
              />

              <div className="slider-labels">
                <span>₦10,000</span>
                <span>₦1,000,000</span>
              </div>

              <label htmlFor="plan-select" className="input-label">
                Choose a plan example
              </label>

              <div className="select-wrap">
                <select
                  id="plan-select"
                  value={selectedPlan}
                  onChange={(event) => setSelectedPlan(event.target.value)}
                >
                  {plans.map((plan) => (
                    <option value={plan.id} key={plan.id}>
                      {plan.name} — {plan.duration}
                    </option>
                  ))}
                </select>

                <ChevronDown size={17} />
              </div>

              <div className="planner-summary">
                <div>
                  <span>Selected plan</span>
                  <strong>{activePlan.name}</strong>
                </div>

                <div>
                  <span>Planned amount</span>
                  <strong>{formatMoney(investment)}</strong>
                </div>

                <div>
                  <span>Example duration</span>
                  <strong>{activePlan.duration}</strong>
                </div>
              </div>

              <div className="planner-note">
                This tool is for planning only. It does not calculate or
                predict profit, and it does not initiate an investment.
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="section process-section" id="how-it-works">
          <div className="container">
            <div className="section-heading section-heading-centered">
              <span className="section-kicker">A CLEARER PROCESS</span>

              <h2>
                Know the steps.
                <br />
                <span>Make informed decisions.</span>
              </h2>

              <p>
                A proposed journey from creating an account to reviewing an
                investment and its terms.
              </p>
            </div>

            <div className="process-grid">
              <div className="process-card">
                <span className="process-number">01</span>

                <div className="process-icon">
                  <LockKeyhole size={23} />
                </div>

                <h3>Create your account</h3>

                <p>
                  Register with your details and complete any required
                  verification.
                </p>
              </div>

              <div className="process-card">
                <span className="process-number">02</span>

                <div className="process-icon">
                  <ChartNoAxesCombined size={23} />
                </div>

                <h3>Review the plans</h3>

                <p>
                  Understand the investment structure, risks, fees and
                  withdrawal terms.
                </p>
              </div>

              <div className="process-card">
                <span className="process-number">03</span>

                <div className="process-icon">
                  <Wallet size={23} />
                </div>

                <h3>Fund your account</h3>

                <p>
                  Use an approved payment method and confirm your transaction
                  record.
                </p>
              </div>

              <div className="process-card">
                <span className="process-number">04</span>

                <div className="process-icon">
                  <TrendingUp size={23} />
                </div>

                <h3>Track your investment</h3>

                <p>
                  Review your investment status and follow the agreed terms
                  through maturity.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="section faq-section" id="faq">
          <div className="container faq-grid">
            <div className="faq-intro">
              <span className="section-kicker">NEED CLARITY?</span>

              <h2>
                Questions worth
                <br />
                <span>asking first.</span>
              </h2>

              <p>
                Investment decisions deserve clear answers. Review these
                basics before proceeding.
              </p>

              <a
                className="faq-support-link"
                href="https://t.me/nextvest_support"
                target="_blank"
                rel="noreferrer"
              >
                Contact recommended support
                <ArrowUpRight size={17} />
              </a>
            </div>

            <div className="faq-list">
              <details>
                <summary>
                  How does NEXTVEST work?
                  <ChevronDown size={18} />
                </summary>

                <p>
                  NEXTVEST is being developed to help users review investment
                  options and track their activity. The actual investment
                  products, operators and applicable terms must be verified
                  and disclosed before funds are accepted.
                </p>
              </details>

              <details>
                <summary>
                  Are returns guaranteed?
                  <ChevronDown size={18} />
                </summary>

                <p>
                  No return should be assumed or treated as guaranteed based
                  on this demonstration website. Any future return claims
                  must be supported by a legitimate, clearly documented
                  arrangement and appropriate disclosures.
                </p>
              </details>

              <details>
                <summary>
                  How can I fund an account?
                  <ChevronDown size={18} />
                </summary>

                <p>
                  Paystack is the planned payment provider. Deposits will
                  become available only after the backend integration,
                  transaction verification and required approvals are
                  completed.
                </p>
              </details>

              <details>
                <summary>
                  When can I withdraw my money?
                  <ChevronDown size={18} />
                </summary>

                <p>
                  Withdrawal eligibility will depend on the verified product
                  terms, account status and any applicable restrictions.
                  These conditions must be displayed clearly before users
                  commit funds.
                </p>
              </details>

              <details>
                <summary>
                  What if I need help?
                  <ChevronDown size={18} />
                </summary>

                <p>
                  You can contact the NEXTVEST support team through the
                  recommended Telegram support channel, WhatsApp or email
                  listed below.
                </p>
              </details>
            </div>
          </div>
        </section>

        {/* RISK DISCLOSURE */}
        <section className="risk-section">
          <div className="container risk-container">
            <div className="risk-icon">
              <CircleHelp size={22} />
            </div>

            <div>
              <h3>Understand the risks before investing</h3>

              <p>
                Investments can involve loss of capital, liquidity
                restrictions and other risks. Past performance does not
                establish future results. NEXTVEST's live products, legal
                status, applicable authorisations and investment terms must
                be verified before real-money operations begin.
              </p>
            </div>
          </div>
        </section>

        {/* SUPPORT */}
        <section className="section support-section" id="contact">
          <div className="container">
            <div className="support-card">
              <div className="support-glow" />

              <div className="support-content">
                <span className="section-kicker">WE'RE HERE TO HELP</span>

                <h2>
                  Need a hand?
                  <br />
                  <span>Let's talk.</span>
                </h2>

                <p>
                  Reach out to the support team for assistance with account
                  questions, platform information or general enquiries.
                </p>
              </div>

              <div className="support-actions">
                <a
                  className="button button-primary button-large"
                  href="https://t.me/nextvest_support"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Headphones size={18} />
                  Telegram support
                  <ArrowUpRight size={17} />
                </a>

                <span className="recommended-label">
                  Recommended Support Channel
                </span>

                <a
                  className="support-contact-link"
                  href="https://wa.me/2348162056605"
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp: 08162056605
                </a>

                <a
                  className="support-contact-link"
                  href="mailto:support.customers911@gmail.com"
                >
                  support.customers911@gmail.com
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="site-footer">
        <div className="container">
          <div className="footer-main">
            <div className="footer-brand">
              <a href="#home" className="brand">
                <span className="brand-icon">
                  <TrendingUp size={21} strokeWidth={2.5} />
                </span>

                <span>
                  NEXT<span className="brand-highlight">VEST</span>
                </span>
              </a>

              <p>
                A more intentional approach to planning, investing and
                tracking your financial journey.
              </p>
            </div>

            <div className="footer-column">
              <h4>Explore</h4>
              <a href="#about">About us</a>
              <a href="#plans">Investment plans</a>
              <a href="#how-it-works">How it works</a>
              <a href="#faq">Frequently asked questions</a>
            </div>

            <div className="footer-column">
              <h4>Support</h4>

              <a
                href="https://t.me/nextvest_support"
                target="_blank"
                rel="noreferrer"
              >
                Telegram support
              </a>

              <a href="https://wa.me/2348162056605" target="_blank" rel="noreferrer">
                WhatsApp
              </a>

              <a href="mailto:support.customers911@gmail.com">
                Email support
              </a>

              <a href="#contact">Contact us</a>
            </div>

            <div className="footer-column">
              <h4>Important</h4>
              <a href="#risk-disclosure">Risk disclosure</a>
              <a href="#privacy">Privacy policy</a>
              <a href="#terms">Terms of service</a>
            </div>
          </div>

          <div className="footer-bottom" id="risk-disclosure">
            <span>
              © {new Date().getFullYear()} NEXTVEST. All rights reserved.
            </span>

            <span className="footer-status">
              <span className="status-dot" />
              Development preview
            </span>
          </div>

          <div className="footer-legal" id="privacy">
            <p>
              NEXTVEST is currently a development preview. Displayed plans
              and illustrations are not offers to invest, and no live
              investment, deposit or withdrawal functionality is represented
              as operational. Legal documents, privacy practices, product
              terms and any required regulatory authorisations must be
              completed and verified before launch.
            </p>
          </div>

          <span id="terms" className="footer-anchor" />
        </div>
      </footer>
    </div>
  )
}

export default App