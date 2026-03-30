#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');

const ROMAN_NUMERAL_RE = /^(?:i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii|xiii|xiv|xv)$/i;

const parseArgs = (argv) => {
  const args = { input: null, output: null, json: false };

  for (const rawArg of argv) {
    if (rawArg.startsWith('--input=')) {
      args.input = rawArg.slice('--input='.length);
      continue;
    }

    if (rawArg.startsWith('--output=')) {
      args.output = rawArg.slice('--output='.length);
      continue;
    }

    if (rawArg === '--json') {
      args.json = true;
    }
  }

  return args;
};

const cleanContent = (value) =>
  String(value || '')
    .replace(/^\s+|\s+$/g, '')
    .replace(/\n{3,}/g, '\n\n');

const normalizeLatexInput = (raw) => {
  const value = String(raw || '');

  const hasRealNewlines = value.includes('\n');
  const looksEscapedLatex = /\\\\documentclass|\\\\begin\{document\}|\\\\section\*/.test(value);
  const hasLiteralNewlineEscapes = value.includes('\\n');

  if (hasRealNewlines || !looksEscapedLatex || !hasLiteralNewlineEscapes) {
    return value;
  }

  try {
    // Decode text that was saved as a single escaped string, e.g. "\\section*...\\n...".
    return JSON.parse(`"${value.replace(/"/g, '\\"')}"`);
  } catch {
    return value;
  }
};

const extractBody = (latex) => {
  const beginMatch = latex.match(/\\begin\{document\}/i);
  const endMatch = latex.match(/\\end\{document\}/i);

  if (!beginMatch || !endMatch) {
    return latex;
  }

  return latex.slice(beginMatch.index + beginMatch[0].length, endMatch.index);
};

const extractQuestionNumber = (text) => {
  const match = String(text || '').match(/Question\s+(\d+)/i);
  return match ? match[1] : null;
};

const buildLabel = (question, part, subpart) => {
  const parts = [`Question ${question || 'X'}`];

  if (part) parts.push(`(${part})`);
  if (subpart) parts.push(`(${subpart})`);

  return parts.join(' ');
};

const splitLatexQuestionSubparts = (latex) => {
  const normalizedLatex = normalizeLatexInput(latex);
  const body = extractBody(normalizedLatex).replace(/\r\n/g, '\n');
  const lines = body.split('\n');
  const items = [];

  let currentQuestion = null;
  let questionIntroLines = [];
  let currentPart = null;

  const flushQuestionIntro = () => {
    const content = cleanContent(questionIntroLines.join('\n'));
    if (!content) {
      questionIntroLines = [];
      return;
    }

    items.push({
      question: currentQuestion,
      part: null,
      subpart: null,
      label: buildLabel(currentQuestion, null, null),
      content,
    });

    questionIntroLines = [];
  };

  const flushPart = () => {
    if (!currentPart) return;

    if (!currentPart.hasSubparts) {
      const content = cleanContent(currentPart.preambleLines.join('\n'));
      if (content) {
        items.push({
          question: currentQuestion,
          part: currentPart.letter,
          subpart: null,
          label: buildLabel(currentQuestion, currentPart.letter, null),
          content,
        });
      }
      currentPart = null;
      return;
    }

    for (const sub of currentPart.subparts) {
      const content = cleanContent(sub.lines.join('\n'));
      if (!content) continue;
      items.push({
        question: currentQuestion,
        part: currentPart.letter,
        subpart: sub.roman,
        label: buildLabel(currentQuestion, currentPart.letter, sub.roman),
        content,
      });
    }

    currentPart = null;
  };

  const flushAll = () => {
    flushPart();
    flushQuestionIntro();
  };

  const startNewPart = (letter, remainder) => {
    flushPart();
    flushQuestionIntro();

    currentPart = {
      letter: letter.toLowerCase(),
      preambleLines: remainder ? [remainder] : [],
      hasSubparts: false,
      subparts: [],
    };
  };

  const startSubpart = (roman, remainder) => {
    if (!currentPart) {
      questionIntroLines.push(remainder || `(${roman})`);
      return;
    }

    if (!currentPart.hasSubparts) {
      currentPart.hasSubparts = true;
    }

    const seedLines = [];
    if (currentPart.subparts.length === 0 && currentPart.preambleLines.length > 0) {
      seedLines.push(...currentPart.preambleLines);
      currentPart.preambleLines = [];
    }
    if (remainder) seedLines.push(remainder);

    currentPart.subparts.push({ roman: roman.toLowerCase(), lines: seedLines });
  };

  const appendRegularLine = (line) => {
    if (currentPart) {
      if (currentPart.hasSubparts && currentPart.subparts.length > 0) {
        currentPart.subparts[currentPart.subparts.length - 1].lines.push(line);
        return;
      }

      currentPart.preambleLines.push(line);
      return;
    }

    questionIntroLines.push(line);
  };

  for (const line of lines) {
    const sectionMatch = line.match(/\\section\*\{([^}]*)\}/i);
    if (sectionMatch) {
      const sectionText = sectionMatch[1] || '';
      const nextQuestion = extractQuestionNumber(sectionText);

      if (/^\s*End\s+of\s+Question/i.test(sectionText)) {
        flushAll();
        continue;
      }

      if (nextQuestion && nextQuestion !== currentQuestion) {
        flushAll();
        currentQuestion = nextQuestion;
      }
      continue;
    }

    const continuedMatch = line.match(/^\s*Question\s+(\d+)\s*\(continued\)/i);
    if (continuedMatch) {
      const nextQuestion = continuedMatch[1];
      if (nextQuestion !== currentQuestion) {
        flushAll();
        currentQuestion = nextQuestion;
      }
      continue;
    }

    const questionHeaderMatch = line.match(/^\s*Question\s+(\d+)\b/i);
    if (questionHeaderMatch) {
      const nextQuestion = questionHeaderMatch[1];
      if (nextQuestion !== currentQuestion) {
        flushAll();
        currentQuestion = nextQuestion;
      }

      // Keep explicit question header lines as intro content for that question.
      questionIntroLines.push(line.trim());
      continue;
    }

    const tokenMatch = line.match(/^\s*\(([a-z]+)\)\s*(.*)$/i);
    if (tokenMatch) {
      const token = tokenMatch[1];
      const remainder = tokenMatch[2] || '';

      if (ROMAN_NUMERAL_RE.test(token)) {
        startSubpart(token, remainder);
      } else if (token.length === 1) {
        startNewPart(token, remainder);
      } else {
        appendRegularLine(line);
      }
      continue;
    }

    appendRegularLine(line);
  }

  flushAll();
  return items.filter((item) => item.content && item.content.trim().length > 0);
};

const formatBlocks = (items) =>
  items
    .map((item) => `${item.label}\n${item.content}`)
    .join('\n\n');

const run = async () => {
  const args = parseArgs(process.argv.slice(2));

  if (!args.input) {
    console.error('Usage: node scripts/split-latex-question-subparts.js --input=path/to/file.tex [--output=out.txt] [--json]');
    process.exit(1);
  }

  const inputPath = path.resolve(process.cwd(), args.input);
  const latex = await fs.readFile(inputPath, 'utf8');
  const items = splitLatexQuestionSubparts(latex);

  const output = args.json ? `${JSON.stringify(items, null, 2)}\n` : `${formatBlocks(items)}\n`;

  if (args.output) {
    const outputPath = path.resolve(process.cwd(), args.output);
    await fs.writeFile(outputPath, output, 'utf8');
    console.log(`Wrote ${items.length} blocks to ${outputPath}`);
    return;
  }

  process.stdout.write(output);
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
