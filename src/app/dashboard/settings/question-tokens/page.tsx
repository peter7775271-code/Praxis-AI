/* Buy Question Tokens full-page pricing */
'use client';

import Link from 'next/link';
import { useState } from 'react';

type QuestionPackageKey =
  | 'questions_200'
  | 'questions_400'
  | 'questions_600'
  | 'questions_800'
  | 'questions_1000'
  | 'questions_1500'
  | 'questions_2000';

const QUESTION_PACKAGES: {
  key: QuestionPackageKey;
  qty: number;
  price: string;
  cpp: string;
  best?: boolean;
}[] = [
  { key: 'questions_200', qty: 200, price: '$69', cpp: '$0.35' },
  { key: 'questions_400', qty: 400, price: '$129', cpp: '$0.32' },
  { key: 'questions_600', qty: 600, price: '$179', cpp: '$0.30' },
  { key: 'questions_800', qty: 800, price: '$219', cpp: '$0.27' },
  { key: 'questions_1000', qty: 1000, price: '$249', cpp: '$0.25' },
  { key: 'questions_1500', qty: 1500, price: '$324', cpp: '$0.22' },
  { key: 'questions_2000', qty: 2000, price: '$384', cpp: '$0.19', best: true },
];

async function startTokenCheckout(pkg: QuestionPackageKey): Promise<string | null> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (!token) {
    throw new Error('You need to sign in before purchasing tokens.');
  }

  const response = await fetch('/api/stripe/create-payment-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ package: pkg }),
  });

  const data = (await response.json().catch(() => ({}))) as { error?: string; checkoutUrl?: string };

  if (response.status === 401) {
    throw new Error(data.error || 'Your session expired. Please sign in again.');
  }

  if (!response.ok || !data.checkoutUrl) {
    throw new Error(data.error || 'Could not start checkout. Please try again.');
  }

  return data.checkoutUrl ?? null;
}

export default function QuestionTokensPage() {
  const [selected, setSelected] = useState<QuestionPackageKey | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = (pkg: QuestionPackageKey) => {
    setSelected(pkg);
    setError(null);
    setMessage(null);
  };

  const handlePrimaryCta = async () => {
    if (!selected || isProcessing) {
      return;
    }

    setIsProcessing(true);
    setError(null);
    setMessage(null);

    try {
      const url = await startTokenCheckout(selected);
      if (url) {
        window.location.href = url;
      } else {
        setError('Failed to start checkout. Please try again.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start checkout. Please try again.';
      setError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <main
      className="min-h-screen px-4 py-10 flex items-center justify-center"
      style={{ backgroundColor: '#fdfcfb' }}
    >
      <div className="w-full max-w-4xl">
        <header className="mb-10 text-center">
          <p
            className="text-xs tracking-[0.15em] uppercase font-semibold mb-3"
            style={{ color: '#c77f3e' }}
          >
            HSC Question Bank
          </p>
          <h1
            className="text-3xl md:text-4xl mb-3"
            style={{
              fontFamily: '"DM Serif Display", system-ui, -apple-system, BlinkMacSystemFont, serif',
              color: '#1a1a1a',
              letterSpacing: '-0.02em',
            }}
          >
            Expand Your Library
          </h1>
          <p className="mx-auto max-w-xl text-sm md:text-base" style={{ color: '#4a4a4a' }}>
            Choose the perfect one-time token package for your tutoring centre. All questions include
            full worked solutions and syllabus alignment.
          </p>
        </header>

        <section
          className="overflow-hidden rounded-2xl border shadow-sm bg-white"
          style={{ borderColor: '#e5e1da' }}
        >
          <div
            className="px-6 py-5 text-center border-b"
            style={{
              background: 'linear-gradient(135deg, #f7f5f2 0%, #ffffff 100%)',
              borderColor: '#e5e1da',
            }}
          >
            <h2
              className="text-xl mb-1"
              style={{
                fontFamily: '"DM Serif Display", system-ui, -apple-system, BlinkMacSystemFont, serif',
                color: '#1a1a1a',
              }}
            >
              One-Time Question Tokens
            </h2>
            <p className="text-sm" style={{ color: '#4a4a4a' }}>
              Lifetime use of your purchased tokens — no expiry.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th
                    className="text-left text-[11px] font-semibold uppercase tracking-[0.08em] px-6 pt-5 pb-3"
                    style={{ color: '#8a8a8a', backgroundColor: '#ffffff', borderBottom: '1px solid #e5e1da' }}
                  >
                    Questions
                  </th>
                  <th
                    className="text-right text-[11px] font-semibold uppercase tracking-[0.08em] px-6 pt-5 pb-3"
                    style={{ color: '#8a8a8a', backgroundColor: '#ffffff', borderBottom: '1px solid #e5e1da' }}
                  >
                    Price
                  </th>
                  <th
                    className="text-right text-[11px] font-semibold uppercase tracking-[0.08em] px-6 pt-5 pb-3"
                    style={{ color: '#8a8a8a', backgroundColor: '#ffffff', borderBottom: '1px solid #e5e1da' }}
                  >
                    Per Question
                  </th>
                </tr>
              </thead>
              <tbody>
                {QUESTION_PACKAGES.map((pkg) => {
                  const isSelected = selected === pkg.key;

                  return (
                    <tr
                      key={pkg.key}
                      className="cursor-pointer transition-all"
                      style={{
                        backgroundColor: isSelected ? '#f7f5f2' : 'transparent',
                        borderBottom: '1px solid #e5e1da',
                      }}
                      onClick={() => handleSelect(pkg.key)}
                    >
                      <td className="px-6 py-4 text-sm font-semibold" style={{ color: '#1a1a1a' }}>
                        {pkg.qty}
                      </td>
                      <td className="px-6 py-4 text-right text-base font-semibold" style={{ color: '#1a1a1a' }}>
                        {pkg.price}
                      </td>
                      <td
                        className="px-6 py-4 text-right text-xs"
                        style={{ color: '#8a8a8a', whiteSpace: 'nowrap' }}
                      >
                        {pkg.cpp}
                        {pkg.best && (
                          <span
                            className="inline-flex items-center ml-2 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                            style={{ backgroundColor: '#e8f5e9', color: '#2e7d32' }}
                          >
                            Best value
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div
            className="px-6 py-6"
            style={{ backgroundColor: '#f7f5f2', borderTop: '1px solid #e5e1da' }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-3" style={{ color: '#8a8a8a' }}>
              What&apos;s included
            </p>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 text-sm">
              <div className="flex items-center gap-2" style={{ color: '#4a4a4a' }}>
                <span className="text-base" style={{ color: '#c77f3e' }}>
                  ✓
                </span>
                <span>LaTeX-formatted questions</span>
              </div>
              <div className="flex items-center gap-2" style={{ color: '#4a4a4a' }}>
                <span className="text-base" style={{ color: '#c77f3e' }}>
                  ✓
                </span>
                <span>Full worked solutions</span>
              </div>
              <div className="flex items-center gap-2" style={{ color: '#4a4a4a' }}>
                <span className="text-base" style={{ color: '#c77f3e' }}>
                  ✓
                </span>
                <span>Syllabus dot-point tagging</span>
              </div>
              <div className="flex items-center gap-2" style={{ color: '#4a4a4a' }}>
                <span className="text-base" style={{ color: '#c77f3e' }}>
                  ✓
                </span>
                <span>Custom exam generator</span>
              </div>
              <div className="flex items-center gap-2" style={{ color: '#4a4a4a' }}>
                <span className="text-base" style={{ color: '#c77f3e' }}>
                  ✓
                </span>
                <span>All difficulty levels</span>
              </div>
              <div className="flex items-center gap-2" style={{ color: '#4a4a4a' }}>
                <span className="text-base" style={{ color: '#c77f3e' }}>
                  ✓
                </span>
                <span>Lifetime access</span>
              </div>
            </div>
          </div>
        </section>

        {(message || error) && (
          <div className="mt-4">
            {message && (
              <div
                className="rounded-xl border px-4 py-3 text-sm mb-2"
                style={{ backgroundColor: '#e8f5e9', borderColor: '#a7f3d0', color: '#2e7d32' }}
              >
                {message}
              </div>
            )}
            {error && (
              <div
                className="rounded-xl border px-4 py-3 text-sm"
                style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}
              >
                {error}
              </div>
            )}
          </div>
        )}

        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <button
            type="button"
            onClick={handlePrimaryCta}
            disabled={!selected || isProcessing}
            className="inline-flex items-center justify-center rounded-lg px-6 py-2.5 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              backgroundColor: selected ? '#c77f3e' : '#e5e1da',
              color: '#ffffff',
              boxShadow: selected ? '0 6px 20px rgba(199, 127, 62, 0.3)' : 'none',
            }}
          >
            {isProcessing
              ? 'Redirecting to Stripe…'
              : selected
                ? `Buy ${QUESTION_PACKAGES.find((p) => p.key === selected)?.qty ?? ''} question tokens`
                : 'Select a package to continue'}
          </button>
          <p className="text-xs" style={{ color: '#8a8a8a' }}>
            You&apos;ll be redirected to Stripe to complete your purchase. Tokens are added immediately after
            payment is confirmed.
          </p>
          <p className="text-xs" style={{ color: '#8a8a8a' }}>
            Prefer a custom arrangement?{' '}
            <a
              href="mailto:hello@hscquestionbank.com"
              className="underline underline-offset-2"
              style={{ color: '#c77f3e' }}
            >
              Contact us
            </a>{' '}
            for bespoke packages.
          </p>
          <Link
            href="/dashboard/settings"
            className="mt-2 text-xs underline underline-offset-4"
            style={{ color: '#4a4a4a' }}
          >
            Back to settings
          </Link>
        </div>
      </div>
    </main>
  );
}

