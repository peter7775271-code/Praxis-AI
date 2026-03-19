'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type SubscriptionInfo = {
  plan: string;
  planDisplayName: string;
  exportsUsed: number;
  exportsLimit: number;
  exportsRemaining: number | null;
  hasActiveSubscription: boolean;
  exportsResetAt: string | null;
};

export default function ManageSubscriptionPage() {
  const [subInfo, setSubInfo] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      setLoading(false);
      return;
    }

    fetch('/api/user/subscription', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: SubscriptionInfo & { error?: string }) => {
        if (data.error) {
          setError(data.error);
        } else {
          setSubInfo(data);
        }
      })
      .catch(() => setError('Failed to load subscription info'))
      .finally(() => setLoading(false));
  }, []);

  const openCustomerPortal = async () => {
    setPortalLoading(true);
    setError(null);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch('/api/stripe/portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = (await res.json()) as { url?: string; error?: string };

      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Could not open billing portal');
      }

      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open billing portal');
      setPortalLoading(false);
    }
  };

  const planColor = {
    free: { bg: 'var(--clr-surface-a20)', text: 'var(--clr-surface-a50)' },
    standard: { bg: '#E5F1FF', text: '#185FA5' },
    pro: { bg: '#EDE9FE', text: '#6D28D9' },
  }[subInfo?.plan ?? 'free'] ?? { bg: 'var(--clr-surface-a20)', text: 'var(--clr-surface-a50)' };

  return (
    <main className="min-h-screen px-5 py-10 md:px-10" style={{ backgroundColor: '#F3F7FC' }}>
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm" style={{ color: '#5D6B82' }}>Billing</p>
            <h1 className="text-3xl font-semibold" style={{ color: '#0F172A' }}>Manage Subscription</h1>
          </div>
          <Link
            href="/dashboard/settings"
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={{
              backgroundColor: '#FFFFFF',
              color: '#1E293B',
              border: '1px solid #CBD5E1',
            }}
          >
            Back to settings
          </Link>
        </div>

        {error && (
          <div
            className="mb-4 rounded-xl border px-4 py-3 text-sm"
            style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA', color: '#991B1B' }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl bg-white p-6" style={{ border: '1px solid #D6DFEA' }}>
            <p className="text-sm" style={{ color: '#64748B' }}>Loading subscription info…</p>
          </div>
        ) : subInfo ? (
          <div className="space-y-4">
            {/* Current plan card */}
            <div className="rounded-2xl bg-white p-6" style={{ border: '1px solid #D6DFEA', boxShadow: '0 6px 18px rgba(15,23,42,0.06)' }}>
              <h2 className="mb-4 text-lg font-semibold" style={{ color: '#0F172A' }}>Current Plan</h2>

              <div className="flex items-center gap-3 mb-4">
                <span
                  className="inline-block rounded-full px-4 py-1.5 text-sm font-semibold"
                  style={{ backgroundColor: planColor.bg, color: planColor.text }}
                >
                  {subInfo.planDisplayName} Plan
                </span>
              </div>

              {subInfo.hasActiveSubscription ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium mb-1" style={{ color: '#64748B' }}>PDF Exports this month</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 rounded-full bg-gray-100 h-2 overflow-hidden">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: subInfo.exportsLimit > 0
                              ? `${Math.min(100, (subInfo.exportsUsed / subInfo.exportsLimit) * 100)}%`
                              : '0%',
                            backgroundColor: subInfo.exportsUsed >= subInfo.exportsLimit ? '#EF4444' : '#185FA5',
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium" style={{ color: '#1E293B' }}>
                        {subInfo.exportsUsed} / {subInfo.exportsLimit}
                      </span>
                    </div>
                  </div>

                  {subInfo.exportsResetAt && (
                    <p className="text-xs" style={{ color: '#64748B' }}>
                      Resets on {new Date(subInfo.exportsResetAt).toLocaleDateString('en-AU', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm" style={{ color: '#64748B' }}>
                  You are on the free plan. Upgrade to get monthly PDF exports.
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="rounded-2xl bg-white p-6 space-y-3" style={{ border: '1px solid #D6DFEA', boxShadow: '0 6px 18px rgba(15,23,42,0.06)' }}>
              <h2 className="text-lg font-semibold mb-4" style={{ color: '#0F172A' }}>Actions</h2>

              {subInfo.hasActiveSubscription ? (
                <>
                  <button
                    type="button"
                    disabled={portalLoading}
                    onClick={() => void openCustomerPortal()}
                    className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ backgroundColor: '#185FA5' }}
                  >
                    {portalLoading ? 'Opening billing portal…' : 'Manage / Cancel Subscription'}
                  </button>
                  <p className="text-xs" style={{ color: '#94A3B8' }}>
                    Opens the Stripe billing portal where you can change your plan, update payment details, or cancel.
                  </p>
                </>
              ) : (
                <>
                  <Link
                    href="/dashboard/settings/pricing"
                    className="block w-full rounded-lg px-4 py-2.5 text-center text-sm font-semibold text-white"
                    style={{ backgroundColor: '#185FA5' }}
                  >
                    Upgrade to Standard or Pro
                  </Link>
                  <p className="text-xs" style={{ color: '#94A3B8' }}>
                    Choose a plan to unlock monthly PDF exports.
                  </p>
                </>
              )}
            </div>

            {/* Plan comparison quick link */}
            <p className="text-center text-sm" style={{ color: '#5D6B82' }}>
              Want to compare plans?{' '}
              <Link href="/dashboard/settings/pricing" className="underline" style={{ color: '#185FA5' }}>
                View pricing
              </Link>
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white p-6" style={{ border: '1px solid #D6DFEA' }}>
            <p className="text-sm" style={{ color: '#64748B' }}>Could not load subscription info. Please try again.</p>
          </div>
        )}
      </div>
    </main>
  );
}
