import React from 'react';

export interface LandingProps {
  onSignIn: () => void;
}

export function Landing({ onSignIn }: LandingProps) {
  return (
    <div className="landing-container">
      <style>{`
        .landing-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          min-height: 100vh;
          min-height: 100dvh;
          width: 100%;
          background-color: var(--surface);
          color: var(--text);
          padding: 2.5rem 1.5rem;
          box-sizing: border-box;
          font-family: 'Segoe UI Variable Text', 'Segoe UI', system-ui, -apple-system, sans-serif;
        }

        .landing-content {
          display: flex;
          flex-direction: column;
          width: 100%;
          max-width: 640px;
          flex: 1;
          justify-content: space-between;
          gap: 3.5rem;
        }

        .landing-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          animation: landingFadeInDown 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .landing-logo {
          font-size: 1.5rem;
          font-weight: 800;
          letter-spacing: -0.04em;
          color: var(--text);
          margin: 0;
          user-select: none;
          background: linear-gradient(135deg, var(--text) 30%, var(--accent) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .landing-signin-btn {
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 0.5rem 1.125rem;
          color: var(--text);
          font-weight: 600;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .landing-signin-btn:hover {
          background-color: var(--border);
          border-color: var(--text-muted);
          transform: translateY(-1px);
        }

        .landing-signin-btn:active {
          transform: translateY(0);
        }

        .landing-hero {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 1.5rem;
          margin: auto 0;
          animation: landingFadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .landing-headline {
          font-size: 3rem;
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 1.15;
          margin: 0;
          background: linear-gradient(135deg, var(--text) 50%, var(--accent) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .landing-subtext {
          font-size: 1.125rem;
          line-height: 1.6;
          color: var(--text-muted);
          max-width: 480px;
          margin: 0;
        }

        .landing-hero-btn {
          background-color: var(--accent);
          color: #0f1115; /* Dark contrasting text */
          border: none;
          border-radius: 9999px;
          padding: 0.875rem 1.75rem;
          font-size: 1rem;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          box-shadow: 0 4px 20px rgba(255, 119, 89, 0.25);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .landing-hero-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 24px rgba(255, 119, 89, 0.4);
          filter: brightness(1.05);
        }

        .landing-hero-btn:active {
          transform: translateY(0);
        }

        .landing-features {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
          width: 100%;
          animation: landingFadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .landing-card {
          background-color: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.75rem;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          text-align: left;
        }

        .landing-card:hover {
          border-color: var(--accent);
          transform: translateY(-3px);
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        }

        .landing-card-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: rgba(255, 119, 89, 0.1);
          color: var(--accent);
          transition: all 0.2s ease;
        }

        .landing-card:hover .landing-card-icon {
          background: var(--accent);
          color: #0f1115;
          transform: scale(1.05);
        }

        .landing-card-title {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--text);
          margin: 0;
        }

        .landing-card-desc {
          font-size: 0.825rem;
          line-height: 1.4;
          color: var(--text-muted);
          margin: 0;
        }

        .landing-footer {
          text-align: center;
          color: var(--text-muted);
          font-size: 0.75rem;
          letter-spacing: 0.02em;
          padding-top: 1rem;
          animation: landingFadeIn 1.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes landingFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes landingFadeInDown {
          from { opacity: 0; transform: translateY(-12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes landingFadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 640px) {
          .landing-features {
            grid-template-columns: 1fr;
            gap: 0.75rem;
          }
          .landing-headline {
            font-size: 2.25rem;
          }
          .landing-content {
            gap: 2.5rem;
          }
        }
      `}</style>

      <div className="landing-content">
        <header className="landing-header">
          <h1 className="landing-logo">Cove</h1>
          <button className="landing-signin-btn" onClick={onSignIn}>
            Sign In
          </button>
        </header>

        <main className="landing-hero">
          <h2 className="landing-headline">Your space. Your friends.</h2>
          <p className="landing-subtext">
            Private voice and text communities, no ads, no algorithms, no noise.
          </p>
          <button className="landing-hero-btn" onClick={onSignIn}>
            Get Early Access →
          </button>
        </main>

        <section className="landing-features">
          <div className="landing-card">
            <div className="landing-card-icon">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
            </div>
            <h3 className="landing-card-title">Voice that works</h3>
            <p className="landing-card-desc">
              Low-latency spatial audio that makes you feel like you are in the same room.
            </p>
          </div>

          <div className="landing-card">
            <div className="landing-card-icon">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="4" x2="20" y1="9" y2="9" />
                <line x1="4" x2="20" y1="15" y2="15" />
                <line x1="10" x2="8" y1="3" y2="21" />
                <line x1="16" x2="14" y1="3" y2="21" />
              </svg>
            </div>
            <h3 className="landing-card-title">Spaces that feel like yours</h3>
            <p className="landing-card-desc">
              Organize your discussions with customizable channels and flexible permissions.
            </p>
          </div>

          <div className="landing-card">
            <div className="landing-card-icon">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h3 className="landing-card-title">Privacy by default</h3>
            <p className="landing-card-desc">
              No advertising, no data-mining, and no algorithmic feeds to distract you.
            </p>
          </div>
        </section>

        <footer className="landing-footer">Built for friends, not engagement.</footer>
      </div>
    </div>
  );
}

export default Landing;
