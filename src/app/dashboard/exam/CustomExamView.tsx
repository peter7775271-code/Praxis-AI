'use client';

import React from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Archive, BookOpen, Copy, Download, Eye, FileText, Image as ImageIcon, RefreshCw, ScrollText } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatPartDividerPlaceholder } from '../question-text-with-dividers';
import { stripOuterBraces } from '../view-helpers';
import { CustomPdfViewer } from './CustomPdfViewer';
import { ResizeHandle } from './ResizeHandle';

const DEFAULT_EXAM_SOURCE_LABEL = 'HSC';

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

const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const result = String(reader.result || '');
    if (!result) {
      reject(new Error('Unable to read image file.'));
      return;
    }
    resolve(result);
  };
  reader.onerror = () => reject(new Error('Unable to read image file.'));
  reader.readAsDataURL(file);
});

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

const formatSampleAnswerLatexForQuestion = (question: DisplayExamQuestion) => {
  if (question.question_type === 'multiple_choice') {
    return String(question.mcq_explanation || '').trim();
  }

  if (question.grouped_subparts.length > 0) {
    const groupedAnswers = question.grouped_subparts
      .filter((subpart) => String(subpart.sample_answer || '').trim())
      .map((subpart) => `${subpart.label}\n${String(subpart.sample_answer || '').trim()}`)
      .join('\n\n');

    if (groupedAnswers.trim()) return groupedAnswers;
  }

  return String(question.sample_answer || '').trim();
};

const stripPartDividerPlaceholders = (value: string | null | undefined) => (
  String(value || '').replace(/\[\[PART_DIVIDER:[^\]]+\]\]\s*/g, '').trim()
);

type CustomExamQuestion = {
  id: string;
  question_number?: string | null;
  subject: string;
  topic: string;
  difficulty?: 'Foundation' | 'Intermediate' | 'Advanced' | 'Extension' | null;
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
  mcq_option_a_image_size?: 'small' | 'medium' | 'large' | null;
  mcq_option_b_image?: string | null;
  mcq_option_b_image_size?: 'small' | 'medium' | 'large' | null;
  mcq_option_c_image?: string | null;
  mcq_option_c_image_size?: 'small' | 'medium' | 'large' | null;
  mcq_option_d_image?: string | null;
  mcq_option_d_image_size?: 'small' | 'medium' | 'large' | null;
  mcq_correct_answer?: 'A' | 'B' | 'C' | 'D' | null;
  mcq_explanation?: string | null;
  dotted_answer_line_count?: number | null;
  graph_image_part_label?: string | null;
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

type CustomExamExportMode = 'questions' | 'questions_with_solutions' | 'solutions_only' | 'raw_latex_tex' | 'raw_latex_zip';

type CustomExamExportOptions = {
  questionsOverride?: DisplayExamQuestion[];
  preview?: boolean;
  titleOverride?: string;
  pdfOptions?: CustomExamPdfOptions;
};

type CustomExamExportResult = {
  blob: Blob;
  filename: string;
  contentType: string;
};

type CustomExamPdfOptions = {
  hideDefaultHeader?: boolean;
  includeCoverPage?: boolean;
  coverPageTitle?: string;
  coverPageSubtitle?: string;
  coverPageFooter?: string;
  fontFamily?: 'lmodern' | 'sans' | 'palatino';
  fontSizePt?: number;
  dottedAnswerLinesEnabled?: boolean;
  dottedAnswerLineCount?: number;
  watermarkEnabled?: boolean;
  watermarkImageData?: string;
  watermarkImageName?: string;
  watermarkOpacity?: number;
  watermarkImageScale?: number;
};

type QuestionImageSize = 'small' | 'medium' | 'large';

type CustomExamQuestionDraftOverride = {
  question_text?: string;
  sample_answer?: string;
  mcq_explanation?: string;
  dotted_answer_line_count?: number | null;
  graph_image_size?: QuestionImageSize;
  sample_answer_image_size?: QuestionImageSize;
  mcq_option_a_image_size?: QuestionImageSize;
  mcq_option_b_image_size?: QuestionImageSize;
  mcq_option_c_image_size?: QuestionImageSize;
  mcq_option_d_image_size?: QuestionImageSize;
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
      graph_image_part_label: null,
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
  const getEntryPartLabel = (parsed: ReturnType<typeof parseQuestionNumber>, rawQuestionNumber: string | null | undefined) => (
    useRomanOnlyLabels && parsed.roman
      ? `(${parsed.roman})`
      : useLetterOnlyLabels && parsed.letter
        ? `(${parsed.letter})${parsed.roman ? `(${parsed.roman})` : ''}`
        : String(rawQuestionNumber || 'Part')
  );

  const displayQuestionNumber = useLetterOnlyLabels
    ? String(parsedEntries[0]?.parsed.number || String(first.question_number || '').trim() || 'Question')
    : useRomanOnlyLabels
      ? getRomanGroupBase(first.question_number) || String(first.question_number || '').trim() || 'Question'
      : String(first.question_number || '').trim() || 'Question';
  const questionText = parsedEntries
    .map(({ question, parsed }) => {
      const label = getEntryPartLabel(parsed, question.question_number);
      return `${formatPartDividerPlaceholder(label)}\n\n${question.question_text}`;
    })
    .join('');
  const sampleAnswer = parsedEntries
    .filter(({ question }) => String(question.sample_answer || '').trim())
    .map(({ question, parsed }) => {
      const label = getEntryPartLabel(parsed, question.question_number);
      return `${formatPartDividerPlaceholder(label)}\n\n${question.sample_answer}`;
    })
    .join('');
  const graphSource = sortedGroup.find((question) => String(question.graph_image_data || '').trim());
  const graphImagePartLabel = graphSource
    ? parsedEntries.find((entry) => entry.question.id === graphSource.id)
    : null;

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
    graph_image_part_label: graphImagePartLabel
      ? getEntryPartLabel(graphImagePartLabel.parsed, graphImagePartLabel.question.question_number)
      : null,
    related_image_data: Array.from(new Set(sortedGroup.flatMap((question) => collectQuestionImageCandidates(question)))),
    grouped_subparts: parsedEntries.map(({ question, parsed }) => {
      const label = getEntryPartLabel(parsed, question.question_number);
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
  onRenameExamTitle,
  backButtonLabel = 'Back to Exam Architect',
  onBack,
}: {
  examTitle: string;
  examMeta?: string | null;
  questions: CustomExamQuestion[];
  exportingPdf: 'exam' | 'solutions' | 'solutions-only' | 'latex-tex' | 'latex-zip' | null;
  onExportPdf: (mode: CustomExamExportMode, options?: CustomExamExportOptions) => Promise<CustomExamExportResult | void>;
  onRenameExamTitle?: (nextTitle: string) => void;
  backButtonLabel?: string;
  onBack: () => void;
}) {
  const [questionActionStatus, setQuestionActionStatus] = React.useState<Record<string, string>>({});
  const [previewMode, setPreviewMode] = React.useState<'questions' | 'questions_with_solutions' | 'solutions_only'>('questions');
  const [previewOnly, setPreviewOnly] = React.useState(false);
  const [questionSearchQuery, setQuestionSearchQuery] = React.useState('');
  const [orderedQuestionIds, setOrderedQuestionIds] = React.useState<string[]>([]);
  const [includedQuestionIds, setIncludedQuestionIds] = React.useState<string[]>([]);
  const [questionConfig, setQuestionConfig] = React.useState<Record<string, { marks: number; hideMarks: boolean }>>({});
  const [questionDraftOverrides, setQuestionDraftOverrides] = React.useState<Record<string, CustomExamQuestionDraftOverride>>({});
  const [selectedQuestionId, setSelectedQuestionId] = React.useState<string | null>(null);
  const [showLeftColumn, setShowLeftColumn] = React.useState(true);
  const [showRightColumn, setShowRightColumn] = React.useState(true);
  const [isPdfCustomisationOpen, setIsPdfCustomisationOpen] = React.useState(true);
  const [isQuestionContentOpen, setIsQuestionContentOpen] = React.useState(true);
  const [leftColumnWidthRem, setLeftColumnWidthRem] = React.useState(22);
  const [rightColumnWidthRem, setRightColumnWidthRem] = React.useState(24);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = React.useState(false);
  const [draftRevision, setDraftRevision] = React.useState(0);
  const [lastPreviewRevision, setLastPreviewRevision] = React.useState<number | null>(null);
  const [pdfOptions, setPdfOptions] = React.useState<CustomExamPdfOptions>({
    hideDefaultHeader: true,
    includeCoverPage: false,
    coverPageTitle: '',
    coverPageSubtitle: '',
    coverPageFooter: '',
    fontFamily: 'lmodern',
    fontSizePt: 11,
    dottedAnswerLinesEnabled: false,
    dottedAnswerLineCount: 3,
    watermarkEnabled: false,
    watermarkImageData: '',
    watermarkImageName: '',
    watermarkOpacity: 0.1,
    watermarkImageScale: 0.66,
  });

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

  React.useEffect(() => {
    const nextIds = displayQuestions.map((question) => question.id);
    setOrderedQuestionIds(nextIds);
    setIncludedQuestionIds(nextIds);
    setSelectedQuestionId((prev) => {
      if (prev && nextIds.includes(prev)) return prev;
      return nextIds[0] || null;
    });
    setQuestionConfig(
      displayQuestions.reduce<Record<string, { marks: number; hideMarks: boolean }>>((acc, question) => {
        acc[question.id] = { marks: question.marks || 0, hideMarks: false };
        return acc;
      }, {}),
    );
    setQuestionSearchQuery('');
    setQuestionDraftOverrides({});
    setPreviewError(null);
    setDraftRevision(0);
    setLastPreviewRevision(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [displayQuestions]);

  React.useEffect(() => () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
  }, [previewUrl]);

  const questionById = React.useMemo(() => {
    const map = new Map<string, DisplayExamQuestion>();
    displayQuestions.forEach((question) => {
      map.set(question.id, question);
    });
    return map;
  }, [displayQuestions]);

  const orderedQuestions = React.useMemo(
    () => orderedQuestionIds
      .map((id) => questionById.get(id))
      .filter((question): question is DisplayExamQuestion => Boolean(question))
      .map((question) => {
        const overrides = questionDraftOverrides[question.id];
        if (!overrides) return question;

        return {
          ...question,
          question_text: overrides.question_text ?? question.question_text,
          sample_answer: overrides.sample_answer ?? question.sample_answer,
          mcq_explanation: overrides.mcq_explanation ?? question.mcq_explanation,
          dotted_answer_line_count: overrides.dotted_answer_line_count ?? question.dotted_answer_line_count,
          graph_image_size: overrides.graph_image_size ?? question.graph_image_size,
          sample_answer_image_size: overrides.sample_answer_image_size ?? question.sample_answer_image_size,
          mcq_option_a_image_size: overrides.mcq_option_a_image_size ?? question.mcq_option_a_image_size,
          mcq_option_b_image_size: overrides.mcq_option_b_image_size ?? question.mcq_option_b_image_size,
          mcq_option_c_image_size: overrides.mcq_option_c_image_size ?? question.mcq_option_c_image_size,
          mcq_option_d_image_size: overrides.mcq_option_d_image_size ?? question.mcq_option_d_image_size,
        };
      }),
    [orderedQuestionIds, questionById, questionDraftOverrides],
  );

  const includedIdSet = React.useMemo(() => new Set(includedQuestionIds), [includedQuestionIds]);

  const draftQuestions = React.useMemo(
    () => orderedQuestions
      .filter((question) => includedIdSet.has(question.id))
      .map((question) => {
        const config = questionConfig[question.id] || { marks: question.marks || 0, hideMarks: false };
        return {
          ...question,
          marks: config.hideMarks ? 0 : Math.max(0, Number.isFinite(config.marks) ? config.marks : 0),
        };
      }),
    [includedIdSet, orderedQuestions, questionConfig],
  );

  const selectedQuestion = React.useMemo(
    () => orderedQuestions.find((question) => question.id === selectedQuestionId) || null,
    [orderedQuestions, selectedQuestionId],
  );

  const selectedQuestionIndex = React.useMemo(
    () => orderedQuestions.findIndex((question) => question.id === selectedQuestion?.id),
    [orderedQuestions, selectedQuestion?.id],
  );

  const selectedConfig = selectedQuestion
    ? (questionConfig[selectedQuestion.id] || { marks: selectedQuestion.marks || 0, hideMarks: false })
    : null;
  const selectedDraft = selectedQuestion ? (questionDraftOverrides[selectedQuestion.id] || {}) : null;

  const filteredQuestions = React.useMemo(() => {
    const query = questionSearchQuery.trim().toLowerCase();
    return orderedQuestions
      .map((question, index) => ({ question, index }))
      .filter(({ question, index }) => {
        if (!query) return true;
        return [
          `question ${index + 1}`,
          question.topic,
          question.subtopic,
          question.difficulty,
          question.display_question_number,
          stripPartDividerPlaceholders(stripOuterBraces(String(question.question_text || ''))),
        ]
          .map((value) => String(value || '').toLowerCase())
          .some((value) => value.includes(query));
      });
  }, [orderedQuestions, questionSearchQuery]);

  const previewStale = lastPreviewRevision === null || draftRevision !== lastPreviewRevision;
  const exportDisabled = exportingPdf !== null || !draftQuestions.length;

  const moveQuestion = React.useCallback((questionId: string, direction: -1 | 1) => {
    setOrderedQuestionIds((prev) => {
      const currentIndex = prev.indexOf(questionId);
      if (currentIndex < 0) return prev;
      const nextIndex = currentIndex + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(currentIndex, 1);
      next.splice(nextIndex, 0, moved);
      return next;
    });
    setDraftRevision((prev) => prev + 1);
  }, []);

  const toggleIncluded = React.useCallback((questionId: string) => {
    setIncludedQuestionIds((prev) => {
      if (prev.includes(questionId)) {
        return prev.filter((id) => id !== questionId);
      }
      return [...prev, questionId];
    });
    setPreviewError(null);
    setDraftRevision((prev) => prev + 1);
  }, []);

  const includeAllQuestions = React.useCallback(() => {
    setIncludedQuestionIds(orderedQuestions.map((question) => question.id));
    setPreviewError(null);
    setDraftRevision((prev) => prev + 1);
  }, [orderedQuestions]);

  const clearAllQuestions = React.useCallback(() => {
    setIncludedQuestionIds([]);
    setPreviewError(null);
    setDraftRevision((prev) => prev + 1);
  }, []);

  const setSelectedQuestionMarks = React.useCallback((marks: number) => {
    if (!selectedQuestion) return;
    const normalized = Number.isFinite(marks) ? Math.max(0, marks) : 0;
    setQuestionConfig((prev) => ({
      ...prev,
      [selectedQuestion.id]: {
        marks: normalized,
        hideMarks: prev[selectedQuestion.id]?.hideMarks || false,
      },
    }));
    setDraftRevision((prev) => prev + 1);
  }, [selectedQuestion]);

  const setSelectedQuestionHideMarks = React.useCallback((hideMarks: boolean) => {
    if (!selectedQuestion) return;
    setQuestionConfig((prev) => ({
      ...prev,
      [selectedQuestion.id]: {
        marks: prev[selectedQuestion.id]?.marks ?? selectedQuestion.marks ?? 0,
        hideMarks,
      },
    }));
    setDraftRevision((prev) => prev + 1);
  }, [selectedQuestion]);

  const setSelectedQuestionDraft = React.useCallback((updates: Partial<CustomExamQuestionDraftOverride>) => {
    if (!selectedQuestion) return;
    setQuestionDraftOverrides((prev) => ({
      ...prev,
      [selectedQuestion.id]: {
        ...(prev[selectedQuestion.id] || {}),
        ...updates,
      },
    }));
    setPreviewError(null);
    setDraftRevision((prev) => prev + 1);
  }, [selectedQuestion]);

  const resetSelectedQuestionDraft = React.useCallback(() => {
    if (!selectedQuestion) return;
    setQuestionDraftOverrides((prev) => {
      if (!prev[selectedQuestion.id]) return prev;
      const next = { ...prev };
      delete next[selectedQuestion.id];
      return next;
    });
    setPreviewError(null);
    setDraftRevision((prev) => prev + 1);
  }, [selectedQuestion]);

  const handleCopyRawLatex = React.useCallback(async (question: DisplayExamQuestion) => {
    try {
      const copied = await copyTextToClipboard(formatRawLatexForQuestion(question));
      setActionStatus(question.id, copied ? 'Raw LaTeX copied.' : 'Unable to copy LaTeX.');
    } catch {
      setActionStatus(question.id, 'Unable to copy LaTeX.');
    }
  }, [setActionStatus]);

  const handleCopySampleAnswerLatex = React.useCallback(async (question: DisplayExamQuestion) => {
    const sampleLatex = formatSampleAnswerLatexForQuestion(question);
    if (!sampleLatex) {
      setActionStatus(question.id, 'No sample answer LaTeX for this question.');
      return;
    }

    try {
      const copied = await copyTextToClipboard(sampleLatex);
      setActionStatus(question.id, copied ? 'Sample answer LaTeX copied.' : 'Unable to copy sample answer LaTeX.');
    } catch {
      setActionStatus(question.id, 'Unable to copy sample answer LaTeX.');
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

  const activeTitle = String(examTitle || '').trim() || 'Custom Exam';
  const exportPdfOptions = React.useMemo<CustomExamPdfOptions>(() => ({
    ...pdfOptions,
    hideDefaultHeader: pdfOptions.hideDefaultHeader !== false,
    coverPageTitle: String(pdfOptions.coverPageTitle || '').trim() || activeTitle,
    fontFamily: (['lmodern', 'sans', 'palatino'].includes(String(pdfOptions.fontFamily))
      ? pdfOptions.fontFamily
      : 'lmodern') as 'lmodern' | 'sans' | 'palatino',
    fontSizePt: Math.min(14, Math.max(9, Number(pdfOptions.fontSizePt || 11))),
    dottedAnswerLinesEnabled: Boolean(pdfOptions.dottedAnswerLinesEnabled),
    dottedAnswerLineCount: Math.min(12, Math.max(1, Number(pdfOptions.dottedAnswerLineCount || 3))),
    watermarkImageData: String(pdfOptions.watermarkImageData || '').trim(),
    watermarkOpacity: Math.min(0.35, Math.max(0.02, Number(pdfOptions.watermarkOpacity || 0.1))),
    watermarkImageScale: Math.min(0.95, Math.max(0.2, Number(pdfOptions.watermarkImageScale || 0.66))),
  }), [activeTitle, pdfOptions]);

  const updatePdfOptions = React.useCallback((updates: Partial<CustomExamPdfOptions>) => {
    setPdfOptions((prev) => ({ ...prev, ...updates }));
    setPreviewError(null);
    setDraftRevision((prev) => prev + 1);
  }, []);

  const handleWatermarkImageUpload = React.useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPreviewError('Please upload an image file for watermark.');
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      updatePdfOptions({
        watermarkEnabled: true,
        watermarkImageData: dataUrl,
        watermarkImageName: '',
      });
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'Failed to load watermark image.');
    } finally {
      event.target.value = '';
    }
  }, [updatePdfOptions]);

  const imageSizeOptions: QuestionImageSize[] = ['small', 'medium', 'large'];

  const handleGeneratePreview = React.useCallback(async () => {
    if (!draftQuestions.length) {
      setPreviewError('Select at least one question before generating a preview.');
      return;
    }

    setIsGeneratingPreview(true);
    setPreviewError(null);

    try {
      const result = await onExportPdf(previewMode, {
        preview: true,
        titleOverride: activeTitle,
        questionsOverride: draftQuestions,
        pdfOptions: exportPdfOptions,
      });

      if (!result?.blob) {
        throw new Error('Preview generation failed to return a PDF.');
      }

      const nextPreviewUrl = URL.createObjectURL(result.blob);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return nextPreviewUrl;
      });
      setLastPreviewRevision(draftRevision);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'Unable to generate preview.');
    } finally {
      setIsGeneratingPreview(false);
    }
  }, [activeTitle, draftQuestions, draftRevision, exportPdfOptions, onExportPdf, previewMode]);

  React.useEffect(() => {
    if (previewUrl || isGeneratingPreview || !draftQuestions.length) return;
    void handleGeneratePreview();
  }, [draftQuestions.length, handleGeneratePreview, isGeneratingPreview, previewUrl]);

  const exportWithDraft = React.useCallback((mode: CustomExamExportMode) => {
    void onExportPdf(mode, {
      titleOverride: activeTitle,
      questionsOverride: draftQuestions,
      pdfOptions: exportPdfOptions,
    });
  }, [activeTitle, draftQuestions, exportPdfOptions, onExportPdf]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-50 overflow-hidden">
      {/* Header */}
      <section className="shrink-0 border-b border-neutral-200 bg-white px-6 py-2.5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 text-sm font-medium text-neutral-500 transition hover:text-neutral-900 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              {backButtonLabel}
            </button>
            <p className="truncate text-xs text-neutral-500">
              {examMeta ? `${examMeta} • ` : ''}
              {draftQuestions.length} of {orderedQuestions.length} selected
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full border border-neutral-300 bg-neutral-50 p-1">
              <button
                type="button"
                onClick={() => {
                  setPreviewMode('questions');
                  setDraftRevision((prev) => prev + 1);
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${previewMode === 'questions' ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'}`}
              >
                Questions
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreviewMode('questions_with_solutions');
                  setDraftRevision((prev) => prev + 1);
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${previewMode === 'questions_with_solutions' ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'}`}
              >
                Q + S
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreviewMode('solutions_only');
                  setDraftRevision((prev) => prev + 1);
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${previewMode === 'solutions_only' ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'}`}
              >
                Solutions
              </button>
            </div>

            <button
              type="button"
              onClick={() => { void handleGeneratePreview(); }}
              disabled={isGeneratingPreview || !draftQuestions.length}
              className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isGeneratingPreview ? 'animate-spin' : ''}`} />
              {isGeneratingPreview ? 'Refreshing...' : 'Refresh'}
            </button>

            <button
              type="button"
              onClick={() => setPreviewOnly((prev) => !prev)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition cursor-pointer ${previewOnly ? 'border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800' : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50'}`}
            >
              <Eye className="h-3.5 w-3.5" />
              {previewOnly ? 'Exit Preview' : 'Preview'}
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={exportDisabled}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  {exportingPdf ? 'Exporting…' : 'Export'}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 rounded-2xl border-neutral-200 bg-white p-2 shadow-lg">
                <DropdownMenuItem
                  onSelect={() => exportWithDraft('questions')}
                  disabled={exportDisabled}
                  className="group rounded-xl px-3 py-2.5 text-neutral-800 outline-none transition data-[highlighted]:bg-neutral-100 data-[highlighted]:text-neutral-900"
                >
                  <div className="flex w-full items-start gap-2.5">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500 transition group-data-[highlighted]:text-neutral-900" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">Questions only</p>
                    </div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => exportWithDraft('questions_with_solutions')}
                  disabled={exportDisabled}
                  className="group rounded-xl px-3 py-2.5 text-neutral-800 outline-none transition data-[highlighted]:bg-neutral-100 data-[highlighted]:text-neutral-900"
                >
                  <div className="flex w-full items-start gap-2.5">
                    <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500 transition group-data-[highlighted]:text-neutral-900" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">Questions and solutions</p>
                    </div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => exportWithDraft('solutions_only')}
                  disabled={exportDisabled}
                  className="group rounded-xl px-3 py-2.5 text-neutral-800 outline-none transition data-[highlighted]:bg-neutral-100 data-[highlighted]:text-neutral-900"
                >
                  <div className="flex w-full items-start gap-2.5">
                    <ScrollText className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500 transition group-data-[highlighted]:text-neutral-900" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">Solutions only</p>
                    </div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => exportWithDraft('raw_latex_tex')}
                  disabled={exportDisabled}
                  className="group rounded-xl px-3 py-2.5 text-neutral-800 outline-none transition data-[highlighted]:bg-neutral-100 data-[highlighted]:text-neutral-900"
                >
                  <div className="flex w-full items-start gap-2.5">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500 transition group-data-[highlighted]:text-neutral-900" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">Raw LaTeX (.tex)</p>
                    </div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => exportWithDraft('raw_latex_zip')}
                  disabled={exportDisabled}
                  className="group rounded-xl px-3 py-2.5 text-neutral-800 outline-none transition data-[highlighted]:bg-neutral-100 data-[highlighted]:text-neutral-900"
                >
                  <div className="flex w-full items-start gap-2.5">
                    <Archive className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500 transition group-data-[highlighted]:text-neutral-900" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">Raw LaTeX and images (.zip)</p>
                    </div>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </section>

      {!orderedQuestions.length ? (
        <div className="m-6 rounded-2xl border border-dashed border-neutral-200 bg-white p-12 text-center text-neutral-500">
          No questions are available for this custom exam yet.
        </div>
      ) : (
        <section className="flex flex-1 min-h-0 flex-col bg-neutral-50">
          <div className="shrink-0 border-b border-neutral-200 bg-white px-6 py-1.5">
            {previewStale ? (
              <p className="text-xs font-medium text-amber-700">Draft has changed. Refresh the preview to see latest edits.</p>
            ) : (
              <p className="text-xs font-medium text-emerald-700">Preview is up to date with your draft.</p>
            )}
          </div>

          <div className="flex flex-1 min-h-0 gap-0 overflow-hidden bg-neutral-50">

            {/* Left Column - Questions List */}
            {!previewOnly && showLeftColumn && (
              <>
                <aside
                  className="flex flex-col border-r border-neutral-200 bg-neutral-50 p-3 overflow-hidden shrink-0"
                  style={{ width: `${leftColumnWidthRem}rem` }}
                >
                  <div className="space-y-2 shrink-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Questions</p>
                    <input
                      type="search"
                      value={questionSearchQuery}
                      onChange={(event) => setQuestionSearchQuery(event.target.value)}
                      placeholder="Search questions"
                      className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 outline-none transition focus:border-neutral-500"
                    />
                    <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                      <span>{draftQuestions.length} selected</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={includeAllQuestions}
                          className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-100 cursor-pointer"
                        >
                          All
                        </button>
                        <button
                          type="button"
                          onClick={clearAllQuestions}
                          className="rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-100 cursor-pointer"
                        >
                          None
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1 min-h-0">
                    {filteredQuestions.map(({ question, index }) => {
                      const isSelected = question.id === selectedQuestionId;
                      const isIncluded = includedIdSet.has(question.id);
                      const config = questionConfig[question.id] || { marks: question.marks || 0, hideMarks: false };
                      const tags = [
                        `Topic: ${question.topic || 'Not set'}`,
                        `Subtopic: ${question.subtopic || 'Not set'}`,
                        `Difficulty: ${question.difficulty || 'Not set'}`,
                        config.hideMarks ? 'Marks hidden' : `Marks: ${config.marks}`,
                      ];
                      return (
                        <div
                          key={question.id}
                          className={`rounded-xl border px-2.5 py-2 transition ${isSelected ? 'border-neutral-900 bg-white' : 'border-neutral-200 bg-white/70 hover:border-neutral-300'}`}
                        >
                          <div className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              checked={isIncluded}
                              onChange={() => toggleIncluded(question.id)}
                              className="mt-0.5 h-4 w-4 cursor-pointer rounded border-neutral-300"
                              aria-label={`Include question ${index + 1}`}
                            />
                            <button
                              type="button"
                              onClick={() => setSelectedQuestionId(question.id)}
                              className="min-w-0 flex-1 text-left cursor-pointer"
                            >
                              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500">Q{index + 1}</p>
                              <p className="line-clamp-2 text-sm text-neutral-800">
                                {stripPartDividerPlaceholders(stripOuterBraces(String(question.question_text || ''))) || 'Untitled question'}
                              </p>
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {tags.map((tag) => (
                                  <span
                                    key={tag}
                                    className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-700"
                                    title={tag}
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </button>
                            <div className="flex flex-col gap-1">
                              <button
                                type="button"
                                onClick={() => moveQuestion(question.id, -1)}
                                disabled={index === 0}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-neutral-300 bg-white text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                                aria-label={`Move question ${index + 1} up`}
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveQuestion(question.id, 1)}
                                disabled={index === orderedQuestions.length - 1}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-neutral-300 bg-white text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                                aria-label={`Move question ${index + 1} down`}
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {!filteredQuestions.length ? (
                      <p className="rounded-xl border border-dashed border-neutral-300 px-3 py-4 text-center text-xs text-neutral-500">
                        No questions match your search.
                      </p>
                    ) : null}
                  </div>
                </aside>
                <ResizeHandle
                  width={leftColumnWidthRem}
                  isVisible={showLeftColumn}
                  onWidthChange={setLeftColumnWidthRem}
                  onToggleVisibility={() => setShowLeftColumn(!showLeftColumn)}
                  position="left"
                  minWidth={12}
                  maxWidth={35}
                />
              </>
            )}

            {/* Center Column - PDF Viewer */}
            <div className="flex flex-col flex-1 overflow-hidden min-w-0">
              {previewError ? (
                <div className="m-3 shrink-0 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {previewError}
                </div>
              ) : null}
              {previewUrl ? (
                <CustomPdfViewer
                  pdfUrl={previewUrl}
                  className="flex-1 min-h-0"
                />
              ) : (
                <div className="flex flex-1 items-center justify-center m-3 rounded-xl border border-dashed border-neutral-300 bg-white text-center text-sm text-neutral-500">
                  {isGeneratingPreview ? (
                    <div className="flex flex-col items-center gap-2 text-neutral-500">
                      <div className="w-6 h-6 border-2 border-neutral-400 border-t-neutral-700 rounded-full animate-spin" />
                      Generating preview…
                    </div>
                  ) : (
                    'Generate a preview to inspect the export-ready PDF.'
                  )}
                </div>
              )}
            </div>

            {/* Right Column - ResizeHandle + Options */}
            {!previewOnly && showRightColumn && (
              <>
                <ResizeHandle
                  width={rightColumnWidthRem}
                  isVisible={showRightColumn}
                  onWidthChange={setRightColumnWidthRem}
                  onToggleVisibility={() => setShowRightColumn(!showRightColumn)}
                  position="right"
                  minWidth={14}
                  maxWidth={40}
                />
                <aside
                  className="flex flex-col border-l border-neutral-200 bg-white overflow-y-auto shrink-0"
                  style={{ width: `${rightColumnWidthRem}rem` }}
                >
                  <div className="space-y-4 p-4">

                    {/* PDF customisation */}
                    <div className="rounded-xl border border-neutral-200 bg-neutral-50">
                      <button
                        type="button"
                        onClick={() => setIsPdfCustomisationOpen((prev) => !prev)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">PDF customisation</p>
                        {isPdfCustomisationOpen ? <ArrowUp className="h-4 w-4 text-neutral-500" /> : <ArrowDown className="h-4 w-4 text-neutral-500" />}
                      </button>

                      {isPdfCustomisationOpen ? (
                        <div className="space-y-3 border-t border-neutral-200 px-3 pb-3 pt-2.5">
                          <label className="flex items-center gap-2 text-xs font-medium text-neutral-700">
                            <input
                              type="checkbox"
                              checked={Boolean(pdfOptions.hideDefaultHeader !== false)}
                              onChange={(event) => updatePdfOptions({ hideDefaultHeader: event.target.checked })}
                              className="h-4 w-4 cursor-pointer rounded border-neutral-300"
                            />
                            Remove default PDF header text
                          </label>

                          <label className="flex items-center gap-2 text-xs font-medium text-neutral-700">
                            <input
                              type="checkbox"
                              checked={Boolean(pdfOptions.includeCoverPage)}
                              onChange={(event) => updatePdfOptions({ includeCoverPage: event.target.checked })}
                              className="h-4 w-4 cursor-pointer rounded border-neutral-300"
                            />
                            Include cover page
                          </label>

                          <div className="space-y-2">
                            <label className="text-[11px] font-semibold uppercase tracking-[0.13em] text-neutral-500" htmlFor="cover-page-title">
                              Cover title
                            </label>
                            <input
                              id="cover-page-title"
                              type="text"
                              value={pdfOptions.coverPageTitle || ''}
                              onChange={(event) => updatePdfOptions({ coverPageTitle: event.target.value })}
                              placeholder="Defaults to exam title"
                              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 outline-none transition focus:border-neutral-500"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-[11px] font-semibold uppercase tracking-[0.13em] text-neutral-500" htmlFor="cover-page-subtitle">
                              Cover subtitle
                            </label>
                            <input
                              id="cover-page-subtitle"
                              type="text"
                              value={pdfOptions.coverPageSubtitle || ''}
                              onChange={(event) => updatePdfOptions({ coverPageSubtitle: event.target.value })}
                              placeholder="Optional subtitle"
                              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 outline-none transition focus:border-neutral-500"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-[11px] font-semibold uppercase tracking-[0.13em] text-neutral-500" htmlFor="cover-page-footer">
                              Cover footer
                            </label>
                            <input
                              id="cover-page-footer"
                              type="text"
                              value={pdfOptions.coverPageFooter || ''}
                              onChange={(event) => updatePdfOptions({ coverPageFooter: event.target.value })}
                              placeholder="Optional footer text"
                              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 outline-none transition focus:border-neutral-500"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-[11px] font-semibold uppercase tracking-[0.13em] text-neutral-500" htmlFor="pdf-font-family">
                              Font family
                            </label>
                            <select
                              id="pdf-font-family"
                              value={exportPdfOptions.fontFamily || 'lmodern'}
                              onChange={(event) => updatePdfOptions({ fontFamily: event.target.value as 'lmodern' | 'sans' | 'palatino' })}
                              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 outline-none transition focus:border-neutral-500"
                            >
                              <option value="lmodern">Latin Modern (default)</option>
                              <option value="palatino">Palatino</option>
                              <option value="sans">Sans Serif</option>
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.13em] text-neutral-500">
                              <span>Font size</span>
                              <span>{Math.round(exportPdfOptions.fontSizePt || 11)}pt</span>
                            </div>
                            <input
                              type="range"
                              min={9}
                              max={14}
                              step={1}
                              value={Math.round(exportPdfOptions.fontSizePt || 11)}
                              onChange={(event) => {
                                const next = Number.parseInt(event.target.value || '11', 10);
                                updatePdfOptions({ fontSizePt: Math.max(9, Math.min(14, next)) });
                              }}
                              className="w-full cursor-pointer"
                            />
                          </div>

                          <label className="flex items-center gap-2 text-xs font-medium text-neutral-700">
                            <input
                              type="checkbox"
                              checked={Boolean(pdfOptions.dottedAnswerLinesEnabled)}
                              onChange={(event) => updatePdfOptions({ dottedAnswerLinesEnabled: event.target.checked })}
                              className="h-4 w-4 cursor-pointer rounded border-neutral-300"
                            />
                            Add dotted answer lines (questions-only)
                          </label>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.13em] text-neutral-500">
                              <span>Dotted lines per question</span>
                              <span>{Math.round(exportPdfOptions.dottedAnswerLineCount || 3)}</span>
                            </div>
                            <input
                              type="range"
                              min={1}
                              max={12}
                              step={1}
                              value={Math.round(exportPdfOptions.dottedAnswerLineCount || 3)}
                              onChange={(event) => {
                                const next = Number.parseInt(event.target.value || '3', 10);
                                updatePdfOptions({ dottedAnswerLineCount: Math.max(1, Math.min(12, next)) });
                              }}
                              className="w-full cursor-pointer"
                              disabled={!pdfOptions.dottedAnswerLinesEnabled}
                            />
                          </div>

                          <label className="flex items-center gap-2 text-xs font-medium text-neutral-700">
                            <input
                              type="checkbox"
                              checked={Boolean(pdfOptions.watermarkEnabled)}
                              onChange={(event) => updatePdfOptions({ watermarkEnabled: event.target.checked })}
                              className="h-4 w-4 cursor-pointer rounded border-neutral-300"
                            />
                            Add watermark
                          </label>

                          <div className="space-y-2">
                            <label className="text-[11px] font-semibold uppercase tracking-[0.13em] text-neutral-500" htmlFor="watermark-image-upload">
                              Watermark image
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                id="watermark-image-upload"
                                type="file"
                                accept="image/*"
                                onChange={(event) => { void handleWatermarkImageUpload(event); }}
                                className="block w-full cursor-pointer rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs text-neutral-700"
                              />
                              {pdfOptions.watermarkImageData ? (
                                <button
                                  type="button"
                                  onClick={() => updatePdfOptions({ watermarkImageData: '', watermarkImageName: '' })}
                                  className="inline-flex items-center rounded-md border border-neutral-300 bg-white px-2 py-1 text-[11px] font-medium text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-100 cursor-pointer"
                                >
                                  Clear
                                </button>
                              ) : null}
                            </div>
                            {pdfOptions.watermarkImageName ? (
                              <p className="text-[11px] text-neutral-500">Using: {pdfOptions.watermarkImageName}</p>
                            ) : null}
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.13em] text-neutral-500">
                              <span>Watermark opacity</span>
                              <span>{Math.round((exportPdfOptions.watermarkOpacity || 0.1) * 100)}%</span>
                            </div>
                            <input
                              type="range"
                              min={2}
                              max={35}
                              step={1}
                              value={Math.round((pdfOptions.watermarkOpacity || 0.1) * 100)}
                              onChange={(event) => {
                                const next = Number.parseInt(event.target.value || '10', 10);
                                updatePdfOptions({ watermarkOpacity: Math.max(0.02, Math.min(0.35, next / 100)) });
                              }}
                              className="w-full cursor-pointer"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.13em] text-neutral-500">
                              <span>Watermark image size</span>
                              <span>{Math.round((exportPdfOptions.watermarkImageScale || 0.66) * 100)}%</span>
                            </div>
                            <input
                              type="range"
                              min={20}
                              max={95}
                              step={1}
                              value={Math.round((pdfOptions.watermarkImageScale || 0.66) * 100)}
                              onChange={(event) => {
                                const next = Number.parseInt(event.target.value || '66', 10);
                                updatePdfOptions({ watermarkImageScale: Math.max(0.2, Math.min(0.95, next / 100)) });
                              }}
                              className="w-full cursor-pointer"
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {/* Selected question details */}
                    {selectedQuestion ? (
                      <div className="space-y-4">
                        <label className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-700">
                          <input
                            type="checkbox"
                            checked={includedIdSet.has(selectedQuestion.id)}
                            onChange={() => toggleIncluded(selectedQuestion.id)}
                            className="h-4 w-4 cursor-pointer rounded border-neutral-300"
                          />
                          Include this question
                        </label>

                        <div className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Marks</p>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              disabled={Boolean(selectedConfig?.hideMarks)}
                              value={selectedConfig?.marks ?? 0}
                              onChange={(event) => {
                                setSelectedQuestionMarks(Number.parseInt(event.target.value || '0', 10));
                              }}
                              className="w-24 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-800 outline-none transition focus:border-neutral-500 disabled:opacity-50"
                            />
                            <span className="text-xs text-neutral-500">mark count</span>
                          </div>
                          <label className="flex items-center gap-2 text-xs text-neutral-700">
                            <input
                              type="checkbox"
                              checked={Boolean(selectedConfig?.hideMarks)}
                              onChange={(event) => setSelectedQuestionHideMarks(event.target.checked)}
                              className="h-4 w-4 cursor-pointer rounded border-neutral-300"
                            />
                            Hide marks for this question
                          </label>
                          <div className="space-y-1.5 border-t border-neutral-200 pt-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs text-neutral-700">Dotted lines override</span>
                              <button
                                type="button"
                                onClick={() => setSelectedQuestionDraft({ dotted_answer_line_count: null })}
                                className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-[10px] font-medium text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-100 cursor-pointer"
                              >
                                Use global
                              </button>
                            </div>
                            <input
                              type="number"
                              min={1}
                              max={12}
                              step={1}
                              value={selectedDraft?.dotted_answer_line_count ?? ''}
                              onChange={(event) => {
                                const raw = String(event.target.value || '').trim();
                                if (!raw) {
                                  setSelectedQuestionDraft({ dotted_answer_line_count: null });
                                  return;
                                }
                                const next = Number.parseInt(raw, 10);
                                if (!Number.isFinite(next)) return;
                                setSelectedQuestionDraft({ dotted_answer_line_count: Math.max(1, Math.min(12, next)) });
                              }}
                              placeholder={`Global (${Math.round(exportPdfOptions.dottedAnswerLineCount || 3)})`}
                              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-800 outline-none transition focus:border-neutral-500"
                            />
                          </div>
                        </div>

                        <div className="rounded-xl border border-neutral-200 bg-neutral-50">
                          <button
                            type="button"
                            onClick={() => setIsQuestionContentOpen((prev) => !prev)}
                            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
                          >
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Question content</p>
                            {isQuestionContentOpen ? <ArrowUp className="h-4 w-4 text-neutral-500" /> : <ArrowDown className="h-4 w-4 text-neutral-500" />}
                          </button>

                          {isQuestionContentOpen ? (
                            <div className="space-y-3 border-t border-neutral-200 px-3 pb-3 pt-2.5">
                              <div className="flex items-center justify-end">
                                <button
                                  type="button"
                                  onClick={resetSelectedQuestionDraft}
                                  className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-[11px] font-medium text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-100 cursor-pointer"
                                >
                                  Reset edits
                                </button>
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[11px] font-semibold uppercase tracking-[0.13em] text-neutral-500" htmlFor="selected-question-text">
                                  Question content
                                </label>
                                <textarea
                                  id="selected-question-text"
                                  value={selectedDraft?.question_text ?? selectedQuestion.question_text ?? ''}
                                  onChange={(event) => setSelectedQuestionDraft({ question_text: event.target.value })}
                                  className="min-h-[120px] w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 outline-none transition focus:border-neutral-500"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[11px] font-semibold uppercase tracking-[0.13em] text-neutral-500" htmlFor="selected-answer-text">
                                  {selectedQuestion.question_type === 'multiple_choice' ? 'MCQ explanation' : 'Sample answer'}
                                </label>
                                <textarea
                                  id="selected-answer-text"
                                  value={selectedQuestion.question_type === 'multiple_choice'
                                    ? (selectedDraft?.mcq_explanation ?? selectedQuestion.mcq_explanation ?? '')
                                    : (selectedDraft?.sample_answer ?? selectedQuestion.sample_answer ?? '')}
                                  onChange={(event) => {
                                    if (selectedQuestion.question_type === 'multiple_choice') {
                                      setSelectedQuestionDraft({ mcq_explanation: event.target.value });
                                      return;
                                    }
                                    setSelectedQuestionDraft({ sample_answer: event.target.value });
                                  }}
                                  className="min-h-[120px] w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 outline-none transition focus:border-neutral-500"
                                />
                              </div>
                            </div>
                          ) : null}
                        </div>

                        {(selectedQuestion.graph_image_data
                          || selectedQuestion.sample_answer_image
                          || selectedQuestion.mcq_option_a_image
                          || selectedQuestion.mcq_option_b_image
                          || selectedQuestion.mcq_option_c_image
                          || selectedQuestion.mcq_option_d_image) ? (
                          <div className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Image sizing</p>
                            {selectedQuestion.graph_image_data ? (
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs text-neutral-700">Question image</span>
                                <select
                                  value={selectedQuestion.graph_image_size || 'medium'}
                                  onChange={(event) => setSelectedQuestionDraft({ graph_image_size: event.target.value as QuestionImageSize })}
                                  className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-800"
                                >
                                  {imageSizeOptions.map((size) => (
                                    <option key={size} value={size}>{size}</option>
                                  ))}
                                </select>
                              </div>
                            ) : null}

                            {selectedQuestion.sample_answer_image ? (
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs text-neutral-700">Sample answer image</span>
                                <select
                                  value={selectedQuestion.sample_answer_image_size || 'medium'}
                                  onChange={(event) => setSelectedQuestionDraft({ sample_answer_image_size: event.target.value as QuestionImageSize })}
                                  className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-800"
                                >
                                  {imageSizeOptions.map((size) => (
                                    <option key={size} value={size}>{size}</option>
                                  ))}
                                </select>
                              </div>
                            ) : null}

                            {([
                              ['A', selectedQuestion.mcq_option_a_image, selectedQuestion.mcq_option_a_image_size, 'mcq_option_a_image_size'],
                              ['B', selectedQuestion.mcq_option_b_image, selectedQuestion.mcq_option_b_image_size, 'mcq_option_b_image_size'],
                              ['C', selectedQuestion.mcq_option_c_image, selectedQuestion.mcq_option_c_image_size, 'mcq_option_c_image_size'],
                              ['D', selectedQuestion.mcq_option_d_image, selectedQuestion.mcq_option_d_image_size, 'mcq_option_d_image_size'],
                            ] as Array<[string, string | null | undefined, string | null | undefined, keyof CustomExamQuestionDraftOverride]>).map(([label, imageValue, sizeValue, key]) => {
                              if (!imageValue) return null;
                              return (
                                <div key={label} className="flex items-center justify-between gap-2">
                                  <span className="text-xs text-neutral-700">MCQ option {label} image</span>
                                  <select
                                    value={sizeValue || 'medium'}
                                    onChange={(event) => setSelectedQuestionDraft({ [key]: event.target.value as QuestionImageSize })}
                                    className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-800"
                                  >
                                    {imageSizeOptions.map((size) => (
                                      <option key={size} value={size}>{size}</option>
                                    ))}
                                  </select>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}

                        <div className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700">
                          <p><span className="font-semibold text-neutral-900">Topic:</span> {selectedQuestion.topic || 'Not set'}</p>
                          <p><span className="font-semibold text-neutral-900">Subtopic:</span> {selectedQuestion.subtopic || 'Not set'}</p>
                          <p><span className="font-semibold text-neutral-900">Year:</span> {selectedQuestion.year || 'Unknown'}</p>
                          <p><span className="font-semibold text-neutral-900">Source:</span> {selectedQuestion.school_name || DEFAULT_EXAM_SOURCE_LABEL}</p>
                          <p><span className="font-semibold text-neutral-900">Paper number:</span> {selectedQuestion.source_question_numbers.length ? selectedQuestion.source_question_numbers.join(', ') : (selectedQuestion.display_question_number || 'Unknown')}</p>
                        </div>

                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={() => void handleCopyRawLatex(selectedQuestion)}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50 cursor-pointer"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Copy raw LaTeX
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleCopySampleAnswerLatex(selectedQuestion)}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50 cursor-pointer"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Copy sample answer LaTeX
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleCopyImageList(selectedQuestion)}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50 cursor-pointer"
                          >
                            <ImageIcon className="h-3.5 w-3.5" />
                            Copy image URLs
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadImages(selectedQuestion, selectedQuestionIndex + 1)}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50 cursor-pointer"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Download related images
                          </button>
                        </div>

                        {questionActionStatus[selectedQuestion.id] ? (
                          <p className="text-xs font-medium text-neutral-500">{questionActionStatus[selectedQuestion.id]}</p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="flex min-h-[12rem] items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-4 text-center text-sm text-neutral-500">
                        Select a question to view details.
                      </div>
                    )}

                  </div>
                </aside>
              </>
            )}

          </div>
        </section>
      )}
    </div>
  );
}
