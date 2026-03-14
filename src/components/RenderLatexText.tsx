'use client';

import { useEffect, useRef } from 'react';

type Props = {
  text: string;
  className?: string;
  style?: React.CSSProperties;
};

const KATEX_MACROS = {
  '\\undertilde': '\\underset{\\sim}{#1}',
  '\\utilde': '\\underset{\\sim}{#1}',
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const hasMathDelimiters = (value: string) => /\$\$|\$|\\\(|\\\)|\\\[|\\\]/.test(value);

const looksLikeBareLatex = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^\\[a-zA-Z]+/.test(trimmed) || /\\[a-zA-Z]+\{/.test(trimmed);
};

const unwrapStandaloneTextCommand = (value: string) => {
  const trimmed = value.trim();
  const match = trimmed.match(/^\\text\{([\s\S]*)\}$/);
  if (!match) return value;
  return match[1];
};

const normalizeDisplayMathDelimiters = (value: string) => {
  const unescapedDelimiters = value
    .replace(/\\{2,}\[/g, '\\[')
    .replace(/\\{2,}\]/g, '\\]');

  return unescapedDelimiters.replace(/\\\[([\s\S]*?)\\\]/g, (_match, inner) => {
    const trimmed = inner.trim();
    return `$$${trimmed}$$`;
  });
};

const normalizeLatexInput = (value: string) => {
  const normalizedDisplayMath = normalizeDisplayMathDelimiters(value);
  if (hasMathDelimiters(normalizedDisplayMath)) return normalizedDisplayMath;

  const withoutStandaloneText = unwrapStandaloneTextCommand(normalizedDisplayMath);
  if (withoutStandaloneText !== normalizedDisplayMath) return withoutStandaloneText;
  if (!looksLikeBareLatex(normalizedDisplayMath)) return normalizedDisplayMath;
  return `\\(${normalizedDisplayMath}\\)`;
};

const ensureKatex = () => {
  return new Promise<void>((resolve, reject) => {
    const loadScript = (id: string, src: string, onLoad: () => void) => {
      const existing = document.getElementById(id) as HTMLScriptElement | null;
      if (existing) {
        if (existing.getAttribute('data-loaded') === 'true') {
          onLoad();
        } else {
          existing.addEventListener('load', onLoad, { once: true });
          existing.addEventListener('error', () => reject(new Error('Failed to load script')));
        }
        return;
      }

      const script = document.createElement('script');
      script.id = id;
      script.src = src;
      script.async = true;
      script.onload = () => {
        script.setAttribute('data-loaded', 'true');
        onLoad();
      };
      script.onerror = () => reject(new Error('Failed to load script'));
      document.head.appendChild(script);
    };

    if (!document.getElementById('katex-css')) {
      const styleLink = document.createElement('link');
      styleLink.id = 'katex-css';
      styleLink.rel = 'stylesheet';
      styleLink.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css';
      document.head.appendChild(styleLink);
    }

    if (!(window as any).katex) {
      loadScript('katex-script', 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js', () => {
        loadScript('katex-auto-render', 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js', () => resolve());
      });
      return;
    }

    if (!(window as any).renderMathInElement) {
      loadScript('katex-auto-render', 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js', () => resolve());
      return;
    }

    resolve();
  });
};

export default function RenderLatexText({ text, className, style }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;

    const render = async () => {
      const normalizedText = normalizeLatexInput(text);
      const html = escapeHtml(normalizedText);
      container.innerHTML = html;

      try {
        await ensureKatex();
        if (cancelled || !containerRef.current) return;

        const renderMathInElement = (window as any).renderMathInElement;
        if (typeof renderMathInElement === 'function') {
          renderMathInElement(containerRef.current, {
            delimiters: [
              { left: '$$', right: '$$', display: true },
              { left: '\\\\[', right: '\\\\]', display: true },
              { left: '\\[', right: '\\]', display: true },
              { left: '\\\\(', right: '\\\\)', display: false },
              { left: '\\(', right: '\\)', display: false },
              { left: '$', right: '$', display: false },
            ],
            macros: KATEX_MACROS,
            throwOnError: false,
            ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
          });
        }
      } catch {
      }
    };

    render();

    return () => {
      cancelled = true;
    };
  }, [text]);

  return <div ref={containerRef} className={className} style={{ whiteSpace: 'pre-wrap', ...style }} />;
}
