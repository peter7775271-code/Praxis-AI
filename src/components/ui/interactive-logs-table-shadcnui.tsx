'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Filter, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type UploadLogLevel = 'manual' | 'pdf-ingest';

export interface UploadLog {
  id: string;
  uploadedAt: string;
  level: UploadLogLevel;
  subject: string;
  questionText: string;
  duration?: string;
  status: string;
  tags: string[];
  grade: string;
  year: number;
  topic: string;
  questionNumber?: string | null;
  schoolName?: string | null;
  marks?: number | null;
  paperNumber?: number | null;
}

type Filters = {
  level: string[];
  subject: string[];
  status: string[];
};

const levelStyles: Record<UploadLogLevel, string> = {
  manual: 'bg-blue-500/10 text-blue-700',
  'pdf-ingest': 'bg-amber-500/10 text-amber-700',
};

const statusStyles: Record<string, string> = {
  uploaded: 'text-green-700',
};

function formatUploadTime(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleString('en-AU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function summarizeQuestion(log: UploadLog) {
  const prefix = log.questionNumber ? `Q${log.questionNumber} • ` : '';
  return `${prefix}${log.questionText}`;
}

function LogRow({
  log,
  expanded,
  onToggle,
}: {
  log: UploadLog;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <motion.button
        type="button"
        onClick={onToggle}
        className="w-full p-4 text-left transition-colors hover:bg-muted/50 active:bg-muted/70"
        whileHover={{ backgroundColor: 'rgba(0,0,0,0.02)' }}
      >
        <div className="hidden items-center gap-4 md:flex">
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex-shrink-0"
          >
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </motion.div>

          <Badge
            variant="secondary"
            className={`flex-shrink-0 capitalize ${levelStyles[log.level]}`}
          >
            {log.level === 'pdf-ingest' ? 'PDF ingest' : 'Manual'}
          </Badge>

          <time className="w-40 flex-shrink-0 font-mono text-xs text-muted-foreground">
            {formatUploadTime(log.uploadedAt)}
          </time>

          <span className="min-w-[9rem] flex-shrink-0 text-sm font-medium text-foreground">
            {log.subject}
          </span>

          <p className="flex-1 truncate text-sm text-muted-foreground">
            {summarizeQuestion(log)}
          </p>

          <span
            className={`flex-shrink-0 font-mono text-sm font-semibold ${
              statusStyles[log.status] ?? 'text-muted-foreground'
            }`}
          >
            {log.status}
          </span>

          <span className="w-16 flex-shrink-0 text-right font-mono text-xs text-muted-foreground">
            {log.marks ? `${log.marks}m` : '--'}
          </span>
        </div>

        <div className="space-y-3 md:hidden">
          <div className="flex items-start gap-3">
            <motion.div
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="mt-1 flex-shrink-0"
            >
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </motion.div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className={`capitalize ${levelStyles[log.level]}`}>
                  {log.level === 'pdf-ingest' ? 'PDF ingest' : 'Manual'}
                </Badge>
                <Badge variant="outline">{log.subject}</Badge>
              </div>
              <p className="line-clamp-2 text-sm text-foreground">{summarizeQuestion(log)}</p>
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <time>{formatUploadTime(log.uploadedAt)}</time>
                <span>{log.marks ? `${log.marks}m` : '--'}</span>
              </div>
            </div>
          </div>
        </div>
      </motion.button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border bg-muted/50"
          >
            <div className="space-y-4 p-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Question
                </p>
                <p className="rounded bg-background p-3 text-sm text-foreground">
                  {log.questionText}
                </p>
              </div>

              <div className="grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Uploaded at
                  </p>
                  <p className="font-mono text-xs text-foreground">{formatUploadTime(log.uploadedAt)}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Topic
                  </p>
                  <p className="text-foreground">{log.topic}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Grade / Year
                  </p>
                  <p className="text-foreground">{log.grade} • {log.year}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    School / Paper
                  </p>
                  <p className="text-foreground">
                    {log.schoolName || 'Unknown school'}
                    {log.paperNumber ? ` • Paper ${log.paperNumber}` : ''}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Tags
                </p>
                <div className="flex flex-wrap gap-2">
                  {log.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
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
  logs: UploadLog[];
}) {
  const levels = Array.from(new Set(logs.map((log) => log.level)));
  const subjects = Array.from(new Set(logs.map((log) => log.subject)));
  const statuses = Array.from(new Set(logs.map((log) => log.status)));

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
    onChange({
      level: [],
      subject: [],
      status: [],
    });
  };

  const hasActiveFilters = Object.values(filters).some((group) => group.length > 0);

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
          <Button variant="ghost" size="sm" onClick={clearAll} className="h-6 text-xs">
            Clear
          </Button>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Upload source
        </p>
        <div className="space-y-2">
          {levels.map((level) => {
            const selected = filters.level.includes(level);

            return (
              <motion.button
                key={level}
                type="button"
                whileHover={{ x: 2 }}
                onClick={() => toggleFilter('level', level)}
                aria-pressed={selected}
                className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                  selected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/40'
                }`}
              >
                <span className="capitalize">{level === 'pdf-ingest' ? 'PDF ingest' : level}</span>
                {selected && <Check className="h-3.5 w-3.5" />}
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Subject
        </p>
        <div className="space-y-2">
          {subjects.map((subject) => {
            const selected = filters.subject.includes(subject);

            return (
              <motion.button
                key={subject}
                type="button"
                whileHover={{ x: 2 }}
                onClick={() => toggleFilter('subject', subject)}
                aria-pressed={selected}
                className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                  selected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/40'
                }`}
              >
                <span>{subject}</span>
                {selected && <Check className="h-3.5 w-3.5" />}
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Status
        </p>
        <div className="space-y-2">
          {statuses.map((status) => {
            const selected = filters.status.includes(status);

            return (
              <motion.button
                key={status}
                type="button"
                whileHover={{ x: 2 }}
                onClick={() => toggleFilter('status', status)}
                aria-pressed={selected}
                className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                  selected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/40'
                }`}
              >
                <span>{status}</span>
                {selected && <Check className="h-3.5 w-3.5" />}
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

export function InteractiveLogsTable({
  logs,
  title = 'Upload Logs',
  description,
}: {
  logs: UploadLog[];
  title?: string;
  description?: string;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    level: [],
    subject: [],
    status: [],
  });

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const lowerQuery = searchQuery.toLowerCase();
      const matchSearch =
        log.questionText.toLowerCase().includes(lowerQuery) ||
        log.subject.toLowerCase().includes(lowerQuery) ||
        log.topic.toLowerCase().includes(lowerQuery) ||
        String(log.schoolName || '').toLowerCase().includes(lowerQuery) ||
        String(log.questionNumber || '').toLowerCase().includes(lowerQuery);

      const matchLevel = filters.level.length === 0 || filters.level.includes(log.level);
      const matchSubject = filters.subject.length === 0 || filters.subject.includes(log.subject);
      const matchStatus = filters.status.length === 0 || filters.status.includes(log.status);

      return matchSearch && matchLevel && matchSubject && matchStatus;
    });
  }, [filters, logs, searchQuery]);

  const activeFilters = filters.level.length + filters.subject.length + filters.status.length;

  return (
    <main className="h-full min-h-[70vh] w-full overflow-hidden rounded-3xl border border-border bg-background">
      <div className="flex h-full flex-col">
        <div className="border-b border-border bg-card p-6">
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
              <p className="text-sm text-muted-foreground">
                {filteredLogs.length} of {logs.length} uploaded questions
              </p>
              {description ? (
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by question, subject, topic, school, or number..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="h-9 pl-9 text-sm"
                />
              </div>
              <Button
                variant={showFilters ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowFilters((current) => !current)}
                className="relative"
              >
                <Filter className="h-4 w-4" />
                {activeFilters > 0 && (
                  <Badge className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center bg-destructive p-0 text-xs text-destructive-foreground">
                    {activeFilters}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
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
                <FilterPanel filters={filters} onChange={setFilters} logs={logs} />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="divide-y divide-border">
              <AnimatePresence mode="popLayout">
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((log, index) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2, delay: index * 0.02 }}
                    >
                      <LogRow
                        log={log}
                        expanded={expandedId === log.id}
                        onToggle={() => setExpandedId((current) => (current === log.id ? null : log.id))}
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
                    <p className="text-muted-foreground">No upload logs match your filters.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}