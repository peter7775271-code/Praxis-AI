"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Filter, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type QuestionType = "written" | "multiple_choice" | "unknown";

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
}

type Filters = {
  questionType: string[];
  subject: string[];
  grade: string[];
};

const questionTypeStyles: Record<QuestionType, string> = {
  written: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  multiple_choice: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  unknown: "bg-neutral-500/10 text-neutral-600 dark:text-neutral-400",
};

const questionTypeLabel: Record<QuestionType, string> = {
  written: "Written",
  multiple_choice: "MCQ",
  unknown: "Unknown",
};

function QuestionLogRow({
  log,
  expanded,
  onToggle,
}: {
  log: QuestionLog;
  expanded: boolean;
  onToggle: () => void;
}) {
  const formattedDate = new Date(log.timestamp).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const formattedTime = new Date(log.timestamp).toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <>
      <motion.button
        onClick={onToggle}
        className="w-full p-4 text-left transition-colors hover:bg-muted/50 active:bg-muted/70"
        whileHover={{ backgroundColor: "rgba(0,0,0,0.02)" }}
      >
        <div className="flex items-center gap-4">
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex-shrink-0"
          >
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </motion.div>

          <Badge
            variant="secondary"
            className={`flex-shrink-0 ${questionTypeStyles[log.questionType]}`}
          >
            {questionTypeLabel[log.questionType]}
          </Badge>

          <time className="w-24 flex-shrink-0 font-mono text-xs text-muted-foreground">
            {formattedDate}
          </time>

          <span className="flex-shrink-0 min-w-max text-sm font-medium text-foreground">
            {log.subject}
          </span>

          <p className="flex-1 truncate text-sm text-muted-foreground">
            {log.topic}
          </p>

          <span className="flex-shrink-0 font-mono text-sm font-semibold text-muted-foreground">
            {log.grade}
          </span>

          <span className="w-16 flex-shrink-0 text-right font-mono text-xs text-muted-foreground">
            {log.marks}m
          </span>
        </div>
      </motion.button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border bg-muted/50"
          >
            <div className="space-y-4 p-4">
              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Subject
                  </p>
                  <p className="font-mono text-foreground">{log.subject}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Topic
                  </p>
                  <p className="font-mono text-foreground">{log.topic}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Grade
                  </p>
                  <p className="font-mono text-foreground">{log.grade}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Year
                  </p>
                  <p className="font-mono text-foreground">{log.year}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Marks
                  </p>
                  <p className="font-mono text-foreground">{log.marks}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Question #
                  </p>
                  <p className="font-mono text-foreground">
                    {log.questionNumber ?? "—"}
                  </p>
                </div>
                {log.schoolName && (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      School
                    </p>
                    <p className="font-mono text-foreground">{log.schoolName}</p>
                  </div>
                )}
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Uploaded
                  </p>
                  <p className="font-mono text-xs text-foreground">
                    {formattedDate} {formattedTime}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Tags
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-xs">
                    {log.questionType === "multiple_choice" ? "MCQ" : "Written"}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {log.subject}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {log.grade}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {log.year}
                  </Badge>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function FilterPanel({
  filters,
  onChange,
  logs,
}: {
  filters: Filters;
  onChange: (filters: Filters) => void;
  logs: QuestionLog[];
}) {
  const questionTypes = Array.from(new Set(logs.map((log) => log.questionType)));
  const subjects = Array.from(new Set(logs.map((log) => log.subject))).sort();
  const grades = Array.from(new Set(logs.map((log) => log.grade))).sort();

  const toggleFilter = (category: keyof Filters, value: string) => {
    const current = filters[category];
    const updated = current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [...current, value];

    onChange({
      ...filters,
      [category]: updated,
    });
  };

  const clearAll = () => {
    onChange({ questionType: [], subject: [], grade: [] });
  };

  const hasActiveFilters = Object.values(filters).some(
    (group) => group.length > 0
  );

  const renderFilterGroup = (
    label: string,
    items: string[],
    category: keyof Filters,
    displayLabel?: (val: string) => string
  ) => {
    const selectedClass = "border-primary bg-primary/10 text-primary";
    const unselectedClass =
      "border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/40";

    return (
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <div className="space-y-2">
          {items.map((item) => {
            const selected = filters[category].includes(item);
            return (
              <motion.button
                key={item}
                type="button"
                whileHover={{ x: 2 }}
                onClick={() => toggleFilter(category, item)}
                aria-pressed={selected}
                className={`flex w-full items-center justify-between gap-2 border rounded-md px-3 py-2 text-sm transition-colors ${
                  selected ? selectedClass : unselectedClass
                }`}
              >
                <span>{displayLabel ? displayLabel(item) : item}</span>
                {selected && <Check className="h-3.5 w-3.5" />}
              </motion.button>
            );
          })}
        </div>
      </div>
    );
  };

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
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="h-6 text-xs"
          >
            Clear
          </Button>
        )}
      </div>

      {renderFilterGroup("Type", questionTypes, "questionType", (val) =>
        questionTypeLabel[val as QuestionType] ?? val
      )}
      {renderFilterGroup("Subject", subjects, "subject")}
      {renderFilterGroup("Grade", grades, "grade")}
    </motion.div>
  );
}

const LIMIT_OPTIONS = [50, 100, 250, 500] as const;
type LimitOption = (typeof LIMIT_OPTIONS)[number] | "all";

export function InteractiveLogsTable() {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    questionType: [],
    subject: [],
    grade: [],
  });
  const [limit, setLimit] = useState<LimitOption>(100);
  const [logs, setLogs] = useState<QuestionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/hsc/all-questions");
        if (!response.ok) {
          throw new Error(`Failed to fetch questions: ${response.statusText}`);
        }
        const data = await response.json();
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
          }) => ({
            id: String(q.id),
            timestamp: q.created_at!,
            questionType: (q.question_type === "written" || q.question_type === "multiple_choice"
              ? q.question_type
              : "unknown") as QuestionType,
            subject: q.subject ?? "Unknown",
            topic: q.topic ?? "Unknown",
            grade: q.grade ?? "Unknown",
            year: q.year ?? 0,
            marks: q.marks ?? 0,
            questionNumber: q.question_number ?? null,
            schoolName: q.school_name ?? null,
          })
        );
        setLogs(questions);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load logs");
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const lowerQuery = searchQuery.toLowerCase();

      const matchSearch =
        log.subject.toLowerCase().includes(lowerQuery) ||
        log.topic.toLowerCase().includes(lowerQuery) ||
        log.grade.toLowerCase().includes(lowerQuery) ||
        (log.schoolName ?? "").toLowerCase().includes(lowerQuery);

      const matchType =
        filters.questionType.length === 0 ||
        filters.questionType.includes(log.questionType);
      const matchSubject =
        filters.subject.length === 0 || filters.subject.includes(log.subject);
      const matchGrade =
        filters.grade.length === 0 || filters.grade.includes(log.grade);

      return matchSearch && matchType && matchSubject && matchGrade;
    });
  }, [filters, searchQuery, logs]);

  const activeFilters =
    filters.questionType.length +
    filters.subject.length +
    filters.grade.length;

  const visibleLogs =
    limit === "all" ? filteredLogs : filteredLogs.slice(0, limit);

  const subtitle = loading
    ? "Loading…"
    : error
    ? error
    : limit !== "all" && filteredLogs.length > limit
    ? `Showing ${visibleLogs.length} of ${filteredLogs.length} filtered (${logs.length} total) — increase limit to see more`
    : `${filteredLogs.length} of ${logs.length} questions`;

  return (
    <main className="h-full w-full bg-background">
      <div className="flex h-full flex-col">
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
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="h-9 pl-9 text-sm"
                />
              </div>
              <select
                value={String(limit)}
                onChange={(e) => {
                  const val = e.target.value;
                  setLimit(val === "all" ? "all" : (Number(val) as LimitOption));
                }}
                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="Entries to show"
              >
                {LIMIT_OPTIONS.map((n) => (
                  <option key={n} value={String(n)}>
                    Show {n}
                  </option>
                ))}
                <option value="all">Show all</option>
              </select>
              <Button
                variant={showFilters ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFilters((current) => !current)}
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

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-12 text-center">
                <p className="text-muted-foreground">Loading upload logs…</p>
              </div>
            ) : error ? (
              <div className="p-12 text-center">
                <p className="text-red-500">{error}</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                <AnimatePresence mode="popLayout">
                  {visibleLogs.length > 0 ? (
                    visibleLogs.map((log, index) => (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{
                          duration: 0.2,
                          delay: Math.min(index * 0.02, 0.5),
                        }}
                      >
                        <QuestionLogRow
                          log={log}
                          expanded={expandedId === log.id}
                          onToggle={() =>
                            setExpandedId((current) =>
                              current === log.id ? null : log.id
                            )
                          }
                        />
                      </motion.div>
                    ))
                  ) : (
                    <motion.div
                      key="empty-state"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-12 text-center"
                    >
                      <p className="text-muted-foreground">
                        No questions match your filters.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
