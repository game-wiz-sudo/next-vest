import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState(
    "Enter your registered email address and the six-digit code sent to your inbox."
  );
  const [resending, setResending] = useState(false);

  const verifyEmail = async (event) => {
    event.preventDefault();

    if (!email.trim()) {
      setStatus("error");
      setMessage("Please enter your registered email address.");
      return;
    }

    if (!/^\d{6}$/.test(code)) {
      setStatus("error");
      setMessage("Please enter a valid six-digit verification code.");
      return;
    }

    setStatus("loading");
    setMessage("Verifying your email address...");

    try {
      const response = await fetch(
        "http://localhost:5000/api/auth/verify-email",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim(),
            code,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || data.error || "Email verification failed."
        );
      }

      setStatus("success");
      setMessage(
        data.message || "Your email address has been verified successfully."
      );
    } catch (error) {
      setStatus("error");
      setMessage(
        error.message || "Unable to verify your email. Please try again."
      );
    }
  };

  const resendCode = async () => {
    if (!email.trim()) {
      setStatus("error");
      setMessage("Enter your email address before requesting a new code.");
      return;
    }

    setResending(true);
    setMessage("Sending a new verification code...");

    try {
      const response = await fetch(
        "http://localhost:5000/api/auth/resend-verification",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || data.error || "Unable to resend the code."
        );
      }

      setStatus("idle");
      setCode("");
      setMessage(
        data.message || "A new verification code has been sent to your email."
      );
    } catch (error) {
      setStatus("error");
      setMessage(
        error.message || "Unable to resend the code. Please try again."
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <main className="verify-page">
      <section className="verify-card">
        <div className={`verify-icon ${status}`} aria-live="polite">
          {status === "loading" && <span className="verify-spinner" />}
          {status === "success" && "✓"}
          {status === "error" && "!"}
          {(status === "idle" || status === "resending") && "✉"}
        </div>

        <h1>
          {status === "loading" && "Verifying your email"}
          {status === "success" && "Email verified!"}
          {status === "error" && "Verification issue"}
          {(status === "idle" || status === "resending") &&
            "Verify your email"}
        </h1>

        <p className="verify-message" aria-live="polite">
          {message}
        </p>

        {status !== "success" && (
          <form onSubmit={verifyEmail} className="verify-form">
            <label htmlFor="verify-email">Email address</label>

            <input
              id="verify-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />

            <label htmlFor="verification-code">Six-digit code</label>

            <input
              id="verification-code"
              type="text"
              placeholder="000000"
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="[0-9]{6}"
              required
            />

            <button
              type="submit"
              className="verify-button"
              disabled={status === "loading"}
            >
              {status === "loading" ? "Verifying..." : "Verify Email"}
            </button>

            <button
              type="button"
              className="verify-resend"
              onClick={resendCode}
              disabled={resending || status === "loading"}
            >
              {resending ? "Sending..." : "Resend Code"}
            </button>
          </form>
        )}

        {status === "success" && (
          <Link to="/login" className="verify-button">
            Continue to Login
          </Link>
        )}

        <div className="verify-brand">NEXTVEST</div>

        {status !== "success" && (
          <Link to="/register" className="verify-back">
            Return to Registration
          </Link>
        )}
      </section>

      <style>{`
        .verify-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          box-sizing: border-box;
          background: #07110f;
          color: #f1f5f4;
          font-family: Arial, sans-serif;
        }

        .verify-card {
          width: 100%;
          max-width: 440px;
          padding: 42px 30px;
          box-sizing: border-box;
          text-align: center;
          background: #0d1b18;
          border: 1px solid #23443a;
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
        }

        .verify-icon {
          width: 66px;
          height: 66px;
          margin: 0 auto 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          font-size: 32px;
          font-weight: 700;
        }

        .verify-icon.idle,
        .verify-icon.loading {
          background: #153c30;
          color: #34d399;
        }

        .verify-icon.success {
          background: #123f2c;
          color: #4ade80;
        }

        .verify-icon.error {
          background: #452020;
          color: #fca5a5;
        }

        .verify-spinner {
          width: 28px;
          height: 28px;
          border: 3px solid #315b4c;
          border-top-color: #34d399;
          border-radius: 50%;
          animation: verify-spin 0.8s linear infinite;
        }

        .verify-card h1 {
          margin: 0 0 14px;
          font-size: clamp(23px, 5vw, 29px);
          line-height: 1.3;
        }

        .verify-message {
          margin: 0;
          color: #a8bbb4;
          font-size: 15px;
          line-height: 1.8;
          overflow-wrap: anywhere;
        }

        .verify-form {
          margin-top: 26px;
          text-align: left;
        }

        .verify-form label {
          display: block;
          margin: 18px 0 8px;
          color: #d4e5de;
          font-size: 13px;
          font-weight: 600;
        }

        .verify-form input {
          width: 100%;
          box-sizing: border-box;
          padding: 14px 15px;
          border: 1px solid #315548;
          border-radius: 10px;
          outline: none;
          background: #091511;
          color: #f1f5f4;
          font-size: 15px;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .verify-form input:focus {
          border-color: #10b981;
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.12);
        }

        #verification-code {
          text-align: center;
          font-size: 24px;
          font-weight: 700;
          letter-spacing: 9px;
        }

        .verify-button {
          display: block;
          width: 100%;
          margin-top: 24px;
          padding: 14px 18px;
          box-sizing: border-box;
          border: none;
          border-radius: 10px;
          background: #10b981;
          color: #04130d;
          font-size: 15px;
          font-weight: 700;
          text-align: center;
          text-decoration: none;
          cursor: pointer;
          transition: background 0.2s ease, transform 0.2s ease;
        }

        .verify-button:hover {
          background: #34d399;
        }

        .verify-button:active {
          transform: scale(0.98);
        }

        .verify-button:disabled,
        .verify-resend:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .verify-resend {
          display: block;
          width: 100%;
          margin-top: 12px;
          padding: 13px 18px;
          border: 1px solid #315548;
          border-radius: 10px;
          background: transparent;
          color: #a7f3d0;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .verify-resend:hover:not(:disabled) {
          background: #153c30;
        }

        .verify-brand {
          margin-top: 32px;
          color: #658477;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 3px;
        }

        .verify-back {
          display: inline-block;
          margin-top: 18px;
          color: #8fa99e;
          font-size: 13px;
          text-decoration: none;
        }

        .verify-back:hover {
          color: #34d399;
        }

        @keyframes verify-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 480px) {
          .verify-card {
            padding: 34px 22px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .verify-spinner {
            animation-duration: 2s;
          }
        }
      `}</style>
    </main>
  );
}