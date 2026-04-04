'use client';

import React from 'react';
import { ArrowLeft, BookOpen, Copy, Download, Eye, EyeOff, Image, Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatPartDividerPlaceholder, LatexText, QuestionTextWithDividers } from '../question-text-with-dividers';
import { stripOuterBraces } from '../view-helpers';

const DEFAULT_EXAM_SOURCE_LABEL = 'HSC';
const RESPONSIVE_IMAGE_CLASS = 'mx-auto block h-auto max-h-[58vh] w-auto max-w-full object-contain';

const copyTextToClipboard = async (value: string) => {
  if (!value.trim()) return false;

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }

  if (typeof document === 'undefined') return false;

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  return copied;
};

const normalizeImageUrl = (value: string | null | undefined) => {
  const trimmed = String(value || '').trim();
  return trimmed || null;
};

const collectQuestionImageCandidates = (question: CustomExamQuestion) => {
  const candidates = [
    normalizeImageUrl(question.graph_image_data),
    normalizeImageUrl(question.sample_answer_image),
    normalizeImageUrl(question.mcq_option_a_image),
    normalizeImageUrl(question.mcq_option_b_image),
    normalizeImageUrl(question.mcq_option_c_image),
    normalizeImageUrl(question.mcq_option_d_image),
  ].filter((value): value is string => Boolean(value));

  return Array.from(new Set(candidates));
};

const getImageExtension = (imageUrl: string) => {
  const lower = imageUrl.toLowerCase();
  if (lower.startsWith('data:image/')) {
    const typeMatch = lower.match(/^data:image\/([^;,]+)/);
    const dataExt = typeMatch?.[1]?.trim();
    if (dataExt === 'jpeg') return 'jpg';
    return dataExt || 'png';
  }

  const pathMatch = imageUrl.match(/\.([a-z0-9]+)(?:\?|#|$)/i);
  const ext = pathMatch?.[1]?.toLowerCase();
  if (!ext) return 'png';
  if (ext === 'jpeg') return 'jpg';
  return ext;
};

const formatRawLatexForQuestion = (question: DisplayExamQuestion) => {
  if (question.grouped_subparts.length > 0) {
    return question.grouped_subparts
      .map((subpart) => `${subpart.label}\n${subpart.question_text}`)
      .join('\n\n');
  }

  return question.question_text;
};

const getMcqOptions = (question: CustomExamQuestion) => (
  [
    { label: 'A' as const, text: stripOuterBraces(question.mcq_option_a || ''), image: question.mcq_option_a_image || null },
    { label: 'B' as const, text: stripOuterBraces(question.mcq_option_b || ''), image: question.mcq_option_b_image || null },
    { label: 'C' as const, text: stripOuterBraces(question.mcq_option_c || ''), image: question.mcq_option_c_image || null },
    { label: 'D' as const, text: stripOuterBraces(question.mcq_option_d || ''), image: question.mcq_option_d_image || null },
  ].filter((option) => option.text || option.image)
);

type CustomExamQuestion = {
  id: string;
  question_number?: string | null;
  subject: string;
  topic: string;
  subtopic?: string | null;
  syllabus_dot_point?: string | null;
  year: number;
  school_name?: string | null;
  marks: number;
  question_text: string;
  question_type?: 'written' | 'multiple_choice' | null;
  sample_answer?: string | null;
  sample_answer_image?: string | null;
  sample_answer_image_size?: 'small' | 'medium' | 'large' | null;
  graph_image_data?: string | null;
  graph_image_size?: 'small' | 'medium' | 'large' | null;
  mcq_option_a?: string | null;
  mcq_option_b?: string | null;
  mcq_option_c?: string | null;
  mcq_option_d?: string | null;
  mcq_option_a_image?: string | null;
  mcq_option_b_image?: string | null;
  mcq_option_c_image?: string | null;
  mcq_option_d_image?: string | null;
  mcq_correct_answer?: 'A' | 'B' | 'C' | 'D' | null;
  mcq_explanation?: string | null;
};

type DisplayExamQuestion = CustomExamQuestion & {
  display_question_number: string;
  source_question_numbers: string[];
  related_image_data: string[];
  grouped_subparts: Array<{
    id: string;
    label: string;
    question_text: string;
    sample_answer?: string | null;
  }>;
};

const ROMAN_TO_NUMBER: Record<string, number> = {
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
  x: 10,
};

const normalizeSubject = (value: string | null | undefined) => String(value || '').trim().toLowerCase();

const isMathematicsAdvancedSubject = (value: string | null | undefined) => {
  const normalized = normalizeSubject(value);
  return normalized.includes('mathematics advanced') || normalized === 'mathematics';
};

const isMathematicsExtensionSubject = (value: string | null | undefined) => {
  const normalized = normalizeSubject(value);
  return normalized.includes('extension 1') || normalized.includes('ext 1') || normalized.includes('extension 2') || normalized.includes('ext 2');
};

const parseQuestionNumber = (value: string | null | undefined) => {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d+)\s*(?:\(?([a-z])\)?)?\s*(?:\(?((?:ix|iv|v?i{0,3}|x))\)?)?$/i);
  const number = match?.[1] ? Number.parseInt(match[1], 10) : Number.POSITIVE_INFINITY;
  const letter = match?.[2] ? match[2].toLowerCase() : '';
  const roman = match?.[3] ? match[3].toLowerCase() : '';

  return {
    raw,
    number,
    letter,
    roman,
    subpart: roman ? (ROMAN_TO_NUMBER[roman] || 0) : 0,
  };
};

const getRomanGroupBase = (value: string | null | undefined) => {
  const parsed = parseQuestionNumber(value);
  if (!Number.isFinite(parsed.number) || !parsed.letter || !parsed.roman) return null;
  return `${parsed.number} (${parsed.letter})`;
};

const getAdvancedGroupBase = (value: string | null | undefined) => {
  const parsed = parseQuestionNumber(value);
  if (!Number.isFinite(parsed.number) || !parsed.letter) return null;
  return String(parsed.number);
};

const getRomanGroupKey = (question: CustomExamQuestion) => {
  const base = getRomanGroupBase(question.question_number);
  if (!base) return null;

  return [
    String(question.subject || '').trim(),
    String(question.year || '').trim(),
    String(question.school_name || DEFAULT_EXAM_SOURCE_LABEL).trim(),
    base,
  ].join('|');
};

const getAdvancedGroupKey = (question: CustomExamQuestion) => {
  const base = getAdvancedGroupBase(question.question_number);
  if (!base) return null;

  return [
    String(question.subject || '').trim(),
    String(question.year || '').trim(),
    String(question.school_name || DEFAULT_EXAM_SOURCE_LABEL).trim(),
    base,
  ].join('|');
};

const getRelatedGroupKey = (question: CustomExamQuestion) => {
  if (isMathematicsAdvancedSubject(question.subject)) {
    return getAdvancedGroupKey(question);
  }
  if (isMathematicsExtensionSubject(question.subject)) {
    return getRomanGroupKey(question);
  }
  return getRomanGroupKey(question);
};

const buildGroupedQuestion = (group: CustomExamQuestion[]): DisplayExamQuestion => {
  const first = group[0];

  if (group.length === 1) {
    const originalNumber = String(first.question_number || '').trim();
    return {
      ...first,
      display_question_number: String(first.question_number || '').trim() || 'Question',
      source_question_numbers: originalNumber ? [originalNumber] : [],
      related_image_data: collectQuestionImageCandidates(first),
      grouped_subparts: [],
    };
  }

  const sortedGroup = [...group].sort((left, right) => {
    const a = parseQuestionNumber(left.question_number);
    const b = parseQuestionNumber(right.question_number);
    return a.number - b.number || a.letter.localeCompare(b.letter) || a.subpart - b.subpart || a.raw.localeCompare(b.raw);
  });

  const parsedEntries = sortedGroup.map((question) => ({ question, parsed: parseQuestionNumber(question.question_number) }));
  const numericParts = parsedEntries
    .map((entry) => entry.parsed.number)
    .filter((value) => Number.isFinite(value));
  const allSameNumber = numericParts.length === parsedEntries.length && new Set(numericParts).size === 1;
  const allHaveLetter = parsedEntries.every((entry) => Boolean(entry.parsed.letter));
  const allHaveRoman = parsedEntries.every((entry) => Boolean(entry.parsed.roman));
  const sameLetter = new Set(parsedEntries.map((entry) => entry.parsed.letter || '__')).size === 1;
  const useRomanOnlyLabels = allSameNumber && sameLetter && allHaveRoman;
  const useLetterOnlyLabels = allSameNumber && allHaveLetter && !useRomanOnlyLabels;

  const displayQuestionNumber = useLetterOnlyLabels
    ? String(parsedEntries[0]?.parsed.number || String(first.question_number || '').trim() || 'Question')
    : useRomanOnlyLabels
      ? getRomanGroupBase(first.question_number) || String(first.question_number || '').trim() || 'Question'
      : String(first.question_number || '').trim() || 'Question';
  const questionText = parsedEntries
    .map(({ question, parsed }) => {
      const label = useRomanOnlyLabels && parsed.roman
        ? `(${parsed.roman})`
        : useLetterOnlyLabels && parsed.letter
          ? `(${parsed.letter})${parsed.roman ? `(${parsed.roman})` : ''}`
          : String(question.question_number || 'Part');
      return `${formatPartDividerPlaceholder(label)}\n\n${question.question_text}`;
    })
    .join('');
  const sampleAnswer = parsedEntries
    .filter(({ question }) => String(question.sample_answer || '').trim())
    .map(({ question, parsed }) => {
      const label = useRomanOnlyLabels && parsed.roman
        ? `(${parsed.roman})`
        : useLetterOnlyLabels && parsed.letter
          ? `(${parsed.letter})${parsed.roman ? `(${parsed.roman})` : ''}`
          : String(question.question_number || 'Part');
      return `${formatPartDividerPlaceholder(label)}\n\n${question.sample_answer}`;
    })
    .join('');
  const graphSource = sortedGroup.find((question) => String(question.graph_image_data || '').trim());

  return {
    ...first,
    question_number: displayQuestionNumber,
    display_question_number: displayQuestionNumber,
    source_question_numbers: parsedEntries
      .map(({ question }) => String(question.question_number || '').trim())
      .filter((value, index, all) => Boolean(value) && all.indexOf(value) === index),
    marks: sortedGroup.reduce((sum, question) => sum + (question.marks || 0), 0),
    question_text: questionText,
    sample_answer: sampleAnswer || first.sample_answer,
    graph_image_data: graphSource?.graph_image_data || first.graph_image_data,
    graph_image_size: graphSource?.graph_image_size || first.graph_image_size,
    related_image_data: Array.from(new Set(sortedGroup.flatMap((question) => collectQuestionImageCandidates(question)))),
    grouped_subparts: parsedEntries.map(({ question, parsed }) => {
      const label = useRomanOnlyLabels && parsed.roman
        ? `(${parsed.roman})`
        : useLetterOnlyLabels && parsed.letter
          ? `(${parsed.letter})${parsed.roman ? `(${parsed.roman})` : ''}`
          : String(question.question_number || 'Part');
      return {
        id: question.id,
        label,
        question_text: question.question_text,
        sample_answer: question.sample_answer,
      };
    }),
  };
};

export default function CustomExamView({
  examTitle,
  examMeta,
  questions,
  exportingPdf,
  onExportPdf,
  onBack,
}: {
  examTitle: string;
  examMeta?: string | null;
  questions: CustomExamQuestion[];
  exportingPdf: 'exam' | 'solutions' | 'solutions-only' | 'latex-tex' | 'latex-zip' | null;
  onExportPdf: (mode: 'questions' | 'questions_with_solutions' | 'solutions_only' | 'raw_latex_tex' | 'raw_latex_zip') => Promise<void>;
  onBack: () => void;
}) {
  const [showSolutions, setShowSolutions] = React.useState(false);
  const [questionActionStatus, setQuestionActionStatus] = React.useState<Record<string, string>>({});

  const setActionStatus = React.useCallback((questionId: string, message: string) => {
    setQuestionActionStatus((prev) => ({ ...prev, [questionId]: message }));
    window.setTimeout(() => {
      setQuestionActionStatus((prev) => {
        if (!prev[questionId]) return prev;
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    }, 2200);
  }, []);

  const handleCopyRawLatex = React.useCallback(async (question: DisplayExamQuestion) => {
    try {
      const copied = await copyTextToClipboard(formatRawLatexForQuestion(question));
      setActionStatus(question.id, copied ? 'Raw LaTeX copied.' : 'Unable to copy LaTeX.');
    } catch {
      setActionStatus(question.id, 'Unable to copy LaTeX.');
    }
  }, [setActionStatus]);

  const handleCopyImageList = React.useCallback(async (question: DisplayExamQuestion) => {
    const images = question.related_image_data;
    if (!images.length) {
      setActionStatus(question.id, 'No related images for this question.');
      return;
    }

    try {
      const copied = await copyTextToClipboard(images.join('\n'));
      setActionStatus(question.id, copied ? `Copied ${images.length} image URL${images.length === 1 ? '' : 's'}.` : 'Unable to copy image URLs.');
    } catch {
      setActionStatus(question.id, 'Unable to copy image URLs.');
    }
  }, [setActionStatus]);

  const handleDownloadImages = React.useCallback((question: DisplayExamQuestion, questionNumber: number) => {
    const images = question.related_image_data;
    if (!images.length) {
      setActionStatus(question.id, 'No related images for this question.');
      return;
    }

    images.forEach((imageUrl, index) => {
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = `question-${questionNumber}-image-${index + 1}.${getImageExtension(imageUrl)}`;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });

    setActionStatus(question.id, `Downloading ${images.length} image${images.length === 1 ? '' : 's'}...`);
  }, [setActionStatus]);

  const displayQuestions = React.useMemo(() => {
    const grouped: DisplayExamQuestion[] = [];

    for (let index = 0; index < questions.length; index += 1) {
      const currentQuestion = questions[index];
      const currentGroupKey = getRelatedGroupKey(currentQuestion);

      if (!currentGroupKey) {
        grouped.push(buildGroupedQuestion([currentQuestion]));
        continue;
      }

      const siblings = [currentQuestion];
      let nextIndex = index + 1;
      while (nextIndex < questions.length && getRelatedGroupKey(questions[nextIndex]) === currentGroupKey) {
        siblings.push(questions[nextIndex]);
        nextIndex += 1;
      }

      grouped.push(buildGroupedQuestion(siblings));
      index = nextIndex - 1;
    }

    return grouped;
  }, [questions]);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col gap-5 rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 text-sm font-medium text-neutral-500 transition hover:text-neutral-900 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Exam Architect
            </button>
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-neutral-400">Generated exam</p>
              <h1 className="text-4xl font-light text-neutral-900">
                {examTitle} <span className="font-bold italic">Questions</span>
              </h1>
              {examMeta ? <p className="text-sm text-neutral-500">{examMeta}</p> : null}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowSolutions((prev) => !prev)}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 cursor-pointer"
          >
            {showSolutions ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showSolutions ? 'Hide Solutions' : 'View Solutions'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onExportPdf('raw_latex_tex')}
            disabled={exportingPdf !== null || !displayQuestions.length}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold text-neutral-800 transition hover:border-neutral-400 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            {exportingPdf === 'latex-tex' ? 'Exporting…' : 'Raw LaTeX (.tex)'}
          </button>
          <button
            type="button"
            onClick={() => onExportPdf('questions')}
            disabled={exportingPdf !== null || !displayQuestions.length}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold text-neutral-800 transition hover:border-neutral-400 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            {exportingPdf === 'exam' ? 'Exporting…' : 'Questions only'}
          </button>
          <button
            type="button"
            onClick={() => onExportPdf('questions_with_solutions')}
            disabled={exportingPdf !== null || !displayQuestions.length}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-neutral-900 bg-neutral-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            {exportingPdf === 'solutions' ? 'Exporting…' : 'Questions + solutions'}
          </button>
          <button
            type="button"
            onClick={() => onExportPdf('solutions_only')}
            disabled={exportingPdf !== null || !displayQuestions.length}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold text-neutral-800 transition hover:border-neutral-400 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            {exportingPdf === 'solutions-only' ? 'Exporting…' : 'Solutions only'}
          </button>
          <button
            type="button"
            onClick={() => onExportPdf('raw_latex_zip')}
            disabled={exportingPdf !== null || !displayQuestions.length}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold text-neutral-800 transition hover:border-neutral-400 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            {exportingPdf === 'latex-zip' ? 'Exporting…' : 'Raw LaTeX + images ZIP'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 pb-1">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-t-2xl border border-b-0 border-neutral-200 bg-neutral-900 px-4 py-3 text-sm font-semibold text-white cursor-default"
            aria-current="page"
          >
            <BookOpen className="h-4 w-4" />
            Questions
          </button>
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-neutral-400">
            {displayQuestions.length} question{displayQuestions.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {!displayQuestions.length ? (
        <div className="rounded-[2rem] border border-dashed border-neutral-200 bg-white p-12 text-center text-neutral-500">
          No questions are available for this custom exam yet.
        </div>
      ) : (
        <div className="space-y-8">
          {displayQuestions.map((question, index) => {
            const isMcq = question.question_type === 'multiple_choice';
            const options = getMcqOptions(question);
            const displayNumber = index + 1;
            const sourceQuestionNumber = question.source_question_numbers.length
              ? question.source_question_numbers.join(', ')
              : (String(question.display_question_number || '').trim() || 'Unknown');

            return (
              <section key={question.id} className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm md:p-8">
                <div className="flex items-start justify-between gap-4 border-b border-neutral-100 pb-6">
                  <div className="flex items-center gap-3">
                    <p className="text-base font-semibold text-neutral-900 md:text-lg">
                      Question {displayNumber}
                    </p>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 transition hover:border-neutral-300 hover:text-neutral-800 cursor-pointer"
                          aria-label={`View details for question ${displayNumber}`}
                        >
                          <Info className="h-4 w-4" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-80 rounded-2xl border-neutral-200 bg-white p-4 text-sm text-neutral-700 shadow-lg">
                        <div className="space-y-3">
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-400">Topic</p>
                            <p className="mt-1 font-medium text-neutral-900">{question.topic || 'Not set'}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-400">Subtopic</p>
                            <p className="mt-1">{question.subtopic || 'Not set'}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-400">Dot Point</p>
                            <p className="mt-1 whitespace-pre-wrap">{question.syllabus_dot_point || 'Not set'}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-400">Source</p>
                            <p className="mt-1">{question.year} {question.school_name || DEFAULT_EXAM_SOURCE_LABEL}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-neutral-400">Paper Question Number</p>
                            <p className="mt-1">{sourceQuestionNumber}</p>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="shrink-0 space-y-2">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyRawLatex(question)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50 cursor-pointer"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy LaTeX
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyImageList(question)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50 cursor-pointer"
                      >
                        <Image className="h-3.5 w-3.5" />
                        Copy image URLs
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadImages(question, displayNumber)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50 cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download images
                      </button>
                    </div>
                    <p className="text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                      {question.marks} mark{question.marks === 1 ? '' : 's'}
                    </p>
                    {questionActionStatus[question.id] ? (
                      <p className="text-right text-xs font-medium text-neutral-500">{questionActionStatus[question.id]}</p>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-6 pt-6">
                  <div className="rounded-[1.5rem] border border-neutral-200 bg-neutral-50 p-5 font-serif text-neutral-900">
                    <QuestionTextWithDividers text={question.question_text} />
                  </div>

                  {question.graph_image_data ? (
                    <div className="rounded-[1.5rem] border border-neutral-200 bg-white p-4">
                      <img
                        src={question.graph_image_data}
                        alt={`Question ${displayNumber} graph`}
                        loading="lazy"
                        className={`${RESPONSIVE_IMAGE_CLASS} rounded-xl graph-image graph-image--${question.graph_image_size || 'medium'}`}
                      />
                    </div>
                  ) : null}

                  {isMcq && options.length > 0 ? (
                    <div className="space-y-3">
                      {options.map((option) => (
                        <div key={option.label} className="rounded-[1.25rem] border border-neutral-200 bg-white px-4 py-3">
                          <div className="flex items-start gap-3">
                            <span className="pt-0.5 text-sm font-bold text-neutral-700">{option.label}.</span>
                            <div className="min-w-0 flex-1 font-serif text-neutral-900">
                              {option.image ? (
                                <img
                                  src={option.image}
                                  alt={`Option ${option.label}`}
                                  loading="lazy"
                                  className={`${RESPONSIVE_IMAGE_CLASS} max-h-[40vh] rounded-lg`}
                                />
                              ) : (
                                <LatexText text={option.text} />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {showSolutions ? (
                    <div className="rounded-[1.5rem] border border-[#b5a45d]/30 bg-amber-50/60 p-5">
                      <div className="mb-3 flex items-center gap-2">
                        <Eye className="h-4 w-4 text-[#8a7831]" />
                        <h3 className="text-sm font-bold uppercase tracking-[0.25em] text-[#8a7831]">Solutions</h3>
                      </div>
                      {isMcq ? (
                        <div className="space-y-3 text-neutral-800">
                          {question.mcq_correct_answer ? (
                            <p className="text-sm font-semibold">
                              Correct answer: <span className="text-[#8a7831]">{question.mcq_correct_answer}</span>
                            </p>
                          ) : null}
                          {question.mcq_explanation ? (
                            <LatexText text={stripOuterBraces(question.mcq_explanation)} />
                          ) : (
                            <p className="text-sm text-neutral-500">No solution explanation is available for this question yet.</p>
                          )}
                        </div>
                      ) : question.sample_answer || question.sample_answer_image ? (
                        <div className="space-y-4 text-neutral-800">
                          {question.sample_answer ? <QuestionTextWithDividers text={question.sample_answer} /> : null}
                          {question.sample_answer_image ? (
                            <img
                              src={question.sample_answer_image}
                              alt="Sample solution"
                              loading="lazy"
                              className={`${RESPONSIVE_IMAGE_CLASS} rounded-xl border border-neutral-200 bg-white p-1`}
                            />
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-sm text-neutral-500">No written solution is available for this question yet.</p>
                      )}
                    </div>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
