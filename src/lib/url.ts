import { NextRequest } from 'next/server';

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/$/, '');
  if (!trimmed) return '';

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export function getPublicAppBaseUrl(request: NextRequest): string {
  const explicitBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (explicitBaseUrl) {
    const normalized = normalizeBaseUrl(explicitBaseUrl);
    if (normalized) return normalized;
  }

  // On Vercel this is a stable custom domain for production, unlike per-deployment URLs.
  const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProductionUrl) {
    const normalized = normalizeBaseUrl(vercelProductionUrl);
    if (normalized) return normalized;
  }

  const forwardedHost = request.headers.get('x-forwarded-host');
  if (forwardedHost) {
    const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https';
    return `${forwardedProto}://${forwardedHost}`;
  }

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    const normalized = normalizeBaseUrl(vercelUrl);
    if (normalized) return normalized;
  }

  return request.nextUrl.origin;
}