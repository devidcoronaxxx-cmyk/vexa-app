"use client";

import { useState, useEffect } from "react";

const BANNER_KEY = "Vexa_banner_dismissed2";

export default function VexaBanner() {
  return null;

  const [visible, setVisible] = useState(false);
  const [hiding, setHiding] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(BANNER_KEY)) {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    setHiding(true);
    setTimeout(() => {
      setVisible(false);
      localStorage.setItem(BANNER_KEY, "1");
    }, 350);
  };

  if (!visible) return null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');

        .Vexa-banner {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 9999;
          font-family: 'DM Sans', sans-serif;
          background: #0a0a0a;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 10px 44px 10px 16px;
          border-bottom: 1px solid #1e1e1e;
          animation: bannerSlideDown 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
          min-height: 44px;
          box-sizing: border-box;
        }

        .Vexa-banner.hiding {
          animation: bannerSlideUp 0.35s ease forwards;
        }

        @keyframes bannerSlideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes bannerSlideUp {
          from {
            transform: translateY(0);
            opacity: 1;
          }
          to {
            transform: translateY(-100%);
            opacity: 0;
          }
        }

        .Vexa-banner__inner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          max-width: 760px;
          position: relative;
          z-index: 1;
        }

        .Vexa-banner__icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          color: #ef4444;
          flex-shrink: 0;
        }

        .Vexa-banner__text {
          font-size: 13.5px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.8);
          line-height: 1.4;
        }

        .Vexa-banner__text strong {
          color: #fff;
          font-weight: 700;
        }

        .Vexa-banner__close {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.4);
          font-size: 16px;
          line-height: 1;
          cursor: pointer;
          padding: 6px 8px;
          border-radius: 5px;
          transition: color 0.15s, background 0.15s;
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }

        .Vexa-banner__close:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.08);
        }

        @media (min-width: 540px) {
          .Vexa-banner {
            padding: 10px 48px;
          }

          .Vexa-banner__text {
            font-size: 14px;
            white-space: nowrap;
          }

          .Vexa-banner__close {
            right: 14px;
          }
        }

        @media (min-width: 900px) {
          .Vexa-banner {
            padding: 10px 56px;
          }

          .Vexa-banner__text {
            font-size: 14.5px;
          }
        }

        @media (max-width: 540px) {
          .Vexa-banner__inner {
            justify-content: flex-start;
            padding-right: 24px;
          }

          .Vexa-banner__text {
            white-space: normal;
          }
        }

        @media (max-width: 359px) {
          .Vexa-banner {
            padding: 10px 40px 10px 12px;
          }

          .Vexa-banner__close {
            top: 12px;
            transform: none;
          }
        }
      `}</style>

      <div
        className={`Vexa-banner${hiding ? " hiding" : ""}`}
        role="banner"
        aria-label="Authentication status"
      >
        <div className="Vexa-banner__inner">
          <div className="Vexa-banner__icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
          </div>

          <span className="Vexa-banner__text">
            <strong>We&apos;re experiencing authentication issues.</strong>{" "}
            Some users may be unable to sign in while we work on a fix.
          </span>
        </div>

        <button
          className="Vexa-banner__close"
          onClick={dismiss}
          aria-label="Dismiss banner"
        >
          ✕
        </button>
      </div>
    </>
  );
}