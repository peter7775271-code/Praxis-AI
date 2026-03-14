'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export function formatPartDividerPlaceholder(label: string) {
  return `[[PART_DIVIDER:${label.replace(/\]\]/g, '')}]]`;
}

export function getRomanPart(questionNumber: string | null | undefined): string {
  const raw = String(questionNumber ?? '').trim();
  const m = raw.match(/\(((?:i|ii|iii|iv|v|vi|vii|viii|ix|x))\)\s*$/i);
  return m ? `(${m[1].toLowerCase()})` : '';
}

export function QuestionTextWithDividers({ text }: { text: string }) {
  const blocks = useMemo(() => {
    const tokens = text.split(/(\[\[PART_DIVIDER:[^\]]+\]\])/g);
    const result: Array<{ label: string; content: string }> = [];
    for (let i = 1; i < tokens.length; i += 2) {
      const labelMatch = tokens[i]?.match(/^\[\[PART_DIVIDER:([^\]]*)\]\]$/);
      const label = labelMatch ? labelMatch[1].trim() || 'Part' : 'Part';
      const content = tokens[i + 1]?.trim() ?? '';
      if (label || content) result.push({ label, content });
    }
    return result;
  }, [text]);

  if (blocks.length === 0) {
    return <LatexText text={text} />;
  }

  return (
    <div className="question-text-with-dividers exam-question-text space-y-6">
      {blocks.map((block, i) => (
        <div key={i} className="exam-question-part">
          <div className="exam-part-row">
            <span className="exam-part-label">
              {block.label}
            </span>
            <div className="exam-part-content">
              <LatexText text={block.content} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function LatexText({ text }: { text: string }) {
  const segments = useMemo(() => {
    const segmentList: Array<{
      type: 'html' | 'tikz';
      content: string;
    }> = [];

    const parts = text.split(
      /(\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\})/
    );

    parts.forEach((part) => {
      if (part.includes('\\begin{tikzpicture}')) {
        segmentList.push({
          type: 'tikz',
          content: part,
        });
      } else if (part.trim()) {
        segmentList.push({
          type: 'html',
          content: part,
        });
      }
    });

    return segmentList;
  }, [text]);

  return (
    <div className="latex-text">
      {segments.map((segment, i) => {
        if (segment.type === 'tikz') {
          return (
            <div key={`tikz-${i}`} className="tikz-output">
              <TikzBlock code={segment.content} />
            </div>
          );
        }
        return <HtmlSegment key={`html-${i}`} html={segment.content} />;
      })}
    </div>
  );
}

function TikzBlock({ code }: { code: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isActive = true;

    const renderTikz = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/render-tikz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tikzCode: code }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || `Render failed (${response.status})`);
        }

        if (!isActive) return;

        if (data.svg) {
          setSvg(data.svg);
          setDataUrl(null);
        } else if (data.dataUrl) {
          setDataUrl(data.dataUrl);
          setSvg(null);
        } else if (data.url) {
          setDataUrl(data.url);
          setSvg(null);
        } else {
          throw new Error('Invalid render response');
        }
      } catch (err) {
        if (isActive) {
          setError(err instanceof Error ? err.message : 'Render failed');
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    renderTikz();

    return () => {
      isActive = false;
    };
  }, [code]);

  if (loading) {
    return <div style={{ opacity: 0.7 }}>Rendering graph...</div>;
  }

  if (error) {
    return <div style={{ color: 'var(--clr-warning-a10)' }}>{error}</div>;
  }

  if (svg) {
    return <div dangerouslySetInnerHTML={{ __html: svg }} />;
  }

  if (dataUrl) {
    return <img src={dataUrl} alt="TikZ" className="w-full h-auto" />;
  }

  return null;
}

function HtmlSegment({ html }: { html: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const escapeHtml = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const wrapCellLatex = (cell: string) => {
      const trimmed = cell.trim();
      if (!trimmed) return '';
      if (trimmed.includes('$') || trimmed.includes('\\(') || trimmed.includes('\\[')) {
        return trimmed;
      }
      return `\\(${trimmed}\\)`;
    };

    const convertTabularToHtml = (input: string) => {
      let output = input
        .replace(/\\begin\{center\}|\\end\{center\}/g, '')
        .replace(/\\\[[\s\S]*?\\begin\{tabular\}[\s\S]*?\\end\{tabular\}[\s\S]*?\\\]/g, (match) =>
          match.replace(/\\\[/g, '').replace(/\\\]/g, '')
        )
        .replace(/\\\[[\s\S]*?\\begin\{array\}[\s\S]*?\\end\{array\}[\s\S]*?\\\]/g, (match) =>
          match.replace(/\\\[/g, '').replace(/\\\]/g, '')
        );

      const splitRows = (text: string): string[] => {
        const SPACING_PLACEHOLDER = '\u200B\u200BSPACING\u200B\u200B';
        const spacingMatches: string[] = [];
        const protectedText = text.replace(/\\\[[^\]]*\]/g, (match) => {
          spacingMatches.push(match);
          return `${SPACING_PLACEHOLDER}${spacingMatches.length - 1}\u200B\u200B`;
        });
        const rows = protectedText.split('\\\\');
        return rows.map((row) => {
          let restored = row;
          spacingMatches.forEach((spacing, i) => {
            const placeholder = `${SPACING_PLACEHOLDER}${i}\u200B\u200B`;
            restored = restored.replace(placeholder, spacing);
          });
          return restored;
        });
      };

      output = output.replace(/\\begin\{tabular\}\{[^}]*\}([\s\S]*?)\\end\{tabular\}/g, (_match, body) => {
        const rows = splitRows(body)
          .map((row: string) => row.replace(/\\hline/g, '').trim())
          .filter((row: string) => row.length > 0);

        const tableRows = rows
          .map((row: string) => {
            const cells = row.split('&').map((cell) => wrapCellLatex(cell));
            const tds = cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('');
            return `<tr>${tds}</tr>`;
          })
          .join('');

        return `<div class="latex-table"><table>${tableRows}</table></div>`;
      });

      output = output.replace(/\\begin\{array\}\{[^}]*\}([\s\S]*?)\\end\{array\}/g, (_match, body) => {
        const rows = splitRows(body)
          .map((row: string) => row.replace(/\\hline/g, '').trim())
          .filter((row: string) => row.length > 0);

        const tableRows = rows
          .map((row: string) => {
            const cells = row.split('&').map((cell) => wrapCellLatex(cell));
            const tds = cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('');
            return `<tr>${tds}</tr>`;
          })
          .join('');

        return `<div class="latex-table"><table>${tableRows}</table></div>`;
      });

      return output;
    };

    const parseListItems = (body: string) => {
      const items = body
        .split(/\\item/g)
        .map((item: string) => item.trim())
        .filter((item: string) => item.length > 0);
      return items
        .map((item: string) => {
          const labelMatch = item.match(/^\[([^\]]+)\]\s*/);
          const label = labelMatch ? labelMatch[1] : null;
          const content = labelMatch ? item.replace(/^\[[^\]]+\]\s*/, '') : item;
          const safeContent = escapeHtml(content.trim());
          const safeLabel = label ? escapeHtml(label) : '';
          return label
            ? `<li><span class="item-label">${safeLabel}</span> ${safeContent}</li>`
            : `<li>${safeContent}</li>`;
        })
        .join('');
    };

    const convertEnumerateToHtml = (input: string) => {
      return input.replace(/\\begin\{enumerate\}([\s\S]*?)\\end\{enumerate\}/g, (_match, body) => {
        return `<ol class="latex-list">${parseListItems(body)}</ol>`;
      });
    };

    const convertItemizeToHtml = (input: string) => {
      return input.replace(/\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/g, (_match, body) => {
        return `<ul class="latex-list">${parseListItems(body)}</ul>`;
      });
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

    const renderLatex = async () => {
      if (!containerRef.current) return;

      const normalizeSpacedLetters = (text: string) => {
        const lines = text.split('\n');
        const output: string[] = [];
        let buffer = '';

        lines.forEach((line) => {
          const trimmed = line.trim();
          if (trimmed.length === 1 && /[A-Za-z0-9]/.test(trimmed)) {
            buffer += trimmed;
          } else {
            if (buffer) {
              output.push(buffer);
              buffer = '';
            }
            output.push(line);
          }
        });

        if (buffer) output.push(buffer);

        return output.join('\n');
      };

      const applyTextFormatting = (input: string) => {
        return input.replace(/\\textbf\{([^}]*)\}/g, '<strong>$1</strong>');
      };

      const wrapStandaloneCommandOutsideMath = (input: string, command: 'text' | 'vec') => {
        let out = '';
        let i = 0;
        let mode: 'none' | 'inlineDollar' | 'displayDollar' | 'inlineParen' | 'displayBracket' = 'none';
        const len = input.length;
        const cmdRe = new RegExp(`^\\s*\\\\${command}\\s*\\{`);
        const isEscaped = (idx: number) => idx > 0 && input[idx - 1] === '\\';

        while (i < len) {
          if (mode === 'none') {
            if (input.startsWith('\\[', i)) {
              mode = 'displayBracket';
              out += '\\[';
              i += 2;
              continue;
            }
            if (input.startsWith('\\(', i)) {
              mode = 'inlineParen';
              out += '\\(';
              i += 2;
              continue;
            }
            if (input[i] === '$' && !isEscaped(i)) {
              if (input[i + 1] === '$') {
                mode = 'displayDollar';
                out += '$$';
                i += 2;
                continue;
              }
              mode = 'inlineDollar';
              out += '$';
              i += 1;
              continue;
            }

            const rest = input.slice(i);
            const match = rest.match(cmdRe);
            if (match) {
              const matchLen = match[0].length;
              const start = i + matchLen;
              let depth = 1;
              let j = start;
              while (j < len && depth > 0) {
                if (input[j] === '\\' && input[j + 1] === '{') {
                  j += 2;
                  depth++;
                  continue;
                }
                if (input[j] === '\\' && input[j + 1] === '}') {
                  j += 2;
                  depth--;
                  continue;
                }
                if (input[j] === '{') {
                  j++;
                  depth++;
                  continue;
                }
                if (input[j] === '}') {
                  j++;
                  depth--;
                  continue;
                }
                j++;
              }
              const leadingWs = input.slice(i, i + matchLen).match(/^\s*/)?.[0] ?? '';
              if (leadingWs) out += leadingWs;
              out += `$\\${command}{`;
              i = i + matchLen;
              const end = j - 1;
              out += input.slice(i, end);
              out += '}$';
              i = end + 1;
              continue;
            }

            out += input[i];
            i++;
            continue;
          }

          if (mode === 'displayBracket' && input.startsWith('\\]', i)) {
            mode = 'none';
            out += '\\]';
            i += 2;
            continue;
          }
          if (mode === 'inlineParen' && input.startsWith('\\)', i)) {
            mode = 'none';
            out += '\\)';
            i += 2;
            continue;
          }
          if (mode === 'displayDollar' && input[i] === '$' && input[i + 1] === '$' && !isEscaped(i)) {
            mode = 'none';
            out += '$$';
            i += 2;
            continue;
          }
          if (mode === 'inlineDollar' && input[i] === '$' && !isEscaped(i)) {
            mode = 'none';
            out += '$';
            i += 1;
            continue;
          }

          out += input[i];
          i++;
        }

        return out;
      };

      const wrapStandaloneText = (input: string) => wrapStandaloneCommandOutsideMath(input, 'text');
      const wrapStandaloneVec = (input: string) => wrapStandaloneCommandOutsideMath(input, 'vec');

      const normalizeDisplayMath = (input: string) => {
        const unescapedDelimiters = input
          .replace(/\\{2,}\[/g, '\\[')
          .replace(/\\{2,}\]/g, '\\]');

        return unescapedDelimiters.replace(/\\\[([\s\S]*?)\\\]/g, (_, inner) => {
          const trimmed = inner.trim();
          return `$$${trimmed}$$`;
        });
      };

      const wrapStandaloneMatrix = (input: string) => {
        const MATH_PLACEHOLDER = '\u200B\u200BMATH_BLOCK\u200B\u200B';
        const blocks: string[] = [];
        let protectedInput = input;

        const protect = (regex: RegExp) => {
          protectedInput = protectedInput.replace(regex, (m) => {
            blocks.push(m);
            return `${MATH_PLACEHOLDER}${blocks.length - 1}\u200B\u200B`;
          });
        };

        protect(/\$\$[\s\S]*?\$\$/g);
        protect(/\\\[[\s\S]*?\\\]/g);
        protect(/\\\([\s\S]*?\\\)/g);
        protect(/(?<!\\)\$(?:(?!\$\$)[\s\S])*?(?<!\\)\$(?!\$)/g);

        const envNames = ['pmatrix', 'bmatrix', 'Bmatrix', 'vmatrix', 'Vmatrix', 'matrix', 'array'];
        let result = protectedInput;
        for (const env of envNames) {
          const re = new RegExp(`\\\\begin\\{${env}\\}[\\s\\S]*?\\\\end\\{${env}\\}`, 'g');
          result = result.replace(re, (fullMatch) => `$${fullMatch}$`);
        }
        blocks.forEach((block, i) => {
          result = result.replace(`${MATH_PLACEHOLDER}${i}\u200B\u200B`, block);
        });
        return result;
      };

      const processedWithTables = wrapStandaloneMatrix(
        normalizeDisplayMath(wrapStandaloneVec(wrapStandaloneText(applyTextFormatting(
          convertItemizeToHtml(convertEnumerateToHtml(convertTabularToHtml(normalizeSpacedLetters(html))))
        ))))
      );

      const HTML_BLOCK_PREFIX = '\u200B\u200BHTMLLATEXBLOCK';
      const htmlBlocks: string[] = [];
      let preProcessed = processedWithTables;
      preProcessed = preProcessed.replace(/<div class="latex-table"><table>[\s\S]*?<\/table><\/div>/g, (match) => {
        htmlBlocks.push(match);
        return `${HTML_BLOCK_PREFIX}${htmlBlocks.length - 1}\u200B\u200B`;
      });
      preProcessed = preProcessed.replace(/<ol class="latex-list">[\s\S]*?<\/ol>/g, (match) => {
        htmlBlocks.push(match);
        return `${HTML_BLOCK_PREFIX}${htmlBlocks.length - 1}\u200B\u200B`;
      });
      preProcessed = preProcessed.replace(/<ul class="latex-list">[\s\S]*?<\/ul>/g, (match) => {
        htmlBlocks.push(match);
        return `${HTML_BLOCK_PREFIX}${htmlBlocks.length - 1}\u200B\u200B`;
      });

      preProcessed = preProcessed.replace(/\$\$([\s\S]*?)\$\$/g, (_, inner) => {
        const trimmed = inner.trim();
        const isShort = trimmed.length <= 120 && !/\n/.test(trimmed) && !/\\begin\{/.test(trimmed);
        return isShort ? `$${trimmed}$` : `$$${trimmed}$$`;
      });

      const normalizedMath = preProcessed
        .replace(/\\\(/g, '$')
        .replace(/\\\)/g, '$')
        .replace(/(\$\$[\s\S]*?\$\$)/g, '\n$1\n');
      const parts = normalizedMath.split(/((?<!\\)\$\$[\s\S]*?(?<!\\)\$\$|(?<!\\)\$(?:(?!\$\$)[\s\S])*?(?<!\\)\$(?!\$))/g);
      const wrapBareLatexCommands = (value: string) => {
        return value.replace(/\\+(leq|geq|le|ge|neq|approx|times)\b/g, '$\\$1$');
      };

      const BR_PLACEHOLDER = '\u200B\u200BBR\u200B\u200B';
      const DOLLAR_PLACEHOLDER = '\u200B\u200BDOLLAR\u200B\u200B';
      const processed = parts
        .map((part, index) => {
          if (index % 2 === 1) {
            return part.replace(/\\+(leq|geq|le|ge|neq|approx|times)\b/g, '\\$1');
          }
          return wrapBareLatexCommands(
            part
              .replace(/\\%/g, '%')
              .replace(/\\\$/g, DOLLAR_PLACEHOLDER)
              .replace(/\\{,\\}/g, ',')
              .replace(/\{,\}/g, ',')
              .replace(/\n/g, BR_PLACEHOLDER)
          );
        })
        .join('');
      const withLineBreaks = processed.split(BR_PLACEHOLDER).join('<br />');
      const withLiteralDollars = withLineBreaks.split(DOLLAR_PLACEHOLDER).join('<code class="tex-literal-dollar">$</code>');

      let toEscape = withLiteralDollars;
      const escaped = toEscape
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/&lt;br\s*\/?&gt;/g, '<br />')
        .replace(/&lt;code class=&quot;tex-literal-dollar&quot;&gt;\$&lt;\/code&gt;/g, '<code class="tex-literal-dollar">$</code>');

      let finalHtml = escaped
        .replace(/&lt;strong&gt;/g, '<strong>')
        .replace(/&lt;\/strong&gt;/g, '</strong>');
      htmlBlocks.forEach((block, i) => {
        finalHtml = finalHtml.replace(`${HTML_BLOCK_PREFIX}${i}\u200B\u200B`, block);
      });
      containerRef.current.innerHTML = finalHtml;

      try {
        await ensureKatex();
        if ((window as any).renderMathInElement) {
          (window as any).renderMathInElement(containerRef.current, {
            delimiters: [
              { left: '$$', right: '$$', display: true },
              { left: '\\\\[', right: '\\\\]', display: true },
              { left: '\\[', right: '\\]', display: true },
              { left: '\\\\(', right: '\\\\)', display: false },
              { left: '\\(', right: '\\)', display: false },
              { left: '$', right: '$', display: false },
            ],
            macros: {
              '\\undertilde': '\\underset{\\sim}{#1}',
              '\\utilde': '\\underset{\\sim}{#1}',
            },
            throwOnError: false,
            ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
          });
        }
      } catch (e) {
        console.error('LaTeX error:', e);
      }
    };

    renderLatex();
  }, [html]);

  return <div ref={containerRef} style={{ whiteSpace: 'pre-wrap' }} />;
}
