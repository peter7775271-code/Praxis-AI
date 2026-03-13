'use client';

import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Undo2,
  Redo2,
  Trash2,
  Send,
  Upload,
  ArrowLeft,
  BookOpen,
  Atom,
  Beaker,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Eye,
  Download,
  Bookmark,
  Settings,
  Menu,
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingUp,
  Edit2,
  Timer,
  Eraser,
  Search,
  Zap,
  LayoutDashboard,
  LineChart,
  PlusCircle,
  Sigma,
  History,
  SlidersHorizontal,
  Brain,
  Trophy,
  Target,
  Sparkles,
  Layers,
  ArrowRight,
  GraduationCap,
  FileText,
  Info,
  ChevronDown,
  ChevronUp,
  PanelLeftClose,
  PanelLeftOpen,
  Award,
  Clock,
  Hash,
  ScrollText,
} from 'lucide-react';
import { getStroke } from 'perfect-freehand';
import type {
  AppState as ExcalidrawAppState,
  BinaryFiles,
  ExcalidrawElement,
  ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw';
import SyllabusViewer from './syllabus-viewer';
import {
  CURRENT_EXAM_YEAR,
  MIN_EXAM_YEAR,
  SUBJECTS_BY_YEAR,
  TOPICS_BY_YEAR_SUBJECT,
  getPaperKey,
  getTopics,
} from './syllabus-config';
import {
  LatexText,
  QuestionTextWithDividers,
  formatPartDividerPlaceholder,
} from './question-text-with-dividers';
import {
  AnalyticsHubView,
  BrowseView,
  DashboardView,
  ExamBuilderView,
  FormulaVaultView,
  HistoryView,
} from './dashboard-views';
import type {
  DashboardViewMode,
  ExamBuilderParams,
  HeatmapCell,
  TopicStat,
} from './types';
import { ComboboxDemo } from '@/components/ui/demo';
import { InteractiveLogsTable } from '@/components/ui/interactive-logs-table-shadcnui';
import type {
  Filter as ManageQuestionChipFilter,
  FilterConfig as ManageQuestionFilterConfig,
  FilterOption as ManageQuestionFilterOption,
} from '@/components/ui/filters';
import { FilterType as ManageQuestionFilterType } from '@/components/ui/filters';
import { Sidebar, SidebarBody } from '@/components/ui/sidebar';
import { parseCriteriaForDisplay, stripOuterBraces } from './view-helpers';
import InlineQuestionEditorModal from './InlineQuestionEditorModal';
import EditQuestionModal from './EditQuestionModal';

const Excalidraw = dynamic(
  async () => {
    const mod = await import('@excalidraw/excalidraw');
    return mod.Excalidraw;
  },
  { ssr: false }
);
// TikzRenderer no longer used in this page

const pad2 = (value: number) => String(value).padStart(2, '0');

const toLocalDateKey = (date: Date) => {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

const addDays = (date: Date, delta: number) => {
  const next = new Date(date);
  next.setDate(date.getDate() + delta);
  return next;
};

export default function DashboardApp({ initialViewMode = 'dashboard' }: { initialViewMode?: DashboardViewMode }) {
  const router = useRouter();
  const dprRef = useRef(1);

  // Legacy freehand canvas refs kept as inert stubs so helpers that still reference
  // them don't crash at runtime. They are no longer wired to any JSX element.
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  type StrokePoint = [number, number, number];
  type Stroke = StrokePoint[];
  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const historyRef = useRef<Stroke[][]>([]);
  const redoStackRef = useRef<Stroke[][]>([]);
  const eraserPathRef = useRef<[number, number][]>([]);
  const drawingRef = useRef(false);
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);
  const ERASER_RADIUS = 20;
  const activeInputRef = useRef<'pointer' | 'mouse' | 'touch' | null>(null);

  // Question data from database
  type Question = {
    id: string;
    grade: string;
    year: number;
    subject: string;
    paper_number?: number | null;
    group_id?: string | null;
    topic: string;
    subtopic?: string | null;
    syllabus_dot_point?: string | null;
    school_name?: string | null;
    marks: number;
    question_number?: string | null;
    question_text: string;
    question_type?: 'written' | 'multiple_choice' | null;
    marking_criteria?: string | null;
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
    exam_incomplete?: boolean | null;
    _display_group_key?: string | null;
  };

  type ReviewVerifyExamOption = {
    key: string;
    schoolName: string;
    year: number;
    paperNumber: number;
    grade: string;
    subject: string;
    count: number;
  };

  const getFetchErrorMessage = (err: unknown, fallback: string) => {
    if (!(err instanceof Error)) return fallback;
    const message = String(err.message || '').trim();
    const lower = message.toLowerCase();

    if (err.name === 'AbortError' || err.name === 'TimeoutError' || lower.includes('timed out')) {
      return 'Request timed out. Please try again.';
    }

    if (lower.includes('fetch failed') || lower.includes('failed to fetch')) {
      return 'Network error while contacting the server. Please check your connection and try again.';
    }

    return message || fallback;
  };

  const isExpectedFetchError = (err: unknown) => {
    if (!(err instanceof Error)) return false;
    const message = String(err.message || '').toLowerCase();
    return (
      err.name === 'AbortError' ||
      err.name === 'TimeoutError' ||
      message.includes('timed out') ||
      message.includes('fetch failed') ||
      message.includes('failed to fetch')
    );
  };

  const isExamIncomplete = (value: unknown) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    const normalized = String(value ?? '').trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 't';
  };

  const fetchWithTimeout = async (url: string, timeoutMs = 10000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(new DOMException(`Request timed out after ${timeoutMs}ms`, 'TimeoutError')),
      timeoutMs
    );

    try {
      const response = await fetch(url, { signal: controller.signal });
      return response;
    } catch (err) {
      throw new Error(getFetchErrorMessage(err, 'Failed to fetch data'));
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const [question, setQuestion] = useState<Question | null>(null);
  const [brushSize, setBrushSize] = useState(2);
  const [canRedo, setCanRedo] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [yearLevel, setYearLevel] = useState<'Year 11' | 'Year 12'>('Year 12');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const [appState, setAppState] = useState<'idle' | 'marking' | 'reviewed'>('idle');
  const [canvasHeight, setCanvasHeight] = useState(500);
  const [isEraser, setIsEraser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isPenDrawing, setIsPenDrawing] = useState(false);
  const [isIpad, setIsIpad] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<any>(null);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [submittedAnswer, setSubmittedAnswer] = useState<string | null>(null);
  const [selectedMcqAnswer, setSelectedMcqAnswer] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [mcqImageSize, setMcqImageSize] = useState<number>(128); // Default max-h-32 (128px)
  const [savedAttempts, setSavedAttempts] = useState<any[]>([]);
  const [showSavedAttempts, setShowSavedAttempts] = useState(false);
  const [selectedAttempt, setSelectedAttempt] = useState<any>(null);
  const [showLatexModal, setShowLatexModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [isUpdatingQuestion, setIsUpdatingQuestion] = useState(false);
  const [examPdfFile, setExamPdfFile] = useState<File | null>(null);
  const [criteriaPdfFile, setCriteriaPdfFile] = useState<File | null>(null);
  const [examImageFiles, setExamImageFiles] = useState<File[]>([]);
  const [pdfStatus, setPdfStatus] = useState<'idle' | 'uploading' | 'ready' | 'error'>('idle');
  const [pdfMessage, setPdfMessage] = useState<string>('');
  const [pdfChatGptResponse, setPdfChatGptResponse] = useState<string>('');
  const [pdfRawInputs, setPdfRawInputs] = useState<string>('');
  const [pdfGrade, setPdfGrade] = useState<'Year 7' | 'Year 8' | 'Year 9' | 'Year 10' | 'Year 11' | 'Year 12'>('Year 12');
  const [pdfYear, setPdfYear] = useState<string>(new Date().getFullYear().toString());
  const [pdfSubject, setPdfSubject] = useState<string>('Mathematics Advanced');
  const [pdfOverwrite, setPdfOverwrite] = useState(false);
  const [pdfGenerateCriteria, setPdfGenerateCriteria] = useState(false);
  const [pdfAutoGroupSubparts, setPdfAutoGroupSubparts] = useState(false);
  const [pdfSchoolName, setPdfSchoolName] = useState('');
  const [pdfPaperNumber, setPdfPaperNumber] = useState('');
  const [selectedSyllabusMappingPaper, setSelectedSyllabusMappingPaper] = useState('');
  const [isMappingSyllabusDotPoints, setIsMappingSyllabusDotPoints] = useState(false);
  const [syllabusMappingResult, setSyllabusMappingResult] = useState<string>('');
  const [syllabusMappingStatus, setSyllabusMappingStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [syllabusMappingProgress, setSyllabusMappingProgress] = useState<{ current: number; total: number } | null>(null);
  const [syllabusMappingDebugOutputs, setSyllabusMappingDebugOutputs] = useState<Array<{
    questionId: string;
    questionNumber: string | null;
    topic: string;
    reason: string;
    rawModelOutput: string | null;
    parsedModelOutput: unknown;
    allowedContextSize: number;
  }>>([]);
  const [syllabusWorkflowTestInput, setSyllabusWorkflowTestInput] = useState('');
  const [isRunningSyllabusWorkflowTest, setIsRunningSyllabusWorkflowTest] = useState(false);
  const [syllabusWorkflowTestStatus, setSyllabusWorkflowTestStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [syllabusWorkflowTestResult, setSyllabusWorkflowTestResult] = useState('');
  const [syllabusWorkflowTestOutput, setSyllabusWorkflowTestOutput] = useState<Record<string, unknown> | null>(null);
  const [taxonomyGrouped, setTaxonomyGrouped] = useState<Record<string, Record<string, { id: string; text: string }[]>>>({});
  const [taxonomyLoading, setTaxonomyLoading] = useState(false);
  const [syllabusImportText, setSyllabusImportText] = useState('');
  const [syllabusImportSubject, setSyllabusImportSubject] = useState('Mathematics');
  const [syllabusImportGrade, setSyllabusImportGrade] = useState<'Year 7' | 'Year 8' | 'Year 9' | 'Year 10' | 'Year 11' | 'Year 12'>('Year 10');
  const [syllabusImporting, setSyllabusImporting] = useState(false);
  const [syllabusImportResult, setSyllabusImportResult] = useState('');
  const [syllabusImportStatus, setSyllabusImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const pdfYearRef = useRef(pdfYear);
  pdfYearRef.current = pdfYear;
  const [viewMode, setViewMode] = useState<DashboardViewMode>(initialViewMode);
  const [isSaving, setIsSaving] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const [userCreatedAt, setUserCreatedAt] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [userNameDraft, setUserNameDraft] = useState<string>('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [paperQuestions, setPaperQuestions] = useState<Question[]>([]);
  const [paperIndex, setPaperIndex] = useState(0);
  const [showPaperQuestionNavigator, setShowPaperQuestionNavigator] = useState(false);
  const [showQuestionInfo, setShowQuestionInfo] = useState(false);
  const [activePaper, setActivePaper] = useState<{ year: string; subject: string; grade: string; school: string; count: number } | null>(null);
  const [exportingPaperPdf, setExportingPaperPdf] = useState<'exam' | 'solutions' | null>(null);
  const [exportingSavedExamPdf, setExportingSavedExamPdf] = useState<'exam' | 'solutions' | null>(null);
  const [examEndsAt, setExamEndsAt] = useState<number | null>(null);
  const [examRemainingMs, setExamRemainingMs] = useState<number | null>(null);
  const [examConditionsActive, setExamConditionsActive] = useState(false);
  const [examAttempts, setExamAttempts] = useState<Array<{ question: Question; submittedAnswer: string | null; feedback: any }>>([]);
  const [examEnded, setExamEnded] = useState(false);
  const [showFinishExamPrompt, setShowFinishExamPrompt] = useState(false);
  const [examReviewMode, setExamReviewMode] = useState(false);
  const [examReviewIndex, setExamReviewIndex] = useState(0);
  const [savedExamReviewMode, setSavedExamReviewMode] = useState(false);
  const [savedExamReviewIndex, setSavedExamReviewIndex] = useState(0);
  const [savedQuestionsListExpanded, setSavedQuestionsListExpanded] = useState(false);
  const [savedReviewSidebarCollapsed, setSavedReviewSidebarCollapsed] = useState(false);
  const [isInitializingExam, setIsInitializingExam] = useState(false);
  const [analyticsSummary, setAnalyticsSummary] = useState<string>('');
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [syllabusTopic, setSyllabusTopic] = useState<string | null>(null);
  const [heatmapMonth, setHeatmapMonth] = useState<number>(new Date().getMonth());
  const [heatmapYear] = useState<number>(new Date().getFullYear());
  const excalidrawSceneRef = useRef<{
    elements: readonly ExcalidrawElement[];
    appState: ExcalidrawAppState;
    files: BinaryFiles;
  } | null>(null);
  const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null);

  // Dev mode state
  const [isDevMode, setIsDevMode] = useState(false);
  const [devTab, setDevTab] = useState<'add' | 'manage' | 'review'>('add');
  const [allQuestions, setAllQuestions] = useState<any[]>([]);
  const [browseQuestions, setBrowseQuestions] = useState<any[]>([]);
  const [browseQuestionsSubject, setBrowseQuestionsSubject] = useState<string>('');
  const [browseLoadingQuestions, setBrowseLoadingQuestions] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [questionsFetchError, setQuestionsFetchError] = useState<string | null>(null);
  const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(null);
  const [selectedManageQuestionId, setSelectedManageQuestionId] = useState<string | null>(null);
  const [manageQuestionDraft, setManageQuestionDraft] = useState<any | null>(null);
  const [manageQuestionEditMode, setManageQuestionEditMode] = useState(false);
  const manageListScrollYRef = useRef(0);
  const [inlineEditDraft, setInlineEditDraft] = useState<any | null>(null);
  const [inlineEditSaving, setInlineEditSaving] = useState(false);
  const [selectedManageQuestionIds, setSelectedManageQuestionIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [manageFilters, setManageFilters] = useState<ManageQuestionChipFilter[]>([]);
  const [manageSearchQuery, setManageSearchQuery] = useState('');
  const [manageFiltersApplied, setManageFiltersApplied] = useState(false);
  const [manageSortKey, setManageSortKey] = useState<'question_number' | 'year' | 'subject' | 'grade' | 'marks' | 'topic' | 'school'>('question_number');
  const [manageSortDirection, setManageSortDirection] = useState<'asc' | 'desc'>('asc');
  const [manageSubView, setManageSubView] = useState<'list' | 'image-map'>('list');
  const [selectedVisibilityExamKey, setSelectedVisibilityExamKey] = useState('');
  const [examVisibilityUpdatingKey, setExamVisibilityUpdatingKey] = useState('');
  const [examVisibilityMessage, setExamVisibilityMessage] = useState<string | null>(null);
  const [imageMapSelectedPaperKey, setImageMapSelectedPaperKey] = useState('');
  const [imageMapQuestions, setImageMapQuestions] = useState<any[]>([]);
  const [imageMapDraftById, setImageMapDraftById] = useState<Record<string, {
    graph_image_data: string;
    sample_answer_image: string;
    mcq_option_a_image: string;
    mcq_option_b_image: string;
    mcq_option_c_image: string;
    mcq_option_d_image: string;
    mcq_correct_answer: 'A' | 'B' | 'C' | 'D';
  }>>({});
  const [imageMapSaving, setImageMapSaving] = useState(false);
  const [selectedGroupingPaperKey, setSelectedGroupingPaperKey] = useState('');
  const [groupingPaperLoading, setGroupingPaperLoading] = useState(false);
  const [groupingPaperMessage, setGroupingPaperMessage] = useState<string | null>(null);
  const [selectedVerifySolutionsExamKey, setSelectedVerifySolutionsExamKey] = useState('');
  const [verifySolutionsApplyUpdates, setVerifySolutionsApplyUpdates] = useState(false);
  const [isVerifyingSolutions, setIsVerifyingSolutions] = useState(false);
  const [verifySolutionsStatus, setVerifySolutionsStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [verifySolutionsMessage, setVerifySolutionsMessage] = useState('');
  const [verifySolutionsOutput, setVerifySolutionsOutput] = useState<Record<string, unknown> | null>(null);
  const mainContentScrollRef = useRef<HTMLDivElement | null>(null);
  const manageDragSelectingRef = useRef(false);
  const manageDragSelectValueRef = useRef(true);
  const manageDragTouchedRef = useRef<Set<string>>(new Set());
  const [newQuestion, setNewQuestion] = useState({
    grade: 'Year 12',
    year: new Date().getFullYear().toString(),
    subject: 'Mathematics Advanced',
    topic: 'Complex Numbers',
    marks: 4,
    questionType: 'written',
    questionNumber: '',
    questionText: '',
    markingCriteria: '',
    sampleAnswer: '',
    sampleAnswerImage: '',
    sampleAnswerImageSize: 'medium' as 'small' | 'medium' | 'large',
    mcqOptionA: '',
    mcqOptionB: '',
    mcqOptionC: '',
    mcqOptionD: '',
    mcqOptionAImage: '',
    mcqOptionBImage: '',
    mcqOptionCImage: '',
    mcqOptionDImage: '',
    mcqCorrectAnswer: 'A',
    mcqExplanation: '',
    graphImageData: '',
    graphImageSize: 'medium',
  });
  const [editQuestion, setEditQuestion] = useState({
    grade: 'Year 12',
    year: new Date().getFullYear().toString(),
    subject: 'Mathematics Advanced',
    topic: 'Complex Numbers',
    marks: 4,
    questionType: 'written',
    questionNumber: '',
    questionText: '',
    markingCriteria: '',
    sampleAnswer: '',
    sampleAnswerImage: '',
    mcqOptionA: '',
    mcqOptionB: '',
    mcqOptionC: '',
    mcqOptionD: '',
    mcqOptionAImage: '',
    mcqOptionBImage: '',
    mcqOptionCImage: '',
    mcqOptionDImage: '',
    mcqCorrectAnswer: 'A',
    mcqExplanation: '',
    graphImageData: '',
    graphImageSize: 'medium',
  });
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);

  // Filter state
  const [filterGrade, setFilterGrade] = useState<string>(yearLevel);
  const [filterYear, setFilterYear] = useState<string>('');
  const [filterSubject, setFilterSubject] = useState<string>('');
  const [filterTopic, setFilterTopic] = useState<string>('');

  // Available filter options
  const YEARS = Array.from(
    { length: CURRENT_EXAM_YEAR - MIN_EXAM_YEAR + 1 },
    (_, i) => String(CURRENT_EXAM_YEAR - i)
  );

  const ALL_TOPICS = useMemo(() => {
    const set = new Set<string>();
    (Object.keys(TOPICS_BY_YEAR_SUBJECT) as Array<keyof typeof TOPICS_BY_YEAR_SUBJECT>).forEach((grade) => {
      const subjectMap = TOPICS_BY_YEAR_SUBJECT[grade];
      Object.keys(subjectMap || {}).forEach((subject) => {
        (subjectMap![subject] || []).forEach((t) => set.add(t));
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, []);

  const parseQuestionNumberForSort = (value: string | null | undefined) => {
    const raw = String(value || '').toLowerCase().trim();
    if (!raw) {
      return { number: Number.POSITIVE_INFINITY, part: '', subpart: 0, raw };
    }
    const match = raw.match(/(\d+)\s*(?:\(?([a-z])\)?)?\s*(?:\(?((?:ix|iv|v?i{0,3}|x))\)?)?/i);
    const number = match?.[1] ? parseInt(match[1], 10) : Number.POSITIVE_INFINITY;
    const part = match?.[2] ? match[2].toLowerCase() : '';
    const roman = match?.[3] ? match[3].toLowerCase() : '';
    const romanMap: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };
    const subpart = roman ? (romanMap[roman] || 0) : 0;
    return { number, part, subpart, raw };
  };

  const customExamGroupByQuestionId = useMemo(() => {
    const grouped: Record<string, string> = {};
    allQuestions.forEach((question) => {
      const questionId = String(question?.id || '').trim();
      const groupId = String(question?.group_id || '').trim();
      if (questionId && groupId) {
        grouped[questionId] = groupId;
      }
    });
    return grouped;
  }, [allQuestions]);

  const buildGroupingPaperKey = (paper: {
    year: string;
    grade: string;
    subject: string;
    school: string;
    paperNumber: number | null;
  }) => {
    return `${paper.year}__${paper.grade}__${paper.subject}__${paper.school}__${paper.paperNumber ?? 'none'}`;
  };

  const isGroupingEligibleSubject = (subjectValue: string | null | undefined) => {
    const normalized = String(subjectValue || '').trim().toLowerCase();
    return normalized === 'mathematics' || normalized === 'mathematics advanced';
  };

  const applyQuestionGroupUpdates = (updatedQuestions: Array<{ id: string; group_id?: string | null }>) => {
    const updatedById = new Map(
      updatedQuestions
        .map((question) => [String(question?.id || '').trim(), question?.group_id ?? null] as const)
        .filter(([id]) => Boolean(id))
    );

    if (!updatedById.size) return;

    const applyToRows = <T extends { id: string; group_id?: string | null }>(rows: T[]) => {
      return rows.map((row) => {
        if (!updatedById.has(row.id)) return row;
        return {
          ...row,
          group_id: updatedById.get(row.id) ?? null,
        };
      });
    };

    setAllQuestions((prev) => applyToRows(prev));
    setBrowseQuestions((prev) => applyToRows(prev));
    setPaperQuestions((prev) => {
      const next = applyToRows(prev);
      if (isPaperMode && next.length > 0) {
        const safeIndex = Math.min(paperIndex, next.length - 1);
        const { group } = getDisplayGroupAt(next, safeIndex);
        if (group.length > 0) {
          setQuestion(mergeGroupForDisplay(group));
        }
      }
      return next;
    });

    setManageQuestionDraft((prev: any) => {
      if (!prev?.id || !updatedById.has(prev.id)) return prev;
      return {
        ...prev,
        group_id: updatedById.get(prev.id) ?? null,
      };
    });

    setInlineEditDraft((prev: any) => {
      if (!prev?.id || !updatedById.has(prev.id)) return prev;
      return {
        ...prev,
        group_id: updatedById.get(prev.id) ?? null,
      };
    });
  };

  const getSelectedQuestionsForGrouping = () => {
    const selectedSet = new Set(selectedManageQuestionIds);
    return allQuestions.filter((question) => selectedSet.has(question.id)) as Question[];
  };

  const validateSelectedQuestionsForGrouping = (questions: Question[]) => {
    if (questions.length < 2) {
      return { ok: false, message: 'Select at least two related subparts to create a group.' };
    }

    const first = questions[0];
    const firstParsed = parseQuestionNumberForSort(first.question_number);
    if (!Number.isFinite(firstParsed.number) || !firstParsed.part) {
      return { ok: false, message: 'Only lettered subparts such as 11(a), 11(b), or 11(a)(i) can be grouped.' };
    }

    const firstSignature = [
      String(first.grade || ''),
      String(first.subject || ''),
      String(first.year || ''),
      String(first.school_name || 'HSC'),
      String(first.paper_number ?? ''),
      String(firstParsed.number),
    ].join('|');

    for (const question of questions) {
      const parsed = parseQuestionNumberForSort(question.question_number);
      const signature = [
        String(question.grade || ''),
        String(question.subject || ''),
        String(question.year || ''),
        String(question.school_name || 'HSC'),
        String(question.paper_number ?? ''),
        String(parsed.number),
      ].join('|');

      if (!Number.isFinite(parsed.number) || !parsed.part) {
        return { ok: false, message: 'Grouping only applies to lettered subparts and their nested roman numeral parts.' };
      }

      if (signature !== firstSignature) {
        return { ok: false, message: 'Grouped questions must come from the same paper and the same main question number.' };
      }
    }

    return { ok: true, message: '' };
  };

  const getGroupBadgeLabel = (groupId: string | null | undefined) => {
    const normalized = String(groupId || '').trim();
    if (!normalized) return '';

    const paperQuestionMatch = normalized.match(/::q(\d+)$/i);
    if (paperQuestionMatch?.[1]) {
      return `Grouped Q${paperQuestionMatch[1]}`;
    }

    if (normalized.startsWith('manual-group::')) {
      return 'Manual Group';
    }

    return 'Grouped';
  };

  const expandManualGroupedSelection = (
    selected: Question[],
    sourcePool: Question[],
    groupByQuestionId: Record<string, string>
  ) => {
    const normalizeGroup = (value: string | undefined) => String(value || '').trim().toLowerCase();
    const groups = new Map<string, Question[]>();

    sourcePool.forEach((question) => {
      const rawLabel = groupByQuestionId[question.id];
      const label = normalizeGroup(rawLabel);
      if (!label) return;
      const existing = groups.get(label) || [];
      existing.push(question);
      groups.set(label, existing);
    });

    groups.forEach((items, label) => {
      const sortedItems = [...items].sort((a, b) => {
        const left = parseQuestionNumberForSort(a.question_number);
        const right = parseQuestionNumberForSort(b.question_number);
        return left.number - right.number || left.part.localeCompare(right.part) || left.subpart - right.subpart || left.raw.localeCompare(right.raw);
      });
      groups.set(label, sortedItems);
    });

    const seenIds = new Set<string>();
    const seenGroupLabels = new Set<string>();
    const expanded: Question[] = [];

    selected.forEach((question) => {
      const groupLabel = normalizeGroup(groupByQuestionId[question.id]);
      if (groupLabel) {
        if (seenGroupLabels.has(groupLabel)) return;
        seenGroupLabels.add(groupLabel);
        const manualGroupKey = `manual:${groupLabel}`;
        const groupedQuestions = groups.get(groupLabel) || [question];
        groupedQuestions.forEach((groupedQuestion) => {
          if (seenIds.has(groupedQuestion.id)) return;
          seenIds.add(groupedQuestion.id);
          expanded.push({
            ...groupedQuestion,
            _display_group_key: manualGroupKey,
          });
        });
        return;
      }

      if (seenIds.has(question.id)) return;
      seenIds.add(question.id);
      expanded.push(question);
    });

    return expanded;
  };

  const expandRomanSubpartSelection = (selected: Question[], sourcePool: Question[]) => {
    const getRomanGroupKey = (question: Question) => {
      const parsed = parseQuestionNumberForSort(question.question_number);
      if (!parsed.part || !parsed.subpart) return null;
      const base = getQuestionDisplayBase(question.question_number);
      const paperNumber = String((question as any).paper_number ?? '');
      return [
        String(question.grade || ''),
        String(question.subject || ''),
        String(question.year || ''),
        String(question.school_name || ''),
        paperNumber,
        base,
      ].join('|');
    };

    const romanGroups = new Map<string, Question[]>();
    sourcePool.forEach((question) => {
      const groupKey = getRomanGroupKey(question);
      if (!groupKey) return;
      const existing = romanGroups.get(groupKey) || [];
      existing.push(question);
      romanGroups.set(groupKey, existing);
    });

    romanGroups.forEach((group, groupKey) => {
      const sortedGroup = [...group].sort((a, b) => {
        const left = parseQuestionNumberForSort(a.question_number);
        const right = parseQuestionNumberForSort(b.question_number);
        return left.number - right.number || left.part.localeCompare(right.part) || left.subpart - right.subpart || left.raw.localeCompare(right.raw);
      });
      romanGroups.set(groupKey, sortedGroup);
    });

    const seenIds = new Set<string>();
    const seenGroupKeys = new Set<string>();
    const expanded: Question[] = [];

    selected.forEach((question) => {
      const groupKey = getRomanGroupKey(question);
      if (groupKey) {
        if (!seenGroupKeys.has(groupKey)) {
          seenGroupKeys.add(groupKey);
          const romanGroupKey = `roman:${groupKey}`;
          const siblings = romanGroups.get(groupKey) || [question];
          siblings.forEach((sibling) => {
            if (seenIds.has(sibling.id)) return;
            seenIds.add(sibling.id);
            expanded.push({
              ...sibling,
              _display_group_key: sibling._display_group_key || romanGroupKey,
            });
          });
        }
        return;
      }

      if (seenIds.has(question.id)) return;
      seenIds.add(question.id);
      expanded.push(question);
    });

    return expanded;
  };

  const applySiblingGraphImages = (questions: Question[]) => {
    const grouped = new Map<string, Question[]>();

    questions.forEach((question) => {
      const base = getQuestionDisplayBase(question.question_number);
      const key = [
        String(question.grade || ''),
        String(question.subject || ''),
        String(question.year || ''),
        String(question.school_name || ''),
        base,
      ].join('|');
      const existing = grouped.get(key) || [];
      existing.push(question);
      grouped.set(key, existing);
    });

    const imageByQuestionId = new Map<string, { data: string; size: 'small' | 'medium' | 'large' }>();

    grouped.forEach((group) => {
      const sourceWithImage = group.find((question) => String(question.graph_image_data || '').trim());
      if (!sourceWithImage || !sourceWithImage.graph_image_data) return;
      const sharedData = String(sourceWithImage.graph_image_data);
      const sharedSize = (sourceWithImage.graph_image_size || 'medium') as 'small' | 'medium' | 'large';
      group.forEach((question) => {
        imageByQuestionId.set(question.id, { data: sharedData, size: sharedSize });
      });
    });

    return questions.map((question) => {
      const shared = imageByQuestionId.get(question.id);
      if (!shared) return question;
      return {
        ...question,
        graph_image_data: shared.data,
        graph_image_size: shared.size,
      };
    });
  };

  /** Display base for grouping: e.g. "11 (a)(i)" and "11 (a)(ii)" both yield "11 (a)". */
  const getQuestionDisplayBase = (qNumber: string | null | undefined): string => {
    const raw = String(qNumber ?? '').trim();
    const withRoman = raw.match(/^(\d+)\s*\(?([a-z])\)?(?:\s*\(?(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)\)?)?$/i);
    if (withRoman) return `${withRoman[1]} (${withRoman[2]})`;
    const letterOnly = raw.match(/^(\d+)\s*\(?([a-z])\)?/i);
    if (letterOnly) return `${letterOnly[1]} (${letterOnly[2]})`;
    const numOnly = raw.match(/^(\d+)/);
    if (numOnly) return numOnly[1];
    return raw;
  };

  /** Display group key used for merging contiguous display questions. */
  const getQuestionParentDisplayBase = (qNumber: string | null | undefined): string => {
    return getQuestionDisplayBase(qNumber);
  };

  const getQuestionDisplayGroupKey = (question: Question): string => {
    const explicitGroupKey = String(question._display_group_key || '').trim();
    if (explicitGroupKey) return explicitGroupKey;
    const persistedGroupKey = String(question.group_id || '').trim();
    if (persistedGroupKey) return `persisted:${persistedGroupKey}`;
    return getQuestionParentDisplayBase(question.question_number);
  };

  const parseQuestionNumberParts = (qNumber: string | null | undefined) => {
    const raw = String(qNumber ?? '').trim();
    const match = raw.match(/^(\d+)\s*\(?([a-z])\)?(?:\s*\(?((?:ix|iv|v?i{0,3}|x))\)?)?$/i);
    return {
      raw,
      number: match?.[1] ? Number.parseInt(match[1], 10) : null,
      letter: match?.[2] ? match[2].toLowerCase() : '',
      roman: match?.[3] ? match[3].toLowerCase() : '',
    };
  };

  /** Contiguous group of questions sharing the same display base that contains the given index. */
  const getDisplayGroupAt = (questions: Question[], index: number): { group: Question[]; startIndex: number; endIndex: number } => {
    if (index < 0 || index >= questions.length) {
      return { group: [], startIndex: index, endIndex: index };
    }
    const base = getQuestionDisplayGroupKey(questions[index]);
    let startIndex = index;
    while (startIndex > 0 && getQuestionDisplayGroupKey(questions[startIndex - 1]) === base) {
      startIndex--;
    }
    let endIndex = index + 1;
    while (endIndex < questions.length && getQuestionDisplayGroupKey(questions[endIndex]) === base) {
      endIndex++;
    }
    return {
      group: questions.slice(startIndex, endIndex),
      startIndex,
      endIndex,
    };
  };

  /** Merge a group of questions (e.g. 11(a)(i), 11(a)(ii)) into one display question with dividers. */
  const mergeGroupForDisplay = (group: Question[]): Question => {
    if (group.length === 0) {
      return null as unknown as Question;
    }
    if (group.length === 1) {
      return group[0];
    }
    const first = group[0];
    const parsedEntries = group.map((q) => ({ q, parts: parseQuestionNumberParts(q.question_number) }));
    const numericParts = parsedEntries
      .map((entry) => entry.parts.number)
      .filter((value): value is number => Number.isFinite(value as number));
    const allSameNumber = numericParts.length === parsedEntries.length && new Set(numericParts).size === 1;
    const allHaveLetter = parsedEntries.every((entry) => Boolean(entry.parts.letter));
    const allHaveRoman = parsedEntries.every((entry) => Boolean(entry.parts.roman));
    const letterSetSize = new Set(parsedEntries.map((entry) => entry.parts.letter || '__')).size;
    const sameLetter = letterSetSize === 1 && allHaveLetter;

    const useRomanOnlyLabels = allSameNumber && sameLetter && allHaveRoman;
    const useLetterOnlyLabels = allSameNumber && allHaveLetter && !useRomanOnlyLabels;

    const displayBase = useLetterOnlyLabels
      ? String(parsedEntries[0]?.parts.number ?? getQuestionParentDisplayBase(first.question_number))
      : getQuestionParentDisplayBase(first.question_number);
    // If any record in the DB already contains our PART_DIVIDER placeholders, it means someone
    // accidentally saved a merged display question back into the underlying sub-question.
    // In that case, re-merging would duplicate content/criteria/marks. Prefer the already-merged
    // text as the canonical display payload.
    const mergedCarrier = group.find((q) => String(q.question_text || '').includes('[[PART_DIVIDER:'));

    const questionText = mergedCarrier
      ? String(mergedCarrier.question_text || '')
      : group
        .map((q) => {
          const parts = parseQuestionNumberParts(q.question_number);
          const label = useRomanOnlyLabels && parts.roman
            ? `(${parts.roman})`
            : useLetterOnlyLabels && parts.letter
              ? `(${parts.letter})${parts.roman ? `(${parts.roman})` : ''}`
              : q.question_number ?? 'Part';
          return `${formatPartDividerPlaceholder(label)}\n\n${q.question_text}`;
        })
        .join('');
    // Marking criteria often already includes all subparts; concatenating per-part causes duplication.
    // For multi-part display groups, dedupe criteria blocks and do NOT add dividers.
    // If a mergedCarrier exists (corrupted-save case), prefer its criteria directly.
    const markingCriteria = mergedCarrier?.marking_criteria
      ? String(mergedCarrier.marking_criteria)
      : Array.from(
        new Set(
          group
            .map((q) => (q.marking_criteria ?? '').trim())
            .filter(Boolean)
        )
      ).join('\n\n');
    const sampleAnswer = group
      .map((q, i) => (i === 0 ? (q.sample_answer ?? '') : `\n\n--- ${q.question_number ?? 'Part'} ---\n\n${q.sample_answer ?? ''}`))
      .join('');
    const totalMarks = mergedCarrier?.marks != null
      ? mergedCarrier.marks
      : group.reduce((sum, q) => sum + (q.marks ?? 0), 0);
    const graphSource = group.find((q) => String(q.graph_image_data || '').trim());
    return {
      ...first,
      id: first.id,
      question_number: displayBase,
      question_text: questionText,
      marking_criteria: markingCriteria || first.marking_criteria,
      sample_answer: sampleAnswer || first.sample_answer,
      marks: totalMarks,
      graph_image_data: graphSource?.graph_image_data || first.graph_image_data,
      graph_image_size: (graphSource?.graph_image_size || first.graph_image_size || 'medium') as 'small' | 'medium' | 'large',
    };
  };

  const manageFilterOptions = useMemo(() => {
    const grades = new Set<string>();
    const years = new Set<string>();
    const subjects = new Set<string>();
    const topics = new Set<string>();
    const schools = new Set<string>();

    Object.keys(SUBJECTS_BY_YEAR).forEach((grade) => grades.add(grade));
    YEARS.forEach((year) => years.add(year));
    Object.values(SUBJECTS_BY_YEAR).forEach((values) => values.forEach((subject) => subjects.add(subject)));
    ALL_TOPICS.forEach((topic) => topics.add(topic));

    allQuestions.forEach((q) => {
      if (q?.grade) grades.add(String(q.grade));
      if (q?.year) years.add(String(q.year));
      if (q?.subject) subjects.add(String(q.subject));
      if (q?.topic) topics.add(String(q.topic));
      if (q?.school_name) schools.add(String(q.school_name));
    });

    const sortAlpha = (values: Set<string>) => Array.from(values).sort((a, b) => a.localeCompare(b));
    const sortNumeric = (values: Set<string>) => Array.from(values).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

    return {
      grades: sortAlpha(grades),
      years: sortNumeric(years),
      subjects: sortAlpha(subjects),
      topics: sortAlpha(topics),
      schools: sortAlpha(schools),
    };
  }, [allQuestions]);

  const manageFilterValues = useMemo(() => {
    const byType = new Map(manageFilters.map((filter) => [filter.type, filter.value]));

    return {
      grades: byType.get(ManageQuestionFilterType.GRADE) ?? [],
      years: byType.get(ManageQuestionFilterType.YEAR) ?? [],
      subjects: byType.get(ManageQuestionFilterType.SUBJECT) ?? [],
      topics: byType.get(ManageQuestionFilterType.TOPIC) ?? [],
      schools: byType.get(ManageQuestionFilterType.SCHOOL) ?? [],
      questionTypes: byType.get(ManageQuestionFilterType.QUESTION_TYPE) ?? [],
      imageStatus: byType.get(ManageQuestionFilterType.IMAGE_STATUS) ?? [],
    };
  }, [manageFilters]);

  const manageMissingImagesOnly = manageFilterValues.imageStatus.includes('missing');

  const manageQuestionFilterConfig = useMemo<ManageQuestionFilterConfig>(() => {
    const gradeIcon = <GraduationCap className='size-3.5' />;
    const yearIcon = <History className='size-3.5' />;
    const subjectIcon = <BookOpen className='size-3.5' />;
    const topicIcon = <Layers className='size-3.5' />;
    const schoolIcon = <LayoutDashboard className='size-3.5' />;
    const typeIcon = <FileText className='size-3.5' />;
    const imageIcon = <AlertTriangle className='size-3.5' />;

    return {
      [ManageQuestionFilterType.GRADE]: {
        icon: gradeIcon,
        allowMultiple: true,
        options: manageFilterOptions.grades.map((grade) => ({
          name: grade,
          label: grade,
          icon: gradeIcon,
        })),
      },
      [ManageQuestionFilterType.YEAR]: {
        icon: yearIcon,
        allowMultiple: true,
        options: manageFilterOptions.years.map((year) => ({
          name: year,
          label: year,
          icon: yearIcon,
        })),
      },
      [ManageQuestionFilterType.SUBJECT]: {
        icon: subjectIcon,
        allowMultiple: true,
        options: manageFilterOptions.subjects.map((subject) => ({
          name: subject,
          label: subject,
          icon: subjectIcon,
        })),
      },
      [ManageQuestionFilterType.TOPIC]: {
        icon: topicIcon,
        allowMultiple: true,
        options: manageFilterOptions.topics.map((topic) => ({
          name: topic,
          label: topic,
          icon: topicIcon,
        })),
      },
      [ManageQuestionFilterType.SCHOOL]: {
        icon: schoolIcon,
        allowMultiple: true,
        options: manageFilterOptions.schools.map((school) => ({
          name: school,
          label: school,
          icon: schoolIcon,
        })),
      },
      [ManageQuestionFilterType.QUESTION_TYPE]: {
        icon: typeIcon,
        allowMultiple: true,
        options: [
          {
            name: 'written',
            label: 'Written Response',
            icon: typeIcon,
          },
          {
            name: 'multiple_choice',
            label: 'Multiple Choice',
            icon: CheckCircle2 ? <CheckCircle2 className='size-3.5' /> : typeIcon,
          },
        ],
      },
      [ManageQuestionFilterType.IMAGE_STATUS]: {
        icon: imageIcon,
        options: [
          {
            name: 'missing',
            label: 'Missing graph images',
            icon: imageIcon,
          },
        ],
      },
    };
  }, [manageFilterOptions]);

  const manageQuestionFilterGroups = useMemo<ManageQuestionFilterOption[][]>(
    () => [
      [
        { name: ManageQuestionFilterType.GRADE, icon: manageQuestionFilterConfig[ManageQuestionFilterType.GRADE].icon },
        { name: ManageQuestionFilterType.YEAR, icon: manageQuestionFilterConfig[ManageQuestionFilterType.YEAR].icon },
        { name: ManageQuestionFilterType.SUBJECT, icon: manageQuestionFilterConfig[ManageQuestionFilterType.SUBJECT].icon },
        { name: ManageQuestionFilterType.TOPIC, icon: manageQuestionFilterConfig[ManageQuestionFilterType.TOPIC].icon },
      ],
      [
        { name: ManageQuestionFilterType.SCHOOL, icon: manageQuestionFilterConfig[ManageQuestionFilterType.SCHOOL].icon },
        { name: ManageQuestionFilterType.QUESTION_TYPE, icon: manageQuestionFilterConfig[ManageQuestionFilterType.QUESTION_TYPE].icon },
        { name: ManageQuestionFilterType.IMAGE_STATUS, icon: manageQuestionFilterConfig[ManageQuestionFilterType.IMAGE_STATUS].icon },
      ],
    ],
    [manageQuestionFilterConfig]
  );

  const visibleAllQuestions = useMemo(
    () => allQuestions.filter((q) => !isExamIncomplete(q?.exam_incomplete)),
    [allQuestions]
  );

  const manageExamBuckets = useMemo(() => {
    const map = new Map<
      string,
      {
        year: string;
        subject: string;
        grade: string;
        school: string;
        count: number;
        incompleteCount: number;
      }
    >();

    allQuestions.forEach((q) => {
      if (!q?.year || !q?.subject || !q?.grade) return;
      const year = String(q.year);
      const subject = String(q.subject);
      const grade = String(q.grade);
      const school = String(q.school_name || 'HSC');
      const key = `${year}__${grade}__${subject}__${school}`;
      const existing = map.get(key);
      const incrementIncomplete = isExamIncomplete(q?.exam_incomplete) ? 1 : 0;
      if (existing) {
        existing.count += 1;
        existing.incompleteCount += incrementIncomplete;
      } else {
        map.set(key, {
          year,
          subject,
          grade,
          school,
          count: 1,
          incompleteCount: incrementIncomplete,
        });
      }
    });

    return Array.from(map.values())
      .map((exam) => ({
        ...exam,
        key: getPaperKey(exam),
        status:
          exam.incompleteCount === 0
            ? 'complete'
            : exam.incompleteCount === exam.count
              ? 'incomplete'
              : 'mixed',
      }))
      .sort((a, b) => {
        const yearCompare = Number(b.year) - Number(a.year);
        if (yearCompare !== 0) return yearCompare;
        const gradeCompare = a.grade.localeCompare(b.grade);
        if (gradeCompare !== 0) return gradeCompare;
        const subjectCompare = a.subject.localeCompare(b.subject);
        if (subjectCompare !== 0) return subjectCompare;
        return a.school.localeCompare(b.school);
      });
  }, [allQuestions]);

  const groupingPaperBuckets = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        year: string;
        subject: string;
        grade: string;
        school: string;
        paperNumber: number | null;
        count: number;
      }
    >();

    allQuestions.forEach((q) => {
      if (!q?.year || !q?.subject || !q?.grade || !isGroupingEligibleSubject(String(q.subject))) return;
      const year = String(q.year);
      const subject = String(q.subject);
      const grade = String(q.grade);
      const school = String(q.school_name || 'HSC');
      const parsedPaperNumber = Number.parseInt(String(q.paper_number ?? ''), 10);
      const paperNumber = Number.isInteger(parsedPaperNumber) ? parsedPaperNumber : null;
      const paper = { year, subject, grade, school, paperNumber };
      const key = buildGroupingPaperKey(paper);
      const existing = map.get(key);

      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, {
          key,
          ...paper,
          count: 1,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const yearCompare = Number(b.year) - Number(a.year);
      if (yearCompare !== 0) return yearCompare;
      const subjectCompare = a.subject.localeCompare(b.subject);
      if (subjectCompare !== 0) return subjectCompare;
      const schoolCompare = a.school.localeCompare(b.school);
      if (schoolCompare !== 0) return schoolCompare;
      return (a.paperNumber ?? Number.POSITIVE_INFINITY) - (b.paperNumber ?? Number.POSITIVE_INFINITY);
    });
  }, [allQuestions]);

  const availablePapers = useMemo(() => {
    const map = new Map<string, { year: string; subject: string; grade: string; school: string; count: number }>();
    visibleAllQuestions.forEach((q) => {
      if (!q?.year || !q?.subject || !q?.grade) return;
      const year = String(q.year);
      const subject = String(q.subject);
      const grade = String(q.grade);
      const school = String(q.school_name || 'HSC');
      const key = `${year}__${grade}__${subject}__${school}`;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, { year, subject, grade, school, count: 1 });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const yearCompare = Number(b.year) - Number(a.year);
      if (yearCompare !== 0) return yearCompare;
      const gradeCompare = a.grade.localeCompare(b.grade);
      if (gradeCompare !== 0) return gradeCompare;
      const subjectCompare = a.subject.localeCompare(b.subject);
      if (subjectCompare !== 0) return subjectCompare;
      return a.school.localeCompare(b.school);
    });
  }, [visibleAllQuestions]);

  const browseAvailablePapers = useMemo(() => {
    const map = new Map<string, { year: string; subject: string; grade: string; school: string; count: number }>();
    browseQuestions.forEach((q) => {
      if (!q?.year || !q?.subject || !q?.grade) return;
      const year = String(q.year);
      const subject = String(q.subject);
      const grade = String(q.grade);
      const school = String(q.school_name || 'HSC');
      const key = `${year}__${grade}__${subject}__${school}`;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, { year, subject, grade, school, count: 1 });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const yearCompare = Number(b.year) - Number(a.year);
      if (yearCompare !== 0) return yearCompare;
      const gradeCompare = a.grade.localeCompare(b.grade);
      if (gradeCompare !== 0) return gradeCompare;
      const subjectCompare = a.subject.localeCompare(b.subject);
      if (subjectCompare !== 0) return subjectCompare;
      return a.school.localeCompare(b.school);
    });
  }, [browseQuestions]);

  useEffect(() => {
    if (!availablePapers.length) {
      setSelectedSyllabusMappingPaper('');
      return;
    }

    setSelectedSyllabusMappingPaper((prev) => {
      if (prev && availablePapers.some((paper) => getPaperKey(paper) === prev)) {
        return prev;
      }
      return getPaperKey(availablePapers[0]);
    });
  }, [availablePapers]);

  const topicStats = useMemo<TopicStat[]>(() => {
    const map = new Map<string, { attempts: number; scoredAttempts: number; earnedMarks: number; totalMarks: number }>();

    const record = (topicValue: string | null | undefined, marksValue: unknown, scoreValue: unknown) => {
      const topic = String(topicValue || 'Unspecified');
      const marks = typeof marksValue === 'number' ? marksValue : Number(marksValue || 0);
      const score = typeof scoreValue === 'number' ? scoreValue : Number.NaN;

      if (!map.has(topic)) {
        map.set(topic, { attempts: 0, scoredAttempts: 0, earnedMarks: 0, totalMarks: 0 });
      }
      const entry = map.get(topic)!;
      entry.attempts += 1;
      if (Number.isFinite(marks) && marks > 0 && Number.isFinite(score)) {
        entry.scoredAttempts += 1;
        entry.totalMarks += marks;
        entry.earnedMarks += Math.max(0, score);
      }
    };

    savedAttempts.forEach((attempt) => {
      if (!attempt) return;
      if (attempt.type === 'exam' && Array.isArray(attempt.examAttempts)) {
        attempt.examAttempts.forEach((examAttempt: any) => {
          record(examAttempt?.question?.topic, examAttempt?.question?.marks, examAttempt?.feedback?.score);
        });
        return;
      }
      record(attempt.topic ?? attempt?.question?.topic, attempt.marks ?? attempt?.question?.marks, attempt.feedback?.score);
    });

    return Array.from(map.entries())
      .map(([topic, entry]) => {
        const accuracy = entry.totalMarks > 0 ? Math.round((entry.earnedMarks / entry.totalMarks) * 100) : null;
        return { topic, ...entry, accuracy };
      })
      .sort((a, b) => a.topic.localeCompare(b.topic));
  }, [savedAttempts]);

  const activityMap = useMemo(() => {
    const map = new Map<string, { count: number; date: Date }>();

    const record = (date: Date, count: number) => {
      const dayKey = toLocalDateKey(date);
      const dayDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const existing = map.get(dayKey);
      map.set(dayKey, {
        count: (existing?.count ?? 0) + count,
        date: dayDate,
      });
    };

    savedAttempts.forEach((attempt) => {
      const savedAt = attempt?.savedAt;
      if (!savedAt) return;
      const date = new Date(savedAt);
      if (Number.isNaN(date.getTime())) return;
      let increment = 1;
      if (attempt?.type === 'exam' && Array.isArray(attempt.examAttempts)) {
        increment = Math.max(1, attempt.examAttempts.length);
      }
      record(date, increment);
    });

    return map;
  }, [savedAttempts]);

  const heatmapCells = useMemo<HeatmapCell[]>(() => {
    const firstDay = new Date(heatmapYear, heatmapMonth, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(heatmapYear, heatmapMonth + 1, 0).getDate();
    const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
    const cells: HeatmapCell[] = [];

    for (let i = 0; i < totalCells; i += 1) {
      const dayNumber = i - startWeekday + 1;
      const inMonth = dayNumber >= 1 && dayNumber <= daysInMonth;
      if (!inMonth) {
        cells.push({
          dateKey: `empty-${heatmapYear}-${heatmapMonth}-${i}`,
          label: '',
          count: 0,
          inMonth: false,
        });
        continue;
      }
      const date = new Date(heatmapYear, heatmapMonth, dayNumber);
      const key = toLocalDateKey(date);
      const count = activityMap.get(key)?.count ?? 0;
      cells.push({
        dateKey: key,
        label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
        count,
        inMonth: true,
      });
    }

    return cells;
  }, [activityMap, heatmapMonth, heatmapYear]);

  const studyStreak = useMemo(() => {
    if (activityMap.size === 0) return 0;
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let latest: Date | null = null;

    activityMap.forEach((value) => {
      if (value.date > todayStart) return;
      if (!latest || value.date > latest) {
        latest = value.date;
      }
    });

    if (!latest) return 0;
    let streak = 0;
    let cursor = new Date(latest);
    while (true) {
      const key = toLocalDateKey(cursor);
      const count = activityMap.get(key)?.count ?? 0;
      if (count <= 0) break;
      streak += 1;
      cursor = addDays(cursor, -1);
    }
    return streak;
  }, [activityMap]);

  const hasManageFilters = useMemo(() => {
    return (
      manageMissingImagesOnly ||
      manageFilterValues.grades.length > 0 ||
      manageFilterValues.years.length > 0 ||
      manageFilterValues.subjects.length > 0 ||
      manageFilterValues.topics.length > 0 ||
      manageFilterValues.schools.length > 0 ||
      manageFilterValues.questionTypes.length > 0 ||
      Boolean(manageSearchQuery.trim())
    );
  }, [
    manageMissingImagesOnly,
    manageFilterValues,
    manageSearchQuery,
  ]);

  const filteredManageQuestions = useMemo(() => {
    const shouldGateManageResults = viewMode === 'dev-questions' && devTab === 'manage' && !manageFiltersApplied;
    if (shouldGateManageResults) return [];
    const search = manageSearchQuery.trim().toLowerCase();
    const filtered = allQuestions.filter((q) => {
      if (manageMissingImagesOnly && (q.graph_image_data || q.graph_image_size !== 'missing')) return false;
      if (manageFilterValues.grades.length > 0 && !manageFilterValues.grades.includes(String(q.grade))) return false;
      if (manageFilterValues.years.length > 0 && !manageFilterValues.years.includes(String(q.year))) return false;
      if (manageFilterValues.subjects.length > 0 && !manageFilterValues.subjects.includes(String(q.subject))) return false;
      if (manageFilterValues.topics.length > 0 && !manageFilterValues.topics.includes(String(q.topic))) return false;
      if (manageFilterValues.schools.length > 0 && !manageFilterValues.schools.includes(String(q.school_name || ''))) return false;
      if (manageFilterValues.questionTypes.length > 0 && !manageFilterValues.questionTypes.includes(String(q.question_type))) return false;
      if (search) {
        const haystack = [q.question_number, q.subject, q.topic, q.question_text, q.grade, q.year, q.school_name]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      if (manageSortKey === 'question_number') {
        const left = parseQuestionNumberForSort(a.question_number);
        const right = parseQuestionNumberForSort(b.question_number);
        comparison = left.number - right.number || left.part.localeCompare(right.part) || left.subpart - right.subpart || left.raw.localeCompare(right.raw);
      } else if (manageSortKey === 'year') {
        comparison = Number(a.year || 0) - Number(b.year || 0);
      } else if (manageSortKey === 'marks') {
        comparison = Number(a.marks || 0) - Number(b.marks || 0);
      } else if (manageSortKey === 'grade') {
        const left = String(a.grade || '').match(/\d+/)?.[0] || '';
        const right = String(b.grade || '').match(/\d+/)?.[0] || '';
        comparison = Number(left || 0) - Number(right || 0);
      } else if (manageSortKey === 'subject') {
        comparison = String(a.subject || '').localeCompare(String(b.subject || ''));
      } else if (manageSortKey === 'topic') {
        comparison = String(a.topic || '').localeCompare(String(b.topic || ''));
      } else if (manageSortKey === 'school') {
        comparison = String(a.school_name || '').localeCompare(String(b.school_name || ''));
      }

      return manageSortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [
    viewMode,
    devTab,
    manageFiltersApplied,
    allQuestions,
    manageSearchQuery,
    manageFilterValues,
    manageMissingImagesOnly,
    manageSortKey,
    manageSortDirection,
  ]);

  const filteredManageQuestionIds = useMemo(
    () => filteredManageQuestions.map((q) => q.id),
    [filteredManageQuestions]
  );

  const reviewVerifyExamOptions = useMemo<ReviewVerifyExamOption[]>(() => {
    const grouped = new Map<string, ReviewVerifyExamOption>();

    filteredManageQuestions.forEach((rawQuestion) => {
      const schoolName = String(rawQuestion?.school_name || 'HSC').trim() || 'HSC';
      const year = Number.parseInt(String(rawQuestion?.year ?? ''), 10);
      const paperNumber = Number.parseInt(String(rawQuestion?.paper_number ?? ''), 10);
      const grade = String(rawQuestion?.grade || '').trim();
      const subject = String(rawQuestion?.subject || '').trim();

      if (!Number.isInteger(year) || !Number.isInteger(paperNumber) || !grade || !subject) {
        return;
      }

      const key = [schoolName, year, paperNumber, grade, subject].join('|');
      const existing = grouped.get(key);
      if (existing) {
        existing.count += 1;
        return;
      }

      grouped.set(key, {
        key,
        schoolName,
        year,
        paperNumber,
        grade,
        subject,
        count: 1,
      });
    });

    return Array.from(grouped.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      if (a.schoolName !== b.schoolName) return a.schoolName.localeCompare(b.schoolName);
      if (a.paperNumber !== b.paperNumber) return a.paperNumber - b.paperNumber;
      if (a.grade !== b.grade) return a.grade.localeCompare(b.grade);
      return a.subject.localeCompare(b.subject);
    });
  }, [filteredManageQuestions]);

  useEffect(() => {
    if (!reviewVerifyExamOptions.length) {
      setSelectedVerifySolutionsExamKey('');
      return;
    }

    setSelectedVerifySolutionsExamKey((prev) => {
      if (prev && reviewVerifyExamOptions.some((option) => option.key === prev)) return prev;
      return reviewVerifyExamOptions[0].key;
    });
  }, [reviewVerifyExamOptions]);

  const runVerifySolutionsReview = async () => {
    const selectedExam = reviewVerifyExamOptions.find((option) => option.key === selectedVerifySolutionsExamKey);
    if (!selectedExam) {
      setVerifySolutionsStatus('error');
      setVerifySolutionsMessage('Select an exam with a valid paper number first.');
      setVerifySolutionsOutput(null);
      return;
    }

    try {
      setIsVerifyingSolutions(true);
      setVerifySolutionsStatus('idle');
      setVerifySolutionsMessage('');
      setVerifySolutionsOutput(null);

      const response = await fetch('/api/hsc/verify-solutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName: selectedExam.schoolName,
          year: selectedExam.year,
          paperNumber: selectedExam.paperNumber,
          grade: selectedExam.grade,
          subject: selectedExam.subject,
          applyUpdates: verifySolutionsApplyUpdates,
        }),
      });

      const data = await response.json().catch(() => ({} as Record<string, unknown>));

      if (!response.ok) {
        const message = String(data?.error || `Verification failed (${response.status})`);
        setVerifySolutionsStatus('error');
        setVerifySolutionsMessage(message);
        setVerifySolutionsOutput(data && typeof data === 'object' ? data : null);
        return;
      }

      const output = data && typeof data === 'object' ? data : {};
      const userFeedback = String(output?.userFeedback || '').trim();
      setVerifySolutionsStatus('success');
      setVerifySolutionsMessage(userFeedback || 'Verification complete.');
      setVerifySolutionsOutput(output as Record<string, unknown>);

      if (verifySolutionsApplyUpdates) {
        fetchAllQuestions({ includeIncomplete: true });
      }
    } catch (err) {
      const message = getFetchErrorMessage(err, 'Failed to verify solutions');
      setVerifySolutionsStatus('error');
      setVerifySolutionsMessage(message);
      setVerifySolutionsOutput(null);
    } finally {
      setIsVerifyingSolutions(false);
    }
  };

  // Check user auth and dev mode on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const userJson = localStorage.getItem('user');
      if (!userJson) return;

      const user = JSON.parse(userJson);
      const normalizedEmail = String(user.email || '').toLowerCase();
      setUserEmail(user.email);
      setUserCreatedAt(user.created_at);
      const nextName = String(user.name || '').trim();
      setUserName(nextName);
      setUserNameDraft(nextName);

      // Check if user is dev
      setIsDevMode(normalizedEmail === 'peter7775271@gmail.com');
    } catch (e) {
      console.error('Error parsing user:', e);
    }
  }, []);

  useEffect(() => {
    setUserNameDraft(userName);
  }, [userName]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    if (view === 'papers') {
      setViewMode('papers');
    } else if (view === 'generator') {
      setViewMode('browse');
    }
  }, []);

  // Auto-load questions when entering settings view (needed for exam dropdown in Syllabus Dot Point Mapping)
  useEffect(() => {
    if (viewMode === 'settings' && !allQuestions.length && !loadingQuestions) {
      fetchAllQuestions({ includeIncomplete: true });
    }
  }, [viewMode]);

  // Fetch questions when entering review tab
  useEffect(() => {
    if (viewMode === 'dev-questions' && devTab === 'review') {
      fetchAllQuestions({ includeIncomplete: true });
    }
  }, [viewMode, devTab]);

  useEffect(() => {
    if (viewMode === 'dev-questions' && devTab === 'manage') {
      setManageSubView('list');
      setManageFiltersApplied(false);
      setAllQuestions([]);
      setSelectedManageQuestionId(null);
      setManageQuestionDraft(null);
      setManageQuestionEditMode(false);
      setSelectedManageQuestionIds([]);
      setQuestionsFetchError(null);
      setImageMapSelectedPaperKey('');
      setImageMapQuestions([]);
      setImageMapDraftById({});
    }
  }, [viewMode, devTab]);

  const runSyllabusDotPointMapping = async () => {
    if (!selectedSyllabusMappingPaper) {
      setSyllabusMappingStatus('error');
      setSyllabusMappingResult('Select an exam first.');
      return;
    }

    const selectedPaper = availablePapers.find((paper) => getPaperKey(paper) === selectedSyllabusMappingPaper);
    if (!selectedPaper) {
      setSyllabusMappingStatus('error');
      setSyllabusMappingResult('Selected exam is no longer available.');
      return;
    }

    const hasMappingValue = (value: string | null | undefined) => String(value || '').trim().length > 0;
    const examQuestions = allQuestions.filter((q) => (
      String(q?.year || '') === selectedPaper.year
      && String(q?.grade || '') === selectedPaper.grade
      && String(q?.subject || '') === selectedPaper.subject
      && String(q?.school_name || 'HSC') === selectedPaper.school
    ));
    const unmappedCount = examQuestions.filter((q) => !hasMappingValue(q?.subtopic) && !hasMappingValue(q?.syllabus_dot_point)).length;

    if (examQuestions.length > 0 && unmappedCount === 0) {
      setSyllabusMappingStatus('success');
      setSyllabusMappingResult('All questions in this exam are already mapped.');
      setSyllabusMappingProgress({ current: 0, total: 0 });
      setSyllabusMappingDebugOutputs([]);
      return;
    }

    try {
      setIsMappingSyllabusDotPoints(true);
      setSyllabusMappingStatus('idle');
      setSyllabusMappingResult('');
      setSyllabusMappingDebugOutputs([]);
      setSyllabusMappingProgress({ current: 0, total: unmappedCount || selectedPaper.count });

      const response = await fetch('/api/hsc/map-syllabus-dot-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: selectedPaper.year,
          grade: selectedPaper.grade,
          subject: selectedPaper.subject,
          school: selectedPaper.school,
          only_unmapped: true,
          debug: true,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data?.error || `Mapping failed (${response.status})`;
        setSyllabusMappingDebugOutputs(Array.isArray(data?.debug_model_outputs) ? data.debug_model_outputs : []);
        setSyllabusMappingStatus('error');
        setSyllabusMappingResult(message);
        return;
      }

      const totals = data?.totals || {};
      setSyllabusMappingDebugOutputs(Array.isArray(data?.debug_model_outputs) ? data.debug_model_outputs : []);
      setSyllabusMappingProgress({ current: totals.questions || 0, total: totals.questions || 0 });
      setSyllabusMappingStatus('success');
      setSyllabusMappingResult(
        `Completed. Updated ${totals.updated || 0} of ${totals.questions || 0} unmapped questions (already mapped ${totals.alreadyMapped || 0}, skipped ${totals.skipped || 0}, failed ${totals.failed || 0}).`
      );
      fetchAllQuestions();
    } catch (err) {
      const message = getFetchErrorMessage(err, 'Failed to map syllabus dot points');
      setSyllabusMappingStatus('error');
      setSyllabusMappingResult(message);
    } finally {
      setIsMappingSyllabusDotPoints(false);
    }
  };

  const runSyllabusWorkflowTest = async () => {
    const input = syllabusWorkflowTestInput.trim();
    if (!input) {
      setSyllabusWorkflowTestStatus('error');
      setSyllabusWorkflowTestResult('Enter a question first.');
      setSyllabusWorkflowTestOutput(null);
      return;
    }

    if (!selectedSyllabusMappingPaper) {
      setSyllabusWorkflowTestStatus('error');
      setSyllabusWorkflowTestResult('Select an exam first so grade/subject context is available.');
      setSyllabusWorkflowTestOutput(null);
      return;
    }

    const selectedPaper = availablePapers.find((paper) => getPaperKey(paper) === selectedSyllabusMappingPaper);
    if (!selectedPaper) {
      setSyllabusWorkflowTestStatus('error');
      setSyllabusWorkflowTestResult('Selected exam is no longer available.');
      setSyllabusWorkflowTestOutput(null);
      return;
    }

    try {
      setIsRunningSyllabusWorkflowTest(true);
      setSyllabusWorkflowTestStatus('idle');
      setSyllabusWorkflowTestResult('');
      setSyllabusWorkflowTestOutput(null);

      const response = await fetch('/api/hsc/map-syllabus-dot-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow_test: true,
          workflow_test_input: input,
          year: selectedPaper.year,
          grade: selectedPaper.grade,
          subject: selectedPaper.subject,
          school: selectedPaper.school,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data?.error || `Workflow test failed (${response.status})`;
        setSyllabusWorkflowTestStatus('error');
        setSyllabusWorkflowTestResult(message);
        setSyllabusWorkflowTestOutput(data && typeof data === 'object' ? (data as Record<string, unknown>) : null);
        return;
      }

      setSyllabusWorkflowTestStatus('success');
      setSyllabusWorkflowTestResult(`Completed test. Category: ${data?.classification || 'Unknown'}`);
      setSyllabusWorkflowTestOutput(data && typeof data === 'object' ? (data as Record<string, unknown>) : null);
    } catch (err) {
      const message = getFetchErrorMessage(err, 'Failed to run workflow test');
      setSyllabusWorkflowTestStatus('error');
      setSyllabusWorkflowTestResult(message);
      setSyllabusWorkflowTestOutput(null);
    } finally {
      setIsRunningSyllabusWorkflowTest(false);
    }
  };

  const fetchTaxonomy = async (grade: string, subject: string) => {
    if (!grade || !subject) {
      setTaxonomyGrouped({});
      return;
    }
    setTaxonomyLoading(true);
    try {
      const res = await fetch(`/api/hsc/taxonomy?grade=${encodeURIComponent(grade)}&subject=${encodeURIComponent(subject)}`);
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.grouped) {
        setTaxonomyGrouped(json.grouped);
      } else {
        setTaxonomyGrouped({});
      }
    } catch {
      setTaxonomyGrouped({});
    } finally {
      setTaxonomyLoading(false);
    }
  };

  const runSyllabusImport = async () => {
    if (!syllabusImportText.trim()) {
      setSyllabusImportStatus('error');
      setSyllabusImportResult('Paste syllabus content first.');
      return;
    }

    setSyllabusImporting(true);
    setSyllabusImportStatus('idle');
    setSyllabusImportResult('');

    try {
      // Prepend GRADE if user's text doesn't start with one
      let rawText = syllabusImportText.trim();
      if (!/^GRADE\s/im.test(rawText)) {
        rawText = `GRADE ${syllabusImportGrade}\n${rawText}`;
      }

      const response = await fetch('/api/hsc/import-syllabus-dot-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText,
          subject: syllabusImportSubject,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSyllabusImportStatus('error');
        setSyllabusImportResult(data?.error || `Import failed (${response.status})`);
        return;
      }

      const totals = data?.totals || {};
      setSyllabusImportStatus('success');
      const summary = `Imported ${totals.insertedRows || 0} rows across ${totals.blocks || 0} blocks (${totals.skippedBlocks || 0} skipped, ${totals.failedBlocks || 0} failed).`;
      setSyllabusImportResult(data?.warning ? `${summary} ${data.warning}` : summary);
    } catch (err) {
      setSyllabusImportStatus('error');
      setSyllabusImportResult(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setSyllabusImporting(false);
    }
  };

  useEffect(() => {
    if (devTab !== 'manage') return;
    if (!allQuestions.length) {
      setSelectedManageQuestionId(null);
      setManageQuestionDraft(null);
      setManageQuestionEditMode(false);
      setSelectedManageQuestionIds([]);
      return;
    }
    if (!selectedManageQuestionId) {
      setManageQuestionDraft(null);
      setManageQuestionEditMode(false);
    }
  }, [allQuestions, devTab, selectedManageQuestionId]);

  useEffect(() => {
    if (!selectedManageQuestionIds.length) return;
    const availableIds = new Set(allQuestions.map((q) => q.id));
    setSelectedManageQuestionIds((prev) => prev.filter((id) => availableIds.has(id)));
  }, [allQuestions, selectedManageQuestionIds.length]);

  useEffect(() => {
    if (!manageExamBuckets.length) {
      setSelectedVisibilityExamKey('');
      return;
    }

    setSelectedVisibilityExamKey((prev) => {
      if (prev && manageExamBuckets.some((exam) => exam.key === prev)) return prev;
      return manageExamBuckets[0].key;
    });
  }, [manageExamBuckets]);

  useEffect(() => {
    if (!groupingPaperBuckets.length) {
      setSelectedGroupingPaperKey('');
      return;
    }

    setSelectedGroupingPaperKey((prev) => {
      if (prev && groupingPaperBuckets.some((paper) => paper.key === prev)) return prev;
      return groupingPaperBuckets[0].key;
    });
  }, [groupingPaperBuckets]);

  useEffect(() => {
    if (manageSubView !== 'image-map') return;
    if (!allQuestions.length) return;

    const hasSelected = imageMapSelectedPaperKey
      ? availablePapers.some((paper) => getPaperKey(paper) === imageMapSelectedPaperKey)
      : false;

    const nextKey = hasSelected
      ? imageMapSelectedPaperKey
      : (availablePapers[0] ? getPaperKey(availablePapers[0]) : '');

    if (!nextKey) {
      setImageMapSelectedPaperKey('');
      setImageMapQuestions([]);
      setImageMapDraftById({});
      return;
    }

    if (nextKey !== imageMapSelectedPaperKey) {
      setImageMapSelectedPaperKey(nextKey);
    }

    loadImageMapExam(nextKey);
  }, [manageSubView, allQuestions, availablePapers, imageMapSelectedPaperKey]);

  useEffect(() => {
    const handleMouseUp = () => endManageDragSelection();
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Legacy freehand canvas logic removed; Excalidraw now owns the drawing surface.

  const drawStrokePath = (stroke: Stroke) => {
    if (!stroke.length) return;
    const outline = getStroke(stroke, {
      size: Math.max(2, brushSize * 2) * 0.75,
      thinning: 0.5,
      smoothing: 0.3,
      streamline: 0.2,
      simulatePressure: false,
    });
    if (!outline.length) return;
    const path = new Path2D();
    outline.forEach(([x, y], i) => {
      if (i === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    });
    path.closePath();
    ctxRef.current?.fill(path);
  };

  const renderAllStrokes = (_includeCurrent = true) => {
    // Legacy canvas renderer kept as inert stub; no-op now that Excalidraw is used.
    return;
  };

  // History handling
  const cloneStrokes = (strokes: Stroke[]) =>
    strokes.map((stroke) => stroke.map((p) => [...p] as StrokePoint));

  const saveState = () => {
    historyRef.current.push(cloneStrokes(strokesRef.current));
    if (historyRef.current.length > 50) historyRef.current.shift();

    redoStackRef.current = [];
    setCanRedo(false);
    setCanUndo(historyRef.current.length > 1);
  };

  const restoreState = (strokes: Stroke[]) => {
    strokesRef.current = cloneStrokes(strokes);
    renderAllStrokes(false);
  };

  // Drawing - optimized for pen + touch
  const lastPosRef = useRef<[number, number]>([0, 0]);


  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!rect) return [0, 0];

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    return [x, y];
  };

  const beginStroke = (clientX: number, clientY: number, pressure = 0.5) => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!rect) return;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    drawingRef.current = true;
    if (isEraser) {
      eraserPathRef.current = [[x, y]];
      const ctx = ctxRef.current;
      if (ctx) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(x, y, ERASER_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      return;
    }
    const point: StrokePoint = [x, y, Math.max(0.1, pressure)];
    currentStrokeRef.current = [point];
    lastPosRef.current = [x, y];
    renderAllStrokes(true);
  };

  const moveStroke = (clientX: number, clientY: number, pressure = 0.5) => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!rect) return;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (isEraser) {
      eraserPathRef.current.push([x, y]);
      const ctx = ctxRef.current;
      if (ctx) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(x, y, ERASER_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      return;
    }
    const point: StrokePoint = [x, y, Math.max(0.1, pressure)];
    if (!currentStrokeRef.current) currentStrokeRef.current = [];
    currentStrokeRef.current.push(point);
    lastPosRef.current = [x, y];
    renderAllStrokes(true);
  };

  const endStroke = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    setIsPenDrawing(false);
    if (isEraser) {
      const path = eraserPathRef.current;
      eraserPathRef.current = [];
      if (path.length > 0) {
        const dist = (x1: number, y1: number, x2: number, y2: number) =>
          Math.hypot(x1 - x2, y1 - y2);
        saveState();
        strokesRef.current = strokesRef.current.filter(
          (stroke) =>
            !stroke.some(
              (p) =>
                path.some(
                  (ep) => dist(p[0], p[1], ep[0], ep[1]) < ERASER_RADIUS
                )
            )
        );
        renderAllStrokes(false);
        setCanUndo(historyRef.current.length > 1);
      }
      return;
    }
    if (currentStrokeRef.current && currentStrokeRef.current.length) {
      strokesRef.current.push(currentStrokeRef.current);
      currentStrokeRef.current = null;
      renderAllStrokes(false);
      saveState();
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeInputRef.current === 'pointer') return;
    e.preventDefault();
    activeInputRef.current = 'mouse';
    beginStroke(e.clientX, e.clientY, 0.5);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    if (activeInputRef.current === 'pointer') return;
    e.preventDefault();
    moveStroke(e.clientX, e.clientY, 0.5);
  };

  const handleMouseUp = () => {
    endStroke();
    if (activeInputRef.current === 'mouse') {
      activeInputRef.current = null;
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'touch') return;
    e.preventDefault();
    e.stopPropagation();
    if (e.pointerType === 'pen') {
      e.currentTarget.style.touchAction = 'none';
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    activeInputRef.current = 'pointer';
    if (e.pointerType === 'pen') {
      setIsPenDrawing(true);
    }
    const pressure = Math.max(0.1, e.pressure || 0.4);
    beginStroke(e.clientX, e.clientY, pressure);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    if (activeInputRef.current !== 'pointer') return;
    if (e.pointerType === 'touch') return;
    e.preventDefault();
    e.stopPropagation();
    const pressure = Math.max(0.1, e.pressure || 0.4);
    moveStroke(e.clientX, e.clientY, pressure);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeInputRef.current !== 'pointer') return;
    if (e.pointerType === 'touch') return;
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    if (e.pointerType === 'pen') {
      e.currentTarget.style.touchAction = 'pan-y';
    }
    endStroke();
    if (e.pointerType === 'pen') {
      setIsPenDrawing(false);
    }
    activeInputRef.current = null;
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (activeInputRef.current === 'pointer') return;
    if (e.touches.length >= 2) return;
    const touch = e.touches[0];
    const isStylus = (touch as any).touchType === 'stylus';
    if (isIpad && !isStylus) return;
    e.preventDefault();
    if (isStylus) {
      e.currentTarget.style.touchAction = 'none';
    }
    activeInputRef.current = 'touch';
    setIsPenDrawing(true);
    const pressure = Math.max(0.1, (touch as any).force || 0.5);
    beginStroke(touch.clientX, touch.clientY, pressure);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    if (activeInputRef.current === 'pointer') return;
    if (e.touches.length >= 2) return;
    const touch = e.touches[0];
    const isStylus = (touch as any).touchType === 'stylus';
    if (isIpad && !isStylus) return;
    e.preventDefault();
    const pressure = Math.max(0.1, (touch as any).force || 0.5);
    moveStroke(touch.clientX, touch.clientY, pressure);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length >= 2) return;
    e.preventDefault();
    e.currentTarget.style.touchAction = 'pan-y';
    endStroke();
    if (activeInputRef.current === 'touch') {
      activeInputRef.current = null;
    }
  };

  // Controls
  const undo = () => {
    if (historyRef.current.length <= 1) return;
    redoStackRef.current.push(historyRef.current.pop()!);
    restoreState(historyRef.current[historyRef.current.length - 1]);
    setCanRedo(true);
    setCanUndo(historyRef.current.length > 1);
  };

  const redo = () => {
    if (!redoStackRef.current.length) return;
    const state = redoStackRef.current.pop()!;
    historyRef.current.push(state);
    restoreState(state);
    setCanRedo(redoStackRef.current.length > 0);
    setCanUndo(true);
  };

  const handleSaveName = () => {
    if (typeof window === 'undefined') return;
    const trimmed = userNameDraft.trim();
    setIsSavingName(true);
    try {
      const userJson = localStorage.getItem('user');
      const user = userJson ? JSON.parse(userJson) : {};
      const nextUser = { ...user, name: trimmed };
      localStorage.setItem('user', JSON.stringify(nextUser));
      setUserName(trimmed);
    } catch (err) {
      console.error('Failed to save name:', err);
    } finally {
      setTimeout(() => setIsSavingName(false), 400);
    }
  };

  const saveAttempt = async () => {
    if (!question || !feedback) return;

    try {
      // For now, we'll store attempts in localStorage since we don't have user auth
      const attempt = {
        id: Date.now(),
        questionId: question.id,
        questionText: question.question_text,
        questionType: question.question_type || 'written',
        marks: question.marks,
        subject: question.subject,
        topic: question.topic,
        questionNumber: question.question_number || null,
        graphImageData: question.graph_image_data || null,
        graphImageSize: question.graph_image_size || 'medium',
        mcqOptionA: question.mcq_option_a || null,
        mcqOptionB: question.mcq_option_b || null,
        mcqOptionC: question.mcq_option_c || null,
        mcqOptionD: question.mcq_option_d || null,
        mcqCorrectAnswer: question.mcq_correct_answer || null,
        mcqExplanation: question.mcq_explanation || null,
        submittedAnswer: submittedAnswer,
        feedback: feedback,
        sampleAnswer: question.sample_answer,
        savedAt: new Date().toISOString(),
      };

      const existingAttempts = JSON.parse(localStorage.getItem('savedAttempts') || '[]');
      existingAttempts.push(attempt);
      localStorage.setItem('savedAttempts', JSON.stringify(existingAttempts));

      setSavedAttempts(existingAttempts);
      setError(null);
      setIsSaving(true);
      setTimeout(() => setIsSaving(false), 1500);
    } catch (err) {
      console.error('Error saving attempt:', err);
      setError('Failed to save answer');
    }
  };

  const loadSavedAttempts = () => {
    try {
      const attempts = JSON.parse(localStorage.getItem('savedAttempts') || '[]');
      setSavedAttempts(attempts);
      setViewMode('saved');
      setSelectedAttempt(null);
      setSavedExamReviewMode(false);
    } catch (err) {
      console.error('Error loading attempts:', err);
    }
  };

  const requestAnalyticsSummary = async () => {
    if (!topicStats.length) {
      setAnalyticsSummary('No attempts recorded yet. Complete a few questions to unlock insights.');
      return;
    }
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const response = await fetch('/api/hsc/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topics: topicStats.map((t) => ({
            topic: t.topic,
            attempts: t.attempts,
            scoredAttempts: t.scoredAttempts,
            earnedMarks: t.earnedMarks,
            totalMarks: t.totalMarks,
            accuracy: t.accuracy,
          })),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to generate analytics summary');
      }
      setAnalyticsSummary(data?.summary || '');
    } catch (err) {
      setAnalyticsError(err instanceof Error ? err.message : 'Failed to generate analytics summary');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const saveExam = () => {
    const totalPossible = examAttempts.reduce((sum, a) => sum + (a.question?.marks ?? 0), 0);
    const totalAwarded = examAttempts.reduce((sum, a) => sum + (typeof a.feedback?.score === 'number' ? a.feedback.score : 0), 0);
    const exam = {
      type: 'exam',
      id: Date.now(),
      paperYear: activePaper?.year ?? '',
      paperSubject: activePaper?.subject ?? '',
      paperGrade: activePaper?.grade ?? '',
      examAttempts: [...examAttempts],
      totalScore: totalAwarded,
      totalPossible,
      savedAt: new Date().toISOString(),
    };
    const existing = JSON.parse(localStorage.getItem('savedAttempts') || '[]');
    existing.push(exam);
    localStorage.setItem('savedAttempts', JSON.stringify(existing));
    setSavedAttempts(existing);
  };

  const exportExamQuestionsPdf = async ({
    includeSolutions,
    questions,
    title,
    subtitle,
    downloadName,
  }: {
    includeSolutions: boolean;
    questions: any[];
    title: string;
    subtitle: string;
    downloadName: string;
  }) => {
    if (!questions.length) {
      throw new Error('No questions available to export.');
    }
    const response = await fetch('/api/hsc/export-exam-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        subtitle,
        downloadName,
        includeSolutions,
        questions,
      }),
    });

    if (!response.ok) {
      let err: any = {};
      try {
        err = await response.json();
      } catch {
        const text = await response.text().catch(() => '');
        err = text ? { details: text } : {};
      }
      throw new Error(err?.details || err?.error || `Failed to export PDF (${response.status})`);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${downloadName.replace(/[^a-z0-9\-_.]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'custom-exam'}${includeSolutions ? '-with-solutions' : ''}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const exportPaperPdf = async (includeSolutions: boolean) => {
    if (!activePaper || !paperQuestions.length) {
      alert('No paper is loaded to export.');
      return;
    }

    const mode: 'exam' | 'solutions' = includeSolutions ? 'solutions' : 'exam';
    setExportingPaperPdf(mode);

    try {
      const title = `${activePaper.year === 'Custom' ? 'Custom Exam' : `${activePaper.year} ${activePaper.subject}`} ${includeSolutions ? 'Solutions' : 'Paper'}`;
      const subtitle = `${activePaper.subject} • ${activePaper.grade}`;
      const downloadName = `${activePaper.year}-${activePaper.subject}-${activePaper.grade}`;

      await exportExamQuestionsPdf({
        includeSolutions,
        questions: paperQuestions,
        title,
        subtitle,
        downloadName,
      });
    } catch (err) {
      console.error('Error exporting paper PDF:', err);
      alert(err instanceof Error ? err.message : 'Failed to export PDF');
    } finally {
      setExportingPaperPdf(null);
    }
  };

  const exportSavedExamPdf = async (includeSolutions: boolean) => {
    if (!selectedAttempt || selectedAttempt.type !== 'exam') {
      alert('Select a saved exam first.');
      return;
    }

    const questions = Array.isArray(selectedAttempt.examAttempts)
      ? selectedAttempt.examAttempts.map((entry: any) => entry?.question).filter(Boolean)
      : [];

    if (!questions.length) {
      alert('This saved exam has no questions to export.');
      return;
    }

    const mode: 'exam' | 'solutions' = includeSolutions ? 'solutions' : 'exam';
    setExportingSavedExamPdf(mode);

    try {
      const title = `${selectedAttempt.paperYear || 'Saved'} ${selectedAttempt.paperSubject || 'Exam'} ${includeSolutions ? 'Solutions' : 'Paper'}`.trim();
      const subtitle = `${selectedAttempt.paperGrade || ''}`.trim();
      const downloadName = `${selectedAttempt.paperYear || 'saved'}-${selectedAttempt.paperSubject || 'exam'}-${selectedAttempt.paperGrade || ''}`;

      await exportExamQuestionsPdf({
        includeSolutions,
        questions,
        title,
        subtitle,
        downloadName,
      });
    } catch (err) {
      console.error('Error exporting saved exam PDF:', err);
      alert(err instanceof Error ? err.message : 'Failed to export PDF');
    } finally {
      setExportingSavedExamPdf(null);
    }
  };

  const removeSavedAttempt = (id: number) => {
    const next = savedAttempts.filter((a: { id: number }) => a.id !== id);
    localStorage.setItem('savedAttempts', JSON.stringify(next));
    setSavedAttempts(next);
    if (selectedAttempt?.id === id) {
      setSelectedAttempt(null);
      setSavedExamReviewMode(false);
    }
  };

  const addQuestionToDatabase = async () => {
    try {
      setIsAddingQuestion(true);
      const response = await fetch('/api/hsc/add-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newQuestion),
      });

      if (response.ok) {
        alert('Question added successfully!');
        setNewQuestion({
          grade: 'Year 12',
          year: new Date().getFullYear().toString(),
          subject: 'Mathematics Advanced',
          topic: 'Complex Numbers',
          marks: 4,
          questionType: 'written',
          questionNumber: '',
          questionText: '',
          markingCriteria: '',
          sampleAnswer: '',
          sampleAnswerImage: '',
          sampleAnswerImageSize: 'medium',
          mcqOptionA: '',
          mcqOptionB: '',
          mcqOptionC: '',
          mcqOptionD: '',
          mcqOptionAImage: '',
          mcqOptionBImage: '',
          mcqOptionCImage: '',
          mcqOptionDImage: '',
          mcqCorrectAnswer: 'A',
          mcqExplanation: '',
          graphImageData: '',
          graphImageSize: 'medium',
        });
        // Reload questions list
        fetchAllQuestions();
      } else {
        alert('Failed to add question');
      }
    } catch (err) {
      console.error('Error adding question:', err);
      alert('Error adding question');
    } finally {
      setIsAddingQuestion(false);
    }
  };

  const openEditQuestion = (q: any) => {
    setEditingQuestionId(q.id);
    setEditQuestion({
      grade: q.grade,
      year: String(q.year),
      subject: q.subject,
      topic: q.topic,
      marks: q.marks,
      questionType: q.question_type || 'written',
      questionNumber: q.question_number || '',
      questionText: q.question_text,
      markingCriteria: q.marking_criteria,
      sampleAnswer: q.sample_answer,
      sampleAnswerImage: q.sample_answer_image || '',
      mcqOptionA: q.mcq_option_a || '',
      mcqOptionB: q.mcq_option_b || '',
      mcqOptionC: q.mcq_option_c || '',
      mcqOptionD: q.mcq_option_d || '',
      mcqOptionAImage: q.mcq_option_a_image || '',
      mcqOptionBImage: q.mcq_option_b_image || '',
      mcqOptionCImage: q.mcq_option_c_image || '',
      mcqOptionDImage: q.mcq_option_d_image || '',
      mcqCorrectAnswer: q.mcq_correct_answer || 'A',
      mcqExplanation: q.mcq_explanation || '',
      graphImageData: q.graph_image_data || '',
      graphImageSize: q.graph_image_size || 'medium',
    });
    setShowEditModal(true);
  };

  const updateQuestionInDatabase = async () => {
    if (!editingQuestionId) return;

    try {
      setIsUpdatingQuestion(true);
      const response = await fetch('/api/hsc/update-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: editingQuestionId,
          ...editQuestion,
        }),
      });

      if (response.ok) {
        const { data } = await response.json();
        const updated = Array.isArray(data) ? data[0] : null;
        setAllQuestions(
          allQuestions.map((q) => (q.id === editingQuestionId && updated ? updated : q))
        );
        setShowEditModal(false);
        setEditingQuestionId(null);
      } else {
        alert('Failed to update question');
      }
    } catch (err) {
      console.error('Error updating question:', err);
      alert('Error updating question');
    } finally {
      setIsUpdatingQuestion(false);
    }
  };

  const submitPdfPair = async () => {
    if (!examPdfFile && !criteriaPdfFile && !examImageFiles.length) {
      setPdfStatus('error');
      setPdfMessage('Please select an exam PDF, criteria PDF, or one or more exam images.');
      return;
    }

    const yearSelect = typeof document !== 'undefined' ? document.getElementById('pdf-intake-year') as HTMLSelectElement | null : null;
    const yearToSend = (yearSelect?.value ?? pdfYearRef.current ?? pdfYear) || '';
    if (!yearToSend || !pdfSubject) {
      setPdfStatus('error');
      setPdfMessage('Please select a year and subject.');
      return;
    }

    const sendPdf = async (payload: FormData, label: string) => {
      setPdfStatus('uploading');
      setPdfMessage(`Uploading ${label}...`);

      const response = await fetch('/api/hsc/pdf-ingest', {
        method: 'POST',
        body: payload,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || `Failed to upload ${label}`);
      }
      const updatedQuestions = Array.isArray(data?.updatedQuestions) ? data.updatedQuestions : [];
      if (updatedQuestions.length > 0) {
        applyQuestionGroupUpdates(updatedQuestions as Array<{ id: string; group_id?: string | null }>);
      }
      const modelOutput = data?.modelOutput || data?.chatgpt;
      if (modelOutput) {
        setPdfChatGptResponse((prev) => (prev ? `${prev}\n\n${modelOutput}` : modelOutput));
      }
      if (Array.isArray(data?.rawInputs) && data.rawInputs.length > 0) {
        const formatted = data.rawInputs
          .map((entry: { source?: string; index?: number; input?: string }, idx: number) => {
            const label = entry?.source ? `${entry.source}${entry.index != null ? ` ${entry.index}` : ''}` : `input ${idx + 1}`;
            return `--- RAW INPUT (${label}) ---\n\n${entry?.input || ''}`;
          })
          .join('\n\n');
        setPdfRawInputs((prev) => (prev ? `${prev}\n\n${formatted}` : formatted));
      }
      return data;
    };

    try {
      setPdfChatGptResponse('');
      setPdfRawInputs('');
      if (examPdfFile && criteriaPdfFile) {
        const examData = new FormData();
        examData.append('exam', examPdfFile);
        examData.append('grade', pdfGrade);
        examData.append('year', yearToSend);
        examData.append('subject', pdfSubject);
        examData.append('overwrite', pdfOverwrite ? 'true' : 'false');
        examData.append('generateMarkingCriteria', pdfGenerateCriteria ? 'true' : 'false');
        examData.append('autoGroupSubparts', pdfAutoGroupSubparts ? 'true' : 'false');
        examData.append('schoolName', pdfSchoolName.trim());
        if (pdfPaperNumber.trim()) {
          examData.append('paperNumber', pdfPaperNumber.trim());
        }
        await sendPdf(examData, 'exam PDF');

        const criteriaData = new FormData();
        criteriaData.append('criteria', criteriaPdfFile);
        criteriaData.append('grade', pdfGrade);
        criteriaData.append('year', yearToSend);
        criteriaData.append('subject', pdfSubject);
        criteriaData.append('overwrite', pdfOverwrite ? 'true' : 'false');
        criteriaData.append('generateMarkingCriteria', pdfGenerateCriteria ? 'true' : 'false');
        criteriaData.append('autoGroupSubparts', pdfAutoGroupSubparts ? 'true' : 'false');
        criteriaData.append('schoolName', pdfSchoolName.trim());
        if (pdfPaperNumber.trim()) {
          criteriaData.append('paperNumber', pdfPaperNumber.trim());
        }
        const criteriaResponse = await sendPdf(criteriaData, 'criteria PDF');

        setPdfStatus('ready');
        setPdfMessage(criteriaResponse?.message || 'Files received.');
        return;
      }

      const singleData = new FormData();
      if (examPdfFile) {
        singleData.append('exam', examPdfFile);
      }
      if (criteriaPdfFile) {
        singleData.append('criteria', criteriaPdfFile);
      }
      if (examImageFiles.length) {
        examImageFiles.forEach((file) => singleData.append('examImages', file));
      }
      singleData.append('grade', pdfGrade);
      singleData.append('year', yearToSend);
      singleData.append('subject', pdfSubject);
      singleData.append('overwrite', pdfOverwrite ? 'true' : 'false');
      singleData.append('generateMarkingCriteria', pdfGenerateCriteria ? 'true' : 'false');
      singleData.append('autoGroupSubparts', pdfAutoGroupSubparts ? 'true' : 'false');
      singleData.append('schoolName', pdfSchoolName.trim());
      if (pdfPaperNumber.trim()) {
        singleData.append('paperNumber', pdfPaperNumber.trim());
      }

      const label =
        examPdfFile || criteriaPdfFile
          ? examPdfFile
            ? 'exam PDF'
            : 'criteria PDF'
          : 'exam images';

      const data = await sendPdf(singleData, label);
      setPdfStatus('ready');
      setPdfMessage(data?.message || 'Files received.');
    } catch (err) {
      setPdfStatus('error');
      setPdfMessage(err instanceof Error ? err.message : 'Failed to submit intake');
    }
  };

  const extractMarksAwarded = (evaluation: string, maxMarks: number) => {
    if (!evaluation || typeof evaluation !== 'string') return null;
    const trimmed = evaluation.trim();
    const patterns = [
      /Marks\s*Awarded:\s*([0-9]+(?:\.[0-9]+)?)\s*\/\s*([0-9]+(?:\.[0-9]+)?)/i,
      /Score:\s*([0-9]+(?:\.[0-9]+)?)\s*\/\s*([0-9]+(?:\.[0-9]+)?)/i,
      /([0-9]+(?:\.[0-9]+)?)\s*\/\s*([0-9]+(?:\.[0-9]+)?)\s*marks?/i,
      /Awarded:\s*([0-9]+(?:\.[0-9]+)?)/i,
    ];
    for (const re of patterns) {
      const match = trimmed.match(re);
      if (match && match[1]) {
        const awarded = parseFloat(match[1]);
        if (!Number.isNaN(awarded)) return Math.min(Math.max(awarded, 0), maxMarks);
      }
    }
    return null;
  };

  const resizeImageForMarking = (dataUrl: string, maxDimension = 1536): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const w = img.width;
        const h = img.height;
        if (w <= maxDimension && h <= maxDimension) {
          resolve(dataUrl);
          return;
        }
        const scale = maxDimension / Math.max(w, h);
        const c = document.createElement('canvas');
        c.width = Math.round(w * scale);
        c.height = Math.round(h * scale);
        const ctx = c.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.88));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const analyzeAnswerImage = (dataUrl: string) => {
    return new Promise<{ lowInk: boolean; inkRatio: number; darkPixels: number }>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 512;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.floor(img.width * scale));
        const h = Math.max(1, Math.floor(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ lowInk: false, inkRatio: 1, darkPixels: 0 });
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;
        const totalPixels = w * h;
        let opaquePixels = 0;
        let transparentPixels = 0;
        let darkPixels = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          if (a < 10) {
            transparentPixels += 1;
            continue;
          }

          if (a > 200) {
            opaquePixels += 1;
          }

          const gray = (r + g + b) / 3;
          if (gray < 220 && a > 20) {
            darkPixels += 1;
          }
        }

        const transparentRatio = totalPixels ? transparentPixels / totalPixels : 0;
        const opaqueRatio = totalPixels ? opaquePixels / totalPixels : 0;
        const opaqueInkRatio = totalPixels ? opaquePixels / totalPixels : 0;
        const darkInkRatio = totalPixels ? darkPixels / totalPixels : 0;

        const inkRatio = Math.max(opaqueInkRatio, darkInkRatio);
        const lowInk = transparentRatio > 0.4
          ? (opaquePixels < 40 && inkRatio < 0.0002)
          : (darkPixels < 40 && inkRatio < 0.0002 && opaqueRatio > 0.99);

        resolve({ lowInk, inkRatio, darkPixels });
      };
      img.onerror = () => resolve({ lowInk: false, inkRatio: 1, darkPixels: 0 });
      img.src = dataUrl;
    });
  };

  const handleGraphUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setNewQuestion({ ...newQuestion, graphImageData: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  const handleClipboardImagePaste = (
    e: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    onDataUrl: (dataUrl: string) => void
  ) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (!item.type.startsWith('image/')) continue;
      const file = item.getAsFile();
      if (!file) continue;

      e.preventDefault();
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        if (!dataUrl) return;
        onDataUrl(dataUrl);
      };
      reader.readAsDataURL(file);
      return;
    }
  };

  const handleEditModalImagePaste = (
    field: string,
    sizeField?: string
  ) => (e: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    handleClipboardImagePaste(e, (dataUrl) => {
      setEditQuestion((prev: any) => {
        const next = { ...prev, [field]: dataUrl };
        if (sizeField && !String(prev[sizeField] || '').trim()) {
          next[sizeField] = 'medium';
        }
        return next;
      });
    });
  };

  const handleGraphPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    handleClipboardImagePaste(e, (dataUrl) => {
      setNewQuestion({ ...newQuestion, graphImageData: dataUrl });
    });
  };

  const handleEditGraphUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setEditQuestion({ ...editQuestion, graphImageData: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  const handleEditGraphPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    handleClipboardImagePaste(e, (dataUrl) => {
      setEditQuestion({ ...editQuestion, graphImageData: dataUrl });
    });
  };

  const fetchAllQuestions = async (options?: { includeIncomplete?: boolean }) => {
    try {
      setLoadingQuestions(true);
      setQuestionsFetchError(null);
      const params = new URLSearchParams();
      if (options?.includeIncomplete) {
        params.set('includeIncomplete', 'true');
      }
      const url = params.toString() ? `/api/hsc/all-questions?${params.toString()}` : '/api/hsc/all-questions';
      const response = await fetch(url);
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setAllQuestions(Array.isArray(data) ? data : []);
      } else {
        const msg = data?.details ?? data?.error ?? `Failed to fetch questions (${response.status})`;
        setQuestionsFetchError(msg);
        setAllQuestions([]);
        console.error('[fetchAllQuestions]', msg);
      }
    } catch (err) {
      const msg = getFetchErrorMessage(err, 'Failed to fetch questions');
      setQuestionsFetchError(msg);
      setAllQuestions([]);
      if (isExpectedFetchError(err)) {
        console.warn('[fetchAllQuestions]', msg);
      } else {
        console.error('Error fetching questions:', err);
      }
    } finally {
      setLoadingQuestions(false);
    }
  };

  const fetchBrowseQuestionsForSubject = async (subjectValue: string) => {
    const normalizedSubject = String(subjectValue || '').trim();
    if (!normalizedSubject) {
      setBrowseQuestions([]);
      setBrowseQuestionsSubject('');
      return;
    }

    if (browseQuestionsSubject === normalizedSubject && browseQuestions.length > 0) {
      return;
    }

    try {
      setBrowseLoadingQuestions(true);
      setQuestionsFetchError(null);

      const params = new URLSearchParams({ subject: normalizedSubject });
      const response = await fetch(`/api/hsc/all-questions?${params.toString()}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data?.details ?? data?.error ?? `Failed to fetch questions (${response.status})`;
        throw new Error(msg);
      }

      const rows = Array.isArray(data) ? data : [];
      const uniqueById = new Map<string, any>();
      rows.forEach((row) => {
        const id = String(row?.id || '');
        if (!id) return;
        uniqueById.set(id, row);
      });

      setBrowseQuestions(Array.from(uniqueById.values()));
      setBrowseQuestionsSubject(normalizedSubject);
    } catch (err) {
      const msg = getFetchErrorMessage(err, 'Failed to fetch questions');
      setQuestionsFetchError(msg);
      setBrowseQuestions([]);
      setBrowseQuestionsSubject(normalizedSubject);
      if (isExpectedFetchError(err)) {
        console.warn('[fetchBrowseQuestionsForSubject]', msg);
      } else {
        console.error('Error fetching browse questions:', err);
      }
    } finally {
      setBrowseLoadingQuestions(false);
    }
  };

  const applyManageFilters = async () => {
    if (!hasManageFilters) {
      alert('Apply at least one filter before loading questions.');
      return;
    }

    try {
      setLoadingQuestions(true);
      setQuestionsFetchError(null);

      const params = new URLSearchParams();
      manageFilterValues.grades.forEach((grade) => params.append('grade', grade));
      manageFilterValues.years.forEach((year) => params.append('year', year));
      manageFilterValues.subjects.forEach((subject) => params.append('subject', subject));
      manageFilterValues.topics.forEach((topic) => params.append('topic', topic));
      manageFilterValues.schools.forEach((school) => params.append('school', school));
      manageFilterValues.questionTypes.forEach((questionType) => params.append('questionType', questionType));
      if (manageMissingImagesOnly) params.set('missingImagesOnly', 'true');
      params.set('includeIncomplete', 'true');
      const search = manageSearchQuery.trim();
      if (search) params.set('search', search);

      const response = await fetch(`/api/hsc/all-questions?${params.toString()}`);
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        const rows = Array.isArray(data) ? data : [];
        setAllQuestions(rows);
        setManageFiltersApplied(true);
        setSelectedManageQuestionId(null);
        setManageQuestionDraft(null);
        setManageQuestionEditMode(false);
        setSelectedManageQuestionIds([]);
      } else {
        const msg = data?.details ?? data?.error ?? `Failed to fetch questions (${response.status})`;
        setQuestionsFetchError(msg);
        setAllQuestions([]);
        setManageFiltersApplied(true);
      }
    } catch (err) {
      const msg = getFetchErrorMessage(err, 'Failed to fetch questions');
      setQuestionsFetchError(msg);
      setAllQuestions([]);
      setManageFiltersApplied(true);
      if (isExpectedFetchError(err)) {
        console.warn('Manage questions fetch issue:', msg);
      } else {
        console.error('Error fetching filtered manage questions:', err);
      }
    } finally {
      setLoadingQuestions(false);
    }
  };

  const resetManageFilters = () => {
    setManageFilters([]);
    setManageSearchQuery('');
    setManageFiltersApplied(false);
    setQuestionsFetchError(null);
    setAllQuestions([]);
    setSelectedManageQuestionId(null);
    setManageQuestionDraft(null);
    setManageQuestionEditMode(false);
    setSelectedManageQuestionIds([]);
  };

  const openManageImageMap = async () => {
    setManageSubView('image-map');
    if (!allQuestions.length && !loadingQuestions) {
      await fetchAllQuestions({ includeIncomplete: true });
    }
  };

  const loadImageMapExam = (paperKey: string) => {
    const selectedPaper = availablePapers.find((paper) => getPaperKey(paper) === paperKey);
    if (!selectedPaper) {
      setImageMapQuestions([]);
      setImageMapDraftById({});
      return;
    }

    const nextQuestions = allQuestions
      .filter((q) => (
        String(q?.year || '') === selectedPaper.year
        && String(q?.grade || '') === selectedPaper.grade
        && String(q?.subject || '') === selectedPaper.subject
        && String(q?.school_name || 'HSC') === selectedPaper.school
      ))
      .sort((a, b) => {
        const left = parseQuestionNumberForSort(a.question_number);
        const right = parseQuestionNumberForSort(b.question_number);
        return left.number - right.number || left.part.localeCompare(right.part) || left.subpart - right.subpart || left.raw.localeCompare(right.raw);
      });

    const nextDrafts: Record<string, {
      graph_image_data: string;
      sample_answer_image: string;
      mcq_option_a_image: string;
      mcq_option_b_image: string;
      mcq_option_c_image: string;
      mcq_option_d_image: string;
      mcq_correct_answer: 'A' | 'B' | 'C' | 'D';
    }> = {};

    nextQuestions.forEach((question) => {
      nextDrafts[question.id] = {
        graph_image_data: String(question.graph_image_data || ''),
        sample_answer_image: String(question.sample_answer_image || ''),
        mcq_option_a_image: String(question.mcq_option_a_image || ''),
        mcq_option_b_image: String(question.mcq_option_b_image || ''),
        mcq_option_c_image: String(question.mcq_option_c_image || ''),
        mcq_option_d_image: String(question.mcq_option_d_image || ''),
        mcq_correct_answer: (String(question.mcq_correct_answer || 'A').toUpperCase() as 'A' | 'B' | 'C' | 'D'),
      };
    });

    setImageMapQuestions(nextQuestions);
    setImageMapDraftById(nextDrafts);
  };

  const saveImageMapChanges = async () => {
    if (!imageMapQuestions.length) return;

    const changedQuestions = imageMapQuestions.filter((question) => {
      const draft = imageMapDraftById[question.id];
      if (!draft) return false;
      return (
        String(question.graph_image_data || '') !== draft.graph_image_data
        || String(question.sample_answer_image || '') !== draft.sample_answer_image
        || String(question.mcq_option_a_image || '') !== draft.mcq_option_a_image
        || String(question.mcq_option_b_image || '') !== draft.mcq_option_b_image
        || String(question.mcq_option_c_image || '') !== draft.mcq_option_c_image
        || String(question.mcq_option_d_image || '') !== draft.mcq_option_d_image
        || String(question.mcq_correct_answer || 'A').toUpperCase() !== draft.mcq_correct_answer
      );
    });

    if (!changedQuestions.length) {
      alert('No changes to save.');
      return;
    }

    try {
      setImageMapSaving(true);
      const updatedById = new Map<string, any>();

      for (const question of changedQuestions) {
        const draft = imageMapDraftById[question.id];
        const nextDraft = {
          ...question,
          graph_image_data: draft.graph_image_data,
          sample_answer_image: draft.sample_answer_image,
          mcq_option_a_image: draft.mcq_option_a_image,
          mcq_option_b_image: draft.mcq_option_b_image,
          mcq_option_c_image: draft.mcq_option_c_image,
          mcq_option_d_image: draft.mcq_option_d_image,
          mcq_correct_answer: draft.mcq_correct_answer,
        };

        const response = await fetch('/api/hsc/update-question', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildUpdatePayload(nextDraft)),
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result?.error || `Failed to update question ${question.question_number || question.id}`);
        }

        const updated = Array.isArray(result?.data) ? result.data[0] : result?.data;
        if (updated?.id) {
          updatedById.set(updated.id, updated);
        }
      }

      if (updatedById.size > 0) {
        setAllQuestions((prev) => prev.map((q) => updatedById.get(q.id) || q));
        setImageMapQuestions((prev) => prev.map((q) => updatedById.get(q.id) || q));
      }

      alert(`Saved ${changedQuestions.length} question${changedQuestions.length === 1 ? '' : 's'}.`);
    } catch (err) {
      console.error('Error saving image map changes:', err);
      alert(err instanceof Error ? err.message : 'Failed to save image updates');
    } finally {
      setImageMapSaving(false);
    }
  };

  const deleteQuestion = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this question?')) {
      return;
    }

    try {
      setDeletingQuestionId(questionId);
      const response = await fetch('/api/hsc/delete-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId }),
      });

      if (response.ok) {
        alert('Question deleted successfully!');
        // Remove from local list
        setAllQuestions(allQuestions.filter(q => q.id !== questionId));
      } else {
        alert('Failed to delete question');
      }
    } catch (err) {
      console.error('Error deleting question:', err);
      alert('Error deleting question');
    } finally {
      setDeletingQuestionId(null);
    }
  };

  const toggleManageSelection = (questionId: string, shouldSelect?: boolean) => {
    setSelectedManageQuestionIds((prev) => {
      const alreadySelected = prev.includes(questionId);
      if (shouldSelect === true && alreadySelected) return prev;
      if (shouldSelect === false && !alreadySelected) return prev;
      if (alreadySelected) {
        return prev.filter((id) => id !== questionId);
      }
      return [...prev, questionId];
    });
  };

  const beginManageDragSelection = (questionId: string, shouldSelect: boolean) => {
    manageDragSelectingRef.current = true;
    manageDragSelectValueRef.current = shouldSelect;
    manageDragTouchedRef.current = new Set([questionId]);
    toggleManageSelection(questionId, shouldSelect);
  };

  const continueManageDragSelection = (questionId: string) => {
    if (!manageDragSelectingRef.current) return;
    if (manageDragTouchedRef.current.has(questionId)) return;
    manageDragTouchedRef.current.add(questionId);
    toggleManageSelection(questionId, manageDragSelectValueRef.current);
  };

  const endManageDragSelection = () => {
    manageDragSelectingRef.current = false;
    manageDragTouchedRef.current = new Set();
  };

  const setAllManageSelections = (selectAll: boolean, ids?: string[]) => {
    const targetIds = ids && ids.length ? ids : allQuestions.map((q) => q.id);
    if (!selectAll) {
      setSelectedManageQuestionIds((prev) => prev.filter((id) => !targetIds.includes(id)));
      return;
    }
    setSelectedManageQuestionIds((prev) => {
      const next = new Set(prev);
      targetIds.forEach((id) => next.add(id));
      return Array.from(next);
    });
  };

  const deleteSelectedQuestions = async () => {
    if (!selectedManageQuestionIds.length) return;
    if (!confirm(`Delete ${selectedManageQuestionIds.length} selected question(s)?`)) {
      return;
    }

    try {
      setBulkActionLoading(true);
      for (const questionId of selectedManageQuestionIds) {
        await fetch('/api/hsc/delete-question', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionId }),
        });
      }

      const remaining = allQuestions.filter((q) => !selectedManageQuestionIds.includes(q.id));
      setAllQuestions(remaining);
      setSelectedManageQuestionIds([]);
      if (selectedManageQuestionId && selectedManageQuestionIds.includes(selectedManageQuestionId)) {
        setSelectedManageQuestionId(null);
        setManageQuestionDraft(null);
        setManageQuestionEditMode(false);
      }
    } catch (err) {
      console.error('Error deleting selected questions:', err);
      alert('Failed to delete selected questions');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const clearSelectedMarkingCriteria = async () => {
    if (!selectedManageQuestionIds.length) return;
    if (!confirm(`Clear marking criteria for ${selectedManageQuestionIds.length} selected question(s)?`)) {
      return;
    }

    try {
      setBulkActionLoading(true);
      const selectedSet = new Set(selectedManageQuestionIds);
      const updates = allQuestions.filter((q) => selectedSet.has(q.id));

      for (const q of updates) {
        await fetch('/api/hsc/update-question', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionId: q.id,
            grade: q.grade,
            year: String(q.year),
            subject: q.subject,
            topic: q.topic,
            marks: q.marks,
            questionNumber: q.question_number,
            questionText: q.question_text,
            markingCriteria: null,
            sampleAnswer: q.sample_answer,
            graphImageData: q.graph_image_data,
            graphImageSize: q.graph_image_size,
            questionType: q.question_type,
            mcqOptionA: q.mcq_option_a,
            mcqOptionB: q.mcq_option_b,
            mcqOptionC: q.mcq_option_c,
            mcqOptionD: q.mcq_option_d,
            mcqCorrectAnswer: q.mcq_correct_answer,
            mcqExplanation: q.mcq_explanation,
          }),
        });
      }

      setAllQuestions((prev) =>
        prev.map((q) => (selectedSet.has(q.id) ? { ...q, marking_criteria: null } : q))
      );

      if (manageQuestionDraft && selectedSet.has(manageQuestionDraft.id)) {
        setManageQuestionDraft({ ...manageQuestionDraft, marking_criteria: null });
      }
    } catch (err) {
      console.error('Error clearing marking criteria:', err);
      alert('Failed to clear marking criteria');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const assignSelectedQuestionsToGroup = async () => {
    if (!selectedManageQuestionIds.length) return;

    const selectedQuestions = getSelectedQuestionsForGrouping();
    const validation = validateSelectedQuestionsForGrouping(selectedQuestions);
    if (!validation.ok) {
      alert(validation.message);
      return;
    }

    try {
      setBulkActionLoading(true);
      const response = await fetch('/api/hsc/question-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign',
          questionIds: selectedManageQuestionIds,
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.error || `Failed to group questions (${response.status})`);
      }

      const updatedQuestions = Array.isArray(result?.updatedQuestions) ? result.updatedQuestions : [];
      applyQuestionGroupUpdates(updatedQuestions as Array<{ id: string; group_id?: string | null }>);
    } catch (err) {
      console.error('Error grouping selected questions:', err);
      alert(err instanceof Error ? err.message : 'Failed to group selected questions');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const clearSelectedQuestionGroups = async () => {
    if (!selectedManageQuestionIds.length) return;

    try {
      setBulkActionLoading(true);
      const response = await fetch('/api/hsc/question-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clear',
          questionIds: selectedManageQuestionIds,
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.error || `Failed to clear question groups (${response.status})`);
      }

      const updatedQuestions = Array.isArray(result?.updatedQuestions) ? result.updatedQuestions : [];
      applyQuestionGroupUpdates(updatedQuestions as Array<{ id: string; group_id?: string | null }>);
    } catch (err) {
      console.error('Error clearing selected question groups:', err);
      alert(err instanceof Error ? err.message : 'Failed to clear selected question groups');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const setSelectedExamIncomplete = async (isIncomplete: boolean) => {
    if (!selectedVisibilityExamKey) return;

    const selectedExam = manageExamBuckets.find((exam) => exam.key === selectedVisibilityExamKey);
    if (!selectedExam) return;

    const matchesExam = (q: any) => (
      String(q?.year || '') === selectedExam.year
      && String(q?.grade || '') === selectedExam.grade
      && String(q?.subject || '') === selectedExam.subject
      && String(q?.school_name || 'HSC') === selectedExam.school
    );

    try {
      setExamVisibilityUpdatingKey(selectedExam.key);
      setExamVisibilityMessage(null);

      const response = await fetch('/api/hsc/exam-visibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: selectedExam.year,
          grade: selectedExam.grade,
          subject: selectedExam.subject,
          school: selectedExam.school,
          isIncomplete,
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.error || `Failed to update exam visibility (${response.status})`);
      }

      setAllQuestions((prev) => prev.map((q) => (matchesExam(q) ? { ...q, exam_incomplete: isIncomplete } : q)));
      setBrowseQuestions((prev) => (
        isIncomplete
          ? prev.filter((q) => !matchesExam(q))
          : prev
      ));

      if (manageQuestionDraft && matchesExam(manageQuestionDraft)) {
        setManageQuestionDraft({ ...manageQuestionDraft, exam_incomplete: isIncomplete });
      }
      if (inlineEditDraft && matchesExam(inlineEditDraft)) {
        setInlineEditDraft({ ...inlineEditDraft, exam_incomplete: isIncomplete });
      }

      setExamVisibilityMessage(
        isIncomplete
          ? `Marked ${selectedExam.year} • ${selectedExam.grade} • ${selectedExam.subject} • ${selectedExam.school} as incomplete.`
          : `Marked ${selectedExam.year} • ${selectedExam.grade} • ${selectedExam.subject} • ${selectedExam.school} as complete.`
      );
    } catch (err) {
      setExamVisibilityMessage(err instanceof Error ? err.message : 'Failed to update exam visibility');
    } finally {
      setExamVisibilityUpdatingKey('');
    }
  };

  const autoGroupSubpartQuestions = async () => {
    const selectedPaper = groupingPaperBuckets.find((paper) => paper.key === selectedGroupingPaperKey);
    if (!selectedPaper) {
      alert('Select a Mathematics or Mathematics Advanced paper first.');
      return;
    }

    try {
      setGroupingPaperLoading(true);
      setGroupingPaperMessage(null);

      const response = await fetch('/api/hsc/question-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'auto-group-paper',
          year: selectedPaper.year,
          grade: selectedPaper.grade,
          subject: selectedPaper.subject,
          school: selectedPaper.school,
          paperNumber: selectedPaper.paperNumber,
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.error || `Failed to auto-group paper (${response.status})`);
      }

      const updatedQuestions = Array.isArray(result?.updatedQuestions) ? result.updatedQuestions : [];
      applyQuestionGroupUpdates(updatedQuestions as Array<{ id: string; group_id?: string | null }>);

      const groupCount = Number(result?.groupCount || 0);
      const groupedQuestionCount = Number(result?.groupedQuestionCount || 0);
      const paperLabel = `${selectedPaper.year} • ${selectedPaper.grade} • ${selectedPaper.subject} • ${selectedPaper.school} • ${selectedPaper.paperNumber == null ? 'No paper #' : `Paper ${selectedPaper.paperNumber}`}`;

      setGroupingPaperMessage(
        groupCount > 0
          ? `Grouped ${groupedQuestionCount} question rows across ${groupCount} question groups for ${paperLabel}.`
          : `No eligible multi-part questions were found for ${paperLabel}.`
      );
    } catch (err) {
      console.error('Error auto-grouping paper questions:', err);
      setGroupingPaperMessage(err instanceof Error ? err.message : 'Failed to auto-group selected paper');
    } finally {
      setGroupingPaperLoading(false);
    }
  };

  const buildUpdatePayload = (draft: any) => ({
    questionId: draft.id,
    grade: draft.grade,
    year: draft.year,
    schoolName: draft.school_name || draft.schoolName || draft.school || '',
    subject: draft.subject,
    topic: draft.topic,
    subtopic: draft.subtopic || null,
    syllabusDotPoint: draft.syllabus_dot_point || null,
    paperNumber: draft.paper_number || null,
    paperLabel: draft.paper_label || null,
    examIncomplete: isExamIncomplete(draft.exam_incomplete),
    marks: draft.marks,
    questionNumber: draft.question_number,
    questionText: draft.question_text,
    markingCriteria: draft.marking_criteria,
    sampleAnswer: draft.sample_answer,
    sampleAnswerImage: draft.sample_answer_image,
    graphImageData: draft.graph_image_data,
    graphImageSize: draft.graph_image_size,
    questionType: draft.question_type,
    mcqOptionA: draft.mcq_option_a,
    mcqOptionB: draft.mcq_option_b,
    mcqOptionC: draft.mcq_option_c,
    mcqOptionD: draft.mcq_option_d,
    mcqOptionAImage: draft.mcq_option_a_image,
    mcqOptionBImage: draft.mcq_option_b_image,
    mcqOptionCImage: draft.mcq_option_c_image,
    mcqOptionDImage: draft.mcq_option_d_image,
    mcqCorrectAnswer: draft.mcq_correct_answer,
    mcqExplanation: draft.mcq_explanation,
  });

  const openInlineQuestionEditor = (rawQuestion: any) => {
    const fallbackGrade = (String(rawQuestion?.grade || '').trim() || 'Year 12') as 'Year 7' | 'Year 8' | 'Year 9' | 'Year 10' | 'Year 11' | 'Year 12';
    const subjectOptions = SUBJECTS_BY_YEAR[fallbackGrade] || SUBJECTS_BY_YEAR['Year 12'];
    const fallbackSubject = String(rawQuestion?.subject || '').trim() || subjectOptions[0];
    const topicOptions = getTopics(fallbackGrade, fallbackSubject);
    const fallbackTopic = String(rawQuestion?.topic || '').trim() || topicOptions[0] || ALL_TOPICS[0] || 'Unspecified';

    setInlineEditDraft({
      ...rawQuestion,
      grade: fallbackGrade,
      year: String(rawQuestion?.year ?? new Date().getFullYear()),
      subject: fallbackSubject,
      school_name: String(rawQuestion?.school_name || 'HSC'),
      paper_number: rawQuestion?.paper_number ?? null,
      paper_label: String(rawQuestion?.paper_label || ''),
      exam_incomplete: isExamIncomplete(rawQuestion?.exam_incomplete),
      topic: fallbackTopic,
      subtopic: String(rawQuestion?.subtopic || ''),
      syllabus_dot_point: String(rawQuestion?.syllabus_dot_point || ''),
      marks: Number.isFinite(Number(rawQuestion?.marks)) ? Number(rawQuestion.marks) : 0,
      question_number: String(rawQuestion?.question_number || ''),
      question_type: rawQuestion?.question_type || 'written',
      question_text: String(rawQuestion?.question_text || ''),
      marking_criteria: String(rawQuestion?.marking_criteria || ''),
      sample_answer: String(rawQuestion?.sample_answer || ''),
      sample_answer_image: String(rawQuestion?.sample_answer_image || ''),
      sample_answer_image_size: String(rawQuestion?.sample_answer_image_size || 'medium'),
      graph_image_data: String(rawQuestion?.graph_image_data || ''),
      graph_image_size: String(rawQuestion?.graph_image_size || 'medium'),
      mcq_option_a: String(rawQuestion?.mcq_option_a || ''),
      mcq_option_b: String(rawQuestion?.mcq_option_b || ''),
      mcq_option_c: String(rawQuestion?.mcq_option_c || ''),
      mcq_option_d: String(rawQuestion?.mcq_option_d || ''),
      mcq_option_a_image: String(rawQuestion?.mcq_option_a_image || ''),
      mcq_option_b_image: String(rawQuestion?.mcq_option_b_image || ''),
      mcq_option_c_image: String(rawQuestion?.mcq_option_c_image || ''),
      mcq_option_d_image: String(rawQuestion?.mcq_option_d_image || ''),
      mcq_correct_answer: String(rawQuestion?.mcq_correct_answer || 'A'),
      mcq_explanation: String(rawQuestion?.mcq_explanation || ''),
    });
  };

  const saveManageQuestion = async () => {
    if (!manageQuestionDraft?.id) return;

    try {
      const response = await fetch('/api/hsc/update-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildUpdatePayload(manageQuestionDraft)),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || 'Failed to update question');
      }

      const updated = Array.isArray(result.data) ? result.data[0] : result.data;
      if (updated) {
        setAllQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
        setManageQuestionDraft(updated);
      }
    } catch (err) {
      console.error('Error updating question:', err);
      alert(err instanceof Error ? err.message : 'Failed to update question');
    }
  };

  const saveInlineEdit = async () => {
    if (!inlineEditDraft?.id) return;

    setInlineEditSaving(true);
    try {
      const response = await fetch('/api/hsc/update-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildUpdatePayload(inlineEditDraft)),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || 'Failed to update question');
      }

      const updated = Array.isArray(result.data) ? result.data[0] : result.data;
      if (updated) {
        setAllQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
        setPaperQuestions((prev) => {
          const next = prev.map((q) => (q.id === updated.id ? updated : q));
          // Keep the current display question merged for roman-subpart groups
          if (isPaperMode && next.length > 0) {
            const { group } = getDisplayGroupAt(next, paperIndex);
            setQuestion(mergeGroupForDisplay(group));
          } else {
            setQuestion((prevQ) => (prevQ?.id === updated.id ? updated : prevQ));
          }
          return next;
        });
        setInlineEditDraft(null);
      }
    } catch (err) {
      console.error('Error updating question:', err);
      alert(err instanceof Error ? err.message : 'Failed to update question');
    } finally {
      setInlineEditSaving(false);
    }
  };

  const clearCanvas = () => {
    // Clear all history and redo stacks
    historyRef.current = [[]];
    redoStackRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
    strokesRef.current = [];
    currentStrokeRef.current = null;
    backgroundImageRef.current = null;

    // Clear the canvas
    renderAllStrokes(false);
    setIsEraser(false);
  };

  const clearExcalidrawCanvas = () => {
    excalidrawSceneRef.current = null;
    const api = excalidrawApiRef.current;
    if (!api) return;
    api.resetScene();
    api.history.clear();
  };

  const hasCurrentAnswer = () => {
    if (!question) return false;
    if (question.question_type === 'multiple_choice') return !!selectedMcqAnswer;
    return !!uploadedFile || !!(strokesRef.current && strokesRef.current.some((s: { length: number }) => s.length > 0));
  };

  const submitAnswer = async (endExamMode?: boolean) => {
    if (!question) return;

    const isLastQuestion = endExamMode ? false : (isPaperMode && paperQuestions.length > 0 && getDisplayGroupAt(paperQuestions, paperIndex).endIndex >= paperQuestions.length);

    if (question.question_type === 'multiple_choice') {
      if (!selectedMcqAnswer) {
        if (!endExamMode) setError('Please select an answer option before submitting.');
        return;
      }

      const correctAnswer = question.mcq_correct_answer ? question.mcq_correct_answer.toUpperCase() : null;
      const isCorrect = correctAnswer === selectedMcqAnswer;
      const score = isCorrect ? question.marks : 0;
      const mcqFeedback = {
        score,
        maxMarks: question.marks,
        marking_criteria: null,
        sample_answer: question.sample_answer,
        ai_evaluation: null,
        mcq_correct_answer: correctAnswer,
        mcq_explanation: question.mcq_explanation || null,
        mcq_selected_answer: selectedMcqAnswer,
      };

      if (examConditionsActive) {
        setExamAttempts((prev) => [
          ...prev,
          { question: { ...question }, submittedAnswer: selectedMcqAnswer, feedback: mcqFeedback },
        ]);
        setError(null);
        setSubmittedAnswer(selectedMcqAnswer);
        if (endExamMode) return;
        if (isLastQuestion) {
          setShowFinishExamPrompt(true);
        } else {
          const { endIndex } = getDisplayGroupAt(paperQuestions, paperIndex);
          goToPaperQuestion(endIndex);
        }
        return;
      }

      setSubmittedAnswer(selectedMcqAnswer);
      setError(null);
      setFeedback(mcqFeedback);
      setAppState('reviewed');
      return;
    }

    if (!question.marking_criteria || !question.sample_answer) {
      setError('Marking is unavailable for this question (missing criteria or sample answer).');
      setTimeout(() => setAppState('idle'), 300);
      return;
    }

    let imageDataUrl: string;
    try {
      // Prefer the current Excalidraw scene over any previously uploaded image
      if (excalidrawSceneRef.current) {
        const { elements, appState, files } = excalidrawSceneRef.current;
        // Filter out any elements that Excalidraw has marked as deleted so
        // erased strokes do not appear in the exported answer image.
        const visibleElements = elements.filter(
          (el) => !(el as ExcalidrawElement & { isDeleted?: boolean }).isDeleted
        );
        const { exportToBlob } = await import('@excalidraw/excalidraw');

        const enhancedAppState = {
          ...appState,
          exportBackground: true,
          viewBackgroundColor: '#ffffff',
          // Slightly higher resolution export to improve legibility
          exportScale: 2,
        } as ExcalidrawAppState & {
          exportBackground?: boolean;
          viewBackgroundColor?: string;
          exportScale?: number;
        };

        const blob = await exportToBlob({
          elements: visibleElements,
          appState: enhancedAppState,
          files,
          mimeType: 'image/png',
        });

        const reader = new FileReader();
        const dataUrlPromise = new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
            if (typeof reader.result === 'string') {
              resolve(reader.result);
            } else {
              reject(new Error('Failed to read Excalidraw export'));
            }
          };
          reader.onerror = () => reject(new Error('Failed to read Excalidraw export'));
        });
        reader.readAsDataURL(blob);
        imageDataUrl = await dataUrlPromise;
      } else if (uploadedFile) {
        imageDataUrl = uploadedFile;
      } else {
        throw new Error('No drawing found');
      }
    } catch {
      setError('Could not capture answer.');
      return;
    }

    if (examConditionsActive) {
      const attemptIndex = examAttempts.length;
      setExamAttempts((prev) => [
        ...prev,
        { question: { ...question }, submittedAnswer: imageDataUrl, feedback: null },
      ]);
      setSubmittedAnswer(imageDataUrl);
      setError(null);
      if (!endExamMode) {
        if (isLastQuestion) {
          setShowFinishExamPrompt(true);
        } else {
          const { endIndex } = getDisplayGroupAt(paperQuestions, paperIndex);
          goToPaperQuestion(endIndex);
        }
      }
      // Mark in background and update examAttempts when done
      (async () => {
        try {
          const { lowInk } = await analyzeAnswerImage(imageDataUrl);
          const imageToSend = await resizeImageForMarking(imageDataUrl);
          const response = await fetch('/api/hsc/mark', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              questionText: question.question_text,
              markingCriteria: question.marking_criteria,
              sampleAnswer: question.sample_answer,
              maxMarks: question.marks,
              userAnswerImage: imageToSend,
              answerQualityHint: lowInk ? 'low_ink' : 'normal',
            }),
          });
          if (!response.ok) {
            const errData = await response.json().catch(() => null);
            throw new Error(errData?.error || 'Failed to get AI marking');
          }
          const data = await response.json();
          const awardedMarks = extractMarksAwarded(data.evaluation, question.marks);
          setExamAttempts((prev) => {
            const next = [...prev];
            if (next[attemptIndex]) {
              next[attemptIndex] = {
                ...next[attemptIndex],
                feedback: {
                  score: awardedMarks,
                  maxMarks: question.marks,
                  marking_criteria: question.marking_criteria,
                  sample_answer: question.sample_answer,
                  ai_evaluation: data.evaluation,
                },
              };
            }
            return next;
          });
        } catch (err) {
          console.error('Background marking failed:', err);
          setExamAttempts((prev) => {
            const next = [...prev];
            if (next[attemptIndex]) {
              next[attemptIndex] = {
                ...next[attemptIndex],
                feedback: { score: null, maxMarks: question.marks, marking_criteria: question.marking_criteria, sample_answer: question.sample_answer, ai_evaluation: null, _error: true },
              };
            }
            return next;
          });
        }
      })();
      return;
    }

    try {
      setAppState('marking');
      const { lowInk } = await analyzeAnswerImage(imageDataUrl);
      setSubmittedAnswer(imageDataUrl);
      const imageToSend = await resizeImageForMarking(imageDataUrl);

      const response = await fetch('/api/hsc/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionText: question.question_text,
          markingCriteria: question.marking_criteria,
          sampleAnswer: question.sample_answer,
          maxMarks: question.marks,
          userAnswerImage: imageToSend,
          answerQualityHint: lowInk ? 'low_ink' : 'normal',
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || 'Failed to get AI marking');
      }

      const data = await response.json();
      const awardedMarks = extractMarksAwarded(data.evaluation, question.marks);

      setFeedback({
        score: awardedMarks,
        maxMarks: question.marks,
        marking_criteria: question.marking_criteria,
        sample_answer: question.sample_answer,
        ai_evaluation: data.evaluation,
      });
      setAppState('reviewed');
    } catch (error) {
      console.error('Error submitting answer:', error);
      setError('Failed to submit answer. Please try again.');
      setAppState('idle');
    }
  };

  const uploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Store the uploaded file for submission
      setUploadedFile(dataUrl);
      // Also display it on the canvas as background
      const img = new Image();
      img.onload = () => {
        backgroundImageRef.current = img;
        renderAllStrokes(false);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const generateQuestion = async () => {
    setIsGenerating(true);
    setError(null);
    setShowAnswer(false);
    setAppState('idle');
    setFeedback(null);
    setUploadedFile(null);
    setSubmittedAnswer(null);
    setSelectedMcqAnswer(null);
    setTimeout(() => resetCanvas(400), 0);

    // Clear history
    historyRef.current = [];
    redoStackRef.current = [];
    setCanUndo(false);
    setCanRedo(false);

    try {
      const params = new URLSearchParams();
      if (filterGrade) params.append('grade', filterGrade);
      if (filterYear) params.append('year', filterYear);
      if (filterSubject) params.append('subject', filterSubject);
      if (filterTopic) params.append('topic', filterTopic);

      const response = await fetchWithTimeout(`/api/hsc/questions?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch question (${response.status})`);
      }

      const data = await response.json();
      setQuestion(data.question);
      setTimeout(() => resetCanvas(400), 100);
    } catch (err) {
      const msg = getFetchErrorMessage(err, 'Failed to load question');
      setError(msg);
      if (isExpectedFetchError(err)) {
        console.warn('Question fetch issue:', msg);
      } else {
        console.error('Error fetching question:', err);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const resetCanvas = (height?: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const targetHeight = height ?? canvasHeight;
    const dpr = window.devicePixelRatio || 1;
    dprRef.current = dpr;
    const cssW = Math.max(1, canvas.offsetWidth || 1);
    const cssH = targetHeight;
    canvas.width = Math.max(1, Math.floor(cssW * dpr));
    canvas.height = Math.max(1, Math.floor(cssH * dpr));
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize;
    ctx.strokeStyle = 'white';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctxRef.current = ctx;

    strokesRef.current = [];
    currentStrokeRef.current = null;
    backgroundImageRef.current = null;
    historyRef.current = [[]];
    redoStackRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
  };

  const resizeAndRedrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const wrapper = canvas.parentElement?.parentElement;
    const cssW = wrapper ? wrapper.getBoundingClientRect().width : canvas.offsetWidth;
    if (cssW <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    dprRef.current = dpr;
    const cssH = canvasHeight;
    canvas.width = Math.max(1, Math.floor(cssW * dpr));
    canvas.height = Math.max(1, Math.floor(cssH * dpr));
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize;
    ctx.strokeStyle = 'white';
    ctxRef.current = ctx;
  };

  const resetForQuestion = (nextQuestion: Question | null) => {
    setQuestion(nextQuestion);
    setAppState('idle');
    setFeedback(null);
    setError(null);
    setShowAnswer(false);
    setUploadedFile(null);
    setSubmittedAnswer(null);
    setSelectedMcqAnswer(null);
    setIsEraser(false);
    clearExcalidrawCanvas();
    setTimeout(() => resetCanvas(400), 0);

    historyRef.current = [];
    redoStackRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
  };

  const clearPaperState = () => {
    setActivePaper(null);
    setPaperQuestions([]);
    setPaperIndex(0);
    setShowPaperQuestionNavigator(false);
    setExamEndsAt(null);
    setExamRemainingMs(null);
    setExamConditionsActive(false);
    setExamAttempts([]);
    setExamEnded(false);
    setShowFinishExamPrompt(false);
    setExamReviewMode(false);
    setExamReviewIndex(0);
  };

  const getExamDurationHours = (subject?: string | null) => {
    const normalized = String(subject || '').toLowerCase();
    if (normalized.includes('extension 1') || normalized.includes('ext 1')) return 2;
    if (normalized.includes('extension 2') || normalized.includes('ext 2') || normalized.includes('advanced')) return 3;
    return 3;
  };

  const startExamSimulation = (subjectOverride?: string | null) => {
    const durationHours = getExamDurationHours(subjectOverride ?? activePaper?.subject);
    const durationMs = durationHours * 60 * 60 * 1000;
    setExamEndsAt(Date.now() + durationMs);
    setExamRemainingMs(durationMs);
    setExamConditionsActive(true);
    setExamAttempts([]);
    setExamEnded(false);
    setShowFinishExamPrompt(false);
    setExamReviewMode(false);
    setExamReviewIndex(0);
    setSidebarHovered(false);
  };

  const endExam = () => {
    setExamConditionsActive(false);
    setExamEnded(true);
    setShowFinishExamPrompt(false);
  };

  const handleEndExam = async () => {
    if (question && hasCurrentAnswer()) await submitAnswer(true);
    endExam();
  };

  const startPaperAttempt = (paper: { year: string; subject: string; grade: string; school: string; count: number }) => {
    const questionPool = browseQuestions.length ? browseQuestions : visibleAllQuestions;
    const matching = questionPool
      .filter(
        (q) =>
          String(q.year) === paper.year &&
          String(q.subject) === paper.subject &&
          String(q.grade) === paper.grade &&
          String(q.school_name || 'HSC') === paper.school
      )
      .sort((a, b) => {
        const left = parseQuestionNumberForSort(a.question_number);
        const right = parseQuestionNumberForSort(b.question_number);
        return left.number - right.number || left.part.localeCompare(right.part) || left.subpart - right.subpart || left.raw.localeCompare(right.raw);
      });

    if (!matching.length) {
      alert('No questions found for this paper yet.');
      return;
    }

    setActivePaper(paper);
    const questions = matching as Question[];
    setPaperQuestions(questions);
    setPaperIndex(0);
    setViewMode('paper');
    const initialGroup = getDisplayGroupAt(questions, 0);
    resetForQuestion(mergeGroupForDisplay(initialGroup.group));
  };

  const openSavedExamAsPaper = (attempt: any) => {
    if (!attempt || attempt.type !== 'exam') return;

    const questions = Array.isArray(attempt.examAttempts)
      ? attempt.examAttempts.map((entry: any) => entry?.question).filter(Boolean)
      : [];

    if (!questions.length) {
      alert('This saved exam has no questions to display.');
      return;
    }

    clearPaperState();
    const typedQuestions = questions as Question[];
    setActivePaper({
      year: String(attempt.paperYear || 'Saved'),
      subject: String(attempt.paperSubject || 'Saved Exam'),
      grade: String(attempt.paperGrade || ''),
      school: 'Saved',
      count: typedQuestions.length,
    });
    setPaperQuestions(typedQuestions);
    setPaperIndex(0);
    setViewMode('paper');
    const initialGroup = getDisplayGroupAt(typedQuestions, 0);
    resetForQuestion(mergeGroupForDisplay(initialGroup.group));
  };

  const shuffleQuestions = (items: Question[]) => {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const loadQuestionsForBuilder = async () => {
    if (allQuestions.length) return visibleAllQuestions as Question[];
    try {
      setLoadingQuestions(true);
      const response = await fetch('/api/hsc/all-questions');
      const data = await response.json().catch(() => ([]));
      const rows = Array.isArray(data) ? data : [];
      setAllQuestions(rows);
      return rows.filter((q) => !isExamIncomplete((q as any)?.exam_incomplete)) as Question[];
    } catch (err) {
      console.error('Error loading questions for builder:', err);
      return [] as Question[];
    } finally {
      setLoadingQuestions(false);
    }
  };

  const initializeCustomExam = async (params: ExamBuilderParams) => {
    setIsInitializingExam(true);
    try {
      clearPaperState();
      const pool = await loadQuestionsForBuilder();
      const gradeSubjectPool = pool.filter((q) => {
        if (String(q.grade) !== params.grade) return false;
        if (String(q.subject) !== params.subject) return false;
        return true;
      });

      const filtered = gradeSubjectPool.filter((q) => {
        if (params.topics.length > 0 && !params.topics.includes(String(q.topic))) return false;
        return true;
      });

      if (!filtered.length) {
        return { ok: false, message: 'No questions match these settings yet.' };
      }

      const shuffled = shuffleQuestions(filtered);
      const targetCount = Math.min(params.intensity, shuffled.length);
      const selected = shuffled.slice(0, targetCount);
      const manualGroupedSelection = expandManualGroupedSelection(selected, gradeSubjectPool, customExamGroupByQuestionId);
      const romanGroupedSelection = expandRomanSubpartSelection(manualGroupedSelection, gradeSubjectPool);
      const finalSelectionWithSharedImages = applySiblingGraphImages(romanGroupedSelection);

      if (!finalSelectionWithSharedImages.length) {
        return { ok: false, message: 'Not enough questions to build this exam.' };
      }

      const totalPossible = finalSelectionWithSharedImages.reduce((sum, q) => sum + (q.marks || 0), 0);
      const exam = {
        type: 'exam',
        id: Date.now(),
        paperYear: 'Custom',
        paperSubject: params.subject,
        paperGrade: params.grade,
        examAttempts: finalSelectionWithSharedImages.map((q) => ({ question: q, submittedAnswer: null, feedback: null })),
        totalScore: 0,
        totalPossible,
        savedAt: new Date().toISOString(),
      };

      const existing = JSON.parse(localStorage.getItem('savedAttempts') || '[]');
      existing.push(exam);
      localStorage.setItem('savedAttempts', JSON.stringify(existing));
      setSavedAttempts(existing);

      setActivePaper({ year: 'Custom', subject: params.subject, grade: params.grade, school: 'Custom', count: finalSelectionWithSharedImages.length });
      setPaperQuestions(finalSelectionWithSharedImages);
      setPaperIndex(0);
      setViewMode('paper');
      const initialGroup = getDisplayGroupAt(finalSelectionWithSharedImages, 0);
      resetForQuestion(mergeGroupForDisplay(initialGroup.group));
      if (params.cognitive) {
        startExamSimulation(params.subject);
      }
      return { ok: true };
    } catch (err) {
      console.error('Failed to initialize custom exam:', err);
      return { ok: false, message: 'Failed to build exam.' };
    } finally {
      setIsInitializingExam(false);
    }
  };

  const goToPaperQuestion = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= paperQuestions.length) return;
    setPaperIndex(nextIndex);
    const { group } = getDisplayGroupAt(paperQuestions, nextIndex);
    resetForQuestion(mergeGroupForDisplay(group));
  };

  const scrollMainContentToTop = () => {
    const contentEl = mainContentScrollRef.current;
    if (contentEl) {
      contentEl.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  };

  const handleNextQuestion = () => {
    if (isPaperMode) {
      const { endIndex } = getDisplayGroupAt(paperQuestions, paperIndex);
      goToPaperQuestion(endIndex);
    } else {
      generateQuestion();
    }
    scrollMainContentToTop();
  };

  // Initial load
  useEffect(() => {
    const loadInitialQuestion = async () => {
      try {
        setLoading(true);
        const response = await fetchWithTimeout(`/api/hsc/questions?grade=${yearLevel}`);
        if (!response.ok) {
          throw new Error(`Failed to load question (${response.status})`);
        }
        const data = await response.json();
        setQuestion(data.question);
      } catch (err) {
        const msg = getFetchErrorMessage(err, 'Failed to load question');
        setError(msg);
        if (isExpectedFetchError(err)) {
          console.warn('Initial question fetch issue:', msg);
        } else {
          console.error('Error loading initial question:', err);
        }
      } finally {
        setLoading(false);
      }
    };

    loadInitialQuestion();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const attempts = JSON.parse(localStorage.getItem('savedAttempts') || '[]');
      setSavedAttempts(attempts);
    } catch (err) {
      console.error('Error loading saved attempts:', err);
    }
  }, []);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const ua = navigator.userAgent || '';
    const isiPad = /iPad/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document);
    setIsIpad(isiPad);
  }, []);

  useEffect(() => {
    const handleOutsideSidebar = (event: TouchEvent | MouseEvent) => {
      const targetNode = event.target as Node | null;
      if (!targetNode) return;
      if (sidebarRef.current && !sidebarRef.current.contains(targetNode)) {
        setSidebarHovered(false);
      }
    };

    document.addEventListener('touchstart', handleOutsideSidebar);
    document.addEventListener('mousedown', handleOutsideSidebar);
    return () => {
      document.removeEventListener('touchstart', handleOutsideSidebar);
      document.removeEventListener('mousedown', handleOutsideSidebar);
    };
  }, []);

  useEffect(() => {
    if (!examEndsAt) {
      setExamRemainingMs(null);
      return;
    }

    const tick = () => {
      const remaining = Math.max(0, examEndsAt - Date.now());
      setExamRemainingMs(remaining);
    };

    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [examEndsAt]);

  useEffect(() => {
    setShowQuestionInfo(false);
  }, [paperIndex, viewMode, question?.id]);

  const awardedMarks = typeof feedback?.score === 'number' ? feedback.score : null;
  const maxMarks = feedback?.maxMarks ?? 0;
  const isMultipleChoiceReview = question?.question_type === 'multiple_choice' || feedback?.mcq_correct_answer;
  const isMarking = appState === 'marking';
  const isPaperMode = viewMode === 'paper';
  const isSidebarOpen = sidebarHovered || isSidebarPinned;
  const [sidebarContentExpanded, setSidebarContentExpanded] = useState(false);

  useEffect(() => {
    if (isSidebarOpen) {
      setSidebarContentExpanded(true);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSidebarContentExpanded(false);
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [isSidebarOpen]);

  const sidebarItemLayoutClass = 'justify-start pl-[21px] pr-4';
  const sidebarItemGapClass = 'gap-3';
  const sidebarTextClass = sidebarContentExpanded ? 'opacity-100 max-w-[140px]' : 'opacity-0 max-w-0 overflow-hidden';
  const sidebarTextTightClass = sidebarContentExpanded ? 'opacity-100 max-w-[120px]' : 'opacity-0 max-w-0 overflow-hidden';
  const sidebarBrandTextClass = sidebarContentExpanded ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0 overflow-hidden';
  const paperProgress = paperQuestions.length ? (paperIndex + 1) / paperQuestions.length : 0;
  const examTimeRemainingLabel = useMemo(() => {
    if (examRemainingMs === null) return null;
    const totalSeconds = Math.max(0, Math.ceil(examRemainingMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }, [examRemainingMs]);

  const viewModeLabel = viewMode === 'dashboard' ? 'Dashboard' : viewMode === 'analytics' ? 'Analytics Hub' : viewMode === 'browse' ? 'Browse Bank' : viewMode === 'builder' ? 'Exam Architect' : viewMode === 'formulas' ? 'Formula Vault' : viewMode === 'saved' ? 'Saved Content' : viewMode === 'history' ? 'My History' : viewMode === 'syllabus' ? 'Syllabus' : viewMode === 'papers' || viewMode === 'paper' ? 'Exam' : viewMode === 'settings' ? 'Settings' : viewMode === 'dev-questions' ? 'Dev Mode' : viewMode === 'logs' ? 'Upload Logs' : String(viewMode).replace(/-/g, ' ');
  const paperDisplayGroups = useMemo(() => {
    const groups: Array<{ startIndex: number; endIndex: number; label: string }> = [];
    if (!paperQuestions.length) return groups;
    let index = 0;
    while (index < paperQuestions.length) {
      const groupInfo = getDisplayGroupAt(paperQuestions, index);
      const firstQuestion = groupInfo.group[0];
      groups.push({
        startIndex: groupInfo.startIndex,
        endIndex: groupInfo.endIndex,
        label: String(firstQuestion?.question_number || groupInfo.startIndex + 1),
      });
      index = groupInfo.endIndex;
    }
    return groups;
  }, [paperQuestions]);
  const activePaperGroupStartIndex = useMemo(() => {
    if (!paperQuestions.length) return -1;
    return getDisplayGroupAt(paperQuestions, paperIndex).startIndex;
  }, [paperQuestions, paperIndex]);

  return (
    <div className="flex h-screen bg-white overflow-hidden font-sans">
      <style jsx global>{`
        body { 
          font-family: 'Inter', sans-serif; 
          background-color: var(--clr-surface);
          color: var(--foreground);
        }
        .latex-list {
          list-style: none;
          padding-left: 0;
          margin: 0.25rem 0;
        }
        .latex-list li {
          margin: 0.25rem 0;
        }
        .latex-list .item-label {
          font-weight: 600;
          margin-right: 0.5rem;
        }
        .latex-table {
          margin: 0.75rem 0;
          overflow-x: auto;
        }
        .latex-table table {
          border-collapse: collapse;
          width: 100%;
        }
        .latex-table td,
        .latex-table th {
          border: 1px solid var(--clr-surface-tonal-a20);
          padding: 0.35rem 0.6rem;
          vertical-align: middle;
        }
      `}</style>

      <InlineQuestionEditorModal
        isOpen={inlineEditDraft != null}
        draft={inlineEditDraft}
        saving={inlineEditSaving}
        allTopics={ALL_TOPICS}
        subjectsByYear={SUBJECTS_BY_YEAR as unknown as Record<string, readonly string[] | string[]>}
        getTopics={getTopics}
        onClose={() => !inlineEditSaving && setInlineEditDraft(null)}
        onSave={saveInlineEdit}
        setDraft={setInlineEditDraft}
      />

      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        <div ref={sidebarRef} className="flex-shrink-0">
          <Sidebar open={isSidebarOpen} setOpen={setSidebarHovered}>
            <SidebarBody className="justify-between gap-0 border-r border-neutral-200 bg-white px-0 py-4 shadow-[4px_0_24px_rgba(0,0,0,0.08)] md:shadow-none">
              <div className="flex h-full flex-col">
                <div className={`mb-2 flex w-full flex-shrink-0 items-center p-3 ${sidebarContentExpanded ? 'gap-2 px-3' : 'justify-center'}`}>
                  <button
                    type="button"
                    onClick={() => setIsSidebarPinned((prev) => !prev)}
                    className="hidden cursor-pointer rounded-lg p-2 transition-colors hover:bg-neutral-100 md:inline-flex"
                    aria-label="Toggle sidebar pin"
                  >
                    <Menu size={18} className="text-neutral-700" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      router.push('/');
                      setSidebarHovered(false);
                    }}
                    className={`flex items-center overflow-hidden transition-all duration-200 cursor-pointer ${sidebarContentExpanded ? 'opacity-100 max-w-[220px]' : 'opacity-0 max-w-0 pointer-events-none md:pointer-events-auto md:opacity-100 md:max-w-[2rem]'}`}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-neutral-900 font-serif text-lg italic text-white">∑</div>
                    <span className={`ml-2 whitespace-nowrap font-bold tracking-tight text-neutral-800 transition-all duration-200 ${sidebarBrandTextClass}`}>
                      Praxis <span className="font-light text-neutral-400">AI</span>
                    </span>
                  </button>
                </div>

                <nav className="custom-scrollbar flex-1 space-y-0 overflow-y-auto overflow-x-hidden">
                  <button onClick={() => { setViewMode('dashboard'); router.push('/dashboard'); setSidebarHovered(false); }} className={`w-full flex items-center py-4 transition-all duration-200 text-left cursor-pointer shrink-0 ${sidebarItemLayoutClass} ${sidebarItemGapClass} ${viewMode === 'dashboard' ? 'sidebar-link-active font-semibold' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'}`}>
              <LayoutDashboard size={18} className="shrink-0" />
              <span className={`text-sm tracking-wide whitespace-nowrap transition-all duration-200 ${sidebarTextClass}`}>Dashboard</span>
            </button>
            <button onClick={() => { setViewMode('browse'); router.push('/dashboard/browse'); setSidebarHovered(false); }} className={`w-full flex items-center py-4 transition-all duration-200 text-left cursor-pointer shrink-0 ${sidebarItemLayoutClass} ${sidebarItemGapClass} ${viewMode === 'browse' ? 'sidebar-link-active font-semibold' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'}`}>
              <BookOpen size={18} className="shrink-0" />
              <span className={`text-sm tracking-wide whitespace-nowrap transition-all duration-200 ${sidebarTextClass}`}>Browse Bank</span>
            </button>
            <button onClick={() => { setViewMode('analytics'); router.push('/dashboard/analytics'); setSidebarHovered(false); }} className={`w-full flex items-center py-4 transition-all duration-200 text-left cursor-pointer shrink-0 ${sidebarItemLayoutClass} ${sidebarItemGapClass} ${viewMode === 'analytics' ? 'sidebar-link-active font-semibold' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'}`}>
              <LineChart size={18} className="shrink-0" />
              <span className={`text-sm tracking-wide whitespace-nowrap transition-all duration-200 ${sidebarTextClass}`}>Analytics Hub</span>
            </button>
            <button onClick={() => { setViewMode('builder'); clearPaperState(); router.push('/dashboard/builder'); setSidebarHovered(false); }} className={`w-full flex items-center py-4 transition-all duration-200 text-left cursor-pointer shrink-0 ${sidebarItemLayoutClass} ${sidebarItemGapClass} ${viewMode === 'builder' ? 'sidebar-link-active font-semibold' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'}`}>
              <PlusCircle size={18} className="shrink-0" />
              <span className={`text-sm tracking-wide whitespace-nowrap transition-all duration-200 ${sidebarTextClass}`}>Exam Architect</span>
            </button>
            <button onClick={() => { setViewMode('formulas'); router.push('/dashboard/formulas'); setSidebarHovered(false); }} className={`w-full flex items-center py-4 transition-all duration-200 text-left cursor-pointer shrink-0 ${sidebarItemLayoutClass} ${sidebarItemGapClass} ${viewMode === 'formulas' ? 'sidebar-link-active font-semibold' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'}`}>
              <Sigma size={18} className="shrink-0" />
              <span className={`text-sm tracking-wide whitespace-nowrap transition-all duration-200 ${sidebarTextClass}`}>Formula Vault</span>
            </button>
            <button onClick={() => { loadSavedAttempts(); setViewMode('saved'); router.push('/dashboard/saved'); setSidebarHovered(false); }} className={`w-full flex items-center py-4 transition-all duration-200 text-left cursor-pointer shrink-0 ${sidebarItemLayoutClass} ${sidebarItemGapClass} ${viewMode === 'saved' ? 'sidebar-link-active font-semibold' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'}`}>
              <Bookmark size={18} className="shrink-0" />
              <span className={`text-sm tracking-wide whitespace-nowrap transition-all duration-200 ${sidebarTextClass}`}>Saved Content</span>
              {savedAttempts.length > 0 && sidebarContentExpanded && <span className="text-xs text-neutral-400">({savedAttempts.length})</span>}
            </button>
            <button onClick={() => { setViewMode('history'); router.push('/dashboard/history'); setSidebarHovered(false); }} className={`w-full flex items-center py-4 transition-all duration-200 text-left cursor-pointer shrink-0 ${sidebarItemLayoutClass} ${sidebarItemGapClass} ${viewMode === 'history' ? 'sidebar-link-active font-semibold' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'}`}>
              <History size={18} className="shrink-0" />
              <span className={`text-sm tracking-wide whitespace-nowrap transition-all duration-200 ${sidebarTextClass}`}>My History</span>
            </button>
            {viewMode === 'saved' && savedAttempts.length > 0 && sidebarContentExpanded && (
              <div className="space-y-0 px-2 pb-2">
                {savedAttempts.map((attempt) => (
                  <button key={attempt.id} onClick={() => { setSelectedAttempt(attempt); setSidebarHovered(false); }} className={`w-full text-left p-3 rounded-lg transition-colors text-sm cursor-pointer ${selectedAttempt?.id === attempt.id ? 'bg-neutral-100 text-neutral-900 font-medium' : 'text-neutral-600 hover:bg-neutral-50'}`}>
                    <div className="font-medium truncate">{attempt.subject}</div>
                    <div className="text-xs text-neutral-400 truncate">{attempt.topic}</div>
                    <div className="text-xs mt-1 text-neutral-400">{attempt.marks}m • {new Date(attempt.savedAt).toLocaleDateString()}</div>
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => { setViewMode('syllabus'); router.push('/dashboard/syllabus'); setSidebarHovered(false); }} className={`w-full flex items-center py-4 transition-all duration-200 text-left cursor-pointer shrink-0 ${sidebarItemLayoutClass} ${sidebarItemGapClass} ${viewMode === 'syllabus' ? 'sidebar-link-active font-semibold' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'}`}>
              <FileText size={18} className="shrink-0" />
              <span className={`text-sm tracking-wide whitespace-nowrap transition-all duration-200 ${sidebarTextClass}`}>Syllabus</span>
            </button>
            <div className="mt-auto border-t border-neutral-100">
              {isDevMode && (
                <button onClick={() => { setViewMode('dev-questions'); router.push('/dashboard/dev-questions'); setSidebarHovered(false); }} className={`w-full flex items-center py-4 text-left cursor-pointer text-amber-700 bg-amber-50 hover:bg-amber-100 font-medium text-sm shrink-0 ${sidebarItemLayoutClass} ${sidebarItemGapClass}`}>
                  <FileText size={18} className="shrink-0" />
                  <span className={`text-sm whitespace-nowrap transition-all duration-200 ${sidebarTextTightClass}`}>Dev Mode ON</span>
                </button>
              )}
              {isDevMode && (
                <button onClick={() => { setViewMode('logs'); router.push('/dashboard/logs'); setSidebarHovered(false); }} className={`w-full flex items-center py-4 text-left cursor-pointer shrink-0 ${sidebarItemLayoutClass} ${sidebarItemGapClass} ${viewMode === 'logs' ? 'text-amber-800 bg-amber-100 font-semibold' : 'text-amber-700 bg-amber-50 hover:bg-amber-100 font-medium text-sm'}`}>
                  <ScrollText size={18} className="shrink-0" />
                  <span className={`text-sm whitespace-nowrap transition-all duration-200 ${sidebarTextTightClass}`}>Upload Logs</span>
                </button>
              )}
              <button onClick={() => { setViewMode('settings'); router.push('/dashboard/settings'); setSidebarHovered(false); }} className={`w-full flex items-center py-4 transition-all duration-200 text-left cursor-pointer shrink-0 ${sidebarItemLayoutClass} ${sidebarItemGapClass} ${viewMode === 'settings' ? 'sidebar-link-active font-semibold' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'}`}>
                <Settings size={18} className="shrink-0" />
                <span className={`text-sm tracking-wide whitespace-nowrap transition-all duration-200 ${sidebarTextClass}`}>Settings</span>
              </button>
            </div>
                </nav>
              </div>
            </SidebarBody>
          </Sidebar>
        </div>

        {/* Main Content */}
        <main className="flex-1 flex min-w-0 flex-col overflow-hidden relative bg-white">
          <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-0" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
          <header className="h-16 border-b border-neutral-100 flex items-center justify-between px-4 lg:px-8 bg-white/80 backdrop-blur-md z-10 flex-shrink-0">
            <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-widest">{viewModeLabel}</h2>
            <div className="flex items-center gap-4">
              <div className="relative group hidden md:block">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input type="text" placeholder="Search..." className="pl-10 pr-4 py-2 bg-neutral-50 border border-neutral-100 rounded-full text-sm focus:outline-none focus:ring-1 focus:ring-[#b5a45d] w-48 lg:w-64 transition-all text-neutral-800" />
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-50 rounded-full border border-neutral-100">
                <Zap size={14} className="text-amber-500 fill-amber-500" />
                <span className="text-xs font-bold text-neutral-700">HSC</span>
              </div>
            </div>
          </header>
          <div ref={mainContentScrollRef} className={`flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar z-10 relative ${viewMode === 'paper' && showPaperQuestionNavigator ? 'lg:pr-[22rem]' : ''}`}>
            <div className={`${viewMode === 'paper' ? 'max-w-[68rem] mx-auto w-full space-y-8 lg:translate-x-2' : 'max-w-5xl mx-auto space-y-8'}`}>
              {viewMode === 'dashboard' && (
                <DashboardView
                  setViewMode={setViewMode}
                  heatmapCells={heatmapCells}
                  studyStreak={studyStreak}
                  studentName={userName}
                  heatmapMonth={heatmapMonth}
                  heatmapYear={heatmapYear}
                  onHeatmapMonthChange={(month) => setHeatmapMonth(month)}
                />
              )}
              {viewMode === 'analytics' && (
                <AnalyticsHubView
                  topicStats={topicStats}
                  analyticsSummary={analyticsSummary}
                  analyticsLoading={analyticsLoading}
                  analyticsError={analyticsError}
                  onGenerateSummary={requestAnalyticsSummary}
                  onSelectTopic={setSyllabusTopic}
                  selectedTopic={syllabusTopic}
                  onCloseTopic={() => setSyllabusTopic(null)}
                  onOpenSyllabus={() => {
                    setSyllabusTopic(null);
                    setViewMode('syllabus');
                  }}
                />
              )}
              {viewMode === 'browse' && (
                <BrowseView
                  setViewMode={setViewMode}
                  availablePapers={browseAvailablePapers}
                  loadingQuestions={browseLoadingQuestions}
                  onSelectSubject={fetchBrowseQuestionsForSubject}
                  startPaperAttempt={startPaperAttempt}
                />
              )}
              {viewMode === 'builder' && (
                <ExamBuilderView
                  onInitializeExam={initializeCustomExam}
                  isInitializing={isInitializingExam}
                />
              )}
              {viewMode === 'formulas' && <FormulaVaultView setViewMode={setViewMode} />}
              {viewMode === 'history' && <HistoryView />}
              {viewMode === 'paper' && (
                <>
                  {/* Exam Review Mode: one question at a time */}
                  {examEnded && examReviewMode && examAttempts.length > 0 ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <button
                          onClick={() => { setExamReviewMode(false); }}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium cursor-pointer"
                          style={{
                            backgroundColor: 'var(--clr-surface-a10)',
                            borderColor: 'var(--clr-surface-tonal-a20)',
                            color: 'var(--clr-primary-a50)',
                          }}
                        >
                          <ArrowLeft className="w-4 h-4" />
                          Back to Overview
                        </button>
                        <span className="text-sm font-medium" style={{ color: 'var(--clr-surface-a40)' }}>
                          Question {examReviewIndex + 1} of {examAttempts.length}
                        </span>
                      </div>
                      <div className="flex gap-6">
                        <aside
                          className="w-52 flex-shrink-0 rounded-xl border p-3 space-y-1 overflow-y-auto max-h-[70vh]"
                          style={{
                            backgroundColor: 'var(--clr-surface-a10)',
                            borderColor: 'var(--clr-surface-tonal-a20)',
                          }}
                        >
                          <p className="text-xs font-bold uppercase tracking-widest mb-2 px-2" style={{ color: 'var(--clr-surface-a40)' }}>Questions</p>
                          {examAttempts.map((_, i) => (
                            <button
                              key={i}
                              onClick={() => setExamReviewIndex(i)}
                              className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition cursor-pointer"
                              style={{
                                backgroundColor: examReviewIndex === i ? 'var(--clr-primary-a0)' : 'transparent',
                                color: examReviewIndex === i ? 'var(--clr-dark-a0)' : 'var(--clr-primary-a50)',
                              }}
                            >
                              Question {i + 1}
                              {examAttempts[i]?.feedback != null && (
                                <span className="ml-1 text-xs opacity-80">
                                  ({typeof examAttempts[i].feedback?.score === 'number' ? examAttempts[i].feedback.score : '—'}/{examAttempts[i].question?.marks ?? 0})
                                </span>
                              )}
                            </button>
                          ))}
                        </aside>
                        <div className="flex-1 min-w-0">
                          {(() => {
                            const attempt = examAttempts[examReviewIndex];
                            if (!attempt) return null;
                            const revQuestion = attempt.question;
                            const revFeedback = attempt.feedback;
                            const revSubmitted = attempt.submittedAnswer;
                            const isMcq = revQuestion?.question_type === 'multiple_choice';
                            const revAwarded = typeof revFeedback?.score === 'number' ? revFeedback.score : null;
                            const revMax = revFeedback?.maxMarks ?? revQuestion?.marks ?? 0;
                            const revCriteriaText = revFeedback?.marking_criteria ?? revQuestion?.marking_criteria ?? null;
                            return (
                              <div
                                className="rounded-2xl overflow-hidden border shadow-2xl"
                                style={{
                                  backgroundColor: 'var(--clr-surface-a10)',
                                  borderColor: 'var(--clr-surface-tonal-a20)',
                                }}
                              >
                                {/* Report Header (same as generator) */}
                                <div
                                  className="p-6 border-b flex flex-wrap items-center justify-between gap-6"
                                  style={{
                                    backgroundColor: 'var(--clr-surface-a0)',
                                    borderColor: 'var(--clr-surface-tonal-a20)',
                                  }}
                                >
                                  <div>
                                    <h3 className="text-xl font-bold flex items-center gap-2" style={{ color: '#1a1a1a' }}>
                                      {revFeedback ? (
                                        revAwarded === 0 ? (
                                          <XCircle className="w-6 h-6" style={{ color: 'var(--clr-danger-a10)' }} />
                                        ) : revAwarded !== null && revAwarded < revMax ? (
                                          <CheckCircle2 className="w-6 h-6" style={{ color: 'var(--clr-warning-a10)' }} />
                                        ) : (
                                          <CheckCircle2 className="w-6 h-6" style={{ color: 'var(--clr-success-a10)' }} />
                                        )
                                      ) : null}
                                      {revFeedback ? 'Marking Complete' : 'Marking…'}
                                    </h3>
                                    <p className="text-sm mt-1" style={{ color: '#525252' }}>Assessed against NESA Guidelines</p>
                                  </div>
                                  <div className="flex items-center gap-6">
                                    <div className="text-right">
                                      <span className="block text-xs font-bold uppercase tracking-widest" style={{ color: '#404040' }}>Score</span>
                                      <div className="flex items-baseline gap-1 justify-end">
                                        <span className="text-4xl font-bold" style={{ color: '#1a1a1a' }}>{revAwarded === null ? '--' : revAwarded}</span>
                                        <span className="text-xl font-medium" style={{ color: '#404040' }}>/{revMax}</span>
                                      </div>
                                      {isMcq && revFeedback && (
                                        <div className="mt-2 text-xs space-y-1">
                                          <div style={{ color: '#525252' }}>Selected: <strong style={{ color: '#1a1a1a' }}>{revFeedback.mcq_selected_answer ?? revSubmitted ?? '-'}</strong></div>
                                          <div style={{ color: '#525252' }}>Correct: <strong style={{ color: 'var(--clr-success-a0)' }}>{revFeedback.mcq_correct_answer ?? revQuestion?.mcq_correct_answer ?? '-'}</strong></div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Question */}
                                <div className="p-6 border-b" style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                  <div className="flex items-center justify-between gap-2 mb-2">
                                    <h4 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--clr-surface-a40)' }}>Question</h4>
                                    {isDevMode && revQuestion?.id && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          // Prefer editing the underlying raw DB row by id (avoid saving merged display payloads)
                                          const canonical =
                                            allQuestions.find((q) => q?.id === revQuestion.id) ||
                                            paperQuestions.find((q) => q?.id === revQuestion.id) ||
                                            revQuestion;
                                          openInlineQuestionEditor(canonical);
                                        }}
                                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                        Edit
                                      </button>
                                    )}
                                  </div>
                                  <div
                                    className="font-serif rounded-lg border p-3"
                                    style={{ color: 'var(--clr-primary-a50)', borderColor: 'var(--clr-surface-tonal-a20)' }}
                                  >
                                    <QuestionTextWithDividers text={revQuestion?.question_text || ''} />
                                  </div>
                                </div>

                                {/* AI Feedback / MCQ Explanation */}
                                {revFeedback && (
                                  <div
                                    className="p-6 border-b"
                                    style={{
                                      backgroundColor: 'var(--clr-surface-a10)',
                                      borderColor: 'var(--clr-surface-tonal-a20)',
                                    }}
                                  >
                                    <h4 className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: 'var(--clr-surface-a40)' }}>
                                      <TrendingUp className="w-4 h-4" />
                                      {isMcq ? 'Answer Explanation' : 'AI Feedback'}
                                    </h4>
                                    <div className="text-base leading-relaxed space-y-3 text-neutral-800">
                                      {isMcq ? (
                                        revFeedback.mcq_explanation ? (
                                          <LatexText text={stripOuterBraces(revFeedback.mcq_explanation)} />
                                        ) : (
                                          <p className="italic text-neutral-600">Explanation not available.</p>
                                        )
                                      ) : revFeedback.ai_evaluation ? (
                                        <LatexText text={revFeedback.ai_evaluation} />
                                      ) : revFeedback._error ? (
                                        <p className="italic" style={{ color: 'var(--clr-danger-a10)' }}>Marking failed. Please try again later.</p>
                                      ) : (
                                        <p className="italic text-neutral-600">AI evaluation is being processed...</p>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Marking Criteria (table, same as generator) */}
                                {!isMcq && revCriteriaText && (
                                  <div
                                    className="p-6 border-b"
                                    style={{
                                      backgroundColor: 'var(--clr-surface-a10)',
                                      borderColor: 'var(--clr-surface-tonal-a20)',
                                    }}
                                  >
                                    <h4 className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: 'var(--clr-surface-a40)' }}>
                                      <CheckCircle2 className="w-4 h-4" />
                                      Marking Criteria
                                    </h4>
                                    <div className="overflow-x-auto">
                                      <table className="w-full">
                                        <thead>
                                          <tr className="border-b" style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                            <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--clr-surface-a40)' }}>Criteria</th>
                                            <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wider w-24" style={{ color: 'var(--clr-surface-a40)' }}>Marks</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {(() => {
                                            const items = parseCriteriaForDisplay(revCriteriaText);
                                            const rows: React.ReactNode[] = [];
                                            let lastSubpart: string | null = null;
                                            items.forEach((item, idx) => {
                                              if (item.type === 'heading') {
                                                lastSubpart = null;
                                                rows.push(
                                                  <tr key={`part-${item.key}-${idx}`} className="border-b" style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                                    <td colSpan={2} className="py-3 px-3 font-semibold" style={{ color: 'var(--clr-primary-a50)' }}>{item.text}</td>
                                                  </tr>
                                                );
                                                return;
                                              }
                                              if (item.subpart && item.subpart !== lastSubpart) {
                                                lastSubpart = item.subpart;
                                                rows.push(
                                                  <tr key={`subpart-${item.subpart}-${idx}`} className="border-b" style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                                    <td colSpan={2} className="py-2 px-3 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--clr-surface-a40)' }}>Part ({item.subpart})</td>
                                                  </tr>
                                                );
                                              }
                                              rows.push(
                                                <tr key={`${item.key}-${idx}`} className="border-b" style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                                  <td className="py-3 px-3 text-neutral-800"><LatexText text={item.text} /></td>
                                                  <td className="py-3 px-3 text-right font-mono font-bold" style={{ color: 'var(--clr-success-a20)' }}>{item.marks}</td>
                                                </tr>
                                              );
                                            });
                                            return rows;
                                          })()}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}

                                {/* Sample Solution (written only; MCQ explanation is shown above) */}
                                {!isMcq && (revFeedback?.sample_answer ?? revQuestion?.sample_answer ?? revQuestion?.sample_answer_image) && (
                                  <div
                                    className="p-8 border-t space-y-4"
                                    style={{
                                      backgroundColor: 'var(--clr-surface-a0)',
                                      borderColor: 'var(--clr-surface-tonal-a20)',
                                    }}
                                  >
                                    <h3 className="font-bold text-lg flex items-center gap-2" style={{ color: 'var(--clr-success-a20)' }}>
                                      <BookOpen className="w-5 h-5" />
                                      Sample Solution
                                    </h3>
                                    {(revFeedback?.sample_answer ?? revQuestion?.sample_answer) ? (
                                      <div
                                        className="font-serif text-base leading-relaxed space-y-3 pl-4 border-l-2 text-neutral-800"
                                        style={{ borderColor: 'var(--clr-success-a10)' }}
                                      >
                                        <LatexText text={revFeedback?.sample_answer ?? revQuestion?.sample_answer ?? ''} />
                                      </div>
                                    ) : null}
                                    {revQuestion?.sample_answer_image ? (
                                      <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--clr-success-a10)' }}>
                                        <img src={revQuestion.sample_answer_image} alt="Sample solution" className="w-full h-auto" />
                                      </div>
                                    ) : null}
                                  </div>
                                )}

                                {/* Your Submitted Answer */}
                                {revSubmitted && (
                                  <div
                                    className="p-8 border-t space-y-4"
                                    style={{
                                      backgroundColor: 'var(--clr-surface-a0)',
                                      borderColor: 'var(--clr-surface-tonal-a20)',
                                    }}
                                  >
                                    <h3 className="font-bold text-lg flex items-center gap-2 text-neutral-800">
                                      <Eye className="w-5 h-5" />
                                      Your Submitted Answer
                                    </h3>
                                    <div
                                      className="rounded-lg p-4 border"
                                      style={{
                                        backgroundColor: 'var(--clr-surface-a10)',
                                        borderColor: 'var(--clr-surface-tonal-a20)',
                                      }}
                                    >
                                      {isMcq ? (
                                        <div className="space-y-3">
                                          <p className="text-sm font-semibold text-neutral-700 mb-3">Selected Answer: <span className="text-lg font-bold text-neutral-900">{revSubmitted}</span></p>
                                          {(() => {
                                            const options = [
                                              { label: 'A' as const, text: revQuestion?.mcq_option_a || '', image: revQuestion?.mcq_option_a_image || null },
                                              { label: 'B' as const, text: revQuestion?.mcq_option_b || '', image: revQuestion?.mcq_option_b_image || null },
                                              { label: 'C' as const, text: revQuestion?.mcq_option_c || '', image: revQuestion?.mcq_option_c_image || null },
                                              { label: 'D' as const, text: revQuestion?.mcq_option_d || '', image: revQuestion?.mcq_option_d_image || null },
                                            ];
                                            const selectedOption = options.find(opt => opt.label === revSubmitted);
                                            const correctAnswer = revFeedback?.mcq_correct_answer ?? revQuestion?.mcq_correct_answer;
                                            const correctOption = options.find(opt => opt.label === correctAnswer);
                                            return (
                                              <div className="space-y-2">
                                                {options.map((option) => {
                                                  const isSelected = option.label === revSubmitted;
                                                  const isCorrect = option.label === correctAnswer;
                                                  return (
                                                    <div
                                                      key={option.label}
                                                      className={`rounded-lg border-2 p-3 ${isSelected && isCorrect
                                                        ? 'bg-green-50 border-green-300'
                                                        : isSelected
                                                          ? 'bg-red-50 border-red-300'
                                                          : isCorrect
                                                            ? 'bg-green-50 border-green-200'
                                                            : 'bg-white border-neutral-200'
                                                        }`}
                                                    >
                                                      <div className="flex items-start gap-3">
                                                        <span className={`font-bold text-sm ${isSelected && isCorrect
                                                          ? 'text-green-700'
                                                          : isSelected
                                                            ? 'text-red-700'
                                                            : isCorrect
                                                              ? 'text-green-600'
                                                              : 'text-neutral-600'
                                                          }`}>
                                                          {option.label}.
                                                        </span>
                                                        <div className="flex-1 font-serif text-neutral-800">
                                                          {option.image ? (
                                                            <img src={option.image} alt={`Option ${option.label}`} className="max-w-full object-contain rounded" style={{ maxHeight: `${mcqImageSize}px` }} />
                                                          ) : (
                                                            <LatexText text={stripOuterBraces(option.text)} />
                                                          )}
                                                        </div>
                                                        {isSelected && (
                                                          <span className="text-xs font-semibold px-2 py-1 rounded" style={{ backgroundColor: isCorrect ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: isCorrect ? 'rgb(21, 128, 61)' : 'rgb(153, 27, 27)' }}>
                                                            {isCorrect ? '✓ Correct' : 'Your choice'}
                                                          </span>
                                                        )}
                                                        {!isSelected && isCorrect && (
                                                          <span className="text-xs font-semibold px-2 py-1 rounded bg-green-100 text-green-700">
                                                            Correct
                                                          </span>
                                                        )}
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            );
                                          })()}
                                        </div>
                                      ) : (
                                        <img src={revSubmitted} alt="Your answer" className="w-full rounded" style={{ border: '1px solid var(--clr-surface-tonal-a20)' }} />
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Nav: Previous / Next */}
                                <div className="border-t p-6 flex gap-3" style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                  <button
                                    onClick={() => setExamReviewIndex((i) => Math.max(0, i - 1))}
                                    disabled={examReviewIndex === 0}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                    style={{
                                      backgroundColor: 'var(--clr-surface-a10)',
                                      borderColor: 'var(--clr-surface-tonal-a20)',
                                      color: 'var(--clr-primary-a50)',
                                    }}
                                  >
                                    <ChevronLeft className="w-4 h-4" />
                                    Previous
                                  </button>
                                  <button
                                    onClick={() => setExamReviewIndex((i) => Math.min(examAttempts.length - 1, i + 1))}
                                    disabled={examReviewIndex >= examAttempts.length - 1}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                    style={{
                                      backgroundColor: 'var(--clr-primary-a0)',
                                      borderColor: 'var(--clr-primary-a0)',
                                      color: 'var(--clr-dark-a0)',
                                    }}
                                  >
                                    Next
                                    <ChevronRight className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  ) : examEnded ? (
                    /* Exam Overview */
                    <div className="space-y-6">
                      <div className="flex items-center justify-between gap-3">
                        <button
                          onClick={() => { clearPaperState(); setViewMode('papers'); }}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium cursor-pointer"
                          style={{
                            backgroundColor: 'var(--clr-surface-a10)',
                            borderColor: 'var(--clr-surface-tonal-a20)',
                            color: 'var(--clr-primary-a50)',
                          }}
                        >
                          <ArrowLeft className="w-4 h-4" />
                          Back to Papers
                        </button>
                      </div>
                      <h1 className="text-3xl font-bold" style={{ color: 'var(--clr-primary-a50)' }}>Exam Overview</h1>
                      {(() => {
                        const totalPossible = examAttempts.reduce((sum, a) => sum + (a.question?.marks ?? 0), 0);
                        const totalAwarded = examAttempts.reduce((sum, a) => sum + (typeof a.feedback?.score === 'number' ? a.feedback.score : 0), 0);
                        const pct = totalPossible > 0 ? Math.round((totalAwarded / totalPossible) * 100) : 0;
                        return (
                          <>
                            <div className="grid gap-4 sm:grid-cols-3">
                              <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--clr-surface-a10)', borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--clr-surface-a50)' }}>Total Score</div>
                                <div className="text-2xl font-bold" style={{ color: 'var(--clr-primary-a50)' }}>{totalAwarded} / {totalPossible}</div>
                              </div>
                              <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--clr-surface-a10)', borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--clr-surface-a50)' }}>Percentage</div>
                                <div className="text-2xl font-bold" style={{ color: 'var(--clr-primary-a50)' }}>{pct}%</div>
                              </div>
                            </div>
                            <div>
                              <h3 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--clr-surface-a40)' }}>Marks per question</h3>
                              <ul className="space-y-2">
                                {examAttempts.map((a, i) => (
                                  <li key={i} className="flex items-center justify-between rounded-lg border px-3 py-2" style={{ backgroundColor: 'var(--clr-surface-a10)', borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                    <span style={{ color: 'var(--clr-primary-a50)' }}>Q{i + 1}</span>
                                    <span style={{ color: 'var(--clr-primary-a50)' }}>
                                      {a.feedback ? (typeof a.feedback.score === 'number' ? a.feedback.score : '—') : 'Marking…'}
                                    </span>
                                    <span style={{ color: 'var(--clr-surface-a40)' }}>/ {a.question?.marks ?? 0}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--clr-surface-a10)', borderColor: 'var(--clr-surface-tonal-a20)' }}>
                              <h3 className="text-sm font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--clr-surface-a40)' }}>AI performance evaluation</h3>
                              <p className="text-sm italic" style={{ color: 'var(--clr-surface-a50)' }}>Strengths and weaknesses analysis will appear here in a future update.</p>
                            </div>
                            <div className="flex justify-end gap-3">
                              <button
                                onClick={saveExam}
                                className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold cursor-pointer"
                                style={{
                                  backgroundColor: 'var(--clr-info-a0)',
                                  color: 'var(--clr-light-a0)',
                                }}
                              >
                                <Bookmark className="w-5 h-5" />
                                Save Exam
                              </button>
                              <button
                                onClick={() => { setExamReviewMode(true); setExamReviewIndex(0); }}
                                className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold cursor-pointer"
                                style={{
                                  backgroundColor: 'var(--clr-primary-a0)',
                                  color: 'var(--clr-dark-a0)',
                                }}
                              >
                                <BookOpen className="w-5 h-5" />
                                Review Questions
                              </button>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  ) : isPaperMode && showFinishExamPrompt ? (
                    <div className="rounded-2xl border p-8 text-center space-y-6" style={{ backgroundColor: 'var(--clr-surface-a10)', borderColor: 'var(--clr-surface-tonal-a20)' }}>
                      <p className="text-lg font-medium" style={{ color: 'var(--clr-primary-a50)' }}>You have completed all questions.</p>
                      <p className="text-sm" style={{ color: 'var(--clr-surface-a40)' }}>Click Finish Exam to see your results.</p>
                      <button
                        onClick={endExam}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold cursor-pointer"
                        style={{
                          backgroundColor: 'var(--clr-success-a10)',
                          color: 'var(--clr-light-a0)',
                        }}
                      >
                        Finish Exam
                      </button>
                    </div>
                  ) : (
                    <>
                      {!isPaperMode && (
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                          <div>
                            <h1
                              className="text-4xl font-bold mb-2"
                              style={{ color: 'var(--clr-primary-a50)' }}
                            >HSC Practice Generator</h1>
                            <p
                              className="text-lg"
                              style={{ color: 'var(--clr-surface-a40)' }}
                            >Practice exam-style questions and handwrite your answers.</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={generateQuestion}
                              disabled={isGenerating || loading}
                              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-70 disabled:hover:scale-100 whitespace-nowrap cursor-pointer"
                              style={{
                                backgroundColor: 'var(--clr-primary-a0)',
                                color: 'var(--clr-dark-a0)',
                              }}
                            >
                              <RefreshCw className={`w-5 h-5 ${isGenerating ? 'animate-spin' : ''}`} />
                              {isGenerating ? 'Loading...' : 'Generate'}
                            </button>
                          </div>
                        </div>
                      )}

                      {isPaperMode && (
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            onClick={() => {
                              setViewMode('papers');
                              clearPaperState();
                            }}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition cursor-pointer"
                            style={{
                              backgroundColor: 'var(--clr-surface-a10)',
                              borderColor: 'var(--clr-surface-tonal-a20)',
                              color: 'var(--clr-primary-a50)',
                            }}
                          >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Papers
                          </button>
                          <div className="ml-auto flex items-center gap-2">
                            <div className="text-sm" style={{ color: 'var(--clr-surface-a40)' }}>
                              Question {paperIndex + 1} of {paperQuestions.length}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const { startIndex } = getDisplayGroupAt(paperQuestions, paperIndex);
                                goToPaperQuestion(startIndex - 1);
                              }}
                              disabled={paperIndex === 0}
                              aria-label="Previous question"
                              className="h-10 w-10 inline-flex items-center justify-center rounded-lg border transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                              style={{
                                backgroundColor: 'var(--clr-surface-a10)',
                                borderColor: 'var(--clr-surface-tonal-a20)',
                                color: 'var(--clr-primary-a50)',
                              }}
                            >
                              <ChevronLeft className="w-5 h-5" />
                            </button>
                            <button
                              type="button"
                              onClick={handleNextQuestion}
                              disabled={paperQuestions.length === 0 || getDisplayGroupAt(paperQuestions, paperIndex).endIndex >= paperQuestions.length}
                              aria-label="Next question"
                              className="h-10 w-10 inline-flex items-center justify-center rounded-lg border transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer hover:opacity-90"
                              style={{
                                backgroundColor: 'var(--clr-btn-primary)',
                                borderColor: 'var(--clr-btn-primary-hover)',
                                color: 'var(--clr-btn-primary-text)',
                              }}
                            >
                              <ChevronRight className="w-5 h-5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowPaperQuestionNavigator((prev) => !prev)}
                              className="px-4 py-2 rounded-lg border text-sm font-semibold transition cursor-pointer"
                              style={{
                                backgroundColor: showPaperQuestionNavigator ? 'var(--clr-btn-primary)' : 'var(--clr-surface-a10)',
                                borderColor: showPaperQuestionNavigator ? 'var(--clr-btn-primary-hover)' : 'var(--clr-surface-tonal-a20)',
                                color: showPaperQuestionNavigator ? 'var(--clr-btn-primary-text)' : 'var(--clr-primary-a50)',
                              }}
                            >
                              {showPaperQuestionNavigator ? 'Hide Question List' : 'Show Question List'}
                            </button>
                          </div>
                        </div>
                      )}

                      {isPaperMode && showPaperQuestionNavigator && (
                        <aside
                          className="fixed right-4 top-24 z-40 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border shadow-xl"
                          style={{
                            backgroundColor: 'var(--clr-surface-a0)',
                            borderColor: 'var(--clr-surface-tonal-a20)',
                          }}
                        >
                          <div
                            className="px-4 py-3 border-b text-xs font-bold uppercase tracking-widest"
                            style={{
                              borderColor: 'var(--clr-surface-tonal-a20)',
                              color: 'var(--clr-surface-a40)',
                            }}
                          >
                            Questions ({paperDisplayGroups.length})
                          </div>
                          <div className="max-h-[70vh] overflow-y-auto p-2 space-y-1">
                            {paperDisplayGroups.map((group, idx) => {
                              const isActive = group.startIndex === activePaperGroupStartIndex;
                              return (
                                <button
                                  key={`${group.label}-${group.startIndex}-${idx}`}
                                  type="button"
                                  onClick={() => goToPaperQuestion(group.startIndex)}
                                  className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition cursor-pointer"
                                  style={{
                                    backgroundColor: isActive ? 'var(--clr-btn-primary)' : 'transparent',
                                    color: isActive ? 'var(--clr-btn-primary-text)' : 'var(--clr-primary-a50)',
                                  }}
                                >
                                  Question {group.label}
                                </button>
                              );
                            })}
                          </div>
                        </aside>
                      )}

                      {/* Question Card */}
                      <div className="relative">
                        {isPaperMode && (
                          <div className="absolute right-4 top-4 z-20">
                            <div className="relative">
                              <button
                                type="button"
                                aria-label="Question information"
                                onClick={() => setShowQuestionInfo((prev) => !prev)}
                                className="h-11 w-11 inline-flex items-center justify-center rounded border shadow-sm transition cursor-pointer"
                                style={{
                                  backgroundColor: 'var(--clr-surface-a0)',
                                  borderColor: 'var(--clr-surface-tonal-a20)',
                                  color: 'var(--clr-surface-a50)',
                                }}
                              >
                                <Info className="w-5 h-5" />
                              </button>
                              {showQuestionInfo && question && (
                                <div
                                  className="absolute right-0 top-14 z-30 w-72 rounded-xl border p-4 shadow-xl"
                                  style={{
                                    backgroundColor: 'var(--clr-surface-a0)',
                                    borderColor: 'var(--clr-surface-tonal-a20)',
                                  }}
                                >
                                  <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--clr-surface-a40)' }}>
                                    Question Info
                                  </p>
                                  <div className="space-y-1.5 text-sm" style={{ color: 'var(--clr-primary-a50)' }}>
                                    <p><strong>Number:</strong> {question.question_number || '-'}</p>
                                    <p><strong>Marks:</strong> {question.marks ?? '-'}</p>
                                    <p><strong>Subject:</strong> {question.subject || '-'}</p>
                                    <p><strong>Topic:</strong> {question.topic || '-'}</p>
                                    <p><strong>Subtopic:</strong> {question.subtopic || '-'}</p>
                                    <p><strong>Syllabus Dot Points:</strong> {question.syllabus_dot_point || '-'}</p>
                                    <p><strong>Year:</strong> {question.year || '-'}</p>
                                    <p><strong>Type:</strong> {question.question_type === 'multiple_choice' ? 'Multiple Choice' : 'Written Response'}</p>
                                    <p><strong>Source:</strong> {question.school_name || 'HSC'}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        <div>
                          <div
                            className={`${isPaperMode ? 'paper-question-card rounded-md border p-6 lg:p-10' : 'glass-card rounded-2xl border border-neutral-100 p-6 lg:p-10'} transition-all duration-500 ${isGenerating ? 'blur-sm scale-[0.99] opacity-80' : 'blur-0 scale-100 opacity-100'}`}
                          >
                            {loading ? (
                              <div className="flex items-center justify-center min-h-[300px]">
                                <div className="text-center">
                                  <RefreshCw className="w-8 h-8 text-neutral-400 animate-spin mx-auto mb-2" />
                                  <p className="text-neutral-500">Loading question...</p>
                                </div>
                              </div>
                            ) : error ? (
                              <div className="flex items-center justify-center min-h-[300px]">
                                <div className="text-center">
                                  <p className="text-red-600 font-medium">Error: {error}</p>
                                  <button
                                    onClick={() => (isPaperMode ? goToPaperQuestion(paperIndex) : generateQuestion())}
                                    className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                                  >
                                    Try Again
                                  </button>
                                </div>
                              </div>
                            ) : question ? (
                              <>
                                {isPaperMode ? (
                                  <div className="mb-6">
                                    <div className="exam-question-meta mb-5 flex items-center justify-between gap-3">
                                      <span>{question.marks} marks{question.topic ? ` • ${question.topic}` : ''}</span>
                                      {isDevMode && question.id && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const canonical =
                                              allQuestions.find((q) => q?.id === question.id) ||
                                              paperQuestions.find((q) => q?.id === question.id) ||
                                              question;
                                            openInlineQuestionEditor(canonical);
                                          }}
                                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                                        >
                                          <Edit2 className="w-4 h-4" />
                                          Edit question
                                        </button>
                                      )}
                                    </div>
                                    <div className="exam-question-body text-neutral-900">
                                      <QuestionTextWithDividers text={question.question_text} />
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex flex-col gap-4 border-b border-neutral-100 pb-6 mb-8">
                                      <div className="flex justify-between items-start gap-6">
                                        <div>
                                          <span className="block font-bold text-2xl text-neutral-900">Question {question.question_number || ''}</span>
                                          <span className="text-neutral-600 font-semibold text-lg block">{question.marks} Marks</span>
                                          <span className="text-neutral-500 text-base block mt-1">{question.topic}</span>
                                        </div>
                                        <div className="text-right flex flex-col items-end gap-2">
                                          {isDevMode && question.id && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const canonical =
                                                  allQuestions.find((q) => q?.id === question.id) ||
                                                  paperQuestions.find((q) => q?.id === question.id) ||
                                                  question;
                                                openInlineQuestionEditor(canonical);
                                              }}
                                              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                                            >
                                              <Edit2 className="w-4 h-4" />
                                              Edit question
                                            </button>
                                          )}
                                          <span className="text-lg font-semibold text-neutral-600 block">{question.subject}</span>
                                          <span className="text-neutral-400 font-medium uppercase tracking-widest text-xs block mt-1">
                                            {question.year} {question.school_name || 'HSC'}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="rounded-xl p-4 border" style={{ backgroundColor: 'var(--clr-question-bg)', borderColor: 'var(--clr-question-border)' }}>
                                      <div className="text-lg leading-relaxed space-y-4 font-serif whitespace-pre-wrap text-neutral-800">
                                        <QuestionTextWithDividers text={question.question_text} />
                                      </div>
                                    </div>
                                  </>
                                )}

                                {question.graph_image_data && (
                                  <div className={`${isPaperMode ? 'mt-6 p-0 border-0' : 'mt-4 rounded-xl border p-4'}`} style={isPaperMode ? undefined : { backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                    <img
                                      src={question.graph_image_data}
                                      alt="Question graph"
                                      className={`${isPaperMode ? 'graph-image graph-image--medium' : `rounded-lg border graph-image graph-image--${question.graph_image_size || 'medium'}`}`}
                                      style={isPaperMode ? undefined : { borderColor: 'var(--clr-surface-tonal-a20)' }}
                                    />
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="flex items-center justify-center min-h-[300px]">
                                <p className="text-neutral-500">Loading question…</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Multiple Choice Answer */}
                      {appState === 'idle' && question?.question_type === 'multiple_choice' && (
                        <div
                          className="border rounded-2xl shadow-2xl p-6"
                          style={{
                            backgroundColor: 'var(--clr-surface-a10)',
                            borderColor: 'var(--clr-surface-tonal-a20)',
                          }}
                        >
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <label
                              className="block text-sm font-semibold uppercase tracking-wide"
                              style={{ color: 'var(--clr-surface-a40)' }}
                            >Answer Options</label>
                            {(() => {
                              const hasImages = [question.mcq_option_a_image, question.mcq_option_b_image, question.mcq_option_c_image, question.mcq_option_d_image].some(Boolean);
                              return hasImages ? (
                                <div className="flex items-center gap-2">
                                  <label className="text-xs text-neutral-600">Image size:</label>
                                  <input
                                    type="range"
                                    min="64"
                                    max="512"
                                    step="16"
                                    value={mcqImageSize}
                                    onChange={(e) => setMcqImageSize(Number(e.target.value))}
                                    className="w-24"
                                  />
                                  <span className="text-xs text-neutral-600 w-12">{mcqImageSize}px</span>
                                </div>
                              ) : null;
                            })()}
                          </div>
                          <div className="space-y-3">
                            {([
                              { label: 'A' as const, text: stripOuterBraces(question.mcq_option_a || ''), image: question.mcq_option_a_image || null },
                              { label: 'B' as const, text: stripOuterBraces(question.mcq_option_b || ''), image: question.mcq_option_b_image || null },
                              { label: 'C' as const, text: stripOuterBraces(question.mcq_option_c || ''), image: question.mcq_option_c_image || null },
                              { label: 'D' as const, text: stripOuterBraces(question.mcq_option_d || ''), image: question.mcq_option_d_image || null },
                            ]).map((option) => (
                              <button
                                key={option.label}
                                type="button"
                                onClick={() => setSelectedMcqAnswer(option.label)}
                                className="w-full text-left rounded-xl border px-4 py-3 transition-all cursor-pointer"
                                style={{
                                  backgroundColor: selectedMcqAnswer === option.label
                                    ? 'var(--clr-primary-a0)'
                                    : 'var(--clr-surface-a0)',
                                  borderColor: selectedMcqAnswer === option.label
                                    ? 'var(--clr-primary-a0)'
                                    : 'var(--clr-surface-tonal-a20)',
                                  color: selectedMcqAnswer === option.label
                                    ? 'var(--clr-dark-a0)'
                                    : 'var(--clr-primary-a50)',
                                }}
                              >
                                <div className="flex items-start gap-3">
                                  <span className="font-bold text-sm">{option.label}.</span>
                                  <div className="flex-1 font-serif min-w-0">
                                    {option.image ? (
                                      <img src={option.image} alt={`Option ${option.label}`} className="max-w-full object-contain rounded" style={{ maxHeight: `${mcqImageSize}px`, borderColor: 'var(--clr-surface-tonal-a20)' }} />
                                    ) : (
                                      <LatexText text={option.text || ''} />
                                    )}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => submitAnswer()}
                            disabled={isMarking}
                            className="mt-4 w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition text-sm disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer hover:opacity-90"
                            style={{
                              backgroundColor: isMarking ? 'var(--clr-surface-a30)' : 'var(--clr-btn-success)',
                              color: isMarking ? 'var(--clr-surface-a50)' : 'var(--clr-btn-success-text)',
                              border: isMarking ? undefined : '1px solid var(--clr-btn-success-hover)',
                            }}
                          >
                            {isMarking ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                            {isMarking ? 'Submitting...' : 'Submit Answer'}
                          </button>
                        </div>
                      )}

                      {/* Drawing Canvas */}
                      {appState === 'idle' && question?.question_type !== 'multiple_choice' && (
                        <div
                          className="border rounded-2xl shadow-2xl p-4"
                          style={{
                            backgroundColor: 'var(--clr-surface-a10)',
                            borderColor: 'var(--clr-surface-tonal-a20)',
                          }}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                            <label
                              className="text-sm font-semibold uppercase tracking-wide"
                              style={{ color: 'var(--clr-surface-a40)' }}
                            >Answer Area</label>
                            {isIpad && (
                              <span className="text-xs" style={{ color: 'var(--clr-surface-a50)' }}>
                                Use two fingers to scroll.
                              </span>
                            )}
                          </div>
                          {/* Excalidraw answer area (toolbar and controls handled by Excalidraw itself) */}
                          <div
                            className="rounded-xl bg-white border border-neutral-100"
                            style={{ touchAction: 'none' }}
                            onTouchMove={(e) => {
                              if (isIpad && e.touches.length < 2) {
                                e.preventDefault();
                              }
                            }}
                          >
                            <div
                              style={{
                                height: `${canvasHeight}px`,
                              }}
                            >
                              <Excalidraw
                                theme="light"
                                initialData={{
                                  appState: {
                                    currentItemStrokeWidth: 1,
                                  },
                                }}
                                excalidrawAPI={(api) => {
                                  excalidrawApiRef.current = api;
                                }}
                                onChange={(
                                  elements: readonly ExcalidrawElement[],
                                  appState: ExcalidrawAppState,
                                  files: BinaryFiles
                                ) => {
                                  excalidrawSceneRef.current = {
                                    elements,
                                    appState,
                                    files,
                                  };
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Canvas Controls: Upload + Submit (below answer area) */}
                      {appState === 'idle' && question?.question_type !== 'multiple_choice' && (
                        <div className="flex flex-col sm:flex-row gap-3">
                          <div className="flex gap-2 sm:ml-auto">
                            <label
                              className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition cursor-pointer text-sm"
                              style={{
                                backgroundColor: 'var(--clr-surface-a20)',
                                color: 'var(--clr-primary-a50)',
                              }}
                            >
                              <Upload className="w-4 h-4" />
                              <span>Upload</span>
                              <input
                                type="file"
                                hidden
                                accept="image/*"
                                onChange={uploadImage}
                              />
                            </label>

                            <button
                              onClick={() => submitAnswer()}
                              disabled={isMarking}
                              className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold transition text-sm flex-1 sm:flex-none justify-center disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer hover:opacity-90"
                              style={{
                                backgroundColor: isMarking ? 'var(--clr-surface-a30)' : 'var(--clr-btn-success)',
                                color: isMarking ? 'var(--clr-surface-a50)' : 'var(--clr-btn-success-text)',
                                border: isMarking ? undefined : '1px solid var(--clr-btn-success-hover)',
                              }}
                            >
                              {isMarking ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <Send className="w-4 h-4" />
                              )}
                              {isMarking ? 'Submitting...' : 'Submit'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Action Toolbar */}
                      {appState === 'idle' && !examConditionsActive && (
                        <div
                          className="flex flex-wrap items-center justify-between gap-4 backdrop-blur-md p-4 rounded-2xl border"
                          style={{
                            backgroundColor: 'var(--clr-surface-a10)',
                            borderColor: 'var(--clr-surface-tonal-a20)',
                          }}
                        >
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={() => setShowAnswer(!showAnswer)}
                              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium text-sm cursor-pointer"
                              style={{
                                backgroundColor: 'var(--clr-surface-a20)',
                                color: 'var(--clr-primary-a50)',
                              }}
                            >
                              <Eye className="w-4 h-4" />
                              {showAnswer ? 'Hide' : 'Show'} Solution
                            </button>
                            {isPaperMode && (
                              <>
                                <button
                                  onClick={() => exportPaperPdf(false)}
                                  disabled={exportingPaperPdf !== null}
                                  className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                  style={{
                                    backgroundColor: 'var(--clr-surface-a20)',
                                    color: 'var(--clr-primary-a50)',
                                  }}
                                >
                                  <Download className="w-4 h-4" />
                                  {exportingPaperPdf === 'exam' ? 'Exporting Exam PDF…' : 'Export Exam PDF'}
                                </button>
                                <button
                                  onClick={() => exportPaperPdf(true)}
                                  disabled={exportingPaperPdf !== null}
                                  className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                  style={{
                                    backgroundColor: 'var(--clr-btn-primary)',
                                    color: 'var(--clr-btn-primary-text)',
                                    border: '1px solid var(--clr-btn-primary-hover)',
                                  }}
                                >
                                  <Download className="w-4 h-4" />
                                  {exportingPaperPdf === 'solutions' ? 'Exporting Solutions PDF…' : 'Export Exam + Solutions PDF'}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Marking State */}
                      {appState === 'marking' && (
                        <div
                          className="rounded-2xl p-8 shadow-2xl border flex items-center justify-center"
                          style={{
                            backgroundColor: 'var(--clr-surface-a10)',
                            borderColor: 'var(--clr-surface-tonal-a20)',
                          }}
                        >
                          <div className="text-center">
                            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: 'var(--clr-surface-a40)' }} />
                            <p className="text-lg" style={{ color: 'var(--clr-surface-a40)' }}>
                              Submitting for marking...
                            </p>
                            <p className="text-sm mt-1" style={{ color: 'var(--clr-surface-a50)' }}>
                              Please wait while we assess your response.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Solution Panel */}
                      {showAnswer && appState === 'idle' && (
                        <div
                          className="rounded-2xl p-8 shadow-2xl relative overflow-hidden border"
                          style={{
                            backgroundColor: 'var(--clr-surface-a10)',
                            borderColor: 'var(--clr-success-a10)',
                          }}
                        >
                          <div
                            className="absolute top-0 left-0 w-1 h-full"
                            style={{ backgroundColor: 'var(--clr-success-a10)' }}
                          />
                          <h3
                            className="font-bold text-xl mb-4"
                            style={{ color: 'var(--clr-success-a20)' }}
                          >Sample Solution</h3>
                          <div className="font-serif text-lg leading-relaxed space-y-4 text-neutral-800">
                            {question?.question_type === 'multiple_choice' ? (
                              <>
                                {question.mcq_correct_answer && (
                                  <p className="font-semibold">Correct Answer: {question.mcq_correct_answer}</p>
                                )}
                                {question.mcq_explanation ? (
                                  <LatexText text={stripOuterBraces(question.mcq_explanation)} />
                                ) : (
                                  <p className="text-sm italic" style={{ color: 'var(--clr-surface-a40)' }}>
                                    Explanation not available.
                                  </p>
                                )}
                              </>
                            ) : question?.sample_answer || question?.sample_answer_image ? (
                              <>
                                {question.sample_answer ? <LatexText text={question.sample_answer} /> : null}
                                {question.sample_answer_image ? (
                                  <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--clr-success-a10)' }}>
                                    <img src={question.sample_answer_image} alt="Sample solution" className="w-full h-auto" />
                                  </div>
                                ) : null}
                              </>
                            ) : (
                              <>
                                <p>A detailed solution will appear here. Use this as a guide to check your working and understanding.</p>
                                <p
                                  className="text-sm italic"
                                  style={{ color: 'var(--clr-surface-a40)' }}
                                >Use Next Question to see more.</p>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Reviewed Feedback */}
                      {appState === 'reviewed' && feedback && !examConditionsActive && (
                        <div className="animate-fade-in space-y-4">

                          {/* Marking Report Card */}
                          <div
                            className="rounded-2xl overflow-hidden border shadow-2xl"
                            style={{
                              backgroundColor: 'var(--clr-surface-a10)',
                              borderColor: 'var(--clr-surface-tonal-a20)',
                            }}
                          >

                            {/* Report Header */}
                            <div
                              className="p-6 border-b flex flex-wrap items-center justify-between gap-6"
                              style={{
                                backgroundColor: 'var(--clr-surface-a0)',
                                borderColor: 'var(--clr-surface-tonal-a20)',
                              }}
                            >
                              <div>
                                <h3
                                  className="text-xl font-bold flex items-center gap-2"
                                  style={{ color: '#1a1a1a' }}
                                >
                                  {awardedMarks === 0 ? (
                                    <XCircle className="w-6 h-6" style={{ color: 'var(--clr-danger-a10)' }} />
                                  ) : awardedMarks !== null && awardedMarks < maxMarks ? (
                                    <CheckCircle2 className="w-6 h-6" style={{ color: 'var(--clr-warning-a10)' }} />
                                  ) : (
                                    <CheckCircle2 className="w-6 h-6" style={{ color: 'var(--clr-success-a10)' }} />
                                  )}
                                  Marking Complete
                                </h3>
                                <p
                                  className="text-sm mt-1"
                                  style={{ color: '#525252' }}
                                >Assessed against NESA Guidelines</p>
                              </div>

                              <div className="flex items-center gap-6">
                                <div className="text-right">
                                  <span
                                    className="block text-xs font-bold uppercase tracking-widest"
                                    style={{ color: '#404040' }}
                                  >Score</span>
                                  <div className="flex items-baseline gap-1 justify-end">
                                    <span
                                      className="text-4xl font-bold"
                                      style={{ color: '#1a1a1a' }}
                                    >{awardedMarks === null ? '--' : awardedMarks}</span>
                                    <span
                                      className="text-xl font-medium"
                                      style={{ color: '#404040' }}
                                    >/{maxMarks}</span>
                                  </div>
                                  {isMultipleChoiceReview && (
                                    <div className="mt-2 text-xs" style={{ color: '#525252' }}>
                                      <div>Selected: <strong style={{ color: '#1a1a1a' }}>{feedback?.mcq_selected_answer || submittedAnswer || '-'}</strong></div>
                                      <div>Correct: <strong style={{ color: 'var(--clr-success-a0)' }}>{feedback?.mcq_correct_answer || question?.mcq_correct_answer || '-'}</strong></div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* AI Feedback / MCQ Explanation Section */}
                            <div
                              className="p-6 border-b"
                              style={{
                                backgroundColor: 'var(--clr-surface-a10)',
                                borderColor: 'var(--clr-surface-tonal-a20)',
                              }}
                            >
                              <h4
                                className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2"
                                style={{ color: 'var(--clr-surface-a40)' }}
                              >
                                <TrendingUp className="w-4 h-4" />
                                {isMultipleChoiceReview ? 'Answer Explanation' : 'AI Feedback'}
                              </h4>
                              <div
                                className="text-base leading-relaxed space-y-3"
                                style={{ color: 'var(--clr-primary-a50)' }}
                              >
                                {isMultipleChoiceReview ? (
                                  feedback?.mcq_explanation ? (
                                    <LatexText text={stripOuterBraces(feedback.mcq_explanation)} />
                                  ) : (
                                    <p className="italic" style={{ color: 'var(--clr-surface-a50)' }}>Explanation not available.</p>
                                  )
                                ) : feedback.ai_evaluation ? (
                                  <LatexText text={feedback.ai_evaluation} />
                                ) : (
                                  <p
                                    className="italic"
                                    style={{ color: 'var(--clr-surface-a50)' }}
                                  >AI evaluation is being processed...</p>
                                )}
                              </div>
                            </div>

                            {/* Marking Criteria Section */}
                            {!isMultipleChoiceReview && (
                              <div
                                className="p-6 border-b"
                                style={{
                                  backgroundColor: 'var(--clr-surface-a10)',
                                  borderColor: 'var(--clr-surface-tonal-a20)',
                                }}
                              >
                                <h4
                                  className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2"
                                  style={{ color: 'var(--clr-surface-a40)' }}
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  Marking Criteria
                                </h4>
                                <div className="overflow-x-auto">
                                  <table className="w-full">
                                    <thead>
                                      <tr
                                        className="border-b"
                                        style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}
                                      >
                                        <th
                                          className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wider"
                                          style={{ color: 'var(--clr-surface-a40)' }}
                                        >Criteria</th>
                                        <th
                                          className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wider w-24"
                                          style={{ color: 'var(--clr-surface-a40)' }}
                                        >Marks</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(() => {
                                        const criteriaText = feedback.marking_criteria;
                                        const items = parseCriteriaForDisplay(criteriaText);
                                        const rows: React.ReactNode[] = [];
                                        let lastSubpart: string | null = null;

                                        items.forEach((item, idx) => {
                                          if (item.type === 'heading') {
                                            lastSubpart = null;
                                            rows.push(
                                              <tr key={`part-${item.key}-${idx}`} className="border-b" style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                                <td colSpan={2} className="py-3 px-3 font-semibold" style={{ color: 'var(--clr-primary-a50)' }}>
                                                  {item.text}
                                                </td>
                                              </tr>
                                            );
                                            return;
                                          }

                                          if (item.subpart && item.subpart !== lastSubpart) {
                                            lastSubpart = item.subpart;
                                            rows.push(
                                              <tr key={`subpart-${item.subpart}-${idx}`} className="border-b" style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                                <td colSpan={2} className="py-2 px-3 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--clr-surface-a40)' }}>
                                                  Part ({item.subpart})
                                                </td>
                                              </tr>
                                            );
                                          }

                                          rows.push(
                                            <tr
                                              key={`${item.key}-${idx}`}
                                              className="border-b transition-colors"
                                              style={{
                                                borderColor: 'var(--clr-surface-tonal-a20)',
                                              }}
                                            >
                                              <td
                                                className="py-3 px-3"
                                                style={{ color: 'var(--clr-primary-a50)' }}
                                              >
                                                <LatexText text={item.text} />
                                              </td>
                                              <td
                                                className="py-3 px-3 text-right font-mono font-bold"
                                                style={{ color: 'var(--clr-success-a10)' }}
                                              >
                                                {item.marks}
                                              </td>
                                            </tr>
                                          );
                                        });

                                        return rows;
                                      })()}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* Sample Solution Section (written questions only; MCQ explanation is shown above) */}
                            {!isMultipleChoiceReview && (
                              <div
                                className="p-8 border-t space-y-4"
                                style={{
                                  backgroundColor: 'var(--clr-surface-a0)',
                                  borderColor: 'var(--clr-surface-tonal-a20)',
                                }}
                              >
                                <h3
                                  className="font-bold text-lg flex items-center gap-2"
                                  style={{ color: 'var(--clr-success-a20)' }}
                                >
                                  <BookOpen className="w-5 h-5" />
                                  Sample Solution
                                </h3>
                                {feedback.sample_answer ? (
                                  <div
                                    className="font-serif text-base leading-relaxed space-y-3 pl-4 border-l-2 text-neutral-800"
                                    style={{ borderColor: 'var(--clr-success-a10)' }}
                                  >
                                    <LatexText text={feedback.sample_answer} />
                                  </div>
                                ) : null}
                                {feedback.question?.sample_answer_image ? (
                                  <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--clr-success-a10)' }}>
                                    <img src={feedback.question.sample_answer_image} alt="Sample solution" className="w-full h-auto" />
                                  </div>
                                ) : null}
                              </div>
                            )}

                            {/* Action Buttons */}
                            <div
                              className="border-t p-6 flex flex-wrap items-center gap-3"
                              style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}
                            >
                              <button
                                onClick={saveAttempt}
                                disabled={isSaving}
                                className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 cursor-pointer border`}
                                style={{
                                  backgroundColor: isSaving ? 'var(--clr-surface-a20)' : 'var(--clr-btn-primary)',
                                  borderColor: isSaving ? 'var(--clr-surface-tonal-a20)' : 'var(--clr-btn-primary)',
                                  color: isSaving ? 'var(--clr-surface-a40)' : 'var(--clr-btn-primary-text)',
                                  cursor: isSaving ? 'not-allowed' : 'pointer',
                                  opacity: isSaving ? 0.7 : 1,
                                }}
                              >
                                <Bookmark className={`w-4 h-4 transition-all ${isSaving ? 'fill-zinc-300' : ''
                                  }`} />
                                {isSaving ? 'Saving...' : 'Save Answer'}
                              </button>
                              <button
                                onClick={() => {
                                  setAppState('idle');
                                  setFeedback(null);
                                  setSubmittedAnswer(null);
                                  setUploadedFile(null);
                                  setTimeout(() => resetCanvas(canvasHeight), 50);
                                }}
                                className="px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer border"
                                style={{
                                  backgroundColor: 'var(--clr-surface-a10)',
                                  borderColor: 'var(--clr-surface-tonal-a20)',
                                  color: 'var(--clr-primary-a50)',
                                }}
                              >
                                <Edit2 className="w-4 h-4" />
                                Review & Try Again
                              </button>
                              <button
                                onClick={handleNextQuestion}
                                disabled={isPaperMode && (paperQuestions.length === 0 || getDisplayGroupAt(paperQuestions, paperIndex).endIndex >= paperQuestions.length)}
                                className="ml-auto px-6 py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed border"
                                style={{
                                  backgroundColor: 'var(--clr-btn-primary)',
                                  borderColor: 'var(--clr-btn-primary)',
                                  color: 'var(--clr-btn-primary-text)',
                                }}
                              >
                                <RefreshCw className="w-4 h-4" />
                                Next Question
                              </button>
                            </div>

                            {/* Submitted Answer Section */}
                            {submittedAnswer && (
                              <div
                                className="p-8 border-t space-y-4"
                                style={{
                                  backgroundColor: 'var(--clr-surface-a0)',
                                  borderColor: 'var(--clr-surface-tonal-a20)',
                                }}
                              >
                                <h3
                                  className="font-bold text-lg flex items-center gap-2"
                                  style={{ color: 'var(--clr-dark-a0)' }}
                                >
                                  <Eye className="w-5 h-5" />
                                  Your Submitted Answer
                                </h3>
                                <div
                                  className="rounded-lg p-4 border"
                                  style={{
                                    backgroundColor: 'var(--clr-surface-a10)',
                                    borderColor: 'var(--clr-surface-tonal-a20)',
                                  }}
                                >
                                  {isMultipleChoiceReview ? (
                                    <p className="font-semibold">Selected Answer: {submittedAnswer}</p>
                                  ) : (
                                    <img src={submittedAnswer} alt="Student answer" className="w-full rounded" style={{ borderColor: 'var(--clr-surface-tonal-a20)', border: '1px solid var(--clr-surface-tonal-a20)' }} />
                                  )}
                                </div>
                              </div>
                            )}

                          </div>
                        </div>
                      )}

                      {isPaperMode && !examEnded && (
                        <div className="flex items-center justify-end gap-3">
                          {examTimeRemainingLabel && (
                            <div
                              className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold"
                              style={{
                                backgroundColor: 'var(--clr-surface-a10)',
                                borderColor: 'var(--clr-surface-tonal-a20)',
                                color: 'var(--clr-primary-a50)',
                              }}
                            >
                              <Timer className="w-4 h-4" />
                              {examTimeRemainingLabel}
                            </div>
                          )}
                          <button
                            onClick={examConditionsActive ? handleEndExam : () => startExamSimulation()}
                            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold transition-all shadow-sm whitespace-nowrap cursor-pointer hover:opacity-90"
                            style={{
                              backgroundColor: examConditionsActive ? 'var(--clr-btn-danger)' : 'var(--clr-btn-primary)',
                              color: examConditionsActive ? 'var(--clr-btn-danger-text)' : 'var(--clr-btn-primary-text)',
                              border: '1px solid ' + (examConditionsActive ? 'var(--clr-btn-danger-hover)' : 'var(--clr-btn-primary-hover)'),
                            }}
                          >
                            {examConditionsActive ? 'End Exam' : 'Simulate Exam Conditions'}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
              {viewMode === 'papers' && (
                <>
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                    <div>
                      <h1
                        className="text-4xl font-bold mb-2"
                        style={{ color: 'var(--clr-primary-a50)' }}
                      >Browse HSC Papers</h1>
                      <p
                        className="text-lg"
                        style={{ color: 'var(--clr-surface-a40)' }}
                      >Select a paper to start a full exam attempt.</p>
                    </div>
                  </div>

                  {loadingQuestions ? (
                    <div className="flex items-center justify-center min-h-[240px]">
                      <RefreshCw className="w-8 h-8 animate-spin" style={{ color: 'var(--clr-surface-a40)' }} />
                    </div>
                  ) : questionsFetchError ? (
                    <div className="text-center py-16">
                      <p className="text-lg" style={{ color: 'var(--clr-warning-a10)' }}>Could not load questions</p>
                      <p className="text-sm mt-2 max-w-md mx-auto" style={{ color: 'var(--clr-surface-a50)' }}>{questionsFetchError}</p>
                      <p className="text-xs mt-2" style={{ color: 'var(--clr-surface-a40)' }}>Check DATABASE_URL or NEON_DATABASE_URL in .env.local</p>
                    </div>
                  ) : availablePapers.length === 0 ? (
                    <div className="text-center py-16">
                      <p className="text-lg" style={{ color: 'var(--clr-surface-a40)' }}>No papers available yet.</p>
                      <p className="text-sm mt-2" style={{ color: 'var(--clr-surface-a50)' }}>Upload exam questions to create papers.</p>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {availablePapers.map((paper) => (
                        <button
                          key={`${paper.year}-${paper.grade}-${paper.subject}-${paper.school}`}
                          onClick={() => startPaperAttempt(paper)}
                          className="text-left border rounded-2xl p-6 transition-all hover:-translate-y-0.5 hover:shadow-xl cursor-pointer"
                          style={{
                            backgroundColor: 'var(--clr-surface-a10)',
                            borderColor: 'var(--clr-surface-tonal-a20)',
                          }}
                        >
                          <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--clr-surface-a40)' }}>
                            {paper.year}
                          </div>
                          <div className="text-xl font-semibold mt-2" style={{ color: 'var(--clr-primary-a50)' }}>
                            {paper.subject}
                          </div>
                          <div className="text-sm mt-1" style={{ color: 'var(--clr-surface-a50)' }}>
                            {paper.grade}
                          </div>
                          <div className="text-xs mt-2" style={{ color: 'var(--clr-surface-a40)' }}>
                            {paper.school || 'HSC'}
                          </div>
                          <div className="text-xs mt-4" style={{ color: 'var(--clr-surface-a40)' }}>
                            {paper.count} question{paper.count === 1 ? '' : 's'} available
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
              {viewMode === 'saved' && (
                <>
                  {/* Saved Attempts View */}
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                    <div>
                      <h1
                        className="text-4xl font-bold mb-2"
                        style={{ color: 'var(--clr-primary-a50)' }}
                      >My Saved Answers</h1>
                      <p
                        className="text-lg"
                        style={{ color: 'var(--clr-surface-a40)' }}
                      >
                        {savedAttempts.length === 0 ? 'No saves yet' : (() => {
                          const examCount = savedAttempts.filter(a => a.type === 'exam').length;
                          const questionCount = savedAttempts.length - examCount;
                          return (
                            <>
                              <span className="font-semibold" style={{ color: 'var(--clr-primary-a50)' }}>{examCount}</span> exam{examCount !== 1 ? 's' : ''}
                              {' '}&amp;{' '}
                              <span className="font-semibold" style={{ color: 'var(--clr-primary-a50)' }}>{questionCount}</span> question{questionCount !== 1 ? 's' : ''} saved
                            </>
                          );
                        })()}
                      </p>
                    </div>
                    <button
                      onClick={() => setViewMode('browse')}
                      className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all cursor-pointer border"
                      style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }}
                    >
                      <RefreshCw className="w-4 h-4" />
                      Browse exams
                    </button>
                  </div>

                  {selectedAttempt ? (
                    <>
                      <div className="flex items-center justify-between gap-3 mb-6">
                        <button
                          onClick={() => { setSelectedAttempt(null); setSavedExamReviewMode(false); setSavedQuestionsListExpanded(false); }}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl transition-colors cursor-pointer font-medium text-sm"
                          style={{ backgroundColor: 'var(--clr-surface-a20)', color: 'var(--clr-surface-a50)' }}
                        >
                          <ArrowLeft className="w-4 h-4" />
                          Back to list
                        </button>
                        <button
                          onClick={() => removeSavedAttempt(selectedAttempt.id)}
                          className="text-sm font-medium cursor-pointer px-4 py-2 rounded-lg transition-colors"
                          style={{ color: 'var(--clr-surface-a50)' }}
                        >
                          Unsave
                        </button>
                      </div>

                      {selectedAttempt.type === 'exam' ? (
                        savedExamReviewMode && selectedAttempt.examAttempts?.length > 0 ? (
                          <div className="space-y-4">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => setSavedExamReviewMode(false)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium cursor-pointer transition-colors"
                                style={{ backgroundColor: 'var(--clr-surface-a10)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }}
                              >
                                <ArrowLeft className="w-4 h-4" />
                                Back to Overview
                              </button>
                              <span className="text-sm" style={{ color: 'var(--clr-surface-a40)' }}>
                                Question {savedExamReviewIndex + 1} of {selectedAttempt.examAttempts?.length ?? 0}
                              </span>
                            </div>
                            <div className="flex gap-4">
                              {/* Collapsible Question Sidebar */}
                              <aside
                                className={`flex-shrink-0 rounded-xl border overflow-hidden transition-all duration-300 ${savedReviewSidebarCollapsed ? 'w-12' : 'w-52'}`}
                                style={{ backgroundColor: 'var(--clr-surface-a10)', borderColor: 'var(--clr-surface-tonal-a20)', maxHeight: '70vh' }}
                              >
                                <div className="flex items-center justify-between p-2 border-b" style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                  {!savedReviewSidebarCollapsed && (
                                    <p className="text-xs font-bold uppercase tracking-widest px-1" style={{ color: 'var(--clr-surface-a40)' }}>Questions</p>
                                  )}
                                  <button
                                    onClick={() => setSavedReviewSidebarCollapsed(c => !c)}
                                    className="p-1.5 rounded-lg cursor-pointer transition-colors hover:bg-neutral-200 ml-auto"
                                    style={{ color: 'var(--clr-surface-a40)' }}
                                    title={savedReviewSidebarCollapsed ? 'Expand question list' : 'Collapse question list'}
                                  >
                                    {savedReviewSidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
                                  </button>
                                </div>
                                {!savedReviewSidebarCollapsed && (
                                  <div className="p-2 space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(70vh - 40px)' }}>
                                    {(selectedAttempt.examAttempts || []).map((_: any, i: number) => {
                                      const score = typeof selectedAttempt.examAttempts[i].feedback?.score === 'number' ? selectedAttempt.examAttempts[i].feedback.score : null;
                                      const maxMarks = selectedAttempt.examAttempts[i].question?.marks ?? 0;
                                      const isCorrect = score !== null && score === maxMarks;
                                      const isPartial = score !== null && score > 0 && score < maxMarks;
                                      const isWrong = score !== null && score === 0;
                                      return (
                                        <button
                                          key={i}
                                          onClick={() => setSavedExamReviewIndex(i)}
                                          className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition cursor-pointer"
                                          style={{
                                            backgroundColor: savedExamReviewIndex === i ? 'var(--clr-surface-tonal-a20)' : 'transparent',
                                            color: 'var(--clr-primary-a50)',
                                          }}
                                        >
                                          <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isCorrect ? 'bg-green-400' : isPartial ? 'bg-amber-400' : isWrong ? 'bg-red-400' : 'bg-neutral-300'}`} />
                                            <span>Q{i + 1}</span>
                                            {score !== null && (
                                              <span className="ml-auto text-xs opacity-50">{score}/{maxMarks}</span>
                                            )}
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                                {savedReviewSidebarCollapsed && (
                                  <div className="p-1 space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(70vh - 40px)' }}>
                                    {(selectedAttempt.examAttempts || []).map((_: any, i: number) => {
                                      const score = typeof selectedAttempt.examAttempts[i].feedback?.score === 'number' ? selectedAttempt.examAttempts[i].feedback.score : null;
                                      const maxMarks = selectedAttempt.examAttempts[i].question?.marks ?? 0;
                                      const isCorrect = score !== null && score === maxMarks;
                                      const isPartial = score !== null && score > 0 && score < maxMarks;
                                      const isWrong = score !== null && score === 0;
                                      return (
                                        <button
                                          key={i}
                                          onClick={() => setSavedExamReviewIndex(i)}
                                          className="w-full flex items-center justify-center p-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                                          style={{
                                            backgroundColor: savedExamReviewIndex === i ? 'var(--clr-surface-tonal-a20)' : 'transparent',
                                          }}
                                          title={`Question ${i + 1}${score !== null ? ` — ${score}/${maxMarks}` : ''}`}
                                        >
                                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isCorrect ? 'bg-green-100 text-green-700' : isPartial ? 'bg-amber-100 text-amber-700' : isWrong ? 'bg-red-100 text-red-700' : 'bg-neutral-100 text-neutral-600'}`}>{i + 1}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </aside>
                              <div className="flex-1 min-w-0">
                                {(() => {
                                  const attempt = selectedAttempt.examAttempts[savedExamReviewIndex];
                                  if (!attempt) return null;
                                  const revQuestion = attempt.question;
                                  const revFeedback = attempt.feedback;
                                  const revSubmitted = attempt.submittedAnswer;
                                  const isMcq = revQuestion?.question_type === 'multiple_choice';
                                  const revAwarded = typeof revFeedback?.score === 'number' ? revFeedback.score : null;
                                  const revMax = revFeedback?.maxMarks ?? revQuestion?.marks ?? 0;
                                  const revCriteriaText = revFeedback?.marking_criteria ?? revQuestion?.marking_criteria ?? null;
                                  return (
                                    <div className="rounded-2xl overflow-hidden border shadow-2xl" style={{ backgroundColor: 'var(--clr-surface-a10)', borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                      <div className="p-6 border-b flex flex-wrap items-center justify-between gap-6" style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                        <div>
                                          <h3 className="text-xl font-bold flex items-center gap-2" style={{ color: '#1a1a1a' }}>
                                            {revFeedback ? (revAwarded === 0 ? <XCircle className="w-6 h-6" style={{ color: 'var(--clr-danger-a10)' }} /> : revAwarded !== null && revAwarded < revMax ? <CheckCircle2 className="w-6 h-6" style={{ color: 'var(--clr-warning-a10)' }} /> : <CheckCircle2 className="w-6 h-6" style={{ color: 'var(--clr-success-a10)' }} />) : null}
                                            {revFeedback ? 'Marking Complete' : 'Marking…'}
                                          </h3>
                                          <p className="text-sm mt-1" style={{ color: '#525252' }}>Assessed against NESA Guidelines</p>
                                        </div>
                                        <div className="text-right">
                                          <span className="block text-xs font-bold uppercase tracking-widest" style={{ color: '#404040' }}>Score</span>
                                          <div className="flex items-baseline gap-1 justify-end">
                                            <span className="text-4xl font-bold" style={{ color: '#1a1a1a' }}>{revAwarded === null ? '--' : revAwarded}</span>
                                            <span className="text-xl font-medium" style={{ color: '#404040' }}>/{revMax}</span>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="p-6 border-b" style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                          <h4 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--clr-surface-a40)' }}>Question</h4>
                                          {isDevMode && revQuestion?.id && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setViewMode('dev-questions');
                                                setDevTab('manage');
                                                setSelectedManageQuestionId(revQuestion.id);
                                                setManageQuestionDraft(revQuestion);
                                                setManageQuestionEditMode(false);
                                              }}
                                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                                            >
                                              <Edit2 className="w-3.5 h-3.5" />
                                              Edit
                                            </button>
                                          )}
                                        </div>
                                        <div
                                          className="font-serif rounded-lg border p-3"
                                          style={{ color: 'var(--clr-primary-a50)', borderColor: 'var(--clr-surface-tonal-a20)' }}
                                        >
                                          <QuestionTextWithDividers text={revQuestion?.question_text || ''} />
                                        </div>
                                      </div>
                                      {revFeedback && (
                                        <div className="p-6 border-b" style={{ backgroundColor: 'var(--clr-surface-a10)', borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                          <h4 className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: 'var(--clr-surface-a40)' }}><TrendingUp className="w-4 h-4" />{isMcq ? 'Answer Explanation' : 'AI Feedback'}</h4>
                                          <div className="text-base leading-relaxed space-y-3" style={{ color: 'var(--clr-primary-a50)' }}>
                                            {isMcq ? (revFeedback.mcq_explanation ? <LatexText text={stripOuterBraces(revFeedback.mcq_explanation)} /> : <p className="italic" style={{ color: 'var(--clr-surface-a50)' }}>Explanation not available.</p>) : revFeedback.ai_evaluation ? <LatexText text={revFeedback.ai_evaluation} /> : revFeedback._error ? <p className="italic" style={{ color: 'var(--clr-danger-a10)' }}>Marking failed.</p> : <p className="italic" style={{ color: 'var(--clr-surface-a50)' }}>AI evaluation is being processed...</p>}
                                          </div>
                                        </div>
                                      )}
                                      {!isMcq && revCriteriaText && (
                                        <div className="p-6 border-b" style={{ backgroundColor: 'var(--clr-surface-a10)', borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                          <h4 className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: 'var(--clr-surface-a40)' }}><CheckCircle2 className="w-4 h-4" />Marking Criteria</h4>
                                          <div className="overflow-x-auto">
                                            <table className="w-full">
                                              <thead><tr className="border-b" style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}><th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--clr-surface-a40)' }}>Criteria</th><th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wider w-24" style={{ color: 'var(--clr-surface-a40)' }}>Marks</th></tr></thead>
                                              <tbody>
                                                {(() => {
                                                  const items = parseCriteriaForDisplay(revCriteriaText);
                                                  const rows: React.ReactNode[] = [];
                                                  let lastSubpart: string | null = null;
                                                  items.forEach((item, idx) => {
                                                    if (item.type === 'heading') {
                                                      lastSubpart = null;
                                                      rows.push(<tr key={`${item.key}-${idx}`} className="border-b" style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}><td colSpan={2} className="py-3 px-3 font-semibold" style={{ color: 'var(--clr-primary-a50)' }}>{item.text}</td></tr>);
                                                      return;
                                                    }
                                                    if (item.subpart && item.subpart !== lastSubpart) {
                                                      lastSubpart = item.subpart;
                                                      rows.push(<tr key={`sub-${item.subpart}-${idx}`} className="border-b" style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}><td colSpan={2} className="py-2 px-3 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--clr-surface-a40)' }}>Part ({item.subpart})</td></tr>);
                                                    }
                                                    rows.push(<tr key={`${item.key}-${idx}`} className="border-b" style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}><td className="py-3 px-3" style={{ color: 'var(--clr-primary-a50)' }}><LatexText text={item.text} /></td><td className="py-3 px-3 text-right font-mono font-bold" style={{ color: 'var(--clr-success-a10)' }}>{item.marks}</td></tr>);
                                                  });
                                                  return rows;
                                                })()}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      )}
                                      {(revFeedback?.sample_answer ?? revQuestion?.sample_answer ?? revQuestion?.sample_answer_image) && (
                                        <div className="p-8 border-t space-y-4" style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                          <h3 className="font-bold text-lg flex items-center gap-2" style={{ color: 'var(--clr-success-a20)' }}><BookOpen className="w-5 h-5" />{isMcq ? 'Answer Explanation' : 'Sample Solution'}</h3>
                                          {isMcq && revFeedback?.mcq_explanation ? (
                                            <div className="font-serif text-base leading-relaxed space-y-3 pl-4 border-l-2 text-neutral-800" style={{ borderColor: 'var(--clr-success-a10)' }}>
                                              <LatexText text={stripOuterBraces(revFeedback.mcq_explanation)} />
                                            </div>
                                          ) : (revFeedback?.sample_answer ?? revQuestion?.sample_answer) || revQuestion?.sample_answer_image ? (
                                            <>
                                              {(revFeedback?.sample_answer ?? revQuestion?.sample_answer) ? (
                                                <div className="font-serif text-base leading-relaxed space-y-3 pl-4 border-l-2 text-neutral-800" style={{ borderColor: 'var(--clr-success-a10)' }}>
                                                  <LatexText text={revFeedback?.sample_answer ?? revQuestion?.sample_answer ?? ''} />
                                                </div>
                                              ) : null}
                                              {revQuestion?.sample_answer_image ? (
                                                <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--clr-success-a10)' }}>
                                                  <img src={revQuestion.sample_answer_image} alt="Sample solution" className="w-full h-auto" />
                                                </div>
                                              ) : null}
                                            </>
                                          ) : null}
                                        </div>
                                      )}
                                      {revSubmitted && (
                                        <div className="p-8 border-t space-y-4" style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                          <h3 className="font-bold text-lg flex items-center gap-2" style={{ color: 'var(--clr-info-a20)' }}><Eye className="w-5 h-5" />Your Submitted Answer</h3>
                                          <div className="rounded-lg p-4 border" style={{ backgroundColor: 'var(--clr-surface-a10)', borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                            {isMcq ? <p className="font-semibold">Selected Answer: {revSubmitted}</p> : <img src={revSubmitted} alt="Your answer" className="w-full rounded" style={{ border: '1px solid var(--clr-surface-tonal-a20)' }} />}
                                          </div>
                                        </div>
                                      )}
                                      <div className="border-t p-6 flex items-center justify-between gap-3" style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                        <button onClick={() => setSavedExamReviewIndex((i) => Math.max(0, i - 1))} disabled={savedExamReviewIndex === 0} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors" style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }}><ChevronLeft className="w-4 h-4" />Previous</button>
                                        <span className="text-sm" style={{ color: 'var(--clr-surface-a40)' }}>{savedExamReviewIndex + 1} / {selectedAttempt.examAttempts?.length ?? 0}</span>
                                        <button onClick={() => setSavedExamReviewIndex((i) => Math.min((selectedAttempt.examAttempts?.length ?? 1) - 1, i + 1))} disabled={savedExamReviewIndex >= (selectedAttempt.examAttempts?.length ?? 0) - 1} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors" style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }}>Next<ChevronRight className="w-4 h-4" /></button>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-6 rounded-2xl border p-6" style={{ backgroundColor: 'var(--clr-surface-a10)', borderColor: 'var(--clr-surface-tonal-a20)' }}>
                            {/* Exam header */}
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--clr-surface-a40)' }}>Exam</span>
                                  {selectedAttempt.paperGrade && <><span style={{ color: 'var(--clr-surface-a40)' }}>·</span><span className="text-xs font-medium" style={{ color: 'var(--clr-surface-a40)' }}>{selectedAttempt.paperGrade}</span></>}
                                </div>
                                <h1 className="text-2xl font-bold" style={{ color: 'var(--clr-primary-a50)' }}>{selectedAttempt.paperYear} {selectedAttempt.paperSubject}</h1>
                                <p className="text-sm mt-1" style={{ color: 'var(--clr-surface-a40)' }}>
                                  {selectedAttempt.examAttempts?.length ?? 0} question{(selectedAttempt.examAttempts?.length ?? 0) !== 1 ? 's' : ''}
                                  {selectedAttempt.savedAt && <> &bull; Saved {new Date(selectedAttempt.savedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</>}
                                </p>
                              </div>
                            </div>

                            {/* Stats */}
                            <div className="grid gap-4 sm:grid-cols-3">
                              <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                <div className="flex items-center gap-2 mb-1">
                                  <Award className="w-4 h-4" style={{ color: 'var(--clr-surface-a40)' }} />
                                  <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--clr-surface-a40)' }}>Total Score</div>
                                </div>
                                <div className="text-2xl font-bold" style={{ color: 'var(--clr-primary-a50)' }}>{selectedAttempt.totalScore} / {selectedAttempt.totalPossible}</div>
                              </div>
                              <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                <div className="flex items-center gap-2 mb-1">
                                  <Target className="w-4 h-4" style={{ color: 'var(--clr-surface-a40)' }} />
                                  <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--clr-surface-a40)' }}>Percentage</div>
                                </div>
                                <div className="text-2xl font-bold" style={{ color: 'var(--clr-primary-a50)' }}>{selectedAttempt.totalPossible > 0 ? Math.round((selectedAttempt.totalScore / selectedAttempt.totalPossible) * 100) : 0}%</div>
                                <div className="mt-2 rounded-full overflow-hidden" style={{ height: 4, backgroundColor: 'var(--clr-surface-tonal-a20)' }}>
                                  <div className="h-full rounded-full" style={{ width: `${selectedAttempt.totalPossible > 0 ? Math.round((selectedAttempt.totalScore / selectedAttempt.totalPossible) * 100) : 0}%`, backgroundColor: 'var(--clr-primary-a50)' }} />
                                </div>
                              </div>
                              <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                <div className="flex items-center gap-2 mb-1">
                                  <Hash className="w-4 h-4" style={{ color: 'var(--clr-surface-a40)' }} />
                                  <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--clr-surface-a40)' }}>Questions</div>
                                </div>
                                <div className="text-2xl font-bold" style={{ color: 'var(--clr-primary-a50)' }}>{selectedAttempt.examAttempts?.length ?? 0}</div>
                              </div>
                            </div>

                            {/* Toggleable marks per question */}
                            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}>
                              <button
                                type="button"
                                onClick={() => setSavedQuestionsListExpanded(e => !e)}
                                className="w-full flex items-center justify-between px-4 py-3 cursor-pointer transition-colors"
                                style={{ backgroundColor: 'var(--clr-surface-a0)' }}
                              >
                                <span className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--clr-surface-a40)' }}>Marks per question</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs" style={{ color: 'var(--clr-surface-a50)' }}>{savedQuestionsListExpanded ? 'Hide' : `Show ${selectedAttempt.examAttempts?.length ?? 0} questions`}</span>
                                  {savedQuestionsListExpanded ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--clr-surface-a40)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--clr-surface-a40)' }} />}
                                </div>
                              </button>
                              {savedQuestionsListExpanded && (
                                <div className="border-t" style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                  <ul className="divide-y divide-neutral-100">
                                    {(selectedAttempt.examAttempts || []).map((a: any, i: number) => {
                                      const score = a.feedback && typeof a.feedback.score === 'number' ? a.feedback.score : null;
                                      const maxMarks = a.question?.marks ?? 0;
                                      const pct = score !== null && maxMarks > 0 ? Math.round((score / maxMarks) * 100) : null;
                                      const isCorrect = score !== null && score === maxMarks;
                                      const isPartial = score !== null && score > 0 && score < maxMarks;
                                      const isWrong = score !== null && score === 0;
                                      return (
                                        <li key={i} className="flex items-center gap-3 px-4 py-2.5" style={{ backgroundColor: 'var(--clr-surface-a0)' }}>
                                          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isCorrect ? 'bg-green-100 text-green-700' : isPartial ? 'bg-amber-100 text-amber-700' : isWrong ? 'bg-red-100 text-red-700' : 'bg-neutral-100 text-neutral-500'}`}>{i + 1}</span>
                                          <span className="flex-1 text-sm truncate" style={{ color: 'var(--clr-primary-a50)' }}>{a.question?.question_text ? a.question.question_text.replace(/\$[^$]*\$/g, '[math]').substring(0, 60) + (a.question.question_text.length > 60 ? '…' : '') : `Question ${i + 1}`}</span>
                                          <span className="text-sm font-semibold" style={{ color: 'var(--clr-primary-a50)' }}>
                                            {score !== null ? `${score}/${maxMarks}` : `—/${maxMarks}`}
                                          </span>
                                          {pct !== null && <span className="text-xs w-10 text-right" style={{ color: 'var(--clr-surface-a40)' }}>{pct}%</span>}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              )}
                            </div>

                            {/* Action buttons */}
                            <div className="flex flex-wrap items-center gap-3">
                              <button
                                onClick={() => openSavedExamAsPaper(selectedAttempt)}
                                className="flex items-center gap-2 px-5 py-3 rounded-lg font-medium border cursor-pointer transition-colors"
                                style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }}
                              >
                                <BookOpen className="w-5 h-5" />
                                View as Paper
                              </button>
                              <button
                                onClick={() => exportSavedExamPdf(false)}
                                disabled={exportingSavedExamPdf !== null}
                                className="flex items-center gap-2 px-5 py-3 rounded-lg font-medium border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }}
                              >
                                <Download className="w-5 h-5" />
                                {exportingSavedExamPdf === 'exam' ? 'Exporting…' : 'Export PDF'}
                              </button>
                              <button
                                onClick={() => exportSavedExamPdf(true)}
                                disabled={exportingSavedExamPdf !== null}
                                className="flex items-center gap-2 px-5 py-3 rounded-lg font-medium border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }}
                              >
                                <Download className="w-5 h-5" />
                                {exportingSavedExamPdf === 'solutions' ? 'Exporting…' : 'Export + Solutions'}
                              </button>
                              <button
                                onClick={() => { setSavedExamReviewMode(true); setSavedExamReviewIndex(0); setSavedReviewSidebarCollapsed(false); }}
                                className="flex items-center gap-2 px-5 py-3 rounded-lg font-medium border cursor-pointer transition-colors"
                                style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }}
                              >
                                <Eye className="w-5 h-5" />
                                Review Questions
                              </button>
                            </div>
                          </div>
                        )
                      ) : (
                        <div
                          className="rounded-2xl border overflow-hidden shadow-2xl space-y-6 p-8"
                          style={{
                            backgroundColor: 'var(--clr-surface-a10)',
                            borderColor: 'var(--clr-surface-tonal-a20)',
                          }}
                        >
                          {/* Question */}
                          <div className="space-y-2">
                            <h3
                              className="text-sm font-bold uppercase tracking-widest"
                              style={{ color: 'var(--clr-surface-a40)' }}
                            >Question ({selectedAttempt.marks} marks)</h3>
                            <div
                              className="font-serif text-lg"
                              style={{ color: 'var(--clr-light-a0)' }}
                            >
                              <LatexText text={selectedAttempt.questionText} />
                              {selectedAttempt.graphImageData && (
                                <div className="my-4">
                                  <img
                                    src={selectedAttempt.graphImageData}
                                    alt="Question graph"
                                    className={`rounded-lg border graph-image graph-image--${selectedAttempt.graphImageSize || 'medium'}`}
                                    style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}
                                  />
                                </div>
                              )}
                            </div>
                            <div
                              className="text-sm mt-2"
                              style={{ color: 'var(--clr-surface-a50)' }}
                            >{selectedAttempt.subject} • {selectedAttempt.topic}</div>
                          </div>

                          {/* Divider */}
                          <div
                            className="border-t"
                            style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}
                          />

                          {/* Student's Answer */}
                          {selectedAttempt.submittedAnswer && (
                            <div className="space-y-2">
                              <h3
                                className="text-sm font-bold uppercase tracking-widest"
                                style={{ color: 'var(--clr-info-a20)' }}
                              >Your Answer</h3>
                              {selectedAttempt.questionType === 'multiple_choice' ? (
                                <div
                                  className="rounded-lg border px-4 py-3"
                                  style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}
                                >
                                  <span className="font-semibold">Selected: {selectedAttempt.submittedAnswer}</span>
                                </div>
                              ) : (
                                <img
                                  src={selectedAttempt.submittedAnswer}
                                  alt="Student answer"
                                  className="w-full rounded-lg border"
                                  style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}
                                />
                              )}
                            </div>
                          )}

                          {/* AI Feedback / Explanation */}
                          {(selectedAttempt.feedback?.ai_evaluation || selectedAttempt.feedback?.mcq_explanation) && (
                            <div
                              className="space-y-3 p-6 rounded-lg border"
                              style={{
                                backgroundColor: 'var(--clr-surface-a10)',
                                borderColor: 'var(--clr-surface-tonal-a20)',
                              }}
                            >
                              <h3
                                className="text-sm font-bold uppercase tracking-widest"
                                style={{ color: 'var(--clr-info-a20)' }}
                              >{selectedAttempt.questionType === 'multiple_choice' ? 'Answer Explanation' : 'AI Feedback'}</h3>
                              <div
                                className="space-y-2"
                                style={{ color: 'var(--clr-primary-a40)' }}
                              >
                                <LatexText text={selectedAttempt.feedback.ai_evaluation || stripOuterBraces(selectedAttempt.feedback.mcq_explanation || '')} />
                              </div>
                            </div>
                          )}

                          {/* Marking Criteria */}
                          {selectedAttempt.questionType !== 'multiple_choice' && selectedAttempt.feedback?.marking_criteria && (
                            <div className="space-y-3">
                              <h3
                                className="text-sm font-bold uppercase tracking-widest"
                                style={{ color: 'var(--clr-surface-a40)' }}
                              >Marking Criteria</h3>
                              <div className="overflow-x-auto">
                                <table className="w-full">
                                  <thead>
                                    <tr
                                      className="border-b"
                                      style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}
                                    >
                                      <th
                                        className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wider"
                                        style={{ color: 'var(--clr-surface-a40)' }}
                                      >Criteria</th>
                                      <th
                                        className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wider w-24"
                                        style={{ color: 'var(--clr-surface-a40)' }}
                                      >Marks</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(() => {
                                      const criteriaText = selectedAttempt.feedback.marking_criteria;
                                      const items = parseCriteriaForDisplay(criteriaText);
                                      const rows: React.ReactNode[] = [];
                                      let lastSubpart: string | null = null;

                                      items.forEach((item, idx) => {
                                        if (item.type === 'heading') {
                                          lastSubpart = null;
                                          rows.push(
                                            <tr key={`part-${item.key}-${idx}`} className="border-b" style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                              <td colSpan={2} className="py-3 px-3 font-semibold" style={{ color: 'var(--clr-primary-a50)' }}>
                                                {item.text}
                                              </td>
                                            </tr>
                                          );
                                          return;
                                        }

                                        if (item.subpart && item.subpart !== lastSubpart) {
                                          lastSubpart = item.subpart;
                                          rows.push(
                                            <tr key={`subpart-${item.subpart}-${idx}`} className="border-b" style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                              <td colSpan={2} className="py-2 px-3 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--clr-surface-a40)' }}>
                                                Part ({item.subpart})
                                              </td>
                                            </tr>
                                          );
                                        }

                                        rows.push(
                                          <tr
                                            key={`${item.key}-${idx}`}
                                            className="border-b transition-colors"
                                            style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}
                                          >
                                            <td
                                              className="py-3 px-3"
                                              style={{ color: 'var(--clr-light-a0)' }}
                                            >
                                              <LatexText text={item.text} />
                                            </td>
                                            <td
                                              className="py-3 px-3 text-right font-mono font-bold"
                                              style={{ color: 'var(--clr-success-a10)' }}
                                            >
                                              {item.marks}
                                            </td>
                                          </tr>
                                        );
                                      });

                                      return rows;
                                    })()}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* Sample Solution */}
                          {selectedAttempt.sampleAnswer && (
                            <div
                              className="space-y-3 p-6 rounded-lg border"
                              style={{
                                backgroundColor: 'var(--clr-surface-a10)',
                                borderColor: 'var(--clr-success-a10)',
                              }}
                            >
                              <h3
                                className="text-sm font-bold uppercase tracking-widest"
                                style={{ color: 'var(--clr-success-a20)' }}
                              >Sample Solution</h3>
                              {selectedAttempt.sampleAnswer ? (
                                <div
                                  className="font-serif"
                                  style={{ color: 'var(--clr-light-a0)' }}
                                >
                                  <LatexText text={selectedAttempt.sampleAnswer} />
                                </div>
                              ) : null}
                              {selectedAttempt.question?.sample_answer_image ? (
                                <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--clr-success-a10)' }}>
                                  <img src={selectedAttempt.question.sample_answer_image} alt="Sample solution" className="w-full h-auto" />
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Attempts List */}
                      {savedAttempts.length === 0 ? (
                        <div className="text-center py-16">
                          <Bookmark
                            className="w-16 h-16 mx-auto mb-4"
                            style={{ color: 'var(--clr-surface-a30)' }}
                          />
                          <p
                            className="text-lg"
                            style={{ color: 'var(--clr-surface-a40)' }}
                          >No saved answers yet</p>
                          <p
                            className="text-sm mt-2"
                            style={{ color: 'var(--clr-surface-a50)' }}
                          >Submit and save an answer to see it here</p>
                        </div>
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-2">
                          {savedAttempts.map((attempt) => {
                            const isExam = attempt.type === 'exam';
                            const pct = isExam && attempt.totalPossible > 0 ? Math.round((attempt.totalScore / attempt.totalPossible) * 100) : null;
                            const savedDate = attempt.savedAt ? new Date(attempt.savedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
                            return (
                              <div
                                key={attempt.id}
                                className="border rounded-2xl overflow-hidden transition-shadow hover:shadow-md"
                                style={{
                                  backgroundColor: 'var(--clr-surface-a0)',
                                  borderColor: 'var(--clr-surface-tonal-a20)',
                                }}
                              >
                                <button
                                  onClick={() => { setSelectedAttempt(attempt); setSavedExamReviewMode(false); setSavedQuestionsListExpanded(false); }}
                                  className="w-full text-left cursor-pointer p-5"
                                >
                                  {/* Card header */}
                                  <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                                        <span
                                          className="text-xs font-medium uppercase tracking-widest"
                                          style={{ color: 'var(--clr-surface-a40)' }}
                                        >
                                          {isExam ? 'Exam' : 'Question'}{!isExam && attempt.questionType === 'multiple_choice' ? ' · MCQ' : ''}
                                        </span>
                                      </div>
                                      <h3 className="font-semibold text-base leading-tight truncate" style={{ color: 'var(--clr-primary-a50)' }}>
                                        {isExam ? [attempt.paperYear, attempt.paperSubject].filter(Boolean).join(' ') : attempt.subject}
                                      </h3>
                                      <p className="text-xs mt-0.5" style={{ color: 'var(--clr-surface-a40)' }}>
                                        {isExam ? attempt.paperGrade : attempt.topic}
                                      </p>
                                    </div>
                                    {/* Score badge */}
                                    <div className="flex-shrink-0 text-right">
                                      {isExam ? (
                                        <div>
                                          <div className="text-xl font-bold leading-none" style={{ color: 'var(--clr-primary-a50)' }}>
                                            {attempt.totalScore}<span className="text-sm font-medium" style={{ color: 'var(--clr-surface-a40)' }}>/{attempt.totalPossible}</span>
                                          </div>
                                          {pct !== null && <div className="text-xs font-semibold mt-0.5" style={{ color: 'var(--clr-surface-a40)' }}>{pct}%</div>}
                                        </div>
                                      ) : (
                                        <div className="text-xl font-bold leading-none" style={{ color: 'var(--clr-primary-a50)' }}>
                                          {attempt.marks}<span className="text-xs font-medium" style={{ color: 'var(--clr-surface-a40)' }}> marks</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Exam progress bar */}
                                  {isExam && pct !== null && (
                                    <div className="mb-3 rounded-full overflow-hidden" style={{ height: 4, backgroundColor: 'var(--clr-surface-tonal-a20)' }}>
                                      <div
                                        className="h-full rounded-full"
                                        style={{ width: `${pct}%`, backgroundColor: 'var(--clr-primary-a50)' }}
                                      />
                                    </div>
                                  )}

                                  {/* Exam meta */}
                                  {isExam && (
                                    <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--clr-surface-a50)' }}>
                                      <span className="flex items-center gap-1"><Hash className="w-3 h-3" />{attempt.examAttempts?.length ?? 0} questions</span>
                                      {savedDate && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{savedDate}</span>}
                                    </div>
                                  )}

                                  {/* Question preview */}
                                  {!isExam && (
                                    <div className="border-t pt-2.5 mt-2.5 space-y-1.5" style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                      <p className="text-xs line-clamp-2" style={{ color: 'var(--clr-primary-a40)' }}>{attempt.questionText}</p>
                                      {(attempt.feedback?.ai_evaluation || attempt.feedback?.mcq_explanation) && (
                                        <p className="text-xs line-clamp-1" style={{ color: 'var(--clr-surface-a50)' }}>
                                          {stripOuterBraces(attempt.feedback.ai_evaluation || attempt.feedback.mcq_explanation || '').split('\n')[0]}
                                        </p>
                                      )}
                                      <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--clr-surface-a50)' }}>
                                        {savedDate && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{savedDate}</span>}
                                        {attempt.feedback?.score !== undefined && attempt.marks && (
                                          <span className="flex items-center gap-1"><Award className="w-3 h-3" />{attempt.feedback.score}/{attempt.marks}m</span>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </button>

                                {/* Unsave button at bottom */}
                                <div className="px-5 pb-4">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); removeSavedAttempt(attempt.id); }}
                                    className="text-xs font-semibold cursor-pointer px-3 py-1.5 rounded-lg transition-colors"
                                    style={{ color: 'var(--clr-surface-a50)' }}
                                  >
                                    Unsave
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* Saved Attempts Modal - Removed, now using inline sidebar view */}

              {/* Syllabus Viewer */}
              {viewMode === 'syllabus' && (
                <SyllabusViewer onClose={() => setViewMode('browse')} isDevMode={isDevMode} />
              )}

              {/* Settings Page */}
              {viewMode === 'settings' && (
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}>
                    <h1 className="text-3xl font-bold" style={{ color: 'var(--clr-primary-a50)' }}>Settings</h1>
                    <button
                      onClick={() => setViewMode('browse')}
                      className="p-2 rounded-lg cursor-pointer"
                      style={{ color: 'var(--clr-surface-a40)' }}
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="flex-1 p-8 overflow-y-auto">
                    <div className="max-w-2xl">
                      <div
                        className="p-6 rounded-2xl border"
                        style={{
                          backgroundColor: 'var(--clr-surface-a10)',
                          borderColor: 'var(--clr-surface-tonal-a20)',
                        }}
                      >
                        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--clr-primary-a50)' }}>Account Information</h2>

                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>Name</label>
                            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                              <input
                                type="text"
                                value={userNameDraft}
                                onChange={(e) => setUserNameDraft(e.target.value)}
                                placeholder="Enter your name"
                                className="w-full px-4 py-2 rounded-lg border"
                                style={{
                                  backgroundColor: 'var(--clr-surface-a0)',
                                  borderColor: 'var(--clr-surface-tonal-a20)',
                                  color: 'var(--clr-primary-a50)',
                                }}
                              />
                              <button
                                type="button"
                                onClick={handleSaveName}
                                disabled={isSavingName || userNameDraft.trim() === userName}
                                className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                                style={{
                                  backgroundColor: 'var(--clr-primary-a50)',
                                  color: 'var(--clr-surface-a0)',
                                }}
                              >
                                {isSavingName ? 'Saving...' : 'Save'}
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>Email</label>
                            <p className="mt-1 text-lg" style={{ color: 'var(--clr-light-a0)' }}>{userEmail}</p>
                          </div>

                          <div>
                            <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>Date Joined</label>
                            <p className="mt-1 text-lg" style={{ color: 'var(--clr-light-a0)' }}>
                              {userCreatedAt ? new Date(userCreatedAt).toLocaleDateString('en-AU', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              }) : 'Not available'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div
                        className="p-6 rounded-2xl border mt-6"
                        style={{
                          backgroundColor: 'var(--clr-surface-a10)',
                          borderColor: 'var(--clr-surface-tonal-a20)',
                        }}
                      >
                        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--clr-primary-a50)' }}>Syllabus Dot Point Mapping</h2>
                        <p className="text-sm mb-4" style={{ color: 'var(--clr-surface-a40)' }}>
                          Select an exam paper and map each question using your custom classify → specialist ChatGPT syllabus workflow.
                        </p>

                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>Exam</label>
                            <div className="mt-2 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-3 items-center">
                              <select
                                value={selectedSyllabusMappingPaper}
                                onChange={(e) => setSelectedSyllabusMappingPaper(e.target.value)}
                                disabled={isMappingSyllabusDotPoints || loadingQuestions || availablePapers.length === 0}
                                className="w-full px-4 py-2 rounded-lg border"
                                style={{
                                  backgroundColor: 'var(--clr-surface-a0)',
                                  borderColor: 'var(--clr-surface-tonal-a20)',
                                  color: 'var(--clr-primary-a50)',
                                }}
                              >
                                {availablePapers.length === 0 ? (
                                  <option value="">{loadingQuestions ? 'Loading exams…' : 'No exam papers loaded'}</option>
                                ) : (
                                  availablePapers.map((paper) => (
                                    <option key={getPaperKey(paper)} value={getPaperKey(paper)}>
                                      {paper.year} • {paper.grade} • {paper.subject} • {paper.school} ({paper.count} questions)
                                    </option>
                                  ))
                                )}
                              </select>
                              <button
                                type="button"
                                onClick={() => void fetchAllQuestions({ includeIncomplete: true })}
                                disabled={loadingQuestions || isMappingSyllabusDotPoints}
                                className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50"
                                style={{ backgroundColor: 'var(--clr-surface-a20)', color: 'var(--clr-primary-a50)' }}
                              >
                                {loadingQuestions ? 'Loading…' : 'Load Exams'}
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>
                              Manual Workflow Test Question (LaTeX)
                            </label>
                            <textarea
                              value={syllabusWorkflowTestInput}
                              onChange={(e) => setSyllabusWorkflowTestInput(e.target.value)}
                              disabled={isRunningSyllabusWorkflowTest}
                              rows={6}
                              placeholder="Paste a question here to test classify → specialist workflow output..."
                              className="mt-2 w-full px-4 py-3 rounded-lg border text-sm"
                              style={{
                                backgroundColor: 'var(--clr-surface-a0)',
                                borderColor: 'var(--clr-surface-tonal-a20)',
                                color: 'var(--clr-primary-a50)',
                                resize: 'vertical',
                              }}
                            />
                          </div>

                          <div className="flex items-center gap-3">
                            <button
                              onClick={runSyllabusWorkflowTest}
                              disabled={isRunningSyllabusWorkflowTest || !syllabusWorkflowTestInput.trim()}
                              className="px-4 py-2 rounded-lg font-medium cursor-pointer disabled:opacity-50"
                              style={{
                                backgroundColor: 'var(--clr-primary-a0)',
                                color: 'var(--clr-dark-a0)',
                              }}
                            >
                              {isRunningSyllabusWorkflowTest ? 'Testing...' : 'Run Workflow Test'}
                            </button>
                            {syllabusWorkflowTestResult && (
                              <span
                                className="text-sm"
                                style={{
                                  color:
                                    syllabusWorkflowTestStatus === 'error'
                                      ? 'var(--clr-danger-a10)'
                                      : syllabusWorkflowTestStatus === 'success'
                                        ? 'var(--clr-success-a10)'
                                        : 'var(--clr-surface-a50)',
                                }}
                              >
                                {syllabusWorkflowTestResult}
                              </span>
                            )}
                          </div>

                          {syllabusWorkflowTestOutput && (
                            <div
                              className="rounded-xl border p-4"
                              style={{
                                backgroundColor: 'var(--clr-surface-a0)',
                                borderColor: 'var(--clr-surface-tonal-a20)',
                              }}
                            >
                              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--clr-primary-a50)' }}>
                                Workflow Test Output
                              </h3>
                              <div className="space-y-3 mb-3">
                                <div>
                                  <label className="text-xs font-medium" style={{ color: 'var(--clr-surface-a50)' }}>
                                    Classifier ChatGPT Output
                                  </label>
                                  <textarea
                                    readOnly
                                    rows={4}
                                    value={String(syllabusWorkflowTestOutput.classifier_raw_output || '')}
                                    className="mt-1 w-full px-3 py-2 rounded-md border text-xs"
                                    style={{
                                      backgroundColor: 'var(--clr-dark-a0)',
                                      borderColor: 'var(--clr-surface-tonal-a20)',
                                      color: 'var(--clr-light-a0)',
                                      resize: 'vertical',
                                    }}
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-medium" style={{ color: 'var(--clr-surface-a50)' }}>
                                    Specialist ChatGPT Output
                                  </label>
                                  <textarea
                                    readOnly
                                    rows={6}
                                    value={String(syllabusWorkflowTestOutput.specialist_raw_output || '')}
                                    className="mt-1 w-full px-3 py-2 rounded-md border text-xs"
                                    style={{
                                      backgroundColor: 'var(--clr-dark-a0)',
                                      borderColor: 'var(--clr-surface-tonal-a20)',
                                      color: 'var(--clr-light-a0)',
                                      resize: 'vertical',
                                    }}
                                  />
                                </div>
                              </div>
                              <pre
                                className="text-xs whitespace-pre-wrap break-words rounded-md p-3"
                                style={{
                                  backgroundColor: 'var(--clr-dark-a0)',
                                  color: 'var(--clr-light-a0)',
                                }}
                              >
                                {JSON.stringify(syllabusWorkflowTestOutput, null, 2)}
                              </pre>
                            </div>
                          )}

                          <div className="flex items-center gap-3">
                            <button
                              onClick={runSyllabusDotPointMapping}
                              disabled={isMappingSyllabusDotPoints || availablePapers.length === 0}
                              className="px-4 py-2 rounded-lg font-medium cursor-pointer disabled:opacity-50"
                              style={{
                                backgroundColor: 'var(--clr-primary-a0)',
                                color: 'var(--clr-dark-a0)',
                              }}
                            >
                              {isMappingSyllabusDotPoints ? 'Mapping...' : 'Automate Syllabus Mapping'}
                            </button>
                            {syllabusMappingResult && (
                              <span
                                className="text-sm"
                                style={{
                                  color:
                                    syllabusMappingStatus === 'error'
                                      ? 'var(--clr-danger-a10)'
                                      : syllabusMappingStatus === 'success'
                                        ? 'var(--clr-success-a10)'
                                        : 'var(--clr-surface-a50)',
                                }}
                              >
                                {syllabusMappingResult}
                              </span>
                            )}
                          </div>

                          {isMappingSyllabusDotPoints && syllabusMappingProgress && (
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs" style={{ color: 'var(--clr-surface-a40)' }}>
                                <span>Processing questions…</span>
                                <span>{syllabusMappingProgress.current} / {syllabusMappingProgress.total}</span>
                              </div>
                              <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--clr-surface-tonal-a20)' }}>
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${syllabusMappingProgress.total > 0 ? Math.round((syllabusMappingProgress.current / syllabusMappingProgress.total) * 100) : 0}%`,
                                    backgroundColor: 'var(--clr-primary-a0)',
                                  }}
                                />
                              </div>
                            </div>
                          )}

                          {syllabusMappingDebugOutputs.length > 0 && (
                            <div
                              className="mt-3 rounded-xl border p-4 max-h-96 overflow-y-auto custom-scrollbar"
                              style={{
                                backgroundColor: 'var(--clr-surface-a0)',
                                borderColor: 'var(--clr-surface-tonal-a20)',
                              }}
                            >
                              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--clr-primary-a50)' }}>
                                Workflow Mapping Debug Output
                              </h3>
                              <div className="space-y-3">
                                {syllabusMappingDebugOutputs.map((entry, index) => {
                                  const rawText = String(entry?.rawModelOutput || '').trim();
                                  const parsedText = entry?.parsedModelOutput
                                    ? JSON.stringify(entry.parsedModelOutput, null, 2)
                                    : '';
                                  return (
                                    <div
                                      key={`${entry.questionId}-${index}`}
                                      className="rounded-lg border p-3"
                                      style={{
                                        backgroundColor: 'var(--clr-surface-a10)',
                                        borderColor: 'var(--clr-surface-tonal-a20)',
                                      }}
                                    >
                                      <p className="text-xs font-medium mb-2" style={{ color: 'var(--clr-surface-a50)' }}>
                                        Q{entry.questionNumber || 'unknown'} • {entry.topic} • {entry.reason}
                                      </p>
                                      {rawText ? (
                                        <pre
                                          className="text-xs whitespace-pre-wrap break-words rounded-md p-2"
                                          style={{
                                            backgroundColor: 'var(--clr-dark-a0)',
                                            color: 'var(--clr-light-a0)',
                                          }}
                                        >
                                          {rawText}
                                        </pre>
                                      ) : (
                                        <p className="text-xs" style={{ color: 'var(--clr-surface-a40)' }}>
                                          No raw model output returned.
                                        </p>
                                      )}
                                      {parsedText && (
                                        <details className="mt-2">
                                          <summary className="text-xs cursor-pointer" style={{ color: 'var(--clr-primary-a50)' }}>
                                            Parsed JSON
                                          </summary>
                                          <pre
                                            className="text-xs whitespace-pre-wrap break-words rounded-md p-2 mt-2"
                                            style={{
                                              backgroundColor: 'var(--clr-surface-a20)',
                                              color: 'var(--clr-primary-a50)',
                                            }}
                                          >
                                            {parsedText}
                                          </pre>
                                        </details>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div
                        className="p-6 rounded-2xl border mt-6"
                        style={{
                          backgroundColor: 'var(--clr-surface-a10)',
                          borderColor: 'var(--clr-surface-tonal-a20)',
                        }}
                      >
                        <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--clr-primary-a50)' }}>Syllabus Import</h2>
                        <p className="text-sm mb-4" style={{ color: 'var(--clr-surface-a40)' }}>
                          Paste syllabus dot points to populate the taxonomy database. Use the format below.
                        </p>

                        <div className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>Grade</label>
                              <select
                                value={syllabusImportGrade}
                                onChange={(e) => setSyllabusImportGrade(e.target.value as typeof syllabusImportGrade)}
                                disabled={syllabusImporting}
                                className="mt-2 w-full px-4 py-2 rounded-lg border"
                                style={{
                                  backgroundColor: 'var(--clr-surface-a0)',
                                  borderColor: 'var(--clr-surface-tonal-a20)',
                                  color: 'var(--clr-primary-a50)',
                                }}
                              >
                                {Object.keys(SUBJECTS_BY_YEAR).map((g) => (
                                  <option key={g} value={g}>{g}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>Subject</label>
                              <select
                                value={syllabusImportSubject}
                                onChange={(e) => setSyllabusImportSubject(e.target.value)}
                                disabled={syllabusImporting}
                                className="mt-2 w-full px-4 py-2 rounded-lg border"
                                style={{
                                  backgroundColor: 'var(--clr-surface-a0)',
                                  borderColor: 'var(--clr-surface-tonal-a20)',
                                  color: 'var(--clr-primary-a50)',
                                }}
                              >
                                {(SUBJECTS_BY_YEAR[syllabusImportGrade] || []).map((s) => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>Syllabus Content</label>
                            <textarea
                              value={syllabusImportText}
                              onChange={(e) => setSyllabusImportText(e.target.value)}
                              disabled={syllabusImporting}
                              rows={16}
                              placeholder={`TOPIC Financial mathematics A\n\nSUBTOPIC Solve problems involving earning money\nPOINT_1 Solve problems involving wages given an hourly rate…\nPOINT_2 Calculate earnings from non-wage sources…\n\nSUBTOPIC Solve problems involving simple interest\nPOINT_1 Establish and use the formula $I = Prn$…`}
                              className="mt-2 w-full px-4 py-3 rounded-lg border font-mono text-sm leading-relaxed"
                              style={{
                                backgroundColor: 'var(--clr-surface-a0)',
                                borderColor: 'var(--clr-surface-tonal-a20)',
                                color: 'var(--clr-primary-a50)',
                                resize: 'vertical',
                              }}
                            />
                          </div>

                          <details className="text-xs" style={{ color: 'var(--clr-surface-a40)' }}>
                            <summary className="cursor-pointer font-medium hover:underline">Format reference</summary>
                            <pre className="mt-2 p-3 rounded-lg overflow-x-auto text-xs leading-relaxed" style={{ backgroundColor: 'var(--clr-surface-a0)', color: 'var(--clr-surface-a50)' }}>
                              {`TOPIC <topic name>

SUBTOPIC <subtopic name>
POINT_1 <dot point text, may include LaTeX>
POINT_2 <dot point text>
...

SUBTOPIC <another subtopic>
POINT_1 ...`}
                            </pre>
                            <p className="mt-2">
                              The <strong>GRADE</strong> line is optional — if omitted, the grade selected above is used automatically.
                              You can include multiple TOPIC blocks. Each TOPIC can have multiple SUBTOPICs.
                            </p>
                          </details>

                          <div className="flex items-center gap-3">
                            <button
                              onClick={runSyllabusImport}
                              disabled={syllabusImporting || !syllabusImportText.trim()}
                              className="px-5 py-2 rounded-lg font-medium cursor-pointer disabled:opacity-50"
                              style={{
                                backgroundColor: 'var(--clr-primary-a0)',
                                color: 'var(--clr-dark-a0)',
                              }}
                            >
                              {syllabusImporting ? 'Importing…' : 'Import Syllabus'}
                            </button>
                            {syllabusImportResult && (
                              <span
                                className="text-sm"
                                style={{
                                  color:
                                    syllabusImportStatus === 'error'
                                      ? 'var(--clr-danger-a10)'
                                      : syllabusImportStatus === 'success'
                                        ? 'var(--clr-success-a10)'
                                        : 'var(--clr-surface-a50)',
                                }}
                              >
                                {syllabusImportResult}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {isDevMode && (
                        <div
                          className="p-6 rounded-2xl border mt-6"
                          style={{
                            backgroundColor: 'var(--clr-surface-a10)',
                            borderColor: 'var(--clr-surface-tonal-a20)',
                          }}
                        >
                          <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--clr-primary-a50)' }}>PDF Intake</h2>
                          <p className="text-sm mb-4" style={{ color: 'var(--clr-surface-a40)' }}>
                            Upload the exam PDF and/or the marking criteria PDF. The response will be used to create new questions automatically.
                          </p>

                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>Grade</label>
                                <select
                                  value={pdfGrade}
                                  onChange={(e) => {
                                    const nextGrade = e.target.value as 'Year 7' | 'Year 8' | 'Year 9' | 'Year 10' | 'Year 11' | 'Year 12';
                                    const nextSubjects = SUBJECTS_BY_YEAR[nextGrade];
                                    setPdfGrade(nextGrade);
                                    if (!nextSubjects.includes(pdfSubject)) {
                                      setPdfSubject(nextSubjects[0]);
                                    }
                                  }}
                                  className="mt-2 w-full px-4 py-2 rounded-lg border"
                                  style={{
                                    backgroundColor: 'var(--clr-surface-a0)',
                                    borderColor: 'var(--clr-surface-tonal-a20)',
                                    color: 'var(--clr-primary-a50)',
                                  }}
                                >
                                  <option value="Year 7">Year 7</option>
                                  <option value="Year 8">Year 8</option>
                                  <option value="Year 9">Year 9</option>
                                  <option value="Year 10">Year 10</option>
                                  <option value="Year 11">Year 11</option>
                                  <option value="Year 12">Year 12</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>Exam Year</label>
                                <select
                                  id="pdf-intake-year"
                                  value={pdfYear}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    pdfYearRef.current = v;
                                    setPdfYear(v);
                                  }}
                                  className="mt-2 w-full px-4 py-2 rounded-lg border"
                                  style={{
                                    backgroundColor: 'var(--clr-surface-a0)',
                                    borderColor: 'var(--clr-surface-tonal-a20)',
                                    color: 'var(--clr-primary-a50)',
                                  }}
                                >
                                  {YEARS.map((year) => (
                                    <option key={year} value={year}>{year}</option>
                                  ))}
                                </select>
                                <p className="mt-2 text-xs" style={{ color: 'var(--clr-surface-a40)' }}>
                                  Accepted years: {MIN_EXAM_YEAR}–{CURRENT_EXAM_YEAR}
                                </p>
                              </div>
                              <div>
                                <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>Subject</label>
                                <select
                                  value={pdfSubject}
                                  onChange={(e) => setPdfSubject(e.target.value)}
                                  className="mt-2 w-full px-4 py-2 rounded-lg border"
                                  style={{
                                    backgroundColor: 'var(--clr-surface-a0)',
                                    borderColor: 'var(--clr-surface-tonal-a20)',
                                    color: 'var(--clr-primary-a50)',
                                  }}
                                >
                                  {SUBJECTS_BY_YEAR[pdfGrade].map((subject) => (
                                    <option key={subject} value={subject}>{subject}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>School Name</label>
                                <input
                                  type="text"
                                  value={pdfSchoolName}
                                  onChange={(e) => setPdfSchoolName(e.target.value)}
                                  placeholder="e.g., Riverside High School"
                                  className="mt-2 w-full px-4 py-2 rounded-lg border"
                                  style={{
                                    backgroundColor: 'var(--clr-surface-a0)',
                                    borderColor: 'var(--clr-surface-tonal-a20)',
                                    color: 'var(--clr-primary-a50)',
                                  }}
                                />
                              </div>
                              <div>
                                <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>Paper Number (optional)</label>
                                <input
                                  type="number"
                                  min={1}
                                  step={1}
                                  value={pdfPaperNumber}
                                  onChange={(e) => setPdfPaperNumber(e.target.value)}
                                  placeholder="Auto if blank"
                                  className="mt-2 w-full px-4 py-2 rounded-lg border"
                                  style={{
                                    backgroundColor: 'var(--clr-surface-a0)',
                                    borderColor: 'var(--clr-surface-tonal-a20)',
                                    color: 'var(--clr-primary-a50)',
                                  }}
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>Exam PDF (optional)</label>
                              <input
                                type="file"
                                accept="application/pdf"
                                onChange={(e) => setExamPdfFile(e.target.files?.[0] || null)}
                                className="mt-2 w-full px-4 py-2 rounded-lg border"
                                style={{
                                  backgroundColor: 'var(--clr-surface-a0)',
                                  borderColor: 'var(--clr-surface-tonal-a20)',
                                  color: 'var(--clr-primary-a50)',
                                }}
                              />
                              {examPdfFile && (
                                <p className="mt-2 text-xs" style={{ color: 'var(--clr-surface-a50)' }}>
                                  Selected: {examPdfFile.name}
                                </p>
                              )}
                            </div>

                            <div>
                              <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>Marking Criteria PDF (optional)</label>
                              <input
                                type="file"
                                accept="application/pdf"
                                onChange={(e) => setCriteriaPdfFile(e.target.files?.[0] || null)}
                                className="mt-2 w-full px-4 py-2 rounded-lg border"
                                style={{
                                  backgroundColor: 'var(--clr-surface-a0)',
                                  borderColor: 'var(--clr-surface-tonal-a20)',
                                  color: 'var(--clr-primary-a50)',
                                }}
                              />
                            </div>
                          </div>
                          <div className="mt-4">
                            <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>
                              Exam Images (JPEG/PNG) – alternative to Exam PDF
                            </label>
                            <input
                              type="file"
                              accept="image/jpeg,image/png"
                              multiple
                              onChange={(e) => {
                                const files = Array.from(e.target.files || []);
                                setExamImageFiles(files);
                              }}
                              className="mt-2 w-full px-4 py-2 rounded-lg border"
                              style={{
                                backgroundColor: 'var(--clr-surface-a0)',
                                borderColor: 'var(--clr-surface-tonal-a20)',
                                color: 'var(--clr-primary-a50)',
                              }}
                            />
                            {examImageFiles.length > 0 && (
                              <p className="mt-2 text-xs" style={{ color: 'var(--clr-surface-a50)' }}>
                                Selected {examImageFiles.length} image{examImageFiles.length > 1 ? 's' : ''}.
                              </p>
                            )}

                            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--clr-surface-a50)' }}>
                              <input
                                type="checkbox"
                                checked={pdfOverwrite}
                                onChange={(e) => setPdfOverwrite(e.target.checked)}
                              />
                              Overwrite existing questions and marking criteria for this grade/year/subject/school/paper number
                            </label>

                            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--clr-surface-a50)' }}>
                              <input
                                type="checkbox"
                                checked={pdfGenerateCriteria}
                                onChange={(e) => setPdfGenerateCriteria(e.target.checked)}
                              />
                              Generate marking criteria from mark count
                            </label>

                            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--clr-surface-a50)' }}>
                              <input
                                type="checkbox"
                                checked={pdfAutoGroupSubparts}
                                onChange={(e) => setPdfAutoGroupSubparts(e.target.checked)}
                              />
                              Auto-group lettered subparts (e.g. 11(a), 11(b), 11(c)) for Custom Exam
                            </label>

                            <div className="flex items-center gap-3">
                              <button
                                onClick={submitPdfPair}
                                disabled={pdfStatus === 'uploading'}
                                className="px-4 py-2 rounded-lg font-medium cursor-pointer disabled:opacity-50"
                                style={{
                                  backgroundColor: 'var(--clr-primary-a0)',
                                  color: 'var(--clr-dark-a0)',
                                }}
                              >
                                {pdfStatus === 'uploading' ? 'Uploading...' : 'Upload Files'}
                              </button>
                              {pdfMessage && (
                                <span
                                  className="text-sm"
                                  style={{ color: pdfStatus === 'error' ? 'var(--clr-danger-a10)' : 'var(--clr-surface-a50)' }}
                                >
                                  {pdfMessage}
                                </span>
                              )}
                            </div>

                            {pdfRawInputs && (
                              <div className="mt-4">
                                <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>
                                  Raw Model Input
                                </label>
                                <textarea
                                  readOnly
                                  value={pdfRawInputs}
                                  rows={12}
                                  className="mt-2 w-full px-4 py-2 rounded-lg border font-mono text-sm"
                                  style={{
                                    backgroundColor: 'var(--clr-surface-a0)',
                                    borderColor: 'var(--clr-surface-tonal-a20)',
                                    color: 'var(--clr-primary-a50)',
                                  }}
                                />
                              </div>
                            )}

                            {pdfChatGptResponse && (
                              <div className="mt-4">
                                <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>
                                  Model Response
                                </label>
                                <textarea
                                  readOnly
                                  value={pdfChatGptResponse}
                                  rows={12}
                                  className="mt-2 w-full px-4 py-2 rounded-lg border font-mono text-sm"
                                  style={{
                                    backgroundColor: 'var(--clr-surface-a0)',
                                    borderColor: 'var(--clr-surface-tonal-a20)',
                                    color: 'var(--clr-primary-a50)',
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Dev Mode - Upload Logs Page */}
              {viewMode === 'logs' && (
                <div className="flex-1 flex flex-col h-full">
                  <InteractiveLogsTable />
                </div>
              )}

              {/* Dev Mode - Question Management Page */}
              {viewMode === 'dev-questions' && (
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}>
                    <h1 className="text-3xl font-bold" style={{ color: 'var(--clr-primary-a50)' }}>Developer Tools</h1>
                    <button
                      onClick={() => setViewMode('browse')}
                      className="p-2 rounded-lg cursor-pointer"
                      style={{ color: 'var(--clr-surface-a40)' }}
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-4 p-6 border-b" style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}>
                    <button
                      onClick={() => setDevTab('add')}
                      className="px-4 py-2 rounded-lg font-medium transition cursor-pointer"
                      style={{
                        backgroundColor: devTab === 'add' ? 'var(--clr-primary-a0)' : 'transparent',
                        color: devTab === 'add' ? 'var(--clr-dark-a0)' : 'var(--clr-surface-a40)',
                        borderBottom: devTab === 'add' ? `2px solid var(--clr-primary-a0)` : 'none',
                      }}
                    >
                      Add Question
                    </button>
                    <button
                      onClick={() => setDevTab('manage')}
                      className="px-4 py-2 rounded-lg font-medium transition cursor-pointer"
                      style={{
                        backgroundColor: devTab === 'manage' ? 'var(--clr-primary-a0)' : 'transparent',
                        color: devTab === 'manage' ? 'var(--clr-dark-a0)' : 'var(--clr-surface-a40)',
                        borderBottom: devTab === 'manage' ? `2px solid var(--clr-primary-a0)` : 'none',
                      }}
                    >
                      Manage Questions ({allQuestions.length})
                    </button>
                    <button
                      onClick={() => setDevTab('review')}
                      className="px-4 py-2 rounded-lg font-medium transition cursor-pointer"
                      style={{
                        backgroundColor: devTab === 'review' ? 'var(--clr-primary-a0)' : 'transparent',
                        color: devTab === 'review' ? 'var(--clr-dark-a0)' : 'var(--clr-surface-a40)',
                        borderBottom: devTab === 'review' ? `2px solid var(--clr-primary-a0)` : 'none',
                      }}
                    >
                      Review solutions
                    </button>
                  </div>

                  <div className="flex-1 p-8 overflow-y-auto">
                    {devTab === 'add' && (
                      <div className="max-w-2xl">
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clr-primary-a50)' }}>Grade</label>
                            <select
                              value={newQuestion.grade}
                              onChange={(e) => {
                                const nextGrade = e.target.value as 'Year 7' | 'Year 8' | 'Year 9' | 'Year 10' | 'Year 11' | 'Year 12';
                                const nextSubject = SUBJECTS_BY_YEAR[nextGrade][0];
                                const nextTopic = getTopics(nextGrade, nextSubject)[0] || '';
                                setNewQuestion({
                                  ...newQuestion,
                                  grade: nextGrade,
                                  subject: nextSubject,
                                  topic: nextTopic,
                                });
                              }}
                              className="w-full px-4 py-2 rounded-lg border"
                              style={{
                                backgroundColor: 'var(--clr-surface-a0)',
                                borderColor: 'var(--clr-surface-tonal-a20)',
                                color: 'var(--clr-primary-a50)',
                              }}
                            >
                              <option>Year 7</option>
                              <option>Year 8</option>
                              <option>Year 9</option>
                              <option>Year 10</option>
                              <option>Year 11</option>
                              <option>Year 12</option>
                            </select>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clr-primary-a50)' }}>Year</label>
                              <input
                                type="number"
                                value={newQuestion.year}
                                onChange={(e) => setNewQuestion({ ...newQuestion, year: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg border"
                                style={{
                                  backgroundColor: 'var(--clr-surface-a0)',
                                  borderColor: 'var(--clr-surface-tonal-a20)',
                                  color: 'var(--clr-primary-a50)',
                                }}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clr-primary-a50)' }}>Marks</label>
                              <input
                                type="number"
                                value={newQuestion.marks}
                                onChange={(e) => setNewQuestion({ ...newQuestion, marks: parseInt(e.target.value) })}
                                className="w-full px-4 py-2 rounded-lg border"
                                style={{
                                  backgroundColor: 'var(--clr-surface-a0)',
                                  borderColor: 'var(--clr-surface-tonal-a20)',
                                  color: 'var(--clr-primary-a50)',
                                }}
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clr-primary-a50)' }}>Question Type</label>
                            <select
                              value={newQuestion.questionType}
                              onChange={(e) => setNewQuestion({ ...newQuestion, questionType: e.target.value })}
                              className="w-full px-4 py-2 rounded-lg border"
                              style={{
                                backgroundColor: 'var(--clr-surface-a0)',
                                borderColor: 'var(--clr-surface-tonal-a20)',
                                color: 'var(--clr-primary-a50)',
                              }}
                            >
                              <option value="written">Written Response</option>
                              <option value="multiple_choice">Multiple Choice</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clr-primary-a50)' }}>Subject</label>
                            <select
                              value={newQuestion.subject}
                              onChange={(e) => {
                                const nextSubject = e.target.value;
                                const nextTopics = getTopics(newQuestion.grade, nextSubject);
                                setNewQuestion({
                                  ...newQuestion,
                                  subject: nextSubject,
                                  topic: nextTopics[0] || '',
                                });
                              }}
                              className="w-full px-4 py-2 rounded-lg border"
                              style={{
                                backgroundColor: 'var(--clr-surface-a0)',
                                borderColor: 'var(--clr-surface-tonal-a20)',
                                color: 'var(--clr-primary-a50)',
                              }}
                            >
                              {SUBJECTS_BY_YEAR[newQuestion.grade as 'Year 7' | 'Year 8' | 'Year 9' | 'Year 10' | 'Year 11' | 'Year 12']?.map((subject) => (
                                <option key={subject} value={subject}>{subject}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clr-primary-a50)' }}>Topic</label>
                            <select
                              value={newQuestion.topic}
                              onChange={(e) => setNewQuestion({ ...newQuestion, topic: e.target.value })}
                              className="w-full px-4 py-2 rounded-lg border"
                              style={{
                                backgroundColor: 'var(--clr-surface-a0)',
                                borderColor: 'var(--clr-surface-tonal-a20)',
                                color: 'var(--clr-primary-a50)',
                              }}
                            >
                              {(() => {
                                const scopedTopics = getTopics(newQuestion.grade, newQuestion.subject);
                                const current = newQuestion.topic?.trim();
                                const baseOptions = scopedTopics.length > 0 ? scopedTopics : ALL_TOPICS;
                                const options = current && !baseOptions.includes(current) ? [current, ...baseOptions] : baseOptions;
                                return options.map((topic) => <option key={topic} value={topic}>{topic}</option>);
                              })()}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clr-primary-a50)' }}>Question Number</label>
                            <input
                              type="text"
                              value={newQuestion.questionNumber}
                              onChange={(e) => setNewQuestion({ ...newQuestion, questionNumber: e.target.value })}
                              placeholder="e.g., 11 or 11a)"
                              className="w-full px-4 py-2 rounded-lg border"
                              style={{
                                backgroundColor: 'var(--clr-surface-a0)',
                                borderColor: 'var(--clr-surface-tonal-a20)',
                                color: 'var(--clr-primary-a50)',
                              }}
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clr-primary-a50)' }}>Question Text</label>
                            <textarea
                              value={newQuestion.questionText}
                              onChange={(e) => setNewQuestion({ ...newQuestion, questionText: e.target.value })}
                              placeholder="Enter question (use $ for LaTeX)"
                              rows={4}
                              className="w-full px-4 py-2 rounded-lg border"
                              style={{
                                backgroundColor: 'var(--clr-surface-a0)',
                                borderColor: 'var(--clr-surface-tonal-a20)',
                                color: 'var(--clr-primary-a50)',
                              }}
                            />
                          </div>

                          {newQuestion.questionType === 'multiple_choice' ? (
                            <>
                              <div className="space-y-4">
                                <div className="p-3 rounded-lg border" style={{ borderColor: 'var(--clr-surface-tonal-a20)', backgroundColor: 'var(--clr-surface-a05)' }}>
                                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--clr-primary-a50)' }}>Option A</label>
                                  <input type="text" placeholder="Text (LaTeX)" value={newQuestion.mcqOptionA} onChange={(e) => setNewQuestion({ ...newQuestion, mcqOptionA: e.target.value })} className="w-full px-3 py-2 rounded border text-sm mb-2" style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }} />
                                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--clr-surface-a40)' }}>Or image URL (shows image instead of text)</label>
                                  <input type="url" placeholder="https://... or data:image/..." value={newQuestion.mcqOptionAImage} onChange={(e) => setNewQuestion({ ...newQuestion, mcqOptionAImage: e.target.value })} className="w-full px-3 py-2 rounded border text-sm" style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }} />
                                </div>
                                <div className="p-3 rounded-lg border" style={{ borderColor: 'var(--clr-surface-tonal-a20)', backgroundColor: 'var(--clr-surface-a05)' }}>
                                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--clr-primary-a50)' }}>Option B</label>
                                  <input type="text" placeholder="Text (LaTeX)" value={newQuestion.mcqOptionB} onChange={(e) => setNewQuestion({ ...newQuestion, mcqOptionB: e.target.value })} className="w-full px-3 py-2 rounded border text-sm mb-2" style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }} />
                                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--clr-surface-a40)' }}>Or image URL</label>
                                  <input type="url" placeholder="https://... or data:image/..." value={newQuestion.mcqOptionBImage} onChange={(e) => setNewQuestion({ ...newQuestion, mcqOptionBImage: e.target.value })} className="w-full px-3 py-2 rounded border text-sm" style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }} />
                                </div>
                                <div className="p-3 rounded-lg border" style={{ borderColor: 'var(--clr-surface-tonal-a20)', backgroundColor: 'var(--clr-surface-a05)' }}>
                                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--clr-primary-a50)' }}>Option C</label>
                                  <input type="text" placeholder="Text (LaTeX)" value={newQuestion.mcqOptionC} onChange={(e) => setNewQuestion({ ...newQuestion, mcqOptionC: e.target.value })} className="w-full px-3 py-2 rounded border text-sm mb-2" style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }} />
                                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--clr-surface-a40)' }}>Or image URL</label>
                                  <input type="url" placeholder="https://... or data:image/..." value={newQuestion.mcqOptionCImage} onChange={(e) => setNewQuestion({ ...newQuestion, mcqOptionCImage: e.target.value })} className="w-full px-3 py-2 rounded border text-sm" style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }} />
                                </div>
                                <div className="p-3 rounded-lg border" style={{ borderColor: 'var(--clr-surface-tonal-a20)', backgroundColor: 'var(--clr-surface-a05)' }}>
                                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--clr-primary-a50)' }}>Option D</label>
                                  <input type="text" placeholder="Text (LaTeX)" value={newQuestion.mcqOptionD} onChange={(e) => setNewQuestion({ ...newQuestion, mcqOptionD: e.target.value })} className="w-full px-3 py-2 rounded border text-sm mb-2" style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }} />
                                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--clr-surface-a40)' }}>Or image URL</label>
                                  <input type="url" placeholder="https://... or data:image/..." value={newQuestion.mcqOptionDImage} onChange={(e) => setNewQuestion({ ...newQuestion, mcqOptionDImage: e.target.value })} className="w-full px-3 py-2 rounded border text-sm" style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }} />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clr-primary-a50)' }}>Correct Answer</label>
                                  <select
                                    value={newQuestion.mcqCorrectAnswer}
                                    onChange={(e) => setNewQuestion({ ...newQuestion, mcqCorrectAnswer: e.target.value })}
                                    className="w-full px-4 py-2 rounded-lg border"
                                    style={{
                                      backgroundColor: 'var(--clr-surface-a0)',
                                      borderColor: 'var(--clr-surface-tonal-a20)',
                                      color: 'var(--clr-primary-a50)',
                                    }}
                                  >
                                    <option value="A">A</option>
                                    <option value="B">B</option>
                                    <option value="C">C</option>
                                    <option value="D">D</option>
                                  </select>
                                </div>
                              </div>

                              <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clr-primary-a50)' }}>Answer Explanation</label>
                                <textarea
                                  value={newQuestion.mcqExplanation}
                                  onChange={(e) => setNewQuestion({ ...newQuestion, mcqExplanation: e.target.value })}
                                  placeholder="Enter explanation (use $ for LaTeX)"
                                  rows={4}
                                  className="w-full px-4 py-2 rounded-lg border"
                                  style={{
                                    backgroundColor: 'var(--clr-surface-a0)',
                                    borderColor: 'var(--clr-surface-tonal-a20)',
                                    color: 'var(--clr-primary-a50)',
                                  }}
                                />
                              </div>
                            </>
                          ) : (
                            <>
                              <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clr-primary-a50)' }}>Marking Criteria</label>
                                <textarea
                                  value={newQuestion.markingCriteria}
                                  onChange={(e) => setNewQuestion({ ...newQuestion, markingCriteria: e.target.value })}
                                  placeholder="Enter marking criteria (format: criteria - X marks)"
                                  rows={3}
                                  className="w-full px-4 py-2 rounded-lg border"
                                  style={{
                                    backgroundColor: 'var(--clr-surface-a0)',
                                    borderColor: 'var(--clr-surface-tonal-a20)',
                                    color: 'var(--clr-primary-a50)',
                                  }}
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clr-primary-a50)' }}>Sample Answer (LaTeX)</label>
                                <textarea
                                  value={newQuestion.sampleAnswer}
                                  onChange={(e) => setNewQuestion({ ...newQuestion, sampleAnswer: e.target.value })}
                                  placeholder="Enter sample answer (use $ for LaTeX)"
                                  rows={4}
                                  className="w-full px-4 py-2 rounded-lg border"
                                  style={{
                                    backgroundColor: 'var(--clr-surface-a0)',
                                    borderColor: 'var(--clr-surface-tonal-a20)',
                                    color: 'var(--clr-primary-a50)',
                                  }}
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clr-primary-a50)' }}>Sample Answer Image URL</label>
                                <input
                                  type="text"
                                  value={newQuestion.sampleAnswerImage}
                                  onChange={(e) => setNewQuestion({ ...newQuestion, sampleAnswerImage: e.target.value })}
                                  placeholder="https://... or data:image/png;base64,..."
                                  className="w-full px-4 py-2 rounded-lg border"
                                  style={{
                                    backgroundColor: 'var(--clr-surface-a0)',
                                    borderColor: 'var(--clr-surface-tonal-a20)',
                                    color: 'var(--clr-primary-a50)',
                                  }}
                                />
                                <p className="text-xs mt-1" style={{ color: 'var(--clr-surface-a40)' }}>If provided, image will be shown instead of LaTeX text</p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-2 mt-2" style={{ color: 'var(--clr-primary-a50)' }}>Sample Answer Image Size</label>
                                <select
                                  value={newQuestion.sampleAnswerImageSize}
                                  onChange={(e) => setNewQuestion({ ...newQuestion, sampleAnswerImageSize: e.target.value as 'small' | 'medium' | 'large' })}
                                  className="w-full px-4 py-2 rounded-lg border"
                                  style={{
                                    backgroundColor: 'var(--clr-surface-a0)',
                                    borderColor: 'var(--clr-surface-tonal-a20)',
                                    color: 'var(--clr-primary-a50)',
                                  }}
                                >
                                  <option value="small">Small</option>
                                  <option value="medium">Medium</option>
                                  <option value="large">Large</option>
                                </select>
                              </div>
                            </>
                          )}

                          <div>
                            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clr-primary-a50)' }}>Graph Image (data URL)</label>
                            <textarea
                              value={newQuestion.graphImageData}
                              onChange={(e) => setNewQuestion({ ...newQuestion, graphImageData: e.target.value })}
                              onPaste={handleGraphPaste}
                              placeholder="Paste a data:image/png;base64,... URL (optional)"
                              rows={3}
                              className="w-full px-4 py-2 rounded-lg border"
                              style={{
                                backgroundColor: 'var(--clr-surface-a0)',
                                borderColor: 'var(--clr-surface-tonal-a20)',
                                color: 'var(--clr-primary-a50)',
                              }}
                            />
                            <div className="mt-3">
                              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clr-primary-a50)' }}>Graph Size</label>
                              <select
                                value={newQuestion.graphImageSize}
                                onChange={(e) => setNewQuestion({ ...newQuestion, graphImageSize: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg border"
                                style={{
                                  backgroundColor: 'var(--clr-surface-a0)',
                                  borderColor: 'var(--clr-surface-tonal-a20)',
                                  color: 'var(--clr-primary-a50)',
                                }}
                              >
                                <option value="small">Small</option>
                                <option value="medium">Medium</option>
                                <option value="large">Large</option>
                              </select>
                            </div>
                            <div className="mt-3 flex items-center gap-3">
                              <label
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer"
                                style={{
                                  backgroundColor: 'var(--clr-surface-a20)',
                                  color: 'var(--clr-primary-a50)',
                                }}
                              >
                                Upload PNG
                                <input type="file" accept="image/png" hidden onChange={handleGraphUpload} />
                              </label>
                              {newQuestion.graphImageData && (
                                <span className="text-xs" style={{ color: 'var(--clr-surface-a40)' }}>
                                  Image loaded
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex gap-3 pt-4">
                            <button
                              onClick={addQuestionToDatabase}
                              disabled={isAddingQuestion}
                              className="flex-1 px-4 py-3 rounded-lg font-medium cursor-pointer disabled:opacity-50"
                              style={{
                                backgroundColor: 'var(--clr-success-a0)',
                                color: 'var(--clr-light-a0)',
                              }}
                            >
                              {isAddingQuestion ? 'Adding...' : 'Add Question'}
                            </button>
                            <button
                              onClick={() => setViewMode('browse')}
                              className="flex-1 px-4 py-3 rounded-lg font-medium cursor-pointer"
                              style={{
                                backgroundColor: 'var(--clr-surface-a20)',
                                color: 'var(--clr-primary-a50)',
                              }}
                            >
                              Back
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {devTab === 'manage' && (
                      <div className="max-w-6xl">
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-lg font-semibold" style={{ color: 'var(--clr-primary-a50)' }}>Manage Questions</h2>
                        </div>

                        <div className="flex items-center gap-2 mb-6">
                          <button
                            type="button"
                            onClick={() => setManageSubView('list')}
                            className="px-3 py-2 rounded-lg text-sm font-medium cursor-pointer"
                            style={{
                              backgroundColor: manageSubView === 'list' ? 'var(--clr-primary-a0)' : 'var(--clr-surface-a20)',
                              color: manageSubView === 'list' ? 'var(--clr-dark-a0)' : 'var(--clr-primary-a50)',
                            }}
                          >
                            Questions
                          </button>
                          <button
                            type="button"
                            onClick={openManageImageMap}
                            className="px-3 py-2 rounded-lg text-sm font-medium cursor-pointer"
                            style={{
                              backgroundColor: manageSubView === 'image-map' ? 'var(--clr-primary-a0)' : 'var(--clr-surface-a20)',
                              color: manageSubView === 'image-map' ? 'var(--clr-dark-a0)' : 'var(--clr-primary-a50)',
                            }}
                          >
                            Exam Image Mapping
                          </button>
                        </div>

                        {manageSubView === 'list' ? (
                          <div>
                        <div className="mb-4 rounded-xl border p-4" style={{ borderColor: 'var(--clr-surface-tonal-a20)', backgroundColor: 'var(--clr-surface-a05)' }}>
                          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                            <div className="lg:w-[420px]">
                              <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--clr-surface-a40)' }}>
                                Exam Visibility (Dev)
                              </label>
                              <select
                                value={selectedVisibilityExamKey}
                                onChange={(e) => setSelectedVisibilityExamKey(e.target.value)}
                                disabled={!manageExamBuckets.length || !!examVisibilityUpdatingKey}
                                className="w-full px-3 py-2 rounded-lg border text-sm"
                                style={{
                                  backgroundColor: 'var(--clr-surface-a0)',
                                  borderColor: 'var(--clr-surface-tonal-a20)',
                                  color: 'var(--clr-primary-a50)',
                                }}
                              >
                                {manageExamBuckets.length === 0 ? (
                                  <option value="">No exams loaded</option>
                                ) : (
                                  manageExamBuckets.map((exam) => (
                                    <option key={exam.key} value={exam.key}>
                                      {exam.year} • {exam.grade} • {exam.subject} • {exam.school} ({exam.count}) [{exam.status}]
                                    </option>
                                  ))
                                )}
                              </select>
                            </div>

                            <div className="flex items-center gap-2 pt-1 lg:pt-6">
                              <button
                                type="button"
                                onClick={() => setSelectedExamIncomplete(true)}
                                disabled={!selectedVisibilityExamKey || !!examVisibilityUpdatingKey}
                                className="px-3 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50"
                                style={{ backgroundColor: 'var(--clr-warning-a0)', color: 'var(--clr-light-a0)' }}
                              >
                                {examVisibilityUpdatingKey ? 'Updating…' : 'Mark Incomplete'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedExamIncomplete(false)}
                                disabled={!selectedVisibilityExamKey || !!examVisibilityUpdatingKey}
                                className="px-3 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50"
                                style={{ backgroundColor: 'var(--clr-success-a0)', color: 'var(--clr-light-a0)' }}
                              >
                                {examVisibilityUpdatingKey ? 'Updating…' : 'Mark Complete'}
                              </button>
                            </div>
                          </div>
                          {examVisibilityMessage && (
                            <p className="mt-2 text-sm" style={{ color: 'var(--clr-surface-a50)' }}>
                              {examVisibilityMessage}
                            </p>
                          )}
                        </div>

                        <div className="mb-4 rounded-xl border p-4" style={{ borderColor: 'var(--clr-surface-tonal-a20)', backgroundColor: 'var(--clr-surface-a05)' }}>
                          <div className="flex flex-col lg:flex-row lg:items-end gap-3">
                            <div className="lg:w-[520px]">
                              <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--clr-surface-a40)' }}>
                                Auto-Group Paper Subparts
                              </label>
                              <select
                                value={selectedGroupingPaperKey}
                                onChange={(e) => setSelectedGroupingPaperKey(e.target.value)}
                                disabled={!groupingPaperBuckets.length || groupingPaperLoading}
                                className="w-full px-3 py-2 rounded-lg border text-sm"
                                style={{
                                  backgroundColor: 'var(--clr-surface-a0)',
                                  borderColor: 'var(--clr-surface-tonal-a20)',
                                  color: 'var(--clr-primary-a50)',
                                }}
                              >
                                {groupingPaperBuckets.length === 0 ? (
                                  <option value="">No Mathematics or Mathematics Advanced papers loaded</option>
                                ) : (
                                  groupingPaperBuckets.map((paper) => (
                                    <option key={paper.key} value={paper.key}>
                                      {paper.year} • {paper.grade} • {paper.subject} • {paper.school} • {paper.paperNumber == null ? 'No paper #' : `Paper ${paper.paperNumber}`} ({paper.count})
                                    </option>
                                  ))
                                )}
                              </select>
                              <p className="mt-2 text-xs" style={{ color: 'var(--clr-surface-a40)' }}>
                                This groups lettered subparts like 11(a), 11(b), 11(c), and any nested roman numeral parts under the same main question.
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={autoGroupSubpartQuestions}
                              disabled={!selectedGroupingPaperKey || groupingPaperLoading}
                              className="px-3 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50"
                              style={{ backgroundColor: 'var(--clr-primary-a0)', color: 'var(--clr-dark-a0)' }}
                            >
                              {groupingPaperLoading ? 'Grouping…' : 'Auto-Group Selected Paper'}
                            </button>
                          </div>
                          {groupingPaperMessage && (
                            <p className="mt-2 text-sm" style={{ color: 'var(--clr-surface-a50)' }}>
                              {groupingPaperMessage}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 mb-4">
                          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--clr-surface-a50)' }}>
                            <input
                              type="checkbox"
                              checked={
                                filteredManageQuestionIds.length > 0 &&
                                filteredManageQuestionIds.every((id) => selectedManageQuestionIds.includes(id))
                              }
                              onChange={(e) => setAllManageSelections(e.target.checked, filteredManageQuestionIds)}
                              className="h-6 w-6 min-h-6 min-w-6 cursor-pointer shrink-0"
                            />
                            Select all (filtered)
                          </label>
                          <span className="text-xs" style={{ color: 'var(--clr-surface-a40)' }}>
                            {selectedManageQuestionIds.length} selected • {filteredManageQuestions.length} showing of {allQuestions.length}
                          </span>
                          <button
                            onClick={deleteSelectedQuestions}
                            disabled={!selectedManageQuestionIds.length || bulkActionLoading}
                            className="px-3 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50"
                            style={{ backgroundColor: 'var(--clr-danger-a0)', color: 'var(--clr-light-a0)' }}
                          >
                            {bulkActionLoading ? 'Working...' : 'Delete Selected'}
                          </button>
                          <button
                            onClick={clearSelectedMarkingCriteria}
                            disabled={!selectedManageQuestionIds.length || bulkActionLoading}
                            className="px-3 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50"
                            style={{ backgroundColor: 'var(--clr-surface-a20)', color: 'var(--clr-primary-a50)' }}
                          >
                            {bulkActionLoading ? 'Working...' : 'Clear Marking Criteria'}
                          </button>
                          <button
                            onClick={assignSelectedQuestionsToGroup}
                            disabled={!selectedManageQuestionIds.length || bulkActionLoading}
                            className="px-3 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50"
                            style={{ backgroundColor: 'var(--clr-primary-a0)', color: 'var(--clr-dark-a0)' }}
                          >
                            Group Selected
                          </button>
                          <button
                            onClick={clearSelectedQuestionGroups}
                            disabled={!selectedManageQuestionIds.length || bulkActionLoading}
                            className="px-3 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50"
                            style={{ backgroundColor: 'var(--clr-surface-a20)', color: 'var(--clr-primary-a50)' }}
                          >
                            Clear Group
                          </button>
                        </div>

                        <div className="mb-6 rounded-xl border p-4" style={{ borderColor: 'var(--clr-surface-tonal-a20)', backgroundColor: 'var(--clr-surface-a05)' }}>
                          <div className="flex flex-col gap-4">
                            <div className="flex flex-col xl:flex-row xl:items-start gap-3">
                              <div className="relative flex-1 min-w-0 xl:max-w-xl">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--clr-surface-a40)' }} />
                                <input
                                  type="text"
                                  value={manageSearchQuery}
                                  onChange={(e) => setManageSearchQuery(e.target.value)}
                                  placeholder="Search question number, topic, text, school..."
                                  className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm"
                                  style={{
                                    backgroundColor: 'var(--clr-surface-a0)',
                                    borderColor: 'var(--clr-surface-tonal-a20)',
                                    color: 'var(--clr-primary-a50)',
                                  }}
                                />
                              </div>
                              <ComboboxDemo
                                filters={manageFilters}
                                setFilters={setManageFilters}
                                config={manageQuestionFilterConfig}
                                filterGroups={manageQuestionFilterGroups}
                                triggerLabel="Add filter"
                                clearLabel="Clear chips"
                              />
                            </div>

                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                              <div className="flex gap-2 flex-wrap">
                                <select
                                  value={manageSortKey}
                                  onChange={(e) => setManageSortKey(e.target.value as typeof manageSortKey)}
                                  className="px-3 py-2 rounded-lg border text-sm"
                                  style={{
                                    backgroundColor: 'var(--clr-surface-a0)',
                                    borderColor: 'var(--clr-surface-tonal-a20)',
                                    color: 'var(--clr-primary-a50)',
                                  }}
                                >
                                  <option value="question_number">Sort by Question #</option>
                                  <option value="year">Sort by Year</option>
                                  <option value="grade">Sort by Grade</option>
                                  <option value="subject">Sort by Subject</option>
                                  <option value="topic">Sort by Topic</option>
                                  <option value="school">Sort by School</option>
                                  <option value="marks">Sort by Marks</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => setManageSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                                  className="px-3 py-2 rounded-lg border text-sm font-medium"
                                  style={{
                                    backgroundColor: 'var(--clr-surface-a0)',
                                    borderColor: 'var(--clr-surface-tonal-a20)',
                                    color: 'var(--clr-primary-a50)',
                                  }}
                                >
                                  {manageSortDirection === 'asc' ? '↑ Asc' : '↓ Desc'}
                                </button>
                              </div>

                              <div className="flex gap-2 flex-wrap">
                                <button
                                  type="button"
                                  onClick={applyManageFilters}
                                  disabled={loadingQuestions || !hasManageFilters}
                                  className="px-3 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50"
                                  style={{ backgroundColor: 'var(--clr-primary-a0)', color: 'var(--clr-dark-a0)' }}
                                >
                                  {loadingQuestions ? 'Applying…' : 'Apply Filters'}
                                </button>
                                <button
                                  type="button"
                                  onClick={resetManageFilters}
                                  className="px-3 py-2 rounded-lg text-sm font-medium cursor-pointer"
                                  style={{ backgroundColor: 'var(--clr-surface-a20)', color: 'var(--clr-primary-a50)' }}
                                >
                                  Reset Filters
                                </button>
                              </div>
                            </div>

                            <p className="text-xs" style={{ color: 'var(--clr-surface-a40)' }}>
                              Add one or more chips for grade, year, subject, topic, school, question type, or missing images, then apply the filter set to load matching questions.
                            </p>
                          </div>
                        </div>

                        {!manageFiltersApplied ? (
                          <div className="text-center py-12 rounded-xl border" style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}>
                            <p style={{ color: 'var(--clr-surface-a40)' }}>No questions loaded yet.</p>
                            <p className="text-sm mt-2" style={{ color: 'var(--clr-surface-a50)' }}>
                              Apply at least one filter, then click Apply Filters.
                            </p>
                          </div>
                        ) : loadingQuestions ? (
                          <div className="flex items-center justify-center py-12">
                            <div className="text-center">
                              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" style={{ color: 'var(--clr-primary-a50)' }} />
                              <p style={{ color: 'var(--clr-surface-a40)' }}>Loading questions...</p>
                            </div>
                          </div>
                        ) : allQuestions.length === 0 ? (
                          <div className="text-center py-12">
                            {questionsFetchError ? (
                              <>
                                <p style={{ color: 'var(--clr-warning-a10)' }}>Could not load questions</p>
                                <p className="text-sm mt-2 max-w-md mx-auto" style={{ color: 'var(--clr-surface-a50)' }}>{questionsFetchError}</p>
                                <p className="text-xs mt-2" style={{ color: 'var(--clr-surface-a40)' }}>Check .env.local for your Neon database URL</p>
                              </>
                            ) : (
                              <p style={{ color: 'var(--clr-surface-a40)' }}>No questions found</p>
                            )}
                          </div>
                        ) : (
                          <div>
                            {!manageQuestionDraft ? (
                              <div className="space-y-3">
                                {filteredManageQuestions.length === 0 ? (
                                  <div className="text-center py-10">
                                    <p style={{ color: 'var(--clr-surface-a40)' }}>No questions match the current filters</p>
                                  </div>
                                ) : (
                                  filteredManageQuestions.map((q) => {
                                    const isSelected = selectedManageQuestionIds.includes(q.id);
                                    return (
                                      <div
                                        key={q.id}
                                        className="w-full flex items-stretch gap-3"
                                        onMouseEnter={() => continueManageDragSelection(q.id)}
                                      >
                                        <div
                                          className="w-10 rounded-lg border flex items-center justify-center select-none"
                                          style={{
                                            backgroundColor: isSelected ? 'var(--clr-surface-a20)' : 'var(--clr-surface-a10)',
                                            borderColor: 'var(--clr-surface-tonal-a20)',
                                          }}
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            beginManageDragSelection(q.id, !isSelected);
                                          }}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            readOnly
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              beginManageDragSelection(q.id, !isSelected);
                                            }}
                                            className="h-6 w-6 min-h-6 min-w-6 cursor-pointer"
                                          />
                                        </div>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (typeof window !== 'undefined') {
                                              manageListScrollYRef.current = window.scrollY;
                                            }
                                            setSelectedManageQuestionId(q.id);
                                            setManageQuestionDraft(q);
                                            setManageQuestionEditMode(false);
                                          }}
                                          className="flex-1 text-left p-4 rounded-lg border transition-colors"
                                          style={{
                                            backgroundColor: isSelected ? 'var(--clr-surface-a20)' : 'var(--clr-surface-a10)',
                                            borderColor: 'var(--clr-surface-tonal-a20)',
                                          }}
                                        >
                                          <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                              <span className="text-sm font-semibold" style={{ color: 'var(--clr-primary-a50)' }}>{q.subject}</span>
                                              {q.question_number && (
                                                <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--clr-surface-a20)', color: 'var(--clr-surface-a50)' }}>{q.question_number}</span>
                                              )}
                                              {customExamGroupByQuestionId[q.id] && (
                                                <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--clr-primary-a0)', color: 'var(--clr-dark-a0)' }}>
                                                  {getGroupBadgeLabel(customExamGroupByQuestionId[q.id])}
                                                </span>
                                              )}
                                              {!q.graph_image_data && q.graph_image_size === 'missing' && (
                                                <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--clr-warning-a0)', color: 'var(--clr-light-a0)' }}>Missing Image</span>
                                              )}
                                              {isExamIncomplete(q.exam_incomplete) && (
                                                <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--clr-warning-a0)', color: 'var(--clr-light-a0)' }}>
                                                  Incomplete Exam
                                                </span>
                                              )}
                                              <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--clr-surface-a20)', color: 'var(--clr-surface-a50)' }}>{q.year}</span>
                                              {q.school_name && (
                                                <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--clr-surface-a20)', color: 'var(--clr-surface-a50)' }}>{q.school_name}</span>
                                              )}
                                              <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--clr-surface-a20)', color: 'var(--clr-surface-a50)' }}>{q.marks}m</span>
                                            </div>
                                            <p style={{ color: 'var(--clr-surface-a40)' }} className="text-sm">{q.topic}</p>
                                            <p className="text-xs mt-1 line-clamp-1 text-neutral-700">{q.question_text}</p>
                                          </div>
                                        </button>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            ) : (
                              <div className="space-y-6">
                                <button
                                  onClick={() => {
                                    setManageQuestionDraft(null);
                                    setSelectedManageQuestionId(null);
                                    setManageQuestionEditMode(false);
                                    if (typeof window !== 'undefined') {
                                      const savedScrollY = manageListScrollYRef.current;
                                      window.requestAnimationFrame(() => {
                                        window.scrollTo({ top: savedScrollY });
                                      });
                                    }
                                  }}
                                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium cursor-pointer"
                                  style={{ backgroundColor: 'var(--clr-surface-a20)', color: 'var(--clr-primary-a50)' }}
                                >
                                  <ArrowLeft className="w-4 h-4" />
                                  Back to list
                                </button>

                                <div className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--clr-surface-a10)', borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
                                    <div className="space-y-6 min-w-0 overflow-hidden">
                                      <div className="flex items-start justify-between">
                                        <div>
                                          <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--clr-surface-a40)' }}>
                                            {manageQuestionDraft.year} {manageQuestionDraft.school_name || 'HSC'}
                                          </span>
                                          <h3 className="text-2xl font-bold" style={{ color: 'var(--clr-primary-a50)' }}>{manageQuestionDraft.subject}</h3>
                                          <p className="text-sm" style={{ color: 'var(--clr-surface-a40)' }}>{manageQuestionDraft.topic}</p>
                                          {isExamIncomplete(manageQuestionDraft.exam_incomplete) && (
                                            <span className="inline-flex mt-2 text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--clr-warning-a0)', color: 'var(--clr-light-a0)' }}>
                                              Incomplete Exam
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-right">
                                          <span className="block font-bold text-lg" style={{ color: 'var(--clr-primary-a50)' }}>Question {manageQuestionDraft.question_number || ''}</span>
                                          <span className="text-sm" style={{ color: 'var(--clr-surface-a50)' }}>{manageQuestionDraft.marks} Marks</span>
                                        </div>
                                      </div>

                                      <div className="text-lg leading-relaxed space-y-4 font-serif text-neutral-800 min-w-0 break-words">
                                        <QuestionTextWithDividers text={manageQuestionDraft.question_text || ''} />
                                        {manageQuestionDraft.graph_image_data && (
                                          <div className="my-4">
                                            <img
                                              src={manageQuestionDraft.graph_image_data}
                                              alt="Question graph"
                                              className={`rounded-lg border graph-image graph-image--${manageQuestionDraft.graph_image_size || 'medium'}`}
                                              style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}
                                            />
                                          </div>
                                        )}
                                      </div>

                                      {manageQuestionDraft.question_type === 'multiple_choice' && (
                                        <div className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                          <h4 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--clr-surface-a40)' }}>Answer Options</h4>
                                          <div className="space-y-3">
                                            {[
                                              { label: 'A', text: stripOuterBraces(manageQuestionDraft.mcq_option_a || ''), image: manageQuestionDraft.mcq_option_a_image || null },
                                              { label: 'B', text: stripOuterBraces(manageQuestionDraft.mcq_option_b || ''), image: manageQuestionDraft.mcq_option_b_image || null },
                                              { label: 'C', text: stripOuterBraces(manageQuestionDraft.mcq_option_c || ''), image: manageQuestionDraft.mcq_option_c_image || null },
                                              { label: 'D', text: stripOuterBraces(manageQuestionDraft.mcq_option_d || ''), image: manageQuestionDraft.mcq_option_d_image || null },
                                            ].map((opt) => (
                                              <div key={opt.label} className="flex items-start gap-3 rounded-lg border px-4 py-3" style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                                <span className="font-bold text-sm" style={{ color: 'var(--clr-primary-a50)' }}>{opt.label}.</span>
                                                <div className="flex-1 font-serif min-w-0 text-neutral-800">
                                                  {opt.image ? (
                                                    <img src={opt.image} alt={`Option ${opt.label}`} className="max-h-28 max-w-full object-contain rounded" style={{ borderColor: 'var(--clr-surface-tonal-a20)' }} />
                                                  ) : (
                                                    <LatexText text={opt.text || ''} />
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                            {manageQuestionDraft.mcq_correct_answer && (
                                              <p className="text-sm mt-2" style={{ color: 'var(--clr-surface-a50)' }}>Correct: <strong>{manageQuestionDraft.mcq_correct_answer}</strong></p>
                                            )}
                                            {manageQuestionDraft.mcq_explanation && (
                                              <div className="mt-3 pt-3 border-t text-neutral-800" style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                                <h5 className="text-xs font-bold uppercase mb-2" style={{ color: 'var(--clr-surface-a40)' }}>Explanation</h5>
                                                <LatexText text={stripOuterBraces(manageQuestionDraft.mcq_explanation)} />
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      {manageQuestionDraft.marking_criteria && (
                                        <div className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                          <h4 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--clr-surface-a40)' }}>Marking Criteria</h4>
                                          <div className="font-serif text-base leading-relaxed space-y-2 text-neutral-800 min-w-0 break-words">
                                            <LatexText text={manageQuestionDraft.marking_criteria} />
                                          </div>
                                        </div>
                                      )}

                                      {manageQuestionDraft.sample_answer && (
                                        <div className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-success-a10)' }}>
                                          <h4 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--clr-success-a20)' }}>Sample Answer</h4>
                                          <div className="font-serif text-base leading-relaxed space-y-2 text-neutral-800 min-w-0 break-words">
                                            <LatexText text={manageQuestionDraft.sample_answer} />
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    <div className="space-y-3">
                                      <button
                                        onClick={() => setManageQuestionEditMode((prev) => !prev)}
                                        className="w-full px-4 py-2 rounded-lg font-medium cursor-pointer"
                                        style={{ backgroundColor: 'var(--clr-primary-a0)', color: 'var(--clr-dark-a0)' }}
                                      >
                                        {manageQuestionEditMode ? 'Hide LaTeX Editor' : 'Edit LaTeX'}
                                      </button>
                                      <button
                                        onClick={saveManageQuestion}
                                        className="w-full px-4 py-2 rounded-lg font-medium cursor-pointer"
                                        style={{ backgroundColor: 'var(--clr-success-a0)', color: 'var(--clr-light-a0)' }}
                                      >
                                        Save Changes
                                      </button>
                                      <button
                                        onClick={() => deleteQuestion(manageQuestionDraft.id)}
                                        disabled={deletingQuestionId === manageQuestionDraft.id}
                                        className="w-full px-4 py-2 rounded-lg font-medium cursor-pointer disabled:opacity-50"
                                        style={{ backgroundColor: 'var(--clr-danger-a0)', color: 'var(--clr-light-a0)' }}
                                      >
                                        {deletingQuestionId === manageQuestionDraft.id ? 'Deleting...' : 'Delete'}
                                      </button>

                                      {manageQuestionEditMode && (
                                        <div className="mt-4">
                                          <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>Question Number</label>
                                          <input
                                            type="text"
                                            value={manageQuestionDraft.question_number || ''}
                                            onChange={(e) => setManageQuestionDraft({ ...manageQuestionDraft, question_number: e.target.value })}
                                            placeholder="e.g., 11 (a)"
                                            className="mt-2 w-full px-4 py-2 rounded-lg border text-sm"
                                            style={{
                                              backgroundColor: 'var(--clr-surface-a0)',
                                              borderColor: 'var(--clr-surface-tonal-a20)',
                                              color: 'var(--clr-primary-a50)',
                                            }}
                                          />
                                          <label className="text-sm font-medium mt-4 block" style={{ color: 'var(--clr-surface-a50)' }}>Marks</label>
                                          <input
                                            type="number"
                                            min={0}
                                            step={1}
                                            value={manageQuestionDraft.marks ?? 0}
                                            onChange={(e) => {
                                              const parsed = Number.parseInt(e.target.value, 10);
                                              setManageQuestionDraft({
                                                ...manageQuestionDraft,
                                                marks: Number.isNaN(parsed) ? 0 : Math.max(0, parsed),
                                              });
                                            }}
                                            className="mt-2 w-full px-4 py-2 rounded-lg border text-sm"
                                            style={{
                                              backgroundColor: 'var(--clr-surface-a0)',
                                              borderColor: 'var(--clr-surface-tonal-a20)',
                                              color: 'var(--clr-primary-a50)',
                                            }}
                                          />
                                          <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>Topic</label>
                                          <select
                                            value={manageQuestionDraft.topic || ''}
                                            onChange={(e) => setManageQuestionDraft({ ...manageQuestionDraft, topic: e.target.value, subtopic: '', syllabus_dot_point: '' })}
                                            className="mt-2 w-full px-4 py-2 rounded-lg border text-sm"
                                            style={{
                                              backgroundColor: 'var(--clr-surface-a0)',
                                              borderColor: 'var(--clr-surface-tonal-a20)',
                                              color: 'var(--clr-primary-a50)',
                                            }}
                                          >
                                            {(() => {
                                              const current = manageQuestionDraft.topic?.trim();
                                              const options = current && !ALL_TOPICS.includes(current) ? [current, ...ALL_TOPICS] : ALL_TOPICS;
                                              return options.map((t: string) => <option key={t} value={t}>{t}</option>);
                                            })()}
                                          </select>

                                          {/* Subtopic cascading dropdown */}
                                          <label className="text-sm font-medium mt-4 block" style={{ color: 'var(--clr-surface-a50)' }}>Subtopic</label>
                                          {Object.keys(taxonomyGrouped).length === 0 ? (
                                            <div className="mt-2 flex items-center gap-2">
                                              <button
                                                type="button"
                                                onClick={() => fetchTaxonomy(manageQuestionDraft.grade, manageQuestionDraft.subject)}
                                                disabled={taxonomyLoading}
                                                className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-50"
                                                style={{ backgroundColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }}
                                              >
                                                {taxonomyLoading ? 'Loading…' : 'Load taxonomy'}
                                              </button>
                                              <input
                                                type="text"
                                                value={manageQuestionDraft.subtopic || ''}
                                                onChange={(e) => setManageQuestionDraft({ ...manageQuestionDraft, subtopic: e.target.value })}
                                                placeholder="Type subtopic or load taxonomy"
                                                className="flex-1 px-4 py-2 rounded-lg border text-sm"
                                                style={{
                                                  backgroundColor: 'var(--clr-surface-a0)',
                                                  borderColor: 'var(--clr-surface-tonal-a20)',
                                                  color: 'var(--clr-primary-a50)',
                                                }}
                                              />
                                            </div>
                                          ) : (
                                            <select
                                              value={manageQuestionDraft.subtopic || ''}
                                              onChange={(e) => setManageQuestionDraft({ ...manageQuestionDraft, subtopic: e.target.value, syllabus_dot_point: '' })}
                                              className="mt-2 w-full px-4 py-2 rounded-lg border text-sm"
                                              style={{
                                                backgroundColor: 'var(--clr-surface-a0)',
                                                borderColor: 'var(--clr-surface-tonal-a20)',
                                                color: 'var(--clr-primary-a50)',
                                              }}
                                            >
                                              <option value="">— Select subtopic —</option>
                                              {(() => {
                                                const topicData = taxonomyGrouped[manageQuestionDraft.topic || ''] || {};
                                                const subtopics = Object.keys(topicData);
                                                const current = manageQuestionDraft.subtopic?.trim();
                                                if (current && !subtopics.includes(current)) subtopics.unshift(current);
                                                return subtopics.map((st: string) => <option key={st} value={st}>{st}</option>);
                                              })()}
                                            </select>
                                          )}

                                          {/* Dot Point cascading dropdown */}
                                          <label className="text-sm font-medium mt-4 block" style={{ color: 'var(--clr-surface-a50)' }}>Syllabus Dot Point</label>
                                          {(() => {
                                            const topic = manageQuestionDraft.topic || '';
                                            const subtopic = manageQuestionDraft.subtopic || '';
                                            const dotPoints: { id: string; text: string }[] = (taxonomyGrouped[topic]?.[subtopic]) || [];
                                            if (dotPoints.length > 0) {
                                              return (
                                                <select
                                                  value={manageQuestionDraft.syllabus_dot_point || ''}
                                                  onChange={(e) => setManageQuestionDraft({ ...manageQuestionDraft, syllabus_dot_point: e.target.value })}
                                                  className="mt-2 w-full px-4 py-2 rounded-lg border text-sm"
                                                  style={{
                                                    backgroundColor: 'var(--clr-surface-a0)',
                                                    borderColor: 'var(--clr-surface-tonal-a20)',
                                                    color: 'var(--clr-primary-a50)',
                                                  }}
                                                >
                                                  <option value="">— Select dot point —</option>
                                                  {(() => {
                                                    const dotPointTexts = dotPoints.map((dp) => dp.text);
                                                    const current = manageQuestionDraft.syllabus_dot_point?.trim();
                                                    const allDots = current && !dotPointTexts.includes(current) ? [current, ...dotPointTexts] : dotPointTexts;
                                                    return allDots.map((dp: string) => <option key={dp} value={dp}>{dp}</option>);
                                                  })()}
                                                </select>
                                              );
                                            }
                                            return (
                                              <input
                                                type="text"
                                                value={manageQuestionDraft.syllabus_dot_point || ''}
                                                onChange={(e) => setManageQuestionDraft({ ...manageQuestionDraft, syllabus_dot_point: e.target.value })}
                                                placeholder={subtopic ? 'No dot points in taxonomy — type manually' : 'Select a subtopic first, or type manually'}
                                                className="mt-2 w-full px-4 py-2 rounded-lg border text-sm"
                                                style={{
                                                  backgroundColor: 'var(--clr-surface-a0)',
                                                  borderColor: 'var(--clr-surface-tonal-a20)',
                                                  color: 'var(--clr-primary-a50)',
                                                }}
                                              />
                                            );
                                          })()}
                                          <label className="text-sm font-medium mt-4 block" style={{ color: 'var(--clr-surface-a50)' }}>Question (LaTeX)</label>
                                          <textarea
                                            value={manageQuestionDraft.question_text || ''}
                                            onChange={(e) => setManageQuestionDraft({ ...manageQuestionDraft, question_text: e.target.value })}
                                            rows={10}
                                            className="mt-2 w-full px-4 py-2 rounded-lg border font-mono text-sm"
                                            style={{
                                              backgroundColor: 'var(--clr-surface-a0)',
                                              borderColor: 'var(--clr-surface-tonal-a20)',
                                              color: 'var(--clr-primary-a50)',
                                            }}
                                          />
                                          <label className="text-sm font-medium mt-4 block" style={{ color: 'var(--clr-surface-a50)' }}>Marking Criteria (LaTeX)</label>
                                          <textarea
                                            value={manageQuestionDraft.marking_criteria || ''}
                                            onChange={(e) => setManageQuestionDraft({ ...manageQuestionDraft, marking_criteria: e.target.value })}
                                            rows={6}
                                            className="mt-2 w-full px-4 py-2 rounded-lg border font-mono text-sm"
                                            style={{
                                              backgroundColor: 'var(--clr-surface-a0)',
                                              borderColor: 'var(--clr-surface-tonal-a20)',
                                              color: 'var(--clr-primary-a50)',
                                            }}
                                          />
                                          <label className="text-sm font-medium mt-4 block" style={{ color: 'var(--clr-surface-a50)' }}>Sample Answer (LaTeX)</label>
                                          <textarea
                                            value={manageQuestionDraft.sample_answer || ''}
                                            onChange={(e) => setManageQuestionDraft({ ...manageQuestionDraft, sample_answer: e.target.value })}
                                            rows={6}
                                            className="mt-2 w-full px-4 py-2 rounded-lg border font-mono text-sm"
                                            style={{
                                              backgroundColor: 'var(--clr-surface-a0)',
                                              borderColor: 'var(--clr-surface-tonal-a20)',
                                              color: 'var(--clr-primary-a50)',
                                            }}
                                          />
                                          <label className="text-sm font-medium mt-4 block" style={{ color: 'var(--clr-surface-a50)' }}>Sample Answer Image URL</label>
                                          <input
                                            type="text"
                                            value={manageQuestionDraft.sample_answer_image || ''}
                                            onChange={(e) => setManageQuestionDraft({ ...manageQuestionDraft, sample_answer_image: e.target.value })}
                                            placeholder="https://... or data:image/png;base64,..."
                                            className="mt-2 w-full px-4 py-2 rounded-lg border text-sm"
                                            style={{
                                              backgroundColor: 'var(--clr-surface-a0)',
                                              borderColor: 'var(--clr-surface-tonal-a20)',
                                              color: 'var(--clr-primary-a50)',
                                            }}
                                          />
                                          <p className="text-xs mt-1" style={{ color: 'var(--clr-surface-a40)' }}>If provided, image will be shown instead of LaTeX text</p>
                                          <label className="text-sm font-medium mt-4 block" style={{ color: 'var(--clr-surface-a50)' }}>Sample Answer Image Size</label>
                                          <select
                                            value={manageQuestionDraft.sample_answer_image_size || 'medium'}
                                            onChange={(e) => setManageQuestionDraft({ ...manageQuestionDraft, sample_answer_image_size: e.target.value })}
                                            className="mt-2 w-full px-4 py-2 rounded-lg border text-sm"
                                            style={{
                                              backgroundColor: 'var(--clr-surface-a0)',
                                              borderColor: 'var(--clr-surface-tonal-a20)',
                                              color: 'var(--clr-primary-a50)',
                                            }}
                                          >
                                            <option value="small">Small</option>
                                            <option value="medium">Medium</option>
                                            <option value="large">Large</option>
                                          </select>
                                          <label className="text-sm font-medium mt-4 block" style={{ color: 'var(--clr-surface-a50)' }}>Graph Image URL</label>
                                          <input
                                            type="text"
                                            value={manageQuestionDraft.graph_image_data || ''}
                                            onChange={(e) => {
                                              const nextUrl = e.target.value;
                                              setManageQuestionDraft({
                                                ...manageQuestionDraft,
                                                graph_image_data: nextUrl,
                                                graph_image_size: nextUrl ? (manageQuestionDraft.graph_image_size || 'medium') : manageQuestionDraft.graph_image_size,
                                              });
                                            }}
                                            placeholder="https://... or data:image/png;base64,..."
                                            className="mt-2 w-full px-4 py-2 rounded-lg border text-sm"
                                            style={{
                                              backgroundColor: 'var(--clr-surface-a0)',
                                              borderColor: 'var(--clr-surface-tonal-a20)',
                                              color: 'var(--clr-primary-a50)',
                                            }}
                                          />
                                          <label className="text-sm font-medium mt-4 block" style={{ color: 'var(--clr-surface-a50)' }}>Graph Image Size</label>
                                          <select
                                            value={manageQuestionDraft.graph_image_size || 'medium'}
                                            onChange={(e) => setManageQuestionDraft({ ...manageQuestionDraft, graph_image_size: e.target.value })}
                                            className="mt-2 w-full px-4 py-2 rounded-lg border text-sm"
                                            style={{
                                              backgroundColor: 'var(--clr-surface-a0)',
                                              borderColor: 'var(--clr-surface-tonal-a20)',
                                              color: 'var(--clr-primary-a50)',
                                            }}
                                          >
                                            <option value="small">Small</option>
                                            <option value="medium">Medium</option>
                                            <option value="large">Large</option>
                                            <option value="missing">Missing</option>
                                          </select>

                                          {manageQuestionDraft.question_type === 'multiple_choice' && (
                                            <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                              <h5 className="text-sm font-bold mb-3" style={{ color: 'var(--clr-surface-a50)' }}>MCQ Options (text or image URL)</h5>
                                              <div className="space-y-4">
                                                {[
                                                  { key: 'A', text: 'mcq_option_a', image: 'mcq_option_a_image' },
                                                  { key: 'B', text: 'mcq_option_b', image: 'mcq_option_b_image' },
                                                  { key: 'C', text: 'mcq_option_c', image: 'mcq_option_c_image' },
                                                  { key: 'D', text: 'mcq_option_d', image: 'mcq_option_d_image' },
                                                ].map(({ key, text, image }) => (
                                                  <div key={key} className="p-3 rounded border" style={{ borderColor: 'var(--clr-surface-tonal-a20)', backgroundColor: 'var(--clr-surface-a05)' }}>
                                                    <label className="block text-xs font-medium mb-1">Option {key}</label>
                                                    <input type="text" placeholder="Text (LaTeX)" value={manageQuestionDraft[text] || ''} onChange={(e) => setManageQuestionDraft({ ...manageQuestionDraft, [text]: e.target.value })} className="w-full px-3 py-2 rounded border text-sm mb-2" style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }} />
                                                    <input type="url" placeholder="Or image URL" value={manageQuestionDraft[image] || ''} onChange={(e) => setManageQuestionDraft({ ...manageQuestionDraft, [image]: e.target.value })} className="w-full px-3 py-2 rounded border text-sm" style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }} />
                                                  </div>
                                                ))}
                                                <div>
                                                  <label className="block text-xs font-medium mb-1">Correct Answer</label>
                                                  <select value={manageQuestionDraft.mcq_correct_answer || 'A'} onChange={(e) => setManageQuestionDraft({ ...manageQuestionDraft, mcq_correct_answer: e.target.value })} className="w-full px-3 py-2 rounded border text-sm" style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }}>
                                                    <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
                                                  </select>
                                                </div>
                                                <div>
                                                  <label className="block text-xs font-medium mb-1">Explanation (LaTeX)</label>
                                                  <textarea value={manageQuestionDraft.mcq_explanation || ''} onChange={(e) => setManageQuestionDraft({ ...manageQuestionDraft, mcq_explanation: e.target.value })} rows={3} className="w-full px-3 py-2 rounded border text-sm" style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }} />
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                          </div>
                        ) : (
                          <div className="space-y-6">
                            <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--clr-surface-a10)', borderColor: 'var(--clr-surface-tonal-a20)' }}>
                              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
                                <div>
                                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clr-surface-a50)' }}>Exam</label>
                                  <select
                                    value={imageMapSelectedPaperKey}
                                    onChange={(e) => {
                                      const nextKey = e.target.value;
                                      setImageMapSelectedPaperKey(nextKey);
                                      loadImageMapExam(nextKey);
                                    }}
                                    disabled={loadingQuestions || availablePapers.length === 0}
                                    className="w-full px-3 py-2 rounded-lg border text-sm"
                                    style={{
                                      backgroundColor: 'var(--clr-surface-a0)',
                                      borderColor: 'var(--clr-surface-tonal-a20)',
                                      color: 'var(--clr-primary-a50)',
                                    }}
                                  >
                                    {availablePapers.length === 0 ? (
                                      <option value="">No exams loaded</option>
                                    ) : (
                                      availablePapers.map((paper) => (
                                        <option key={getPaperKey(paper)} value={getPaperKey(paper)}>
                                          {paper.year} • {paper.grade} • {paper.subject} • {paper.school} ({paper.count})
                                        </option>
                                      ))
                                    )}
                                  </select>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void fetchAllQuestions();
                                  }}
                                  disabled={loadingQuestions}
                                  className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50"
                                  style={{ backgroundColor: 'var(--clr-surface-a20)', color: 'var(--clr-primary-a50)' }}
                                >
                                  {loadingQuestions ? 'Loading…' : 'Reload Exams'}
                                </button>
                              </div>
                            </div>

                            {loadingQuestions ? (
                              <div className="py-10 text-center" style={{ color: 'var(--clr-surface-a40)' }}>Loading exam questions...</div>
                            ) : imageMapQuestions.length === 0 ? (
                              <div className="py-10 text-center rounded-xl border" style={{ color: 'var(--clr-surface-a40)', borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                Select an exam to edit image data.
                              </div>
                            ) : (
                              <>
                                <div className="space-y-4">
                                  {imageMapQuestions.map((question) => {
                                    const draft = imageMapDraftById[question.id] || {
                                      graph_image_data: '',
                                      sample_answer_image: '',
                                      mcq_option_a_image: '',
                                      mcq_option_b_image: '',
                                      mcq_option_c_image: '',
                                      mcq_option_d_image: '',
                                      mcq_correct_answer: 'A' as 'A' | 'B' | 'C' | 'D',
                                    };

                                    const setDraftField = (field: keyof typeof draft, value: string) => {
                                      setImageMapDraftById((prev) => ({
                                        ...prev,
                                        [question.id]: {
                                          ...draft,
                                          [field]: value,
                                        },
                                      }));
                                    };

                                    return (
                                      <div
                                        key={question.id}
                                        className="rounded-xl border p-4 space-y-3"
                                        style={{ backgroundColor: 'var(--clr-surface-a10)', borderColor: 'var(--clr-surface-tonal-a20)' }}
                                      >
                                        <div className="text-sm font-semibold" style={{ color: 'var(--clr-primary-a50)' }}>
                                          Question {question.question_number || '?'}
                                        </div>

                                        <div>
                                          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--clr-surface-a50)' }}>Question Image</label>
                                          <textarea
                                            value={draft.graph_image_data}
                                            onChange={(e) => setDraftField('graph_image_data', e.target.value)}
                                            onPaste={(e) => handleClipboardImagePaste(e, (dataUrl) => setDraftField('graph_image_data', dataUrl))}
                                            rows={2}
                                            placeholder="Paste image directly, or paste data:image/... / URL"
                                            className="w-full px-3 py-2 rounded-lg border text-xs"
                                            style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }}
                                          />
                                        </div>

                                        <div>
                                          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--clr-surface-a50)' }}>Sample Answer Image</label>
                                          <textarea
                                            value={draft.sample_answer_image}
                                            onChange={(e) => setDraftField('sample_answer_image', e.target.value)}
                                            onPaste={(e) => handleClipboardImagePaste(e, (dataUrl) => setDraftField('sample_answer_image', dataUrl))}
                                            rows={2}
                                            placeholder="Paste image directly, or paste data:image/... / URL"
                                            className="w-full px-3 py-2 rounded-lg border text-xs"
                                            style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }}
                                          />
                                        </div>

                                        {question.question_type === 'multiple_choice' && (
                                          <div className="space-y-2 pt-1">
                                            <div className="text-xs font-semibold" style={{ color: 'var(--clr-surface-a50)' }}>MCQ Option Images</div>
                                            {([
                                              ['A', 'mcq_option_a_image'],
                                              ['B', 'mcq_option_b_image'],
                                              ['C', 'mcq_option_c_image'],
                                              ['D', 'mcq_option_d_image'],
                                            ] as Array<['A' | 'B' | 'C' | 'D', 'mcq_option_a_image' | 'mcq_option_b_image' | 'mcq_option_c_image' | 'mcq_option_d_image']>).map(([label, field]) => (
                                              <div key={field}>
                                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--clr-surface-a50)' }}>Option {label} Image</label>
                                                <textarea
                                                  value={draft[field]}
                                                  onChange={(e) => setDraftField(field, e.target.value)}
                                                  onPaste={(e) => handleClipboardImagePaste(e, (dataUrl) => setDraftField(field, dataUrl))}
                                                  rows={2}
                                                  placeholder="Paste image directly, or paste data:image/... / URL"
                                                  className="w-full px-3 py-2 rounded-lg border text-xs"
                                                  style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }}
                                                />
                                              </div>
                                            ))}

                                            <div>
                                              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--clr-surface-a50)' }}>Correct MCQ Answer</label>
                                              <select
                                                value={draft.mcq_correct_answer}
                                                onChange={(e) => setDraftField('mcq_correct_answer', e.target.value as 'A' | 'B' | 'C' | 'D')}
                                                className="w-full px-3 py-2 rounded-lg border text-sm"
                                                style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }}
                                              >
                                                <option value="A">A</option>
                                                <option value="B">B</option>
                                                <option value="C">C</option>
                                                <option value="D">D</option>
                                              </select>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>

                                <div className="pt-2">
                                  <button
                                    type="button"
                                    onClick={saveImageMapChanges}
                                    disabled={imageMapSaving}
                                    className="w-full px-4 py-3 rounded-lg font-semibold cursor-pointer disabled:opacity-50"
                                    style={{ backgroundColor: 'var(--clr-success-a0)', color: 'var(--clr-light-a0)' }}
                                  >
                                    {imageMapSaving ? 'Saving...' : 'Save'}
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {devTab === 'review' && (
                      <div className="max-w-4xl mx-auto">
                        <p className="text-sm mb-6" style={{ color: 'var(--clr-surface-a50)' }}>
                          Sample solutions in order (same filters as Manage). Compare with your actual solutions to verify correctness.
                        </p>

                        <div
                          className="mb-6 rounded-2xl border p-4 space-y-4"
                          style={{
                            backgroundColor: 'var(--clr-surface-a10)',
                            borderColor: 'var(--clr-surface-tonal-a20)',
                          }}
                        >
                          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
                            <div>
                              <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>
                                Verify Exam
                              </label>
                              <select
                                value={selectedVerifySolutionsExamKey}
                                onChange={(e) => setSelectedVerifySolutionsExamKey(e.target.value)}
                                disabled={isVerifyingSolutions || reviewVerifyExamOptions.length === 0}
                                className="mt-2 w-full px-4 py-2 rounded-lg border"
                                style={{
                                  backgroundColor: 'var(--clr-surface-a0)',
                                  borderColor: 'var(--clr-surface-tonal-a20)',
                                  color: 'var(--clr-primary-a50)',
                                }}
                              >
                                {reviewVerifyExamOptions.length === 0 ? (
                                  <option value="">No exam with paper number available</option>
                                ) : (
                                  reviewVerifyExamOptions.map((option) => (
                                    <option key={option.key} value={option.key}>
                                      {option.year} • {option.grade} • {option.subject} • {option.schoolName} • Paper {option.paperNumber} ({option.count} questions)
                                    </option>
                                  ))
                                )}
                              </select>
                            </div>

                            <button
                              type="button"
                              onClick={runVerifySolutionsReview}
                              disabled={isVerifyingSolutions || reviewVerifyExamOptions.length === 0 || !selectedVerifySolutionsExamKey}
                              className="px-4 py-2 rounded-lg font-medium cursor-pointer disabled:opacity-50"
                              style={{
                                backgroundColor: 'var(--clr-primary-a0)',
                                color: 'var(--clr-dark-a0)',
                              }}
                            >
                              {isVerifyingSolutions
                                ? 'Verifying...'
                                : verifySolutionsApplyUpdates
                                  ? 'Verify + Apply Updates'
                                  : 'Verify (Dry Run)'}
                            </button>
                          </div>

                          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--clr-surface-a50)' }}>
                            <input
                              type="checkbox"
                              checked={verifySolutionsApplyUpdates}
                              onChange={(e) => setVerifySolutionsApplyUpdates(e.target.checked)}
                              disabled={isVerifyingSolutions}
                            />
                            Apply corrected sample answers to database
                          </label>

                          {verifySolutionsMessage && (
                            <p
                              className="text-sm"
                              style={{
                                color:
                                  verifySolutionsStatus === 'error'
                                    ? 'var(--clr-danger-a10)'
                                    : verifySolutionsStatus === 'success'
                                      ? 'var(--clr-success-a10)'
                                      : 'var(--clr-surface-a50)',
                              }}
                            >
                              {verifySolutionsMessage}
                            </p>
                          )}

                          {verifySolutionsOutput && (
                            <details>
                              <summary className="text-sm font-medium cursor-pointer" style={{ color: 'var(--clr-surface-a50)' }}>
                                Verification response details
                              </summary>
                              <pre
                                className="mt-2 p-3 rounded-lg text-xs whitespace-pre-wrap break-words"
                                style={{
                                  backgroundColor: 'var(--clr-dark-a0)',
                                  color: 'var(--clr-light-a0)',
                                }}
                              >
                                {JSON.stringify(verifySolutionsOutput, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>

                        {loadingQuestions ? (
                          <div className="py-12 text-center" style={{ color: 'var(--clr-surface-a40)' }}>Loading questions…</div>
                        ) : filteredManageQuestions.length === 0 ? (
                          <div className="py-12 text-center rounded-xl border" style={{ color: 'var(--clr-surface-a40)', borderColor: 'var(--clr-surface-tonal-a20)' }}>
                            No questions to review. Add questions or adjust filters in Manage.
                          </div>
                        ) : (
                          <div className="space-y-8">
                            {filteredManageQuestions.map((q, index) => (
                              <article
                                key={q.id}
                                className="rounded-2xl border overflow-hidden"
                                style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)' }}
                              >
                                <div className="px-5 py-3 border-b flex flex-wrap items-center gap-x-4 gap-y-1" style={{ borderColor: 'var(--clr-surface-tonal-a20)', backgroundColor: 'var(--clr-surface-a05)' }}>
                                  <span className="font-semibold text-neutral-800">
                                    #{index + 1} · Q{q.question_number ?? '?'}
                                  </span>
                                  <span className="text-sm text-neutral-600">{q.year} {q.school_name || 'HSC'}</span>
                                  <span className="text-sm text-neutral-600">{q.subject}</span>
                                  <span className="text-sm text-neutral-600">{q.topic}</span>
                                  {q.question_type === 'multiple_choice' && (
                                    <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--clr-surface-a20)', color: 'var(--clr-surface-a50)' }}>MCQ</span>
                                  )}
                                </div>
                                <div className="p-5">
                                  <details className="mb-4">
                                    <summary className="text-sm font-medium cursor-pointer" style={{ color: 'var(--clr-surface-a50)' }}>Question text</summary>
                                    <div className="mt-2 font-serif text-sm leading-relaxed text-neutral-800 border-l-2 pl-4" style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                      <LatexText text={q.question_text || ''} />
                                    </div>
                                  </details>
                                  <div className="rounded-xl border p-4" style={{ borderColor: 'var(--clr-success-a10)', backgroundColor: 'var(--clr-surface-a05)' }}>
                                    <h4 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--clr-success-a20)' }}>Sample solution</h4>
                                    {q.sample_answer ? (
                                      <div className="font-serif text-base leading-relaxed space-y-2 text-neutral-800">
                                        <LatexText text={q.sample_answer} />
                                      </div>
                                    ) : q.question_type === 'multiple_choice' ? (
                                      <div className="text-neutral-700">
                                        <p className="font-medium">Correct: {q.mcq_correct_answer ?? '—'}</p>
                                        {q.mcq_explanation && (
                                          <div className="mt-2 font-serif text-sm">
                                            <LatexText text={stripOuterBraces(q.mcq_explanation)} />
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <p className="text-sm italic" style={{ color: 'var(--clr-surface-a40)' }}>No sample answer</p>
                                    )}
                                  </div>
                                </div>
                              </article>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        </main>
      </div>

      <EditQuestionModal
        isOpen={showEditModal}
        editQuestion={editQuestion}
        setEditQuestion={setEditQuestion}
        allTopics={ALL_TOPICS}
        subjectsByYear={SUBJECTS_BY_YEAR as unknown as Record<string, readonly string[] | string[]>}
        getTopics={getTopics}
        handleEditGraphPaste={handleEditGraphPaste}
        handleEditGraphUpload={handleEditGraphUpload}
        handleEditModalImagePaste={handleEditModalImagePaste}
        isUpdatingQuestion={isUpdatingQuestion}
        onClose={() => setShowEditModal(false)}
        onSave={updateQuestionInDatabase}
      />

      {showLatexModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
            onClick={() => setShowLatexModal(false)}
          />
          <div
            className="relative w-full max-w-3xl rounded-2xl border p-6 shadow-2xl"
            style={{
              backgroundColor: 'var(--clr-surface-a10)',
              borderColor: 'var(--clr-surface-tonal-a20)',
              color: 'var(--clr-primary-a50)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">LaTeX Source</h2>
              <button
                onClick={() => setShowLatexModal(false)}
                className="p-2 rounded-lg cursor-pointer"
                style={{ backgroundColor: 'var(--clr-surface-a20)' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <textarea
              readOnly
              value={question?.question_text || ''}
              className="w-full h-64 rounded-lg p-3 text-sm font-mono"
              style={{
                backgroundColor: 'var(--clr-surface-a0)',
                color: 'var(--clr-primary-a50)',
                border: '1px solid var(--clr-surface-tonal-a20)',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
