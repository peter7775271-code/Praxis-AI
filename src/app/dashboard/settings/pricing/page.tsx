'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type BillingPlan = 'standard' | 'pro';
type StandardYearLevel = 'Year 11' | 'Year 12';

const plans: {
  key: BillingPlan;
  name: string;
  price: string;
  subtitle: string;
  tags: string[];
  features: string[];
  featured: boolean;
}[] = [
  {
    key: 'standard',
    name: 'Standard',
    price: '$49',
    subtitle: 'Year 11 or Year 12 - pick one',
    tags: ['Year 11 only', 'Year 12 only'],
    features: [
      'All 4 maths subjects',
      'Filter by topic, subtopic and dot point',
      'LaTeX questions + worked solutions',
      'Images included where needed',
      '30 exam generation tokens / month',
      'Unlimited PDF exports after generation',
    ],
    featured: false,
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '$99',
    subtitle: 'Year 11 and Year 12 - both included',
    tags: ['Year 11', 'Year 12'],
    features: [
      'Everything in Standard',
      'Both year levels included',
      '100 exam generation tokens / month',
      'Unlimited PDF exports after generation',
      'Unlimited tutor accounts',
      'Priority support',
    ],
    featured: true,
  },
];

function PricingPageContent() {
  const searchParams = useSearchParams();
  const checkoutStatus = searchParams.get('checkout');
  const checkoutSessionId = searchParams.get('session_id');
  const isOnboarding = searchParams.get('onboarding') === '1';
  const [pendingPlan, setPendingPlan] = useState<BillingPlan | null>(null);
  const [standardYearLevel, setStandardYearLevel] = useState<StandardYearLevel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const successMessage = useMemo(() => {
    if (checkoutStatus === 'success') {
      return 'Checkout completed. Confirming your subscription...';
    }

    if (checkoutStatus === 'cancelled') {
      return 'Checkout was cancelled. You can choose a plan whenever you are ready.';
    }

    return null;
  }, [checkoutStatus]);

  useEffect(() => {
    if (checkoutStatus !== 'success' || !checkoutSessionId) {
      return;
    }

    let cancelled = false;

    const confirmCheckout = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const response = await fetch(`/api/stripe/confirm-checkout?session_id=${encodeURIComponent(checkoutSessionId)}`, {
          method: 'GET',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        const data = (await response.json()) as { error?: string; plan?: string; message?: string };
        if (cancelled) {
          return;
        }

        if (!response.ok) {
          const message = data.error || data.message || 'Could not confirm your subscription yet.';
          setError(message);
          setSyncMessage(null);
          return;
        }

        const planName = data.plan ? data.plan.charAt(0).toUpperCase() + data.plan.slice(1) : 'paid';
        setSyncMessage(`Your ${planName} plan is now active.`);
        setError(null);
      } catch (confirmError) {
        if (cancelled) {
          return;
        }

        const message = confirmError instanceof Error
          ? confirmError.message
          : 'Could not confirm your subscription yet.';
        setError(message);
        setSyncMessage(null);
      }
    };

    void confirmCheckout();

    return () => {
      cancelled = true;
    };
  }, [checkoutStatus, checkoutSessionId]);

  const startCheckout = async (plan: BillingPlan) => {
    if (plan === 'standard' && !standardYearLevel) {
      setError('Select Year 11 or Year 12 before starting Standard checkout.');
      return;
    }

    setPendingPlan(plan);
    setError(null);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token) {
        setError('You need to sign in before starting checkout. Please log in again.');
        setPendingPlan(null);
        return;
      }

      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plan,
          ...(plan === 'standard' ? { standardYearLevel } : {}),
        }),
      });

      const data = (await response.json()) as { error?: string; url?: string };

      if (response.status === 401) {
        throw new Error(data.error || 'Your session expired. Please sign in again.');
      }

      if (!response.ok || !data.url) {
        throw new Error(data.error || 'Could not start checkout. Please try again.');
      }

      window.location.href = data.url;
    } catch (checkoutError) {
      const message = checkoutError instanceof Error
        ? checkoutError.message
        : 'Could not start checkout. Please try again.';
      setError(message);
      setPendingPlan(null);
    }
  };

  return (
    <main className="min-h-screen px-5 py-10 md:px-10" style={{ backgroundColor: '#F3F7FC' }}>
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm" style={{ color: '#5D6B82' }}>Billing</p>
            <h1 className="text-3xl font-semibold" style={{ color: '#0F172A' }}>Choose your plan</h1>
          </div>
          {isOnboarding ? (
            <Link
              href="/dashboard"
              className="rounded-lg px-4 py-2 text-sm font-medium"
              style={{
                backgroundColor: '#FFFFFF',
                color: '#1E293B',
                border: '1px solid #CBD5E1',
              }}
            >
              Continue with Free
            </Link>
          ) : (
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
          )}
        </div>

        {isOnboarding && (
          <div className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', color: '#065F46' }}>
            You are on the Free plan by default (3 exam creations per month, 0 question tokens). Upgrade anytime.
          </div>
        )}

        {successMessage && (
          <div
            className="mb-4 rounded-xl border px-4 py-3 text-sm"
            style={{ backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', color: '#065F46' }}
          >
            {syncMessage || successMessage}
          </div>
        )}

        {error && (
          <div
            className="mb-4 rounded-xl border px-4 py-3 text-sm"
            style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA', color: '#991B1B' }}
          >
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {plans.map((plan) => {
            const isPending = pendingPlan === plan.key;

            return (
              <section
                key={plan.key}
                className="flex h-full flex-col rounded-2xl bg-white p-6"
                style={{
                  border: plan.featured ? '2px solid #185FA5' : '1px solid #D6DFEA',
                  boxShadow: '0 6px 18px rgba(15, 23, 42, 0.06)',
                }}
              >
                {plan.featured && (
                  <span
                    className="mb-3 inline-block w-fit rounded-md px-3 py-1 text-xs font-medium"
                    style={{ backgroundColor: '#E5F1FF', color: '#185FA5' }}
                  >
                    Most popular
                  </span>
                )}

                <p className="text-2xl font-medium" style={{ color: '#0F172A' }}>{plan.name}</p>
                <p className="mt-2 text-4xl font-semibold" style={{ color: '#0F172A' }}>
                  {plan.price}
                  <span className="ml-1 text-sm font-normal" style={{ color: '#64748B' }}>/ mo</span>
                </p>
                <p className="mb-4 mt-1 text-xs" style={{ color: '#64748B' }}>{plan.subtitle}</p>

                <div className="mb-4 flex flex-wrap gap-2">
                  {plan.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md px-2 py-1 text-xs"
                      style={{
                        backgroundColor: '#EEF3F9',
                        color: '#334155',
                        border: '1px solid #D6DFEA',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <hr className="mb-4" style={{ borderColor: '#D6DFEA' }} />

                {plan.key === 'standard' && (
                  <div className="mb-4 rounded-xl border p-3" style={{ borderColor: '#D6DFEA', backgroundColor: '#F8FAFC' }}>
                    <p className="mb-2 text-xs font-semibold" style={{ color: '#334155' }}>Choose your included year level</p>
                    <div className="flex gap-2">
                      {(['Year 11', 'Year 12'] as StandardYearLevel[]).map((year) => {
                        const selected = standardYearLevel === year;
                        return (
                          <button
                            key={year}
                            type="button"
                            onClick={() => setStandardYearLevel(year)}
                            className="rounded-md px-3 py-1.5 text-xs font-semibold"
                            style={{
                              backgroundColor: selected ? '#185FA5' : '#FFFFFF',
                              color: selected ? '#FFFFFF' : '#334155',
                              border: selected ? '1px solid #185FA5' : '1px solid #CBD5E1',
                            }}
                          >
                            {year}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs" style={{ color: '#64748B' }}>
                      You can generate from this year level on Standard. The other year level requires question tokens.
                    </p>
                  </div>
                )}

                <ul className="flex flex-1 flex-col gap-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm" style={{ color: '#334155' }}>
                      <span
                        className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: plan.featured ? '#534AB7' : '#378ADD' }}
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  disabled={pendingPlan !== null}
                  onClick={() => void startCheckout(plan.key)}
                  className="mt-6 rounded-lg px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    backgroundColor: plan.featured ? '#185FA5' : 'var(--clr-surface-a20)',
                    color: plan.featured ? '#FFFFFF' : '#0F172A',
                    border: plan.featured ? 'none' : '1px solid #C7D2E2',
                  }}
                >
                  {isPending ? 'Redirecting...' : `Choose ${plan.name}`}
                </button>
              </section>
            );
          })}
        </div>

        <p className="mt-6 text-center text-sm" style={{ color: '#5D6B82' }}>
          All plans are monthly subscriptions and can be cancelled anytime.
        </p>
      </div>
    </main>
  );
}

export default function DashboardPricingPage() {
  return (
    <Suspense
      fallback={(
        <main className="min-h-screen px-5 py-10 md:px-10" style={{ backgroundColor: '#F3F7FC' }}>
          <div className="mx-auto w-full max-w-5xl">
            <p className="text-sm" style={{ color: '#5D6B82' }}>Loading pricing…</p>
          </div>
        </main>
      )}
    >
      <PricingPageContent />
    </Suspense>
  );
}
