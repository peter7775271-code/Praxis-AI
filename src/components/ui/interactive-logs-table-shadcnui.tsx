"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Filter, Flag, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type QuestionType = "written" | "multiple_choice" | "unknown";
type ReviewFlag = "needs_images" | "needs_review" | null;

const IS_DEVELOPER = process.env.NEXT_PUBLIC_IS_DEVELOPER === "true";

interface QuestionLog {
  id: string;
  timestamp: string;
  questionType: QuestionType;
  subject: string;
  topic: string;
  grade: string;
  year: number;
  marks: number;
  questionNumber: string | null;
  schoolName: string | null;
  paperLabel: string | null;
  paperNumber: number;
  reviewFlag: ReviewFlag;
}

interface ExamGroup {
  key: string;
  schoolName: string | null;
  year: number;
  subject: string;
  grade: string;
  paperLabel: string | null;
  paperNumber: number;
  questions: QuestionLog[];
  reviewFlag: ReviewFlag;
}

interface DayBlock {
  date: string;
  formattedDate: string;
  exams: ExamGroup[];
  totalQuestions: number;
}

type Filters = {
  subject: string[];
  grade: string[];
};

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const FLAG_LABEL: Record<NonNullable<ReviewFlag>, string> = {
  needs_images: "Needs Images",
  needs_review: "Needs Review",
};

const FLAG_STYLE: Record<NonNullable<ReviewFlag>, string> = {
  needs_images:
    "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-300/40",
  needs_review:
    "bg-red-500/10 text-red-600 dark:text-red-400 border-red-300/40",
};

const questionTypeLabel: Record<QuestionType, string> = {
  written: "Written",
  multiple_choice: "MCQ",
  unknown: "Unknown",
};

function toDateKey(isoString: string): string {
  return isoString.slice(0, 10);
}

function formatDateKey(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function groupIntoDayBlocks(logs: QuestionLog[]): DayBlock[] {
  const dayMap = new Map<string, Map<string, ExamGroup>>();

  for (const log of logs) {
    const date = toDateKey(log.timestamp);
    if (!dayMap.has(date)) dayMap.set(date, new Map());

    const examMap = dayMap.get(date)!;
    const examKey = [
      log.schoolName ?? "__none__",
      String(log.year),
      log.subject,
      String(log.paperNumber),
    ].join("|");

    if (!examMap.has(examKey)) {
      examMap.set(examKey, {
        key: examKey,
        schoolName: log.schoolName,
        year: log.year,
        subject: log.subject,
        grade: log.grade,
        paperLabel: log.paperLabel,
        paperNumber: log.paperNumber,
        questions: [],
        reviewFlag: log.reviewFlag,
      });
    }

    const group = examMap.get(examKey)!;
    group.questions.push(log);
    // needs_review takes priority over needs_images
    if (log.reviewFlag) {
      if (
        !group.reviewFlag ||
        (log.reviewFlag === "needs_review" && group.reviewFlag === "needs_images")
      ) {
        group.reviewFlag = log.reviewFlag;
      }
    }
  }

  return Array.from(dayMap.keys())
    .sort()
    .reverse()
    .map((date) => {
      const exams = Array.from(dayMap.get(date)!.values());
      return {
        date,
        formattedDate: formatDateKey(date),
        exams,
        totalQuestions: exams.reduce((s, e) => s + e.questions.length, 0),
      };
    });
}

// ---------------------------------------------------------------------------
// ExamRow
// ---------------------------------------------------------------------------

function ExamRow({
  exam,
  onFlagChange,
}: {
  exam: ExamGroup;
  onFlagChange: (exam: ExamGroup, flag: ReviewFlag) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [flagging, setFlagging] = useState(false);

  const handleFlag = async (flag: ReviewFlag) => {
    setFlagging(true);
    try {
      await onFlagChange(exam, flag);
    } finally {
      setFlagging(false);
    }
  };

  const examMeta = [
    exam.schoolName ?? "Unknown School",
    exam.paperLabel ?? (exam.paperNumber > 1 ? `Paper ${exam.paperNumber}` : null),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Exam header row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-3 text-left bg-card hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3 flex-wrap">
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex-shrink-0"
          >
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </motion.span>

          <span className="font-medium text-sm text-foreground">
            {exam.subject}
          </span>

          {examMeta && (
            <span className="text-sm text-muted-foreground">{examMeta}</span>
          )}

          <Badge variant="outline" className="text-xs font-mono">
            {exam.year}
          </Badge>

          <Badge variant="outline" className="text-xs">
            {exam.grade}
          </Badge>

          <span className="text-xs text-muted-foreground ml-auto">
            {exam.questions.length}{" "}
            {exam.questions.length === 1 ? "question" : "questions"}
          </span>

          {exam.reviewFlag && (
            <Badge
              variant="outline"
              className={`text-xs ${FLAG_STYLE[exam.reviewFlag]}`}
            >
              <Flag className="h-3 w-3 mr-1" />
              {FLAG_LABEL[exam.reviewFlag]}
            </Badge>
          )}
        </div>
      </button>

      {/* Developer flag controls */}
      {IS_DEVELOPER && (
        <div className="px-4 py-2 bg-muted/20 border-t border-dashed border-border flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Dev · Flag:
          </span>
          {(["needs_images", "needs_review"] as NonNullable<ReviewFlag>[]).map(
            (f) => (
              <button
                key={f}
                disabled={flagging}
                onClick={() => handleFlag(exam.reviewFlag === f ? null : f)}
                className={`px-2 py-0.5 rounded border text-xs transition-colors disabled:opacity-50 ${
                  exam.reviewFlag === f
                    ? FLAG_STYLE[f] + " font-semibold"
                    : "border-border text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {FLAG_LABEL[f]}
              </button>
            )
          )}
          {exam.reviewFlag && (
            <button
              disabled={flagging}
              onClick={() => handleFlag(null)}
              className="px-2 py-0.5 rounded border border-border text-xs text-muted-foreground hover:bg-muted/50 flex items-center gap-1 disabled:opacity-50"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      )}

      {/* Expandable question list */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="exam-questions"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="divide-y divide-border border-t border-border">
              {exam.questions.map((q) => (
                <div
                  key={q.id}
                  className="px-4 py-2 flex items-center gap-3 text-sm bg-muted/10"
                >
                  <span className="font-mono text-xs text-muted-foreground w-8 flex-shrink-0">
                    {q.questionNumber ?? "—"}
                  </span>
                  <Badge variant="secondary" className="text-xs flex-shrink-0">
                    {questionTypeLabel[q.questionType]}
                  </Badge>
                  <span className="flex-1 truncate text-muted-foreground text-xs">
                    {q.topic}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground flex-shrink-0">
                    {q.marks}m
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DayBlock
// ---------------------------------------------------------------------------

function DayBlockRow({
  day,
  onFlagChange,
}: {
  day: DayBlock;
  onFlagChange: (exam: ExamGroup, flag: ReviewFlag) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-1 py-1 text-left"
      >
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </motion.span>
        <span className="text-sm font-semibold text-foreground">
          {day.formattedDate}
        </span>
        <span className="text-xs text-muted-foreground">
          {day.exams.length} {day.exams.length === 1 ? "exam" : "exams"} ·{" "}
          {day.totalQuestions} questions
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="day-exams"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden pl-6 space-y-2"
          >
            {day.exams.map((exam) => (
              <ExamRow key={exam.key} exam={exam} onFlagChange={onFlagChange} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FilterPanel
// ---------------------------------------------------------------------------

function FilterPanel({
  filters,
  onChange,
  logs,
}: {
  filters: Filters;
  onChange: (filters: Filters) => void;
  logs: QuestionLog[];
}) {
  const subjects = Array.from(new Set(logs.map((l) => l.subject))).sort();
  const grades = Array.from(new Set(logs.map((l) => l.grade))).sort();

  const toggle = (category: keyof Filters, value: string) => {
    const current = filters[category];
    onChange({
      ...filters,
      [category]: current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value],
    });
  };

  const hasActive = Object.values(filters).some((g) => g.length > 0);

  const renderGroup = (label: string, items: string[], category: keyof Filters) => (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="space-y-2">
        {items.map((item) => {
          const sel = filters[category].includes(item);
          return (
            <motion.button
              key={item}
              type="button"
              whileHover={{ x: 2 }}
              onClick={() => toggle(category, item)}
              aria-pressed={sel}
              className={`flex w-full items-center justify-between gap-2 border rounded-md px-3 py-2 text-sm transition-colors ${
                sel
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/40"
              }`}
            >
              <span>{item}</span>
              {sel && <Check className="h-3.5 w-3.5" />}
            </motion.button>
          );
        })}
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ delay: 0.05 }}
      className="flex h-full flex-col space-y-6 overflow-y-auto bg-card p-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Filters</h3>
        {hasActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange({ subject: [], grade: [] })}
            className="h-6 text-xs"
          >
            Clear
          </Button>
        )}
      </div>
      {renderGroup("Subject", subjects, "subject")}
      {renderGroup("Grade", grades, "grade")}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const LIMIT_OPTIONS = [3, 7, 25, 50, 100] as const;
type LimitOption = (typeof LIMIT_OPTIONS)[number] | "all";

/** Returns an ISO 8601 string for midnight N days ago (UTC). */
function daysAgoISO(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export function InteractiveLogsTable() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({ subject: [], grade: [] });
  const [limit, setLimit] = useState<LimitOption>(3);
  const [logs, setLogs] = useState<QuestionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async (signal?: AbortSignal, days?: number | "all") => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (days !== "all" && days !== undefined) {
        params.set("since", daysAgoISO(days));
      }
      const url = params.toString() ? `/api/hsc/all-questions?${params}` : "/api/hsc/all-questions";
      const res = await fetch(url, signal ? { signal } : undefined);
      if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);
      const data = await res.json();
      const questions: QuestionLog[] = (Array.isArray(data) ? data : [])
        .filter((q: { created_at?: string }) => Boolean(q.created_at))
        .map(
          (q: {
            id: string;
            created_at?: string;
            question_type?: string | null;
            subject?: string;
            topic?: string;
            grade?: string;
            year?: number;
            marks?: number;
            question_number?: string | null;
            school_name?: string | null;
            paper_label?: string | null;
            paper_number?: number | null;
            review_flag?: string | null;
          }) => ({
            id: String(q.id),
            timestamp: q.created_at!,
            questionType: (
              q.question_type === "written" ||
              q.question_type === "multiple_choice"
                ? q.question_type
                : "unknown"
            ) as QuestionType,
            subject: q.subject ?? "Unknown",
            topic: q.topic ?? "Unknown",
            grade: q.grade ?? "Unknown",
            year: q.year ?? 0,
            marks: q.marks ?? 0,
            questionNumber: q.question_number ?? null,
            schoolName: q.school_name ?? null,
            paperLabel: q.paper_label ?? null,
            paperNumber: q.paper_number ?? 1,
            reviewFlag: (
              q.review_flag === "needs_images" ||
              q.review_flag === "needs_review"
                ? q.review_flag
                : null
            ) as ReviewFlag,
          })
        );
      setLogs(questions);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to load logs");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch (or re-fetch) whenever the day-limit changes.
  useEffect(() => {
    const controller = new AbortController();
    fetchLogs(controller.signal, limit);
    return () => controller.abort();
  }, [fetchLogs, limit]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        log.subject.toLowerCase().includes(q) ||
        log.topic.toLowerCase().includes(q) ||
        log.grade.toLowerCase().includes(q) ||
        (log.schoolName ?? "").toLowerCase().includes(q);
      const matchSubject =
        filters.subject.length === 0 || filters.subject.includes(log.subject);
      const matchGrade =
        filters.grade.length === 0 || filters.grade.includes(log.grade);
      return matchSearch && matchSubject && matchGrade;
    });
  }, [logs, searchQuery, filters]);

  const dayBlocks = useMemo(
    () => groupIntoDayBlocks(filteredLogs),
    [filteredLogs]
  );

  const visibleDays = limit === "all" ? dayBlocks : dayBlocks.slice(0, limit);

  const activeFilters = filters.subject.length + filters.grade.length;

  const subtitle = loading
    ? "Loading…"
    : error
    ? error
    : `${dayBlocks.length} upload days · ${filteredLogs.length} questions${
        limit !== "all" && dayBlocks.length > limit
          ? ` (showing ${visibleDays.length} days)`
          : ""
      }`;

  const handleFlagChange = useCallback(
    async (exam: ExamGroup, flag: ReviewFlag) => {
      // Optimistic UI update
      setLogs((prev) =>
        prev.map((log) =>
          log.schoolName === exam.schoolName &&
          log.year === exam.year &&
          log.subject === exam.subject &&
          log.paperNumber === exam.paperNumber
            ? { ...log, reviewFlag: flag }
            : log
        )
      );

      try {
        const res = await fetch("/api/hsc/flag-exam", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schoolName: exam.schoolName,
            year: exam.year,
            subject: exam.subject,
            paperNumber: exam.paperNumber,
            flag,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { error?: string }).error ?? "Failed to update flag"
          );
        }
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to save flag");
        fetchLogs(undefined, limit);
      }
    },
    [fetchLogs, limit]
  );

  return (
    <main className="h-full w-full bg-background">
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="border-b border-border bg-card p-6">
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                Upload Logs
              </h1>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by subject, topic, grade or school…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-9 text-sm"
                />
              </div>
              <select
                value={String(limit)}
                onChange={(e) => {
                  const val = e.target.value;
                  setLimit(
                    val === "all" ? "all" : (Number(val) as LimitOption)
                  );
                }}
                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="Days to show"
              >
                {LIMIT_OPTIONS.map((n) => (
                  <option key={n} value={String(n)}>
                    {n} days
                  </option>
                ))}
                <option value="all">All days</option>
              </select>
              <Button
                variant={showFilters ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFilters((v) => !v)}
                className="relative"
              >
                <Filter className="h-4 w-4" />
                {activeFilters > 0 && (
                  <Badge className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center p-0 text-xs bg-destructive">
                    {activeFilters}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          <AnimatePresence initial={false}>
            {showFilters && (
              <motion.div
                key="filters"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 280, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden border-r border-border"
              >
                <FilterPanel
                  filters={filters}
                  onChange={setFilters}
                  logs={logs}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {loading ? (
              <p className="text-center text-muted-foreground py-12">
                Loading upload logs…
              </p>
            ) : error ? (
              <p className="text-center text-red-500 py-12">{error}</p>
            ) : visibleDays.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">
                No uploads match your filters.
              </p>
            ) : (
              visibleDays.map((day) => (
                <DayBlockRow
                  key={day.date}
                  day={day}
                  onFlagChange={handleFlagChange}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
