import Link from 'next/link';

const tiers = [
  {
    label: 'Tier 1',
    name: 'Starter',
    target: 'Small centres · 1-3 tutors',
    price: '$49',
    period: '/month',
    chips: ['3 tutor accounts', '20 PDF exports/mo'],
    features: [
      'Standard Maths & Advanced access',
      'Filter by topic & subtopic',
      'Multiple choice & written response',
      'Professional LaTeX formatting',
      'Images included where needed',
      'Full worked solutions',
      'PDF export (mock exams & worksheets)',
    ],
    dotColor: '#0F6E56',
    featured: false,
  },
  {
    label: 'Tier 2',
    name: 'Growth',
    target: 'Medium centres · 4-10 tutors',
    price: '$99',
    period: '/month',
    chips: ['10 tutor accounts', '60 PDF exports/mo'],
    features: [
      'Everything in Starter, plus:',
      'Extension 1 access',
      'Filter by syllabus dot points',
      'Priority support',
    ],
    dotColor: '#185FA5',
    featured: true,
  },
  {
    label: 'Tier 3',
    name: 'Pro',
    target: 'Large centres · 10+ tutors',
    price: '$199',
    period: '/month',
    chips: ['Unlimited accounts', 'Unlimited exports'],
    features: [
      'Everything in Growth, plus:',
      'Extension 2 access',
      'Unlimited PDF exports',
      'Unlimited tutor accounts',
      'Dedicated account support',
    ],
    dotColor: '#534AB7',
    featured: false,
  },
];

export default function DashboardPricingPage() {
  return (
    <main className="min-h-screen px-6 py-10 md:px-10" style={{ backgroundColor: '#F3F7FC' }}>
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm" style={{ color: '#5D6B82' }}>Billing</p>
            <h1 className="text-3xl font-semibold" style={{ color: '#0F172A' }}>Choose your plan</h1>
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

        <div className="grid gap-4 md:grid-cols-3">
          {tiers.map((tier) => (
            <section
              key={tier.name}
              className="flex h-full flex-col rounded-2xl p-6"
              style={{
                backgroundColor: '#FFFFFF',
                border: tier.featured ? '2px solid #185FA5' : '1px solid #D6DFEA',
                boxShadow: tier.featured ? '0 8px 24px rgba(24, 95, 165, 0.12)' : '0 6px 18px rgba(15, 23, 42, 0.06)',
              }}
            >
              {tier.featured && (
                <span
                  className="mb-3 inline-block w-fit rounded-md px-3 py-1 text-xs font-medium"
                  style={{ backgroundColor: '#E5F1FF', color: '#185FA5' }}
                >
                  Most popular
                </span>
              )}

              <p className="mb-1 text-xs" style={{ color: '#64748B' }}>{tier.label}</p>
              <h2 className="mb-1 text-2xl font-semibold" style={{ color: '#0F172A' }}>{tier.name}</h2>
              <p className="mb-4 text-xs" style={{ color: '#64748B' }}>{tier.target}</p>

              <p className="text-4xl font-semibold" style={{ color: '#0F172A' }}>
                {tier.price}
                <span className="ml-1 text-base font-normal" style={{ color: '#64748B' }}>{tier.period}</span>
              </p>

              <hr className="my-4" style={{ borderColor: '#D6DFEA' }} />

              <div className="mb-4 flex flex-wrap gap-2">
                {tier.chips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-md px-2 py-1 text-xs"
                    style={{
                      backgroundColor: '#EEF3F9',
                      color: '#334155',
                      border: '1px solid #D6DFEA',
                    }}
                  >
                    {chip}
                  </span>
                ))}
              </div>

              <hr className="mb-4" style={{ borderColor: '#D6DFEA' }} />

              <ul className="flex flex-1 flex-col gap-2">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm" style={{ color: '#1E293B' }}>
                    <span
                      className="mt-1.5 inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: tier.dotColor }}
                    />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                className="mt-6 rounded-lg px-4 py-2 text-sm font-semibold"
                style={{
                  backgroundColor: tier.featured ? '#185FA5' : 'var(--clr-surface-a20)',
                  color: tier.featured ? '#FFFFFF' : '#0F172A',
                  border: tier.featured ? 'none' : '1px solid #C7D2E2',
                }}
              >
                {tier.featured ? 'Upgrade to Growth' : `Choose ${tier.name}`}
              </button>
            </section>
          ))}
        </div>

        <p className="mt-6 text-center text-sm" style={{ color: '#5D6B82' }}>
          All plans monthly cancel anytime questions sourced from past papers and mapped to current syllabus
        </p>
      </div>
    </main>
  );
}
