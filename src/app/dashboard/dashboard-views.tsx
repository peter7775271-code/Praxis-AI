import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Brain,
  GraduationCap,
  History,
  LineChart,
  Map as MapIcon,
  Plus,
  PlusCircle,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Target,
  Timer,
  Trophy,
  Zap,
} from 'lucide-react';
import SyllabusMindmapModal, { type MindmapSelection } from './SyllabusMindmapModal';
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
  HeatmapCell,
  PaperSummary,
  TopicStat,
} from './types';

type SetViewMode = (m: DashboardViewMode) => void;

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function DashboardView({
  setViewMode,
  heatmapCells,
  studyStreak,
  studentName,
  heatmapMonth,
  heatmapYear,
  onHeatmapMonthChange,
}: {
  setViewMode: SetViewMode;
  heatmapCells: HeatmapCell[];
  studyStreak: number;
  studentName: string;
  heatmapMonth: number;
  heatmapYear: number;
  onHeatmapMonthChange: (month: number) => void;
}) {
  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-6">
        <div>
          <h1 className="text-4xl font-light mb-2">
            Welcome back, <span className="font-semibold italic">{studentName || 'Student'}</span>
          </h1>
          <p className="text-neutral-500 text-lg">Your cognitive endurance is up <span className="text-[#b5a45d] font-bold">14%</span> this week. Keep going.</p>
        </div>
        <div className="flex space-x-3">
          <button type="button" onClick={() => setViewMode('analytics')} className="bg-white border border-neutral-200 px-6 py-3 rounded-full flex items-center space-x-2 hover:bg-neutral-50 transition-all text-sm font-medium text-neutral-800">
            <LineChart size={18} />
            <span>Analytics</span>
          </button>
          <button type="button" onClick={() => setViewMode('builder')} className="bg-neutral-900 text-white px-6 py-3 rounded-full flex items-center space-x-2 hover:bg-neutral-800 transition-all shadow-lg text-sm font-medium">
            <PlusCircle size={18} />
            <span>Build Exam</span>
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-card p-6 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3"><Target size={30} className="text-[#b5a45d] opacity-20" /></div>
          <p className="text-neutral-400 text-[10px] font-bold uppercase tracking-widest mb-1">Expected Grade</p>
          <h3 className="text-3xl font-bold text-[#b5a45d]">A+ <span className="text-xs font-normal text-neutral-400">(84%)</span></h3>
          <div className="mt-3 w-full h-1 bg-neutral-100 rounded-full overflow-hidden">
            <div className="bg-[#b5a45d] h-full w-[84%]" />
          </div>
        </div>
        <div className="glass-card p-6 rounded-2xl">
          <p className="text-neutral-400 text-[10px] font-bold uppercase tracking-widest mb-1">Response Speed</p>
          <h3 className="text-3xl font-bold italic">2.4m <span className="text-sm font-normal text-neutral-400 tracking-tighter italic">/ avg</span></h3>
          <p className="text-[10px] text-green-600 mt-2 font-bold flex items-center"><Sparkles size={10} className="mr-1" /> Optimal for Calculus</p>
        </div>
        <div className="glass-card p-6 rounded-2xl">
          <p className="text-neutral-400 text-[10px] font-bold uppercase tracking-widest mb-1">Study Streak</p>
          <h3 className="text-3xl font-bold">
            {studyStreak}{' '}
            <span className="text-sm font-normal text-neutral-400 tracking-tighter italic">
              {studyStreak === 1 ? 'day' : 'days'}
            </span>
          </h3>
          <p className="text-[10px] text-neutral-400 mt-2 font-medium">
            {studyStreak > 0 ? 'Keep the streak alive.' : 'Complete a question to start a streak.'}
          </p>
        </div>
        <div className="glass-card p-6 rounded-2xl bg-neutral-900 text-white border-none shadow-xl">
          <p className="text-[#b5a45d] text-[10px] font-bold uppercase tracking-widest mb-1">Formula Mastery</p>
          <h3 className="text-3xl font-bold">18/24</h3>
          <p className="text-[10px] text-neutral-500 mt-2">Active in vault</p>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-neutral-900">Cognitive Heatmap</h2>
              <p className="text-xs text-neutral-400">{MONTH_LABELS[heatmapMonth]} {heatmapYear}</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={heatmapMonth}
                onChange={(e) => onHeatmapMonthChange(parseInt(e.target.value, 10))}
                className="text-xs font-semibold border border-neutral-200 rounded-full px-3 py-1.5 bg-white"
              >
                {MONTH_LABELS.map((label, idx) => (
                  <option key={label} value={idx}>{label}</option>
                ))}
              </select>
              <button type="button" onClick={() => setViewMode('analytics')} className="text-xs text-[#b5a45d] font-bold tracking-widest">EXPLORE HUB</button>
            </div>
          </div>
          <div className="p-8 bg-neutral-50 border border-neutral-100 rounded-3xl grid grid-cols-7 gap-3">
            {heatmapCells.map((day) => {
              const intensity =
                day.count >= 6 ? 'bg-[#b5a45d]' :
                  day.count >= 3 ? 'bg-[#b5a45d]/70' :
                    day.count > 0 ? 'bg-[#b5a45d]/40' :
                      day.inMonth ? 'bg-white border border-neutral-100' : 'bg-transparent border-transparent';
              const title = day.inMonth
                ? (day.count > 0
                  ? `${day.label}: ${day.count} question${day.count === 1 ? '' : 's'}`
                  : `${day.label}: no questions`)
                : '';
              return (
                <div
                  key={day.dateKey}
                  className={`aspect-square rounded border border-neutral-100 transition-all cursor-help ${intensity}`}
                  title={title}
                />
              );
            })}
          </div>
        </div>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-neutral-900">Pressure Simulation</h2>
          <div className="glass-card rounded-2xl p-6 bg-amber-50/20 border-amber-200/40">
            <div className="flex items-center space-x-3 mb-4">
              <Timer className="text-amber-600" size={20} />
              <h3 className="font-bold text-amber-900">Next Simulation</h3>
            </div>
            <p className="text-xs text-amber-800/60 mb-6 leading-relaxed">Your scheduled mock exam for <span className="font-bold text-amber-900">Physics P2</span> starts in 14 hours. Review your formulas first.</p>
            <button type="button" onClick={() => setViewMode('builder')} className="w-full py-3 bg-amber-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-amber-700 transition-all shadow-lg shadow-amber-600/20">Enter Simulator</button>
          </div>
        </div>
      </div>
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
  const [isSimMode, setIsSimMode] = useState(false);
  const [subject, setSubject] = useState<string>(initialSubject ?? 'Mathematics Advanced');
  const [grade, setGrade] = useState<'Year 7' | 'Year 8' | 'Year 9' | 'Year 10' | 'Year 11' | 'Year 12'>(
    (initialGrade as any) ?? 'Year 12'
  );
  const [intensity, setIntensity] = useState<number>(35);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [allQuestionsFromTopic, setAllQuestionsFromTopic] = useState(false);
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

  useEffect(() => {
    const hasSyllabusRestrictions = mindmapSelection.subtopics.length > 0 || mindmapSelection.dotPoints.length > 0;
    const hasSingleTopic = selectedTopics.length === 1;
    if (hasSyllabusRestrictions || !hasSingleTopic) {
      setAllQuestionsFromTopic(false);
    }
  }, [mindmapSelection.dotPoints.length, mindmapSelection.subtopics.length, selectedTopics.length]);

  const handleInitialize = async () => {
    setError(null);
    const result = await onInitializeExam({
      subject,
      grade,
      intensity,
      topics: selectedTopics,
      allQuestionsFromTopic,
      cognitive: isSimMode,
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
      <div className={`glass-card rounded-[3rem] p-12 space-y-12 relative overflow-hidden transition-all duration-500 ${isSimMode ? 'border-amber-400/50 bg-amber-50/10' : ''}`}>
        {isSimMode && <div className="absolute top-0 left-0 w-full h-1 bg-amber-400 animate-pulse" />}
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
              <span className="text-sm font-bold text-[#b5a45d]">{allQuestionsFromTopic ? 'ALL' : intensity}</span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={intensity}
              onChange={(e) => setIntensity(Number(e.target.value))}
              disabled={allQuestionsFromTopic}
              className="w-full accent-[#b5a45d] h-1.5 bg-neutral-100 rounded-lg appearance-none cursor-pointer"
            />
            <p className="text-[11px] text-neutral-400">
              {allQuestionsFromTopic ? 'Using every available question from the selected topic.' : 'Set how many questions to include.'}
            </p>
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
                    setAllQuestionsFromTopic(false);
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
                <button
                  type="button"
                  onClick={() => setAllQuestionsFromTopic((prev) => !prev)}
                  disabled={selectedTopics.length !== 1}
                  className={`w-full px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                    allQuestionsFromTopic
                      ? 'bg-[#b5a45d] text-white'
                      : 'bg-neutral-50 border border-neutral-100 text-neutral-600'
                  } ${selectedTopics.length !== 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={selectedTopics.length === 1 ? 'Generate all questions from this topic' : 'Select exactly one topic to enable'}
                >
                  {allQuestionsFromTopic ? 'All Questions From Selected Topic: ON' : 'All Questions From Selected Topic'}
                </button>
                {selectedTopics.length !== 1 && (
                  <p className="text-[11px] text-neutral-400">Select exactly one topic to enable this mode.</p>
                )}
              </div>
            )}
          </div>
          <div className="space-y-4">
            <label className="text-[10px] font-bold tracking-[0.2em] uppercase text-neutral-400">Cognitive Environment</label>
            <button type="button" onClick={() => setIsSimMode(!isSimMode)} className={`w-full flex items-center justify-between p-5 rounded-2xl border cursor-pointer transition-all text-left ${isSimMode ? 'bg-neutral-900 border-neutral-900 text-white shadow-2xl' : 'bg-neutral-50 border-neutral-100 text-neutral-400'}`}>
              <div className="flex items-center space-x-3">
                <Timer size={18} className={isSimMode ? 'text-[#b5a45d]' : ''} />
                <span className="text-sm font-bold uppercase tracking-widest">Pressure Chamber</span>
              </div>
              <div className={`w-10 h-5 rounded-full relative transition-colors ${isSimMode ? 'bg-[#b5a45d]' : 'bg-neutral-200'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${isSimMode ? 'left-6' : 'left-0.5'}`} />
              </div>
            </button>
          </div>
        </div>
        {isSimMode && (
          <div className="p-6 bg-amber-50 rounded-2xl border border-amber-200/50 flex items-start space-x-4">
            <div className="p-2 bg-white rounded-xl text-amber-600"><Zap size={20} /></div>
            <div>
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-widest mb-1">Simulator Active</h4>
              <p className="text-xs text-amber-800/70">Calculators disabled (unless required), strictly timed intervals, and 10-second penalty for window refocusing.</p>
            </div>
          </div>
        )}
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
