import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookmarkCheck,
  BookOpen,
  Brain,
  Coins,
  GraduationCap,
  History,
  Map as MapIcon,
  Plus,
  RefreshCw,
  Sparkles,
  SlidersHorizontal,
  Timer,
  Trophy,
  Wand2,
  Zap,
} from 'lucide-react';
import SyllabusMindmapModal, { type MindmapSelection } from './SyllabusMindmapModal';
import { DASHBOARD_CHANGELOG } from './changelog';
import {
  BROWSE_GRADES_JUNIOR,
  BROWSE_GRADES_SENIOR,
  BROWSE_SUBJECTS,
  BROWSE_YEARS,
  SUBJECTS_BY_YEAR,
  getTopics,
} from './syllabus-config';
import type {
  DashboardViewMode,
  ExamBuilderParams,
  PaperSummary,
  TopicStat,
} from './types';

type SetViewMode = (m: DashboardViewMode) => void;

export function DashboardView({
  companyName,
  questionTokensRemaining,
  planName,
  onOpenExamArchitect,
  onOpenSavedQuestions,
}: {
  companyName: string;
  questionTokensRemaining: number;
  planName: string;
  onOpenExamArchitect: () => void;
  onOpenSavedQuestions: () => void;
}) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
  const displayName = companyName.trim() || 'there';

  // Pull fresh `question_tokens_balance` and `plan` straight from the Neon-backed
  // subscription endpoint so this view shows the latest values regardless of when
  // the parent last refreshed (mirrors the SettingsView fetch pattern).
  const [tokensOverride, setTokensOverride] = useState<number | null>(null);
  const [planOverride, setPlanOverride] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    const token = localStorage.getItem('token');
    if (!token) return;

    (async () => {
      try {
        const response = await fetch('/api/user/subscription', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!response.ok) return;
        const data = (await response.json().catch(() => ({}))) as {
          plan?: string;
          questionTokensBalance?: number;
          error?: string;
        };
        if (cancelled || data?.error) return;
        if (typeof data.questionTokensBalance === 'number') {
          setTokensOverride(data.questionTokensBalance);
        }
        if (typeof data.plan === 'string' && data.plan) {
          setPlanOverride(`${data.plan.charAt(0).toUpperCase()}${data.plan.slice(1)}`);
        }
      } catch {
        // Silently fall back to props on failure.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const displayedTokens = tokensOverride ?? questionTokensRemaining;
  const displayedPlan = planOverride ?? planName;

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 text-white p-10 shadow-xl">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/5 blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-24 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.4em] text-neutral-400">
              <Sparkles className="size-3" /> Dashboard
            </p>
            <h1 className="mt-4 text-4xl font-light leading-tight sm:text-5xl">
              {greeting},{' '}
              <span className="font-semibold italic bg-gradient-to-r from-white to-neutral-300 bg-clip-text text-transparent">
                {displayName}
              </span>
            </h1>
            <p className="mt-3 text-sm text-neutral-400">{todayLabel}</p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-200">
              <Trophy className="size-3" /> {displayedPlan} plan
            </span>
            <span className="text-xs text-neutral-400">
              {displayedTokens.toLocaleString()} tokens remaining
            </span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="group relative overflow-hidden rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="absolute right-5 top-5 flex size-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <Coins className="size-5" />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-400">Question Tokens</p>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-4xl font-semibold text-neutral-900">
              {displayedTokens.toLocaleString()}
            </span>
            <span className="text-xs text-neutral-500">remaining</span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">Used to generate questions and exams.</p>
        </div>

        <div className="group relative overflow-hidden rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="absolute right-5 top-5 flex size-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <Trophy className="size-5" />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-400">Subscription</p>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-4xl font-semibold capitalize text-neutral-900">{displayedPlan}</span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">Your current plan tier.</p>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <button
          type="button"
          onClick={onOpenExamArchitect}
          className="group relative overflow-hidden rounded-3xl bg-neutral-900 p-6 text-left text-white shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
        >
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/5 blur-2xl transition-opacity group-hover:opacity-80" />
          <div className="relative flex items-start justify-between">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-white/10">
              <Wand2 className="size-5" />
            </div>
            <ArrowRight className="size-5 text-neutral-400 transition-transform group-hover:translate-x-1 group-hover:text-white" />
          </div>
          <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.35em] text-neutral-400">Build</p>
          <h3 className="mt-1 text-xl font-semibold">Exam Architect</h3>
          <p className="mt-1 text-sm text-neutral-300">Compose practice exams from the question library.</p>
        </button>

        <button
          type="button"
          onClick={onOpenSavedQuestions}
          className="group relative overflow-hidden rounded-3xl border border-neutral-200 bg-white p-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="relative flex items-start justify-between">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <BookmarkCheck className="size-5" />
            </div>
            <ArrowRight className="size-5 text-neutral-400 transition-transform group-hover:translate-x-1 group-hover:text-neutral-700" />
          </div>
          <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.35em] text-neutral-400">Library</p>
          <h3 className="mt-1 text-xl font-semibold text-neutral-900">Saved Questions</h3>
          <p className="mt-1 text-sm text-neutral-500">Browse and reuse questions you have bookmarked.</p>
        </button>
      </section>

      <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-neutral-900 text-white">
              <History className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">Changelog</h2>
              <p className="text-[11px] text-neutral-500">Recent product updates</p>
            </div>
          </div>
          <span className="hidden text-[10px] uppercase tracking-[0.3em] text-neutral-400 sm:inline">Latest</span>
        </div>
        <ol className="mt-5 space-y-4 text-sm">
          {DASHBOARD_CHANGELOG.length === 0 ? (
            <li className="rounded-2xl border border-dashed border-neutral-200 px-4 py-6 text-center text-neutral-500">
              No entries yet.
            </li>
          ) : (
            DASHBOARD_CHANGELOG.map((entry) => (
              <li
                key={`${entry.date}-${entry.title}`}
                className="relative rounded-2xl border border-neutral-100 bg-neutral-50/60 px-4 py-3 pl-5 transition-colors hover:border-neutral-200 hover:bg-white"
              >
                <span className="absolute left-0 top-3 h-[calc(100%-1.5rem)] w-1 rounded-full bg-gradient-to-b from-neutral-900 to-neutral-400" />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-neutral-900">{entry.title}</p>
                  <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500 ring-1 ring-neutral-200">
                    {entry.date}
                  </span>
                </div>
                {entry.detail ? (
                  <p className="mt-1 text-xs text-neutral-600">{entry.detail}</p>
                ) : null}
              </li>
            ))
          )}
        </ol>
      </section>
    </div>
  );
}

export function AnalyticsHubView({
  topicStats,
  analyticsSummary,
  analyticsLoading,
  analyticsError,
  onGenerateSummary,
  onSelectTopic,
  selectedTopic,
  onCloseTopic,
  onOpenSyllabus,
}: {
  topicStats: TopicStat[];
  analyticsSummary: string;
  analyticsLoading: boolean;
  analyticsError: string | null;
  onGenerateSummary: () => void;
  onSelectTopic: (topic: string) => void;
  selectedTopic: string | null;
  onCloseTopic: () => void;
  onOpenSyllabus: () => void;
}) {
  const hasStats = topicStats.length > 0;
  return (
    <div className="max-w-6xl mx-auto space-y-12">
      <div className="flex justify-between items-end border-b border-neutral-100 pb-8">
        <div>
          <h1 className="text-4xl font-light mb-2 text-neutral-900">Analytics <span className="font-bold italic">Hub</span></h1>
          <p className="text-neutral-500">Mastery metrics and predictive learning insights.</p>
        </div>
        <div className="flex p-1 bg-neutral-50 rounded-xl border border-neutral-100">
          <button type="button" className="px-4 py-2 text-[10px] font-bold bg-white rounded-lg shadow-sm uppercase tracking-widest text-neutral-800">Weekly</button>
          <button type="button" className="px-4 py-2 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">All Time</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-neutral-900">Topic performance</h3>
            <button
              type="button"
              onClick={onGenerateSummary}
              disabled={analyticsLoading}
              className="px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest border border-neutral-200 text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
            >
              {analyticsLoading ? 'Analyzing...' : 'Generate AI overview'}
            </button>
          </div>

          {!hasStats ? (
            <div className="rounded-3xl border border-neutral-100 bg-neutral-50/60 p-8">
              <p className="text-sm text-neutral-500">No attempts recorded yet. Complete a few questions to unlock topic analytics.</p>
            </div>
          ) : (
            <div className="rounded-3xl border border-neutral-100 overflow-hidden">
              <div className="grid grid-cols-[1fr_120px_120px_120px] px-6 py-4 bg-neutral-50 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                <span>Topic</span>
                <span className="text-right">Attempts</span>
                <span className="text-right">Accuracy</span>
                <span className="text-right">Marks</span>
              </div>
              <div className="divide-y divide-neutral-100">
                {topicStats.map((stat) => {
                  const accuracyLabel = stat.accuracy == null ? 'Pending' : `${stat.accuracy}%`;
                  return (
                    <button
                      key={stat.topic}
                      type="button"
                      onClick={() => onSelectTopic(stat.topic)}
                      className="w-full text-left grid grid-cols-[1fr_120px_120px_120px] px-6 py-4 text-sm hover:bg-neutral-50 transition-colors"
                    >
                      <span className="font-semibold text-neutral-800">{stat.topic}</span>
                      <span className="text-right text-neutral-500">{stat.attempts}</span>
                      <span className="text-right text-neutral-700">{accuracyLabel}</span>
                      <span className="text-right text-neutral-500">
                        {stat.scoredAttempts > 0 ? `${stat.earnedMarks}/${stat.totalMarks}` : '—'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {analyticsError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
              {analyticsError}
            </div>
          )}

          <div className="rounded-3xl border border-neutral-100 p-6 bg-white">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-neutral-900">AI overview</h4>
              <span className="text-[10px] uppercase tracking-widest text-neutral-400">Insights</span>
            </div>
            <div className="text-sm text-neutral-600 whitespace-pre-wrap">
              {analyticsSummary || 'Run the AI overview to receive improvement recommendations based on your topic accuracy.'}
            </div>
          </div>

          <div className="rounded-3xl border border-dashed border-neutral-200 p-6 bg-neutral-50/60">
            <h4 className="text-sm font-semibold text-neutral-700 mb-2">Subtopic precision (coming soon)</h4>
            <p className="text-xs text-neutral-500">Future updates will show fine-grained subtopic performance so you can pinpoint gaps with more precision.</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-neutral-900 rounded-3xl p-10 text-white relative overflow-hidden flex flex-col items-center justify-center text-center shadow-2xl">
            <Brain size={48} className="text-[#b5a45d] mb-6" />
            <h3 className="text-[10px] font-bold text-[#b5a45d] uppercase tracking-[0.3em] mb-2">Predictive Performance</h3>
            <div className="text-7xl font-bold mb-4 tracking-tighter italic">86.4%</div>
            <p className="text-neutral-400 text-sm max-w-xs mx-auto mb-8 font-light italic">Your current trend suggests a <span className="text-white font-bold underline decoration-[#b5a45d] underline-offset-4">Grade 9</span> outcome for the end-of-year boards.</p>
            <div className="flex space-x-3">
              <div className="px-4 py-2 bg-white/5 rounded-full text-[10px] font-bold border border-white/10 flex items-center"><Trophy size={14} className="mr-2 text-[#b5a45d]" /> Top 1%</div>
              <div className="px-4 py-2 bg-white/5 rounded-full text-[10px] font-bold border border-white/10 flex items-center"><History size={14} className="mr-2 text-[#b5a45d]" /> 1.2k Reps</div>
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-1 gap-10">
        <div className="space-y-6">
          <h3 className="text-xl font-medium flex items-center space-x-2 text-neutral-900">
            <Timer size={20} className="text-[#b5a45d]" />
            <span>Efficiency Breakdown</span>
          </h3>
          <div className="space-y-6 bg-neutral-50 p-8 rounded-3xl border border-neutral-100">
            {[{ label: 'Algebraic Structures', time: '1m 20s', val: 35, trend: '-12s' }, { label: 'Integral Calculus', time: '4m 05s', val: 95, trend: '+30s' }, { label: 'Trigonometric Identities', time: '2m 15s', val: 60, trend: '-5s' }, { label: 'Vector Spaces', time: '1m 50s', val: 50, trend: '-18s' }].map((item) => (
              <div key={item.label} className="space-y-2">
                <div className="flex justify-between text-xs font-semibold uppercase tracking-widest text-neutral-400">
                  <span>{item.label}</span>
                  <span className="text-neutral-800 font-mono italic">{item.time}</span>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex-1 h-2 bg-neutral-200 rounded-full overflow-hidden">
                    <div className="h-full bg-[#b5a45d]" style={{ width: `${item.val}%` }} />
                  </div>
                  <span className={`text-[10px] font-bold ${item.trend.startsWith('-') ? 'text-green-600' : 'text-amber-500'}`}>{item.trend}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedTopic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={onCloseTopic} />
          <div className="relative w-full max-w-xl rounded-3xl bg-white p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-neutral-900">{selectedTopic} syllabus</h3>
              <button
                type="button"
                onClick={onCloseTopic}
                className="px-3 py-1.5 rounded-full border border-neutral-200 text-xs font-semibold text-neutral-600"
              >
                Close
              </button>
            </div>
            <div className="rounded-2xl border border-neutral-100 bg-neutral-50/80 p-5 text-sm text-neutral-600 space-y-4">
              <p>
                The redesigned syllabus experience is available in the dedicated Syllabus section.
              </p>
              <button
                type="button"
                onClick={onOpenSyllabus}
                className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest border border-neutral-200 text-neutral-700 hover:bg-neutral-100"
              >
                Open redesigned syllabus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function BrowseView({
  setViewMode,
  availablePapers,
  loadingQuestions,
  onSelectSubject,
  startPaperAttempt,
}: {
  setViewMode: SetViewMode;
  availablePapers: PaperSummary[];
  loadingQuestions: boolean;
  onSelectSubject: (subjectValue: string) => Promise<void>;
  startPaperAttempt: (paper: PaperSummary) => void;
}) {
  const [selectedSubject, setSelectedSubject] = useState<{ label: string; value: string } | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);

  const gradeOptions = useMemo(() => {
    if (!selectedSubject) return [] as readonly string[];
    if (selectedSubject.label === 'Maths 7-10') {
      return BROWSE_GRADES_JUNIOR;
    }
    return BROWSE_GRADES_SENIOR;
  }, [selectedSubject]);

  const filteredPapers = useMemo(() => {
    if (!selectedSubject || !selectedGrade || !selectedYear) return [];
    return availablePapers.filter(
      (p) =>
        String(p.subject) === selectedSubject.value &&
        String(p.grade) === selectedGrade &&
        String(p.year) === selectedYear
    );
  }, [availablePapers, selectedSubject, selectedGrade, selectedYear]);

  const subjectExamCounts = useMemo(() => {
    const counts = new Map<string, number>();
    availablePapers.forEach((paper) => {
      const subject = String(paper.subject || '');
      counts.set(subject, (counts.get(subject) || 0) + 1);
    });
    return counts;
  }, [availablePapers]);

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-neutral-100 pb-8">
        <div>
          <h1 className="text-3xl font-light mb-2 text-neutral-900">Browse <span className="font-bold italic">Bank</span></h1>
          <p className="text-neutral-500">Choose a subject, then grade and year to see available exams.</p>
        </div>
      </div>

      {!selectedSubject ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {BROWSE_SUBJECTS.map((sub) => (
            (() => {
              const count = subjectExamCounts.get(sub.value) || 0;
              return (
                <button
                  key={sub.value}
                  type="button"
                  onClick={async () => {
                    setSelectedSubject(sub);
                    setSelectedGrade(null);
                    setSelectedYear(null);
                    await onSelectSubject(sub.value);
                  }}
                  className="glass-card p-10 rounded-[2.5rem] group cursor-pointer border-neutral-50 text-left"
                >
                  <div className="w-16 h-16 bg-neutral-50 rounded-3xl mb-8 group-hover:bg-[#b5a45d]/10 group-hover:scale-110 transition-all duration-500 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full border-2 border-neutral-200 border-t-[#b5a45d] group-hover:rotate-180 transition-transform duration-700" />
                  </div>
                  <h3 className="font-bold text-xl mb-1 text-neutral-900">{sub.label}</h3>
                  <p className="text-xs text-neutral-400 font-bold uppercase tracking-widest">Available exams</p>
                  <p className="text-2xl font-bold text-neutral-900 mt-1">{count}</p>
                  <div className="mt-6 flex items-center text-[#b5a45d] opacity-0 group-hover:opacity-100 transition-all">
                    <span className="text-[10px] font-bold uppercase tracking-widest mr-2">Select</span>
                    <ArrowRight size={14} />
                  </div>
                </button>
              );
            })()
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          <div className="flex items-center gap-4 flex-wrap">
            <button
              type="button"
              onClick={() => { setSelectedSubject(null); setSelectedGrade(null); setSelectedYear(null); }}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-neutral-200 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
            >
              <ArrowLeft size={16} />
              Back to subjects
            </button>
            <span className="text-neutral-400">|</span>
            <span className="font-semibold text-neutral-800">{selectedSubject.label}</span>
          </div>

          {loadingQuestions && (
            <div className="rounded-2xl border border-neutral-100 bg-neutral-50/60 p-4 flex items-center gap-3">
              <RefreshCw className="w-4 h-4 animate-spin text-neutral-500" />
              <p className="text-sm text-neutral-600">Loading exams for {selectedSubject.label}…</p>
            </div>
          )}

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-3">Grade</p>
            <div className="flex flex-wrap gap-2">
              {gradeOptions.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setSelectedGrade(g)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${selectedGrade === g ? 'bg-[#b5a45d] text-white' : 'bg-neutral-50 border border-neutral-100 text-neutral-600 hover:border-[#b5a45d]/50'}`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-3">Year</p>
            <div className="flex flex-wrap gap-2">
              {BROWSE_YEARS.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => setSelectedYear(y)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${selectedYear === y ? 'bg-[#b5a45d] text-white' : 'bg-neutral-50 border border-neutral-100 text-neutral-600 hover:border-[#b5a45d]/50'}`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          {selectedGrade && selectedYear && (
            <div className="pt-4 border-t border-neutral-100">
              {loadingQuestions ? (
                <div className="flex items-center justify-center min-h-[120px]">
                  <RefreshCw className="w-8 h-8 animate-spin text-neutral-400" />
                </div>
              ) : filteredPapers.length === 0 ? (
                <div className="rounded-2xl border border-neutral-100 bg-neutral-50/50 p-8 text-center">
                  <p className="text-neutral-600 font-medium">No exams for this subject, grade and year yet.</p>
                  <p className="text-sm text-neutral-500 mt-1">Create a custom exam from Exam Architect.</p>
                  <button
                    type="button"
                    onClick={() => setViewMode('builder')}
                    className="mt-4 px-6 py-3 bg-neutral-900 text-white rounded-xl text-sm font-semibold hover:bg-neutral-800"
                  >
                    Create custom exam
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-neutral-600">Available exams</p>
                    <button
                      type="button"
                      onClick={() => setViewMode('builder')}
                      className="text-xs font-bold text-[#b5a45d] hover:underline uppercase tracking-widest"
                    >
                      Create custom exam
                    </button>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredPapers.map((paper) => (
                      <button
                        key={`${paper.year}-${paper.grade}-${paper.subject}-${paper.school}`}
                        type="button"
                        onClick={() => startPaperAttempt(paper)}
                        className="text-left border rounded-2xl p-6 transition-all hover:-translate-y-0.5 hover:shadow-lg cursor-pointer bg-white border-neutral-100 hover:border-[#b5a45d]/30"
                      >
                        <div className="text-xs font-bold uppercase tracking-widest text-neutral-400">{paper.year}</div>
                        <div className="text-xl font-semibold mt-2 text-neutral-900">{paper.subject}</div>
                        <div className="text-sm mt-1 text-neutral-500">{paper.grade}</div>
                        <div className="text-xs mt-2 text-neutral-400">{paper.school || 'HSC'}</div>
                        <div className="text-xs mt-4 text-neutral-400">{paper.count} question{paper.count === 1 ? '' : 's'}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ExamBuilderView({
  onInitializeExam,
  isInitializing,
  initialSubject,
  initialGrade,
}: {
  onInitializeExam: (params: ExamBuilderParams) => Promise<{ ok: boolean; message?: string }>;
  isInitializing: boolean;
  initialSubject?: string | null;
  initialGrade?: 'Year 7' | 'Year 8' | 'Year 9' | 'Year 10' | 'Year 11' | 'Year 12' | null;
}) {
  const [subject, setSubject] = useState<string>(initialSubject ?? 'Mathematics Advanced');
  const [grade, setGrade] = useState<'Year 7' | 'Year 8' | 'Year 9' | 'Year 10' | 'Year 11' | 'Year 12'>(
    (initialGrade as any) ?? 'Year 12'
  );
  const [intensity, setIntensity] = useState<number>(25);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [includeWritten, setIncludeWritten] = useState(true);
  const [includeMultipleChoice, setIncludeMultipleChoice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mindmapOpen, setMindmapOpen] = useState(false);
  const [mindmapSelection, setMindmapSelection] = useState<MindmapSelection>({ subtopics: [], dotPoints: [] });

  const subjectsForGrade = useMemo(() => SUBJECTS_BY_YEAR[grade] || [], [grade]);
  const topicsForSelection = useMemo(() => {
    return getTopics(grade, subject);
  }, [grade, subject]);

  useEffect(() => {
    if (!subjectsForGrade.includes(subject)) {
      const next = subjectsForGrade[0] || 'Mathematics Advanced';
      setSubject(next);
    }
  }, [subjectsForGrade, subject]);

  const allTopicsActive = selectedTopics.length === 0;
  const toggleTopic = (value: string) => {
    setSelectedTopics((prev) => (prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]));
  };

  useEffect(() => {
    setSelectedTopics((prev) => prev.filter((t) => topicsForSelection.includes(t)));
  }, [topicsForSelection]);

  const handleInitialize = async () => {
    setError(null);
    if (!includeWritten && !includeMultipleChoice) {
      setError('Select at least one question type: Written or Multiple choice.');
      return;
    }

    const result = await onInitializeExam({
      subject,
      grade,
      intensity,
      topics: selectedTopics,
      includeWritten,
      includeMultipleChoice,
      allQuestionsFromTopic: false,
      cognitive: false,
      subtopics: mindmapSelection.subtopics,
      dotPoints: mindmapSelection.dotPoints,
    });
    if (!result.ok) {
      setError(result.message || 'Unable to create exam.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div className="text-center space-y-3">
        <h1 className="text-5xl font-light text-neutral-900">Exam <span className="font-bold italic">Architect</span></h1>
        <p className="text-neutral-500 text-lg">Select your parameters to initiate an adaptive assessment.</p>
      </div>
      <div className="glass-card rounded-[3rem] p-12 space-y-12 relative overflow-hidden transition-all duration-500">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="space-y-4">
            <label className="text-[10px] font-bold tracking-[0.2em] uppercase text-neutral-400 flex items-center">
              <BookOpen size={14} className="mr-2" /> Knowledge Area
            </label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full p-5 bg-neutral-50 border border-neutral-100 rounded-2xl focus:outline-none focus:ring-1 focus:ring-[#b5a45d] appearance-none font-medium text-neutral-800"
            >
              {subjectsForGrade.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="space-y-4">
            <label className="text-[10px] font-bold tracking-[0.2em] uppercase text-neutral-400 flex items-center">
              <GraduationCap size={14} className="mr-2" /> Curriculum Level
            </label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value as typeof grade)}
              className="w-full p-5 bg-neutral-50 border border-neutral-100 rounded-2xl focus:outline-none focus:ring-1 focus:ring-[#b5a45d] appearance-none font-medium text-neutral-800"
            >
              {Object.keys(SUBJECTS_BY_YEAR).map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold tracking-[0.2em] uppercase text-neutral-400">Question count</label>
              <span className="text-sm font-bold text-[#b5a45d]">{intensity}</span>
            </div>
            <input
              type="range"
              min={10}
              max={50}
              step={5}
              value={intensity}
              onChange={(e) => setIntensity(Number(e.target.value))}
              className="w-full accent-[#b5a45d] h-1.5 bg-neutral-100 rounded-lg appearance-none cursor-pointer"
            />
            <p className="text-[11px] text-neutral-400">Set how many questions to include (maximum 50).</p>

            <div className="pt-3 space-y-3">
              <label className="text-[10px] font-bold tracking-[0.2em] uppercase text-neutral-400">Question types</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={includeWritten}
                  onClick={() => setIncludeWritten((prev) => !prev)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${includeWritten ? 'bg-[#b5a45d] text-white' : 'bg-neutral-50 border border-neutral-100 text-neutral-600'}`}
                >
                  Written
                </button>
                <button
                  type="button"
                  aria-pressed={includeMultipleChoice}
                  onClick={() => setIncludeMultipleChoice((prev) => !prev)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${includeMultipleChoice ? 'bg-[#b5a45d] text-white' : 'bg-neutral-50 border border-neutral-100 text-neutral-600'}`}
                >
                  Multiple choice
                </button>
              </div>
              <p className="text-[11px] text-neutral-400">When enabled, multiple-choice questions appear at the start of the exam.</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold tracking-[0.2em] uppercase text-neutral-400">Topic Focus</label>
              <button
                type="button"
                onClick={() => setMindmapOpen(true)}
                aria-label="Browse syllabus mindmap to restrict questions by subtopic or dot point"
                title="Browse syllabus and restrict by subtopic / dot point"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all hover:bg-neutral-100 border border-neutral-200 text-neutral-500 hover:text-neutral-800"
              >
                <MapIcon size={12} />
                <span>Syllabus</span>
                {(mindmapSelection.subtopics.length > 0 || mindmapSelection.dotPoints.length > 0) && (
                  <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#b5a45d] text-white text-[9px] font-bold">
                    {mindmapSelection.subtopics.length + mindmapSelection.dotPoints.length}
                  </span>
                )}
              </button>
            </div>
            {(mindmapSelection.subtopics.length > 0 || mindmapSelection.dotPoints.length > 0) && (
              <div className="flex flex-wrap gap-2 items-center">
                {mindmapSelection.subtopics.map((s) => (
                  <span key={`sub-${s}`} className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#b5a45d]/10 border border-[#b5a45d]/30 text-[11px] font-semibold text-[#8a7a3a]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#b5a45d] shrink-0" />
                    {s}
                  </span>
                ))}
                {mindmapSelection.dotPoints.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-neutral-100 border border-neutral-200 text-[11px] font-semibold text-neutral-500">
                    <Plus size={10} />
                    {mindmapSelection.dotPoints.length} dot {mindmapSelection.dotPoints.length === 1 ? 'point' : 'points'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setMindmapSelection({ subtopics: [], dotPoints: [] })}
                  className="text-[10px] font-bold text-neutral-400 hover:text-neutral-600 uppercase tracking-wider transition-colors"
                >
                  Clear
                </button>
              </div>
            )}
            {mindmapSelection.subtopics.length > 0 || mindmapSelection.dotPoints.length > 0 ? (
              <div className="rounded-xl border border-[#b5a45d]/25 bg-[#b5a45d]/5 px-4 py-3 text-xs font-medium text-[#8a7a3a]">
                Topic buttons are hidden while syllabus restrictions are active.
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTopics([]);
                  }}
                  className={`w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all ${allTopicsActive ? 'bg-neutral-900 text-white' : 'bg-neutral-50 border border-neutral-100 text-neutral-500'}`}
                >
                  All topics
                </button>
                {topicsForSelection.length === 0 ? (
                  <div className="text-xs text-neutral-400">No topics available for this subject yet.</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {topicsForSelection.map((t) => {
                      const active = selectedTopics.includes(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => toggleTopic(t)}
                          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${active ? 'bg-[#b5a45d] text-white' : 'bg-neutral-50 border border-neutral-100 text-neutral-600'}`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        {error && (
          <div className="p-4 rounded-2xl border" style={{ backgroundColor: 'var(--clr-danger-a0)', borderColor: 'var(--clr-danger-a20)', color: 'var(--clr-light-a0)' }}>
            {error}
          </div>
        )}
        <div className="pt-8 text-center">
          <button
            type="button"
            onClick={handleInitialize}
            disabled={isInitializing}
            className="w-full py-6 bg-neutral-900 text-white rounded-[1.5rem] font-bold tracking-[0.3em] uppercase hover:bg-neutral-800 transition-all flex items-center justify-center space-x-4 shadow-2xl shadow-neutral-900/20 group disabled:opacity-70"
          >
            <SlidersHorizontal size={20} className="group-hover:rotate-180 transition-transform duration-700" />
            <span>{isInitializing ? 'Building Exam...' : 'Initialize Examination'}</span>
          </button>
          <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-[0.3em] mt-8">Adaptive Logic V4.2 Engaged</p>
        </div>
      </div>
      <SyllabusMindmapModal
        open={mindmapOpen}
        onClose={() => setMindmapOpen(false)}
        initialGrade={grade}
        initialSubject={subject}
        initialSelection={mindmapSelection}
        onConfirm={(sel) => setMindmapSelection(sel)}
      />
    </div>
  );
}

const FORMULA_ITEMS = [
  { title: 'Quadratic Formula', formula: 'x = (-b ± √(b² - 4ac)) / 2a', subject: 'Math', usage: '124' },
  { title: "De Moivre's Theorem", formula: '(r(cos θ + i sin θ))ⁿ = rⁿ(cos nθ + i sin nθ)', subject: 'Math', usage: '42' },
  { title: 'Schrodinger Equation', formula: 'iℏ ∂Ψ/∂t = ĤΨ', subject: 'Physics', usage: '18' },
  { title: 'Standard Deviation', formula: 'σ = √(Σ(xᵢ - μ)² / N)', subject: 'Math', usage: '85' },
  { title: 'Ideal Gas Law', formula: 'PV = nRT', subject: 'Physics', usage: '210' },
  { title: 'Chain Rule', formula: 'dy/dx = (dy/du)(du/dx)', subject: 'Math', usage: '312' },
];

export function FormulaVaultView({ setViewMode }: { setViewMode: SetViewMode }) {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-neutral-100 pb-8">
        <div>
          <h1 className="text-4xl font-light mb-2 text-neutral-900">Formula <span className="font-bold">Vault</span></h1>
          <p className="text-neutral-500">Active reference library for your complex subjects.</p>
        </div>
        <div className="flex space-x-2">
          {['Math', 'Physics', 'Chemistry'].map((cat) => (
            <button key={cat} type="button" className="px-6 py-2 bg-neutral-50 border border-neutral-100 rounded-full text-[10px] font-bold uppercase tracking-widest text-neutral-500 hover:text-[#b5a45d] transition-all">{cat}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {FORMULA_ITEMS.map((f) => (
          <div key={f.title} className="glass-card p-8 rounded-3xl flex flex-col items-center text-center group cursor-pointer border-neutral-100">
            <div className="flex justify-between w-full mb-6">
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#b5a45d] px-2 py-0.5 bg-[#b5a45d]/5 rounded">{f.subject}</span>
              <span className="text-[9px] font-bold text-neutral-300 uppercase tracking-widest flex items-center"><Zap size={10} className="mr-1" /> {f.usage} Uses</span>
            </div>
            <h3 className="font-semibold text-lg mb-6 group-hover:text-[#b5a45d] transition-colors text-neutral-900">{f.title}</h3>
            <div className="p-6 bg-neutral-50 rounded-2xl w-full border border-neutral-100 group-hover:bg-white group-hover:shadow-inner transition-all overflow-x-auto">
              <code className="text-base font-mono text-neutral-800 whitespace-nowrap">{f.formula}</code>
            </div>
            <button type="button" onClick={() => setViewMode('browse')} className="mt-8 text-[10px] font-bold text-neutral-400 hover:text-neutral-800 transition-all flex items-center space-x-1 group-hover:underline decoration-[#b5a45d] underline-offset-4 uppercase tracking-[0.2em]">
              <span>Practice Questions</span>
              <ArrowRight size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const MOCK_HISTORY = [
  { id: 1, type: 'Exam', title: 'Calculus Fundamentals', date: '2 hours ago', score: '85%', subject: 'Math', time: '42m' },
  { id: 2, type: 'Quiz', title: 'Organic Chemistry Intro', date: 'Yesterday', score: '92%', subject: 'Chemistry', time: '15m' },
  { id: 3, type: 'Question', title: 'Newtonian Laws P3', date: 'Oct 24', score: 'Correct', subject: 'Physics', time: '4m' },
];

export function HistoryView() {
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-end border-b border-neutral-100 pb-8">
        <div>
          <h1 className="text-3xl font-light italic text-neutral-900">My <span className="font-bold not-italic">Timeline</span></h1>
          <p className="text-neutral-500">A historical log of your academic progression.</p>
        </div>
      </div>
      <div className="bg-white border border-neutral-100 rounded-[2rem] overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-neutral-50/50 border-b border-neutral-100">
              <th className="px-8 py-5 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Assessment</th>
              <th className="px-8 py-5 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Subject</th>
              <th className="px-8 py-5 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Time</th>
              <th className="px-8 py-5 text-[10px] font-bold text-neutral-400 uppercase tracking-widest text-right">Mastery</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {MOCK_HISTORY.map((item) => (
              <tr key={item.id} className="hover:bg-neutral-50/30 transition-colors group cursor-pointer">
                <td className="px-8 py-6">
                  <div className="flex items-center space-x-4">
                    <div className={`w-3 h-3 rounded-full ${item.type === 'Exam' ? 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.4)]' : 'bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.4)]'}`} />
                    <span className="text-sm font-semibold text-neutral-800">{item.title}</span>
                  </div>
                </td>
                <td className="px-8 py-6 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{item.subject}</td>
                <td className="px-8 py-6 text-xs font-mono italic text-neutral-500">{item.time} elapsed</td>
                <td className="px-8 py-6 text-right">
                  <span className={`text-[10px] font-bold px-4 py-1.5 rounded-full ${item.score.includes('%') ? 'bg-green-50 text-green-700' : 'bg-neutral-100 text-neutral-500'}`}>{item.score}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
