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
import PaperView from './paper/PaperView';
import PapersView from './papers/PapersView';
import SavedView from './saved/SavedView';
import SettingsView from './settings/SettingsView';
import LogsView from './logs/LogsView';
import DevQuestionsView from './dev-questions/DevQuestionsView';
import CustomExamView from './exam/CustomExamView';

const Excalidraw = dynamic(
  async () => {
    const mod = await import('@excalidraw/excalidraw');
    return mod.Excalidraw;
  },
  { ssr: false }
);
// TikzRenderer no longer used in this page

const CUSTOM_EXAM_STORAGE_KEY = 'currentCustomExam';
const CUSTOM_EXAM_SESSION_STORAGE_KEY = 'currentCustomExam:session';
const CUSTOM_EXAM_MAX_QUESTIONS = 25;

const isQuotaExceededError = (error: unknown) => {
  if (error instanceof DOMException) {
    return error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED';
  }
  const message = String((error as { message?: string })?.message || '').toLowerCase();
  return message.includes('quota') && message.includes('exceed');
};

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
    difficulty?: 'Foundation' | 'Intermediate' | 'Advanced' | 'Extension' | null;
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

  const isStoredQuestion = (value: unknown): value is Question => {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<Question>;
    return (
      typeof candidate.id === 'string' &&
      typeof candidate.grade === 'string' &&
      typeof candidate.year === 'number' &&
      typeof candidate.subject === 'string' &&
      typeof candidate.topic === 'string' &&
      typeof candidate.marks === 'number' &&
      typeof candidate.question_text === 'string'
    );
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
  const [pdfIngestV2File, setPdfIngestV2File] = useState<File | null>(null);
  const [pdfIngestV2Status, setPdfIngestV2Status] = useState<'idle' | 'uploading' | 'ready' | 'error'>('idle');
  const [pdfIngestV2Message, setPdfIngestV2Message] = useState<string>('');
  const [pdfIngestV2Response, setPdfIngestV2Response] = useState<string>('');
  const [pdfOcrPreviewStatus, setPdfOcrPreviewStatus] = useState<'idle' | 'uploading' | 'ready' | 'error'>('idle');
  const [pdfOcrPreviewMessage, setPdfOcrPreviewMessage] = useState<string>('');
  const [pdfOcrPreviewResponse, setPdfOcrPreviewResponse] = useState<string>('');
  const [pdfIngestV2ClassifyAfterUpload, setPdfIngestV2ClassifyAfterUpload] = useState(true);
  const [pdfIngestV2ReasoningEffort, setPdfIngestV2ReasoningEffort] = useState<'medium' | 'high'>('high');
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
  const [userPlan, setUserPlan] = useState<string>('free');
  const [userExportsUsed, setUserExportsUsed] = useState<number>(0);
  const [userExportsLimit, setUserExportsLimit] = useState<number>(0);
  const [userExportsResetAt, setUserExportsResetAt] = useState<string | null>(null);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [userQuestionTokensBalance, setUserQuestionTokensBalance] = useState<number>(0);
  const [userCompanyName, setUserCompanyName] = useState<string | null>(null);
  const [userDefaultGrade, setUserDefaultGrade] = useState<string>('Year 12');
  const [userDefaultSubject, setUserDefaultSubject] = useState<string>('Mathematics Advanced');
  const [userStripeCancelAt, setUserStripeCancelAt] = useState<string | null>(null);
  const [userStripeCancelAtPeriodEnd, setUserStripeCancelAtPeriodEnd] = useState<boolean | null>(null);
  const [paperQuestions, setPaperQuestions] = useState<Question[]>([]);
  const [paperIndex, setPaperIndex] = useState(0);
  const [showPaperQuestionNavigator, setShowPaperQuestionNavigator] = useState(false);
  const [showQuestionInfo, setShowQuestionInfo] = useState(false);
  const [activePaper, setActivePaper] = useState<{
    year: string;
    subject: string;
    grade: string;
    school: string;
    count: number;
    topic?: string;
    customName?: string;
  } | null>(null);
  const [exportingPaperPdf, setExportingPaperPdf] = useState<'exam' | 'solutions' | 'autofix' | null>(null);
  const [exportingSavedExamPdf, setExportingSavedExamPdf] = useState<'exam' | 'solutions' | 'solutions-only' | 'autofix' | null>(null);
  const [exportingCustomExamPdf, setExportingCustomExamPdf] = useState<'exam' | 'solutions' | 'solutions-only' | 'latex-tex' | 'latex-zip' | null>(null);
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
    return normalized === 'mathematics'
      || normalized === 'mathematics advanced'
      || normalized.includes('mathematics standard');
  };

  const normalizeSubject = (value: string | null | undefined) => String(value || '').trim().toLowerCase();

  const isMathematicsAdvancedSubject = (value: string | null | undefined) => {
    const normalized = normalizeSubject(value);
    return normalized.includes('mathematics advanced') || normalized === 'mathematics';
  };

  const isMathematicsLetterGroupingSubject = (value: string | null | undefined) => {
    const normalized = normalizeSubject(value);
    return isMathematicsAdvancedSubject(normalized) || normalized.includes('mathematics standard');
  };

  const isMathematicsExtensionSubject = (value: string | null | undefined) => {
    const normalized = normalizeSubject(value);
    return normalized.includes('extension 1') || normalized.includes('ext 1') || normalized.includes('extension 2') || normalized.includes('ext 2');
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
    const getAdvancedLetterGroupKey = (question: Question) => {
      if (!isMathematicsLetterGroupingSubject(question.subject)) return null;
      const parsed = parseQuestionNumberForSort(question.question_number);
      if (!parsed.part || !Number.isFinite(parsed.number)) return null;
      const paperNumber = String((question as any).paper_number ?? '');
      return [
        String(question.grade || ''),
        String(question.subject || ''),
        String(question.year || ''),
        String(question.school_name || ''),
        paperNumber,
        String(parsed.number),
      ].join('|');
    };

    const getRomanGroupKey = (question: Question) => {
      if (!isMathematicsExtensionSubject(question.subject)) return null;
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

    const advancedGroups = new Map<string, Question[]>();
    sourcePool.forEach((question) => {
      const groupKey = getAdvancedLetterGroupKey(question);
      if (!groupKey) return;
      const existing = advancedGroups.get(groupKey) || [];
      existing.push(question);
      advancedGroups.set(groupKey, existing);
    });

    advancedGroups.forEach((group, groupKey) => {
      const sortedGroup = [...group].sort((a, b) => {
        const left = parseQuestionNumberForSort(a.question_number);
        const right = parseQuestionNumberForSort(b.question_number);
        return left.number - right.number || left.part.localeCompare(right.part) || left.subpart - right.subpart || left.raw.localeCompare(right.raw);
      });
      advancedGroups.set(groupKey, sortedGroup);
    });

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
    const seenAdvancedGroupKeys = new Set<string>();
    const seenGroupKeys = new Set<string>();
    const expanded: Question[] = [];

    selected.forEach((question) => {
      const advancedGroupKey = getAdvancedLetterGroupKey(question);
      if (advancedGroupKey) {
        if (!seenAdvancedGroupKeys.has(advancedGroupKey)) {
          seenAdvancedGroupKeys.add(advancedGroupKey);
          const relatedKey = `advanced:${advancedGroupKey}`;
          const siblings = advancedGroups.get(advancedGroupKey) || [question];
          siblings.forEach((sibling) => {
            if (seenIds.has(sibling.id)) return;
            seenIds.add(sibling.id);
            expanded.push({
              ...sibling,
              _display_group_key: sibling._display_group_key || relatedKey,
            });
          });
        }
        return;
      }

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

    const parsed = parseQuestionNumberParts(question.question_number);
    if (isMathematicsLetterGroupingSubject(question.subject) && parsed.number !== null && parsed.letter) {
      return `advanced:${parsed.number}`;
    }
    if (isMathematicsExtensionSubject(question.subject) && parsed.number !== null && parsed.letter && parsed.roman) {
      return `extension:${parsed.number}:${parsed.letter}`;
    }

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
    const map = new Map<string, { year: string; subject: string; grade: string; school: string; count: number; unspecifiedCount: number }>();
    visibleAllQuestions.forEach((q) => {
      if (!q?.year || !q?.subject || !q?.grade) return;
      const year = String(q.year);
      const subject = String(q.subject);
      const grade = String(q.grade);
      const school = String(q.school_name || 'HSC');
      const topic = String(q.topic || '').trim().toLowerCase();
      const isUnspecified = topic === 'unspecified';
      const key = `${year}__${grade}__${subject}__${school}`;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        if (isUnspecified) {
          existing.unspecifiedCount += 1;
        }
      } else {
        map.set(key, { year, subject, grade, school, count: 1, unspecifiedCount: isUnspecified ? 1 : 0 });
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

      // Load subscription info
      const savedToken = localStorage.getItem('token');
      if (savedToken) {
        fetch('/api/user/subscription', {
          headers: { Authorization: `Bearer ${savedToken}` },
        })
          .then((r) => r.json())
          .then((sub: {
            plan?: string;
            exportsUsed?: number;
            exportsLimit?: number;
            exportsResetAt?: string | null;
            hasActiveSubscription?: boolean;
            questionTokensBalance?: number;
            companyName?: string | null;
            defaultGrade?: string | null;
            defaultSubject?: string | null;
            stripeCancelAt?: string | null;
            stripeCancelAtPeriodEnd?: boolean | null;
            error?: string;
          }) => {
            if (sub && !sub.error) {
              setUserPlan(sub.plan ?? 'free');
              setUserExportsUsed(sub.exportsUsed ?? 0);
              setUserExportsLimit(sub.exportsLimit ?? 0);
              setUserExportsResetAt(sub.exportsResetAt ?? null);
              setHasActiveSubscription(sub.hasActiveSubscription ?? false);
              setUserQuestionTokensBalance(sub.questionTokensBalance ?? 0);
              setUserCompanyName(sub.companyName ?? null);
              setUserDefaultGrade(sub.defaultGrade ?? 'Year 12');
              setUserDefaultSubject(sub.defaultSubject ?? 'Mathematics Advanced');
              setUserStripeCancelAt(sub.stripeCancelAt ?? null);
              setUserStripeCancelAtPeriodEnd(sub.stripeCancelAtPeriodEnd ?? null);
            }
          })
          .catch(() => undefined);
      }
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
    const checkout = params.get('checkout');
    const sessionId = params.get('session_id');
    const type = params.get('type');

    if (checkout === 'success' && sessionId && type === 'questions') {
      const handleCheckoutSuccess = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
          const response = await fetch('/api/stripe/confirm-checkout', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          const data = (await response.json().catch(() => ({}))) as any;

          if (data?.ok && data?.type === 'payment' && typeof data?.questionTokensBalance === 'number') {
            setUserQuestionTokensBalance(data.questionTokensBalance);
          }
        } catch (error) {
          console.error('Failed to confirm checkout:', error);
        }
      };

      handleCheckoutSuccess();

      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

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

  const handleSaveDefaultPreset = async (grade: string, subject: string) => {
    if (typeof window === 'undefined') {
      return { ok: false, message: 'Not available in this environment.' };
    }

    const token = localStorage.getItem('token');
    if (!token) {
      return { ok: false, message: 'You need to sign in again.' };
    }

    const response = await fetch('/api/user/update-default-preset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ grade, subject }),
    });

    const data = (await response.json().catch(() => ({}))) as { error?: string; ok?: boolean };

    if (!response.ok) {
      return { ok: false, message: data.error || 'Failed to save defaults' };
    }

    setUserDefaultGrade(grade);
    setUserDefaultSubject(subject);
    return { ok: true as const };
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
    includeQuestionContent = true,
    questions,
    title,
    subtitle,
    downloadName,
    outputFormat = 'pdf',
    autoFixExport = false,
  }: {
    includeSolutions: boolean;
    includeQuestionContent?: boolean;
    questions: any[];
    title: string;
    subtitle: string;
    downloadName: string;
    outputFormat?: 'pdf' | 'tex' | 'tex-zip';
    autoFixExport?: boolean;
  }) => {
    if (!questions.length) {
      throw new Error('No questions available to export.');
    }
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const response = await fetch('/api/hsc/export-exam-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        title,
        subtitle,
        downloadName,
        format: outputFormat,
        includeSolutions,
        includeQuestionContent,
        autoFixExport,
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
    const contentDisposition = response.headers.get('content-disposition') || '';
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const filenameMatch = contentDisposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
    const serverFilename = filenameMatch ? decodeURIComponent(filenameMatch[1]) : '';
    const defaultExt = contentType.includes('application/zip')
      ? '.zip'
      : (contentType.includes('application/x-tex') ? '.tex' : '.pdf');
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = serverFilename || `${downloadName.replace(/[^a-z0-9\-_.]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'custom-exam'}${includeSolutions ? '-with-solutions' : ''}${defaultExt}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const exportPaperPdf = async (includeSolutions: boolean, autoFixExport = false) => {
    if (!activePaper || !paperQuestions.length) {
      alert('No paper is loaded to export.');
      return;
    }

    const mode: 'exam' | 'solutions' | 'autofix' = autoFixExport ? 'autofix' : (includeSolutions ? 'solutions' : 'exam');
    setExportingPaperPdf(mode);

    try {
      const title = `${activePaper.year === 'Custom' ? 'Custom Exam' : `${activePaper.year} ${activePaper.subject}`} ${includeSolutions ? 'Solutions' : 'Paper'}`;
      const subtitle = `${activePaper.subject} • ${activePaper.grade}`;
      const downloadName = `${activePaper.year}-${activePaper.subject}-${activePaper.grade}`;

      await exportExamQuestionsPdf({
        includeSolutions,
        autoFixExport,
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

  const exportSavedExamPdf = async (includeSolutions: boolean, autoFixExport = false) => {
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

    const mode: 'exam' | 'solutions' | 'autofix' = autoFixExport ? 'autofix' : (includeSolutions ? 'solutions' : 'exam');
    setExportingSavedExamPdf(mode);

    try {
      const title = `${selectedAttempt.paperYear || 'Saved'} ${selectedAttempt.paperSubject || 'Exam'} ${includeSolutions ? 'Solutions' : 'Paper'}`.trim();
      const subtitle = `${selectedAttempt.paperGrade || ''}`.trim();
      const downloadName = `${selectedAttempt.paperYear || 'saved'}-${selectedAttempt.paperSubject || 'exam'}-${selectedAttempt.paperGrade || ''}`;

      await exportExamQuestionsPdf({
        includeSolutions,
        autoFixExport,
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

  const exportCustomExamPdf = async (mode: 'questions' | 'questions_with_solutions' | 'solutions_only' | 'raw_latex_tex' | 'raw_latex_zip') => {
    if (!paperQuestions.length) {
      alert('No custom exam questions are available to export.');
      return;
    }

    const includeSolutions = mode === 'questions_with_solutions' || mode === 'solutions_only';
    const includeQuestionContent = mode !== 'solutions_only';
    const outputFormat: 'pdf' | 'tex' | 'tex-zip' = mode === 'raw_latex_zip'
      ? 'tex-zip'
      : (mode === 'raw_latex_tex' ? 'tex' : 'pdf');
    const exportMode: 'exam' | 'solutions' | 'solutions-only' | 'latex-tex' | 'latex-zip' = mode === 'raw_latex_zip'
      ? 'latex-zip'
      : (mode === 'raw_latex_tex'
        ? 'latex-tex'
        : (mode === 'solutions_only' ? 'solutions-only' : (includeSolutions ? 'solutions' : 'exam')));
    setExportingCustomExamPdf(exportMode);

    try {
      const subject = activePaper?.subject || 'Custom Exam';
      const grade = activePaper?.grade || '';
      const title = `${subject} ${mode === 'solutions_only' ? 'Solutions' : (includeSolutions ? 'Solutions' : 'Paper')}`;
      const subtitle = [grade, `${paperQuestions.length} question${paperQuestions.length === 1 ? '' : 's'}`].filter(Boolean).join(' • ');
      const normalizedSubject = String(subject || '').toLowerCase();
      const subjectCode = normalizedSubject.includes('extension 2') || normalizedSubject.includes('ext 2')
        ? 'ME2'
        : (normalizedSubject.includes('extension 1') || normalizedSubject.includes('ext 1')
          ? 'ME1'
          : (normalizedSubject.includes('standard') ? 'MS' : 'MA'));
      const gradeToken = String(grade || '').includes('11') ? 'Y11' : 'Y12';
      const topicLabel = String(activePaper?.topic || paperQuestions[0]?.topic || 'Custom Topic').trim() || 'Custom Topic';
      const documentLabel = includeQuestionContent
        ? (includeSolutions ? 'Questions + Solutions' : 'Questions')
        : 'Solutions';
      const downloadName = `${gradeToken} ${subjectCode} ${topicLabel} [${documentLabel}]`;

      await exportExamQuestionsPdf({
        includeSolutions,
        includeQuestionContent,
        outputFormat,
        autoFixExport: false,
        questions: paperQuestions,
        title,
        subtitle,
        downloadName,
      });
    } catch (err) {
      console.error('Error exporting custom exam PDF:', err);
      alert(err instanceof Error ? err.message : 'Failed to export PDF');
    } finally {
      setExportingCustomExamPdf(null);
    }
  };

  const renameCustomExam = (nextTitle: string) => {
    const trimmed = nextTitle.trim();
    if (!trimmed) return;
    setActivePaper((prev) => {
      if (!prev) return prev;
      const nextPaper = { ...prev, customName: trimmed };
      try {
        const rawSession = sessionStorage.getItem(CUSTOM_EXAM_SESSION_STORAGE_KEY);
        if (rawSession) {
          const parsedSession = JSON.parse(rawSession);
          sessionStorage.setItem(CUSTOM_EXAM_SESSION_STORAGE_KEY, JSON.stringify({
            ...parsedSession,
            activePaper: { ...(parsedSession?.activePaper || {}), customName: trimmed },
          }));
        }
      } catch {
        // no-op: title rename should still work even if storage is unavailable
      }
      try {
        const rawLocal = localStorage.getItem(CUSTOM_EXAM_STORAGE_KEY);
        if (rawLocal) {
          const parsedLocal = JSON.parse(rawLocal);
          localStorage.setItem(CUSTOM_EXAM_STORAGE_KEY, JSON.stringify({
            ...parsedLocal,
            activePaper: { ...(parsedLocal?.activePaper || {}), customName: trimmed },
          }));
        }
      } catch {
        // no-op: title rename should still work even if storage is unavailable
      }
      return nextPaper;
    });
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

  const submitPdfIngestV2 = async () => {
    if (!pdfIngestV2File) {
      setPdfIngestV2Status('error');
      setPdfIngestV2Message('Please select a PDF file first.');
      return;
    }

    const yearToSend = (pdfYearRef.current ?? pdfYear) || '';

    if (!yearToSend || !pdfSubject || !pdfGrade || !pdfSchoolName.trim()) {
      setPdfIngestV2Status('error');
      setPdfIngestV2Message('Please provide grade, year, subject, and school.');
      return;
    }

    const payload = new FormData();
    payload.append('pdf', pdfIngestV2File);
    payload.append('grade', pdfGrade);
    payload.append('year', yearToSend);
    payload.append('subject', pdfSubject);
    payload.append('school', pdfSchoolName.trim());
    payload.append('overwrite', pdfOverwrite ? 'true' : 'false');
    payload.append('classifyAfterUpload', pdfIngestV2ClassifyAfterUpload ? 'true' : 'false');
    payload.append('reasoningEffort', pdfIngestV2ReasoningEffort);

    try {
      setPdfIngestV2Status('uploading');
      setPdfIngestV2Message('Running MathPix and ingest pipeline...');
      setPdfIngestV2Response('');

      const response = await fetch('/api/hsc/pdf-ingest-v2', {
        method: 'POST',
        body: payload,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const details = String(data?.details || '').trim();
        const baseError = String(data?.error || '').trim();
        const code = String(data?.code || '').trim();
        const stage = String(data?.stage || '').trim();
        const hint = String(data?.hint || '').trim();

        const lines = [
          details || baseError || `Ingest failed (${response.status})`,
          code ? `Code: ${code}` : '',
          stage ? `Stage: ${stage}` : '',
          hint ? `Hint: ${hint}` : '',
        ].filter(Boolean);

        setPdfIngestV2Response(JSON.stringify(data, null, 2));
        throw new Error(lines.join('\n'));
      }

      setPdfIngestV2Status('ready');
      setPdfIngestV2Message(
        `Inserted ${Number(data?.inserted || 0)} question(s); failed ${Number(data?.failed || 0)}.`
      );
      setPdfIngestV2Response(JSON.stringify(data, null, 2));
      fetchAllQuestions({ includeIncomplete: true });
    } catch (error) {
      setPdfIngestV2Status('error');
      const message = error instanceof Error ? error.message : 'Failed to run pdf-ingest-v2';
      setPdfIngestV2Message(message);
      setPdfIngestV2Response((prev) => prev || JSON.stringify({ error: message }, null, 2));
    }
  };

  const submitPdfMathpixOcrPreview = async () => {
    if (!pdfIngestV2File) {
      setPdfOcrPreviewStatus('error');
      setPdfOcrPreviewMessage('Please select a PDF file first.');
      return;
    }

    const payload = new FormData();
    payload.append('pdf', pdfIngestV2File);
    payload.append('grade', pdfGrade);
    payload.append('year', (pdfYearRef.current ?? pdfYear) || '');
    payload.append('subject', pdfSubject);
    payload.append('school', pdfSchoolName.trim() || 'OCR Preview');
    payload.append('reasoningEffort', pdfIngestV2ReasoningEffort);
    payload.append('maxQuestions', '200');
    payload.append('dryRun', 'true');

    try {
      setPdfOcrPreviewStatus('uploading');
      setPdfOcrPreviewMessage('Running Mathpix OCR preview (no DB writes)...');
      setPdfOcrPreviewResponse('');

      const response = await fetch('/api/hsc/pdf-ingest-v2', {
        method: 'POST',
        body: payload,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const details = String(data?.details || '').trim();
        const baseError = String(data?.error || '').trim();
        const code = String(data?.code || '').trim();
        const stage = String(data?.stage || '').trim();
        const hint = String(data?.hint || '').trim();

        const lines = [
          details || baseError || `OCR preview failed (${response.status})`,
          code ? `Code: ${code}` : '',
          stage ? `Stage: ${stage}` : '',
          hint ? `Hint: ${hint}` : '',
        ].filter(Boolean);

        setPdfOcrPreviewResponse(JSON.stringify(data, null, 2));
        throw new Error(lines.join('\n'));
      }

      const pageCount = Number(data?.source?.pageCount || 0);
      const questionCount = Number(data?.previewQuestions?.length || 0);
      const diagramLines = Number(data?.source?.totalDiagramLikeLines || 0);
      const imageCount = Number(data?.source?.imageCount || 0);
      const pageLabel = pageCount > 0 ? `${pageCount} page(s)` : `${imageCount} extracted image file(s)`;

      setPdfOcrPreviewStatus('ready');
      setPdfOcrPreviewMessage(
        `Preview ready: ${pageLabel}, ${questionCount} preview question chunk(s), ${diagramLines} diagram-like line(s) detected.`
      );
      setPdfOcrPreviewResponse(JSON.stringify(data, null, 2));
    } catch (error) {
      setPdfOcrPreviewStatus('error');
      const message = error instanceof Error ? error.message : 'Failed to run OCR preview';
      setPdfOcrPreviewMessage(message);
      setPdfOcrPreviewResponse((prev) => prev || JSON.stringify({ error: message }, null, 2));
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

  const startPaperAttempt = (paper: { year: string; subject: string; grade: string; school: string; count: number; topic?: string; customName?: string }) => {
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
      topic: String(typedQuestions[0]?.topic || 'Saved Topic'),
      customName: String(attempt.paperSubject || 'Saved Exam'),
    });
    setPaperQuestions(typedQuestions);
    setPaperIndex(0);
    setViewMode('exam');
    router.push('/dashboard/exam');
  };

  const shuffleQuestions = (items: Question[]) => {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const orderMultipleChoiceFirst = (items: Question[]) => {
    const mcq: Question[] = [];
    const written: Question[] = [];
    for (const item of items) {
      if (item.question_type === 'multiple_choice') {
        mcq.push(item);
      } else {
        written.push(item);
      }
    }
    return [...mcq, ...written];
  };

  const loadQuestionsForBuilder = async (grade?: string, subject?: string) => {
    try {
      setLoadingQuestions(true);
      const params = new URLSearchParams();
      if (grade) params.set('grade', grade);
      if (subject) params.set('subject', subject);
      const url = params.toString() ? `/api/hsc/all-questions?${params}` : '/api/hsc/all-questions';
      const response = await fetch(url);
      const data = await response.json().catch(() => ([]));
      const rows = Array.isArray(data) ? data : [];
      return rows.filter((q) => {
        if (isExamIncomplete((q as any)?.exam_incomplete)) return false;
        const topic = String((q as any)?.topic || '').trim().toLowerCase();
        if (topic === 'unspecified') return false;
        return true;
      }) as Question[];
    } catch (err) {
      console.error('Error loading questions for builder:', err);
      return [] as Question[];
    } finally {
      setLoadingQuestions(false);
    }
  };

  const consumeExamGenerationToken = async (
    grade: string
  ): Promise<{ ok: boolean; message?: string; hasActiveSubscription?: boolean }> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      return { ok: false, message: 'Please sign in again before generating an exam.' };
    }

    try {
      const response = await fetch('/api/user/consume-exam-generation-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ grade }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        tokensUsed?: number;
        tokensLimit?: number;
        tokensResetAt?: string | null;
        hasActiveSubscription?: boolean;
        questionTokensRemaining?: number | null;
      };

      if (!response.ok) {
        return { ok: false, message: data.error || 'Unable to use an exam generation token.' };
      }

      if (typeof data.tokensUsed === 'number') {
        setUserExportsUsed(data.tokensUsed);
      }
      if (typeof data.tokensLimit === 'number') {
        setUserExportsLimit(data.tokensLimit);
      }
      if (typeof data.tokensResetAt !== 'undefined') {
        setUserExportsResetAt(data.tokensResetAt ?? null);
      }
      if (typeof data.hasActiveSubscription === 'boolean') {
        setHasActiveSubscription(data.hasActiveSubscription);
      }
      if (typeof data.questionTokensRemaining === 'number') {
        setUserQuestionTokensBalance(data.questionTokensRemaining);
      }

      return { ok: true, hasActiveSubscription: Boolean(data.hasActiveSubscription) };
    } catch (err) {
      return {
        ok: false,
        message: getFetchErrorMessage(err, 'Unable to use an exam generation token.'),
      };
    }
  };

  const consumeQuestionTokens = async (amount: number): Promise<{ ok: boolean; message?: string; remaining?: number }> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      return { ok: false, message: 'Please sign in again before generating questions.' };
    }

    try {
      const response = await fetch('/api/user/consume-question-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        tokensRemaining?: number;
        tokensShortby?: number;
      };

      if (!response.ok) {
        return { ok: false, message: data.error || 'Unable to consume question tokens.', remaining: data.tokensRemaining };
      }

      setUserQuestionTokensBalance(data.tokensRemaining ?? 0);
      return { ok: true, remaining: data.tokensRemaining };
    } catch (err) {
      return {
        ok: false,
        message: getFetchErrorMessage(err, 'Unable to consume question tokens.'),
      };
    }
  };

  const initializeCustomExam = async (params: ExamBuilderParams) => {
    setIsInitializingExam(true);
    try {
      if (!params.includeWritten && !params.includeMultipleChoice) {
        return { ok: false, message: 'Select at least one question type: Written or Multiple choice.' };
      }

      clearPaperState();
      const pool = await loadQuestionsForBuilder(params.grade, params.subject);
      const gradeSubjectPool = pool.filter((q) => {
        if (String(q.grade) !== params.grade) return false;
        if (String(q.subject) !== params.subject) return false;
        return true;
      });

      const filtered = gradeSubjectPool.filter((q) => {
        const topic = String(q.topic || '').trim();
        if (topic.toLowerCase() === 'unspecified') return false;
        if (params.topics.length > 0 && !params.topics.includes(topic)) return false;

        const isMultipleChoice = q.question_type === 'multiple_choice';
        if (isMultipleChoice && !params.includeMultipleChoice) return false;
        if (!isMultipleChoice && !params.includeWritten) return false;

        const subtopics = params.subtopics || [];
        const dotPoints = params.dotPoints || [];
        if (subtopics.length > 0 || dotPoints.length > 0) {
          const qSubtopic = String(q.subtopic || '').trim();
          const qDotPoint = String(q.syllabus_dot_point || '').trim();
          if (subtopics.length > 0 && subtopics.includes(qSubtopic)) return true;
          if (dotPoints.length > 0 && dotPoints.some((dp) => qDotPoint.includes(dp))) return true;
          return false;
        }

        return true;
      });

      if (!filtered.length) {
        return { ok: false, message: 'No questions match these settings yet.' };
      }

      const shuffled = shuffleQuestions(filtered);
      const useAllQuestionsFromTopic = Boolean(params.allQuestionsFromTopic) && params.topics.length === 1;
      const targetCount = Math.min(
        useAllQuestionsFromTopic ? shuffled.length : params.intensity,
        shuffled.length,
        CUSTOM_EXAM_MAX_QUESTIONS
      );
      const selected = shuffled.slice(0, targetCount);
      const manualGroupedSelection = expandManualGroupedSelection(selected, gradeSubjectPool, customExamGroupByQuestionId);
      const romanGroupedSelection = expandRomanSubpartSelection(manualGroupedSelection, gradeSubjectPool);
      const finalSelectionWithSharedImages = applySiblingGraphImages(romanGroupedSelection);
      const orderedSelection = params.includeMultipleChoice
        ? orderMultipleChoiceFirst(finalSelectionWithSharedImages)
        : finalSelectionWithSharedImages;

      if (!orderedSelection.length) {
        return { ok: false, message: 'Not enough questions to build this exam.' };
      }

      const totalPossible = orderedSelection.reduce((sum, q) => sum + (q.marks || 0), 0);
      const exam = {
        type: 'exam',
        id: Date.now(),
        paperYear: 'Custom',
        paperSubject: params.subject,
        paperGrade: params.grade,
        examAttempts: orderedSelection.map((q) => ({ question: q, submittedAnswer: null, feedback: null })),
        totalScore: 0,
        totalPossible,
        savedAt: new Date().toISOString(),
      };

      try {
        const existing = JSON.parse(localStorage.getItem('savedAttempts') || '[]');
        existing.push(exam);
        localStorage.setItem('savedAttempts', JSON.stringify(existing));
        setSavedAttempts(existing);
      } catch (storageError) {
        if (isQuotaExceededError(storageError)) {
          console.warn('Skipping savedAttempts persistence: localStorage quota exceeded.');
        } else {
          throw storageError;
        }
      }

      const customPaper = {
        year: 'Custom',
        subject: params.subject,
        grade: params.grade,
        school: 'Custom',
        count: orderedSelection.length,
        topic: params.topics.length === 1
          ? params.topics[0]
          : (params.topics.length > 1 ? 'Mixed Topics' : (orderedSelection[0]?.topic || 'Custom Topic')),
        customName: params.topics.length === 1 ? params.topics[0] : `${params.subject} Custom Exam`,
      };
      const storagePayload = {
        activePaper: customPaper,
        questions: orderedSelection,
        createdAt: new Date().toISOString(),
      };
      const compactQuestions = orderedSelection.map((q) => ({
        ...q,
        graph_image_data: null,
        sample_answer_image: null,
        mcq_option_a_image: null,
        mcq_option_b_image: null,
        mcq_option_c_image: null,
        mcq_option_d_image: null,
      }));

      let persistedForRestore = false;
      try {
        sessionStorage.setItem(CUSTOM_EXAM_SESSION_STORAGE_KEY, JSON.stringify(storagePayload));
        persistedForRestore = true;
      } catch (storageError) {
        if (!isQuotaExceededError(storageError)) {
          throw storageError;
        }
      }

      try {
        localStorage.setItem(CUSTOM_EXAM_STORAGE_KEY, JSON.stringify({
          ...storagePayload,
          questions: compactQuestions,
          compact: true,
        }));
        persistedForRestore = true;
      } catch (storageError) {
        if (!isQuotaExceededError(storageError)) {
          throw storageError;
        }
      }

      if (!persistedForRestore) {
        return {
          ok: false,
          message: 'Exam is too large to store for navigation. Reduce question count or disable all-topic mode.',
        };
      }

      const examGenTokenResult = await consumeExamGenerationToken(params.grade);
      if (!examGenTokenResult.ok) {
        return { ok: false, message: examGenTokenResult.message || 'Unable to use an exam generation token.' };
      }
      // Exam Architect creation is gated by the monthly exam-generation token counter.
      // Per-question tokens (question_tokens_balance) are used for question-generation flows,
      // and should not block exam generation when they are at 0.

      setActivePaper(customPaper);
      setPaperQuestions(orderedSelection);
      setPaperIndex(0);
      if (params.cognitive) {
        startExamSimulation(params.subject);
      }
      router.push('/dashboard/exam');
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
    if (initialViewMode === 'exam') return;

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
  }, [initialViewMode]);

  useEffect(() => {
    if (initialViewMode !== 'exam') return;

    try {
      const raw = sessionStorage.getItem(CUSTOM_EXAM_SESSION_STORAGE_KEY)
        || localStorage.getItem(CUSTOM_EXAM_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const storedQuestions = Array.isArray(parsed?.questions) ? parsed.questions.filter(isStoredQuestion) : [];
      if (!storedQuestions.length) return;

      setActivePaper(parsed?.activePaper ?? {
        year: 'Custom',
        subject: storedQuestions[0]?.subject || 'Custom Exam',
        grade: storedQuestions[0]?.grade || '',
        school: 'Custom',
        count: storedQuestions.length,
      });
      setPaperQuestions(storedQuestions);
      setPaperIndex(0);
      setViewMode('exam');
    } catch (err) {
      console.error('Failed to restore custom exam:', err);
    }
  }, [initialViewMode]);

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

  const viewModeLabel = viewMode === 'dashboard' ? 'Dashboard' : viewMode === 'analytics' ? 'Analytics Hub' : viewMode === 'browse' ? 'Browse Bank' : viewMode === 'builder' ? 'Exam Architect' : viewMode === 'exam' ? 'Custom Exam' : viewMode === 'formulas' ? 'Formula Vault' : viewMode === 'saved' ? 'Saved Content' : viewMode === 'history' ? 'My History' : viewMode === 'syllabus' ? 'Syllabus' : viewMode === 'papers' || viewMode === 'paper' ? 'Exam' : viewMode === 'settings' ? 'Settings' : viewMode === 'dev-questions' ? 'Dev Mode' : viewMode === 'logs' ? 'Upload Logs' : String(viewMode).replace(/-/g, ' ');
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
            {isDevMode && (
              <button onClick={() => { setViewMode('browse'); router.push('/dashboard/browse'); setSidebarHovered(false); }} className={`w-full flex items-center py-4 transition-all duration-200 text-left cursor-pointer shrink-0 ${sidebarItemLayoutClass} ${sidebarItemGapClass} ${viewMode === 'browse' ? 'sidebar-link-active font-semibold' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'}`}>
                <BookOpen size={18} className="shrink-0" />
                <span className={`text-sm tracking-wide whitespace-nowrap transition-all duration-200 ${sidebarTextClass}`}>Browse Exam</span>
              </button>
            )}
            <button onClick={() => { setViewMode('analytics'); router.push('/dashboard/analytics'); setSidebarHovered(false); }} className={`hidden w-full items-center py-4 transition-all duration-200 text-left cursor-pointer shrink-0 ${sidebarItemLayoutClass} ${sidebarItemGapClass} ${viewMode === 'analytics' ? 'sidebar-link-active font-semibold' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'}`}>
              <LineChart size={18} className="shrink-0" />
              <span className={`text-sm tracking-wide whitespace-nowrap transition-all duration-200 ${sidebarTextClass}`}>Analytics Hub</span>
            </button>
            <button onClick={() => { setViewMode('builder'); clearPaperState(); router.push('/dashboard/builder'); setSidebarHovered(false); }} className={`w-full flex items-center py-4 transition-all duration-200 text-left cursor-pointer shrink-0 ${sidebarItemLayoutClass} ${sidebarItemGapClass} ${viewMode === 'builder' ? 'sidebar-link-active font-semibold' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'}`}>
              <PlusCircle size={18} className="shrink-0" />
              <span className={`text-sm tracking-wide whitespace-nowrap transition-all duration-200 ${sidebarTextClass}`}>Exam Architect</span>
            </button>
            <button onClick={() => { loadSavedAttempts(); setViewMode('saved'); router.push('/dashboard/saved'); setSidebarHovered(false); }} className={`w-full flex items-center py-4 transition-all duration-200 text-left cursor-pointer shrink-0 ${sidebarItemLayoutClass} ${sidebarItemGapClass} ${viewMode === 'saved' ? 'sidebar-link-active font-semibold' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'}`}>
              <Bookmark size={18} className="shrink-0" />
              <span className={`text-sm tracking-wide whitespace-nowrap transition-all duration-200 ${sidebarTextClass}`}>Saved Content</span>
              {savedAttempts.length > 0 && sidebarContentExpanded && <span className="text-xs text-neutral-400">({savedAttempts.length})</span>}
            </button>
            <button onClick={() => { setViewMode('history'); router.push('/dashboard/history'); setSidebarHovered(false); }} className={`hidden w-full items-center py-4 transition-all duration-200 text-left cursor-pointer shrink-0 ${sidebarItemLayoutClass} ${sidebarItemGapClass} ${viewMode === 'history' ? 'sidebar-link-active font-semibold' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'}`}>
              <History size={18} className="shrink-0" />
              <span className={`text-sm tracking-wide whitespace-nowrap transition-all duration-200 ${sidebarTextClass}`}>My History</span>
            </button>
            {viewMode === 'saved' && savedAttempts.length > 0 && sidebarContentExpanded && (
              <div className="space-y-0 px-2 pb-2">
                {savedAttempts.map((attempt) => (
                  <button key={attempt.id} onClick={() => {
                    if (attempt.type === 'exam') {
                      openSavedExamAsPaper(attempt);
                      setSelectedAttempt(null);
                    } else {
                      setSelectedAttempt(attempt);
                    }
                    setSidebarHovered(false);
                  }} className={`w-full text-left p-3 rounded-lg transition-colors text-sm cursor-pointer ${selectedAttempt?.id === attempt.id ? 'bg-neutral-100 text-neutral-900 font-medium' : 'text-neutral-600 hover:bg-neutral-50'}`}>
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
            <div className={`${viewMode === 'paper' ? 'max-w-[68rem] mx-auto w-full space-y-8 lg:translate-x-2' : viewMode === 'exam' ? 'max-w-6xl mx-auto w-full space-y-8' : 'max-w-5xl mx-auto space-y-8'}`}>
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
                  initialSubject={userDefaultSubject}
                  initialGrade={userDefaultGrade as any}
                />
              )}
              {viewMode === 'exam' && (
                <CustomExamView
                  examTitle={activePaper?.customName || activePaper?.subject || 'Custom Exam'}
                  examMeta={activePaper ? `${activePaper.grade} • ${activePaper.count} questions` : null}
                  questions={paperQuestions}
                  exportingPdf={exportingCustomExamPdf}
                  onExportPdf={exportCustomExamPdf}
                  onRenameExamTitle={renameCustomExam}
                  backButtonLabel={activePaper?.school === 'Saved' ? 'Back to Saved Exams' : 'Back to Exam Architect'}
                  onBack={() => {
                    if (activePaper?.school === 'Saved') {
                      setViewMode('saved');
                      router.push('/dashboard/saved');
                      return;
                    }
                    setViewMode('builder');
                    router.push('/dashboard/builder');
                  }}
                />
              )}
              {viewMode === 'formulas' && <FormulaVaultView setViewMode={setViewMode} />}
              {viewMode === 'history' && <HistoryView />}
              {viewMode === 'paper' && (
                <PaperView
                  question={question}
                  isGenerating={isGenerating}
                  showAnswer={showAnswer}
                  appState={appState}
                  canvasHeight={canvasHeight}
                  loading={loading}
                  isIpad={isIpad}
                  error={error}
                  feedback={feedback}
                  submittedAnswer={submittedAnswer}
                  selectedMcqAnswer={selectedMcqAnswer}
                  mcqImageSize={mcqImageSize}
                  isSaving={isSaving}
                  paperQuestions={paperQuestions}
                  paperIndex={paperIndex}
                  showPaperQuestionNavigator={showPaperQuestionNavigator}
                  showQuestionInfo={showQuestionInfo}
                  exportingPaperPdf={exportingPaperPdf}
                  examConditionsActive={examConditionsActive}
                  examAttempts={examAttempts}
                  examEnded={examEnded}
                  showFinishExamPrompt={showFinishExamPrompt}
                  examReviewMode={examReviewMode}
                  examReviewIndex={examReviewIndex}
                  isDevMode={isDevMode}
                  allQuestions={allQuestions}
                  setShowAnswer={setShowAnswer}
                  setAppState={setAppState}
                  setFeedback={setFeedback}
                  setUploadedFile={setUploadedFile}
                  setSubmittedAnswer={setSubmittedAnswer}
                  setSelectedMcqAnswer={setSelectedMcqAnswer}
                  setMcqImageSize={setMcqImageSize}
                  setViewMode={setViewMode}
                  setShowPaperQuestionNavigator={setShowPaperQuestionNavigator}
                  setShowQuestionInfo={setShowQuestionInfo}
                  setExamReviewMode={setExamReviewMode}
                  setExamReviewIndex={setExamReviewIndex}
                  excalidrawSceneRef={excalidrawSceneRef}
                  excalidrawApiRef={excalidrawApiRef}
                  getDisplayGroupAt={getDisplayGroupAt}
                  generateQuestion={generateQuestion}
                  submitAnswer={submitAnswer}
                  clearPaperState={clearPaperState}
                  isPaperMode={isPaperMode}
                  activePaperGroupStartIndex={activePaperGroupStartIndex}
                  Excalidraw={Excalidraw}
                  exportPaperPdf={exportPaperPdf}
                  goToPaperQuestion={goToPaperQuestion}
                  openInlineQuestionEditor={openInlineQuestionEditor}
                  resetCanvas={resetCanvas}
                  startExamSimulation={startExamSimulation}
                  handleEndExam={handleEndExam}
                  saveExam={saveExam}
                  endExam={endExam}
                  handleNextQuestion={handleNextQuestion}
                  paperDisplayGroups={paperDisplayGroups}
                  uploadImage={uploadImage}
                  isMarking={isMarking}
                  awardedMarks={awardedMarks}
                  maxMarks={maxMarks}
                  isMultipleChoiceReview={isMultipleChoiceReview}
                  saveAttempt={saveAttempt}
                  examTimeRemainingLabel={examTimeRemainingLabel}
                />
              )}
              {viewMode === 'papers' && (
                <PapersView
                  loadingQuestions={loadingQuestions}
                  questionsFetchError={questionsFetchError}
                  availablePapers={availablePapers}
                  startPaperAttempt={startPaperAttempt}
                />
              )}
              {viewMode === 'saved' && (
                <SavedView
                  savedAttempts={savedAttempts}
                  selectedAttempt={selectedAttempt}
                  exportingSavedExamPdf={exportingSavedExamPdf}
                  examAttempts={examAttempts}
                  savedExamReviewMode={savedExamReviewMode}
                  savedExamReviewIndex={savedExamReviewIndex}
                  savedQuestionsListExpanded={savedQuestionsListExpanded}
                  savedReviewSidebarCollapsed={savedReviewSidebarCollapsed}
                  isDevMode={isDevMode}
                  feedback={feedback}
                  submittedAnswer={submittedAnswer}
                  question={question}
                  setSelectedAttempt={setSelectedAttempt}
                  setViewMode={setViewMode}
                  setSavedExamReviewMode={setSavedExamReviewMode}
                  setSavedExamReviewIndex={setSavedExamReviewIndex}
                  setSavedQuestionsListExpanded={setSavedQuestionsListExpanded}
                  setSavedReviewSidebarCollapsed={setSavedReviewSidebarCollapsed}
                  setDevTab={setDevTab}
                  setSelectedManageQuestionId={setSelectedManageQuestionId}
                  setManageQuestionDraft={setManageQuestionDraft}
                  setManageQuestionEditMode={setManageQuestionEditMode}
                  exportSavedExamPdf={exportSavedExamPdf}
                  openSavedExamAsPaper={openSavedExamAsPaper}
                  removeSavedAttempt={removeSavedAttempt}
                />
              )}

              {/* Saved Attempts Modal - Removed, now using inline sidebar view */}

              {/* Syllabus Viewer */}
              {viewMode === 'syllabus' && (
                <SyllabusViewer onClose={() => setViewMode('browse')} isDevMode={isDevMode} />
              )}

              {/* Settings Page */}
              {(viewMode === 'settings' || viewMode === 'settings-dev') && (
                <SettingsView
                  question={question}
                  error={error}
                  examPdfFile={examPdfFile}
                  examImageFiles={examImageFiles}
                  pdfStatus={pdfStatus}
                  pdfMessage={pdfMessage}
                  pdfChatGptResponse={pdfChatGptResponse}
                  pdfRawInputs={pdfRawInputs}
                  pdfIngestV2File={pdfIngestV2File}
                  pdfIngestV2Status={pdfIngestV2Status}
                  pdfIngestV2Message={pdfIngestV2Message}
                  pdfIngestV2Response={pdfIngestV2Response}
                  pdfOcrPreviewStatus={pdfOcrPreviewStatus}
                  pdfOcrPreviewMessage={pdfOcrPreviewMessage}
                  pdfOcrPreviewResponse={pdfOcrPreviewResponse}
                  pdfIngestV2ClassifyAfterUpload={pdfIngestV2ClassifyAfterUpload}
                  pdfIngestV2ReasoningEffort={pdfIngestV2ReasoningEffort}
                  pdfGrade={pdfGrade}
                  pdfYear={pdfYear}
                  pdfSubject={pdfSubject}
                  pdfOverwrite={pdfOverwrite}
                  pdfGenerateCriteria={pdfGenerateCriteria}
                  pdfAutoGroupSubparts={pdfAutoGroupSubparts}
                  pdfSchoolName={pdfSchoolName}
                  pdfPaperNumber={pdfPaperNumber}
                  selectedSyllabusMappingPaper={selectedSyllabusMappingPaper}
                  isMappingSyllabusDotPoints={isMappingSyllabusDotPoints}
                  syllabusMappingResult={syllabusMappingResult}
                  syllabusMappingStatus={syllabusMappingStatus}
                  syllabusMappingProgress={syllabusMappingProgress}
                  syllabusMappingDebugOutputs={syllabusMappingDebugOutputs}
                  syllabusWorkflowTestInput={syllabusWorkflowTestInput}
                  isRunningSyllabusWorkflowTest={isRunningSyllabusWorkflowTest}
                  syllabusWorkflowTestStatus={syllabusWorkflowTestStatus}
                  syllabusWorkflowTestResult={syllabusWorkflowTestResult}
                  syllabusWorkflowTestOutput={syllabusWorkflowTestOutput}
                  syllabusImportText={syllabusImportText}
                  syllabusImportSubject={syllabusImportSubject}
                  syllabusImportGrade={syllabusImportGrade}
                  syllabusImporting={syllabusImporting}
                  syllabusImportResult={syllabusImportResult}
                  syllabusImportStatus={syllabusImportStatus}
                  userEmail={userEmail}
                  userCreatedAt={userCreatedAt}
                  userName={userName}
                  userNameDraft={userNameDraft}
                  isSavingName={isSavingName}
                  userPlan={userPlan}
                  userExportsUsed={userExportsUsed}
                  userExportsLimit={userExportsLimit}
                  userExportsResetAt={userExportsResetAt}
                  hasActiveSubscription={hasActiveSubscription}
                  userQuestionTokensBalance={userQuestionTokensBalance}
                  userDefaultGrade={userDefaultGrade}
                  userDefaultSubject={userDefaultSubject}
                  userCompanyName={userCompanyName}
                  userStripeCancelAt={userStripeCancelAt}
                  userStripeCancelAtPeriodEnd={userStripeCancelAtPeriodEnd}
                  onSaveDefaultPreset={handleSaveDefaultPreset}
                  isDevMode={isDevMode}
                  showDeveloperTools={viewMode === 'settings-dev'}
                  loadingQuestions={loadingQuestions}
                  setExamPdfFile={setExamPdfFile}
                  setCriteriaPdfFile={setCriteriaPdfFile}
                  setExamImageFiles={setExamImageFiles}
                  setPdfIngestV2File={setPdfIngestV2File}
                  setPdfIngestV2ClassifyAfterUpload={setPdfIngestV2ClassifyAfterUpload}
                  setPdfIngestV2ReasoningEffort={setPdfIngestV2ReasoningEffort}
                  setPdfGrade={setPdfGrade}
                  setPdfYear={setPdfYear}
                  setPdfSubject={setPdfSubject}
                  setPdfOverwrite={setPdfOverwrite}
                  setPdfGenerateCriteria={setPdfGenerateCriteria}
                  setPdfAutoGroupSubparts={setPdfAutoGroupSubparts}
                  setPdfSchoolName={setPdfSchoolName}
                  setPdfPaperNumber={setPdfPaperNumber}
                  setSelectedSyllabusMappingPaper={setSelectedSyllabusMappingPaper}
                  setSyllabusWorkflowTestInput={setSyllabusWorkflowTestInput}
                  setSyllabusImportText={setSyllabusImportText}
                  setSyllabusImportSubject={setSyllabusImportSubject}
                  setSyllabusImportGrade={setSyllabusImportGrade}
                  setViewMode={setViewMode}
                  setUserNameDraft={setUserNameDraft}
                  pdfYearRef={pdfYearRef}
                  fetchAllQuestions={fetchAllQuestions}
                  availablePapers={availablePapers}
                  handleSaveName={handleSaveName}
                  runSyllabusWorkflowTest={runSyllabusWorkflowTest}
                  runSyllabusDotPointMapping={runSyllabusDotPointMapping}
                  runSyllabusImport={runSyllabusImport}
                  submitPdfPair={submitPdfPair}
                  submitPdfIngestV2={submitPdfIngestV2}
                  submitPdfMathpixOcrPreview={submitPdfMathpixOcrPreview}
                />
              )}

              {/* Dev Mode - Upload Logs Page */}
              {viewMode === 'logs' && (
                <LogsView />
              )}

              {/* Dev Mode - Question Management Page */}
              {viewMode === 'dev-questions' && (
                <DevQuestionsView
                  question={question}
                  error={error}
                  taxonomyGrouped={taxonomyGrouped}
                  taxonomyLoading={taxonomyLoading}
                  devTab={devTab}
                  allQuestions={allQuestions}
                  loadingQuestions={loadingQuestions}
                  questionsFetchError={questionsFetchError}
                  deletingQuestionId={deletingQuestionId}
                  manageQuestionDraft={manageQuestionDraft}
                  manageQuestionEditMode={manageQuestionEditMode}
                  selectedManageQuestionIds={selectedManageQuestionIds}
                  bulkActionLoading={bulkActionLoading}
                  manageFilters={manageFilters}
                  manageSearchQuery={manageSearchQuery}
                  manageFiltersApplied={manageFiltersApplied}
                  manageSortKey={manageSortKey}
                  manageSortDirection={manageSortDirection}
                  manageSubView={manageSubView}
                  selectedVisibilityExamKey={selectedVisibilityExamKey}
                  examVisibilityUpdatingKey={examVisibilityUpdatingKey}
                  examVisibilityMessage={examVisibilityMessage}
                  imageMapSelectedPaperKey={imageMapSelectedPaperKey}
                  imageMapQuestions={imageMapQuestions}
                  imageMapDraftById={imageMapDraftById}
                  imageMapSaving={imageMapSaving}
                  selectedGroupingPaperKey={selectedGroupingPaperKey}
                  groupingPaperLoading={groupingPaperLoading}
                  groupingPaperMessage={groupingPaperMessage}
                  selectedVerifySolutionsExamKey={selectedVerifySolutionsExamKey}
                  verifySolutionsApplyUpdates={verifySolutionsApplyUpdates}
                  isVerifyingSolutions={isVerifyingSolutions}
                  verifySolutionsStatus={verifySolutionsStatus}
                  verifySolutionsMessage={verifySolutionsMessage}
                  verifySolutionsOutput={verifySolutionsOutput}
                  newQuestion={newQuestion}
                  isAddingQuestion={isAddingQuestion}
                  setViewMode={setViewMode}
                  setDevTab={setDevTab}
                  setSelectedManageQuestionId={setSelectedManageQuestionId}
                  setManageQuestionDraft={setManageQuestionDraft}
                  setManageQuestionEditMode={setManageQuestionEditMode}
                  setManageFilters={setManageFilters}
                  setManageSearchQuery={setManageSearchQuery}
                  setManageSortKey={setManageSortKey}
                  setManageSortDirection={setManageSortDirection}
                  setManageSubView={setManageSubView}
                  setSelectedVisibilityExamKey={setSelectedVisibilityExamKey}
                  setImageMapSelectedPaperKey={setImageMapSelectedPaperKey}
                  setImageMapDraftById={setImageMapDraftById}
                  setSelectedGroupingPaperKey={setSelectedGroupingPaperKey}
                  setSelectedVerifySolutionsExamKey={setSelectedVerifySolutionsExamKey}
                  setVerifySolutionsApplyUpdates={setVerifySolutionsApplyUpdates}
                  setNewQuestion={setNewQuestion}
                  manageListScrollYRef={manageListScrollYRef}
                  isExamIncomplete={isExamIncomplete}
                  customExamGroupByQuestionId={customExamGroupByQuestionId}
                  getGroupBadgeLabel={getGroupBadgeLabel}
                  fetchAllQuestions={fetchAllQuestions}
                  applyManageFilters={applyManageFilters}
                  beginManageDragSelection={beginManageDragSelection}
                  addQuestionToDatabase={addQuestionToDatabase}
                  deleteQuestion={deleteQuestion}
                  assignSelectedQuestionsToGroup={assignSelectedQuestionsToGroup}
                  autoGroupSubpartQuestions={autoGroupSubpartQuestions}
                  saveImageMapChanges={saveImageMapChanges}
                  reviewVerifyExamOptions={reviewVerifyExamOptions}
                  ALL_TOPICS={ALL_TOPICS}
                  availablePapers={availablePapers}
                  filteredManageQuestions={filteredManageQuestions}
                  filteredManageQuestionIds={filteredManageQuestionIds}
                  continueManageDragSelection={continueManageDragSelection}
                  setAllManageSelections={setAllManageSelections}
                  setSelectedExamIncomplete={setSelectedExamIncomplete}
                  fetchTaxonomy={fetchTaxonomy}
                  handleClipboardImagePaste={handleClipboardImagePaste}
                  loadImageMapExam={loadImageMapExam}
                  handleGraphPaste={handleGraphPaste}
                  handleGraphUpload={handleGraphUpload}
                  openManageImageMap={openManageImageMap}
                  manageExamBuckets={manageExamBuckets}
                  groupingPaperBuckets={groupingPaperBuckets}
                  deleteSelectedQuestions={deleteSelectedQuestions}
                  clearSelectedMarkingCriteria={clearSelectedMarkingCriteria}
                  clearSelectedQuestionGroups={clearSelectedQuestionGroups}
                  hasManageFilters={hasManageFilters}
                  manageQuestionFilterConfig={manageQuestionFilterConfig}
                  manageQuestionFilterGroups={manageQuestionFilterGroups}
                  resetManageFilters={resetManageFilters}
                  saveManageQuestion={saveManageQuestion}
                  runVerifySolutionsReview={runVerifySolutionsReview}
                />
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
