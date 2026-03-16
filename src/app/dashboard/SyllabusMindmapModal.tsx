'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  ChevronRight,
  Search,
  BookOpen,
  Hash,
  FunctionSquare,
  TrendingUp,
  CheckSquare,
  Square,
  Minus,
  Loader2,
  Map,
  RotateCcw,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type DotPoint = { id: string; text: string };

type SubtopicNode = {
  key: string;       // unique key: `${topicName}||${subtopicName}`
  name: string;
  dotPoints: DotPoint[];
};

type TopicNode = {
  name: string;
  subtopics: SubtopicNode[];
};

export type MindmapSelection = {
  /** Subtopic names that are fully selected (all dot-points included). */
  subtopics: string[];
  /** Individual dot-point texts for partial subtopic selections. */
  dotPoints: string[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** Current grade/subject from the exam builder (used as default selectors). */
  initialGrade: string;
  initialSubject: string;
  /** Previously confirmed selection so the modal re-opens with it populated. */
  initialSelection?: MindmapSelection;
  onConfirm: (selection: MindmapSelection) => void;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const YEARS = ['Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12'] as const;

const SUBJECTS_BY_YEAR: Record<string, string[]> = {
  'Year 7': ['Mathematics'],
  'Year 8': ['Mathematics'],
  'Year 9': ['Mathematics'],
  'Year 10': ['Mathematics'],
  'Year 11': ['Mathematics Advanced', 'Mathematics Extension 1'],
  'Year 12': ['Mathematics Advanced', 'Mathematics Extension 1', 'Mathematics Extension 2'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const coerceDotPointText = (v: unknown): string => {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v).trim();
  if (v && typeof v === 'object') {
    const t = (v as { text?: unknown }).text;
    if (t !== undefined) return coerceDotPointText(t);
  }
  return '';
};

const normalizeDotPoint = (v: unknown, fallbackId: string): DotPoint | null => {
  if (typeof v === 'string') {
    const text = v.trim();
    return text ? { id: fallbackId, text } : null;
  }
  if (!v || typeof v !== 'object') return null;
  const obj = v as { id?: unknown; text?: unknown };
  const text = coerceDotPointText(obj.text ?? v);
  if (!text) return null;
  const id = typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : fallbackId;
  return { id, text };
};

function parseTaxonomy(grouped: unknown): TopicNode[] {
  if (!grouped || typeof grouped !== 'object') return [];
  const topics: TopicNode[] = [];
  for (const [topicName, subtopicsRaw] of Object.entries(grouped as Record<string, unknown>)) {
    const topic = String(topicName || '').trim();
    if (!topic || !subtopicsRaw || typeof subtopicsRaw !== 'object') continue;
    const subtopics: SubtopicNode[] = [];
    for (const [subName, pointsRaw] of Object.entries(subtopicsRaw as Record<string, unknown>)) {
      const subtopic = String(subName || '').trim();
      if (!subtopic) continue;
      const pointList = Array.isArray(pointsRaw) ? pointsRaw : [pointsRaw];
      const dotPoints = pointList
        .map((p, i) => normalizeDotPoint(p, `${topic}-${subtopic}-${i}`))
        .filter((p): p is DotPoint => p !== null);
      if (dotPoints.length > 0) {
        subtopics.push({ key: `${topic}||${subtopic}`, name: subtopic, dotPoints });
      }
    }
    if (subtopics.length > 0) topics.push({ name: topic, subtopics });
  }
  return topics;
}

function topicIcon(title: string): React.ReactNode {
  const t = title.toLowerCase();
  if (t.includes('calculus') || t.includes('differenti')) return <FunctionSquare className="w-4 h-4" />;
  if (t.includes('statistics') || t.includes('probability')) return <TrendingUp className="w-4 h-4" />;
  return <Hash className="w-4 h-4" />;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CheckboxIcon({ state }: { state: 'checked' | 'unchecked' | 'indeterminate' }) {
  if (state === 'checked')
    return <CheckSquare className="w-4 h-4 shrink-0 text-[#b5a45d]" />;
  if (state === 'indeterminate')
    return <Minus className="w-4 h-4 shrink-0 text-[#b5a45d]" />;
  return <Square className="w-4 h-4 shrink-0 text-neutral-300" />;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SyllabusMindmapModal({
  open,
  onClose,
  initialGrade,
  initialSubject,
  initialSelection,
  onConfirm,
}: Props) {
  // ── Selector state ──────────────────────────────────────────────────────────
  const [grade, setGrade] = useState(initialGrade);
  const [subject, setSubject] = useState(initialSubject);

  // Sync grade/subject when props change and modal is opened
  useEffect(() => {
    if (open) {
      setGrade(initialGrade);
      setSubject(initialSubject);
    }
  }, [open, initialGrade, initialSubject]);

  // Ensure subject is valid for grade
  useEffect(() => {
    const validSubjects = SUBJECTS_BY_YEAR[grade] || [];
    if (!validSubjects.includes(subject)) setSubject(validSubjects[0] || '');
  }, [grade, subject]);

  // ── Data ────────────────────────────────────────────────────────────────────
  const [topics, setTopics] = useState<TopicNode[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Navigation ───────────────────────────────────────────────────────────────
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [activeSubtopic, setActiveSubtopic] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open || !grade || !subject) return;
    setLoading(true);
    setTopics([]);
    setActiveTopic(null);
    setActiveSubtopic(null);
    fetch(`/api/hsc/taxonomy?grade=${encodeURIComponent(grade)}&subject=${encodeURIComponent(subject)}`)
      .then((r) => r.json())
      .then((data) => setTopics(parseTaxonomy(data?.grouped)))
      .catch(() => setTopics([]))
      .finally(() => setLoading(false));
  }, [open, grade, subject]);

  // Auto-select first topic when data loads
  useEffect(() => {
    if (topics.length > 0 && activeTopic === null) {
      setActiveTopic(topics[0].name);
    }
  }, [topics, activeTopic]);

  // Reset activeSubtopic when topic changes
  useEffect(() => {
    setActiveSubtopic(null);
  }, [activeTopic]);

  // ── Selection state ─────────────────────────────────────────────────────────
  // checkedSubtopics: subtopic keys where every dot point is selected
  // checkedDotPoints: individual dot point IDs
  const [checkedSubtopics, setCheckedSubtopics] = useState<Set<string>>(new Set());
  const [checkedDotPoints, setCheckedDotPoints] = useState<Set<string>>(new Set());

  // Populate from initialSelection when modal opens
  useEffect(() => {
    if (!open) return;
    if (initialSelection) {
      // We store subtopics by their KEY (topic||subtopic) but initialSelection stores just the subtopic name.
      // We'll resolve after topics load (see below).
      setCheckedDotPoints(new Set(initialSelection.dotPoints));
    } else {
      setCheckedSubtopics(new Set());
      setCheckedDotPoints(new Set());
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resolve subtopic names → keys once topics load
  useEffect(() => {
    if (topics.length === 0 || !initialSelection) return;
    const subNames = new Set(initialSelection.subtopics);
    const keys = new Set<string>();
    for (const t of topics) {
      for (const s of t.subtopics) {
        if (subNames.has(s.name)) keys.add(s.key);
      }
    }
    setCheckedSubtopics(keys);
  }, [topics]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived helpers ──────────────────────────────────────────────────────────

  const subtopicCheckState = useCallback(
    (sub: SubtopicNode): 'checked' | 'unchecked' | 'indeterminate' => {
      if (checkedSubtopics.has(sub.key)) return 'checked';
      const anyChecked = sub.dotPoints.some((dp) => checkedDotPoints.has(dp.id));
      if (anyChecked) return 'indeterminate';
      return 'unchecked';
    },
    [checkedSubtopics, checkedDotPoints],
  );

  const topicCheckState = useCallback(
    (topic: TopicNode): 'checked' | 'unchecked' | 'indeterminate' => {
      const allChecked = topic.subtopics.every((s) => checkedSubtopics.has(s.key));
      if (allChecked && topic.subtopics.length > 0) return 'checked';
      const anyActive = topic.subtopics.some(
        (s) =>
          checkedSubtopics.has(s.key) ||
          s.dotPoints.some((dp) => checkedDotPoints.has(dp.id)),
      );
      if (anyActive) return 'indeterminate';
      return 'unchecked';
    },
    [checkedSubtopics, checkedDotPoints],
  );

  // ── Toggle handlers ──────────────────────────────────────────────────────────

  const toggleSubtopic = (sub: SubtopicNode) => {
    setCheckedSubtopics((prev) => {
      const next = new Set(prev);
      if (next.has(sub.key)) {
        // Uncheck subtopic + remove all its dot points
        next.delete(sub.key);
        setCheckedDotPoints((dp) => {
          const dpNext = new Set(dp);
          sub.dotPoints.forEach((p) => dpNext.delete(p.id));
          return dpNext;
        });
      } else {
        // Check subtopic + clear individual dot-point selections for it
        next.add(sub.key);
        setCheckedDotPoints((dp) => {
          const dpNext = new Set(dp);
          sub.dotPoints.forEach((p) => dpNext.delete(p.id));
          return dpNext;
        });
      }
      return next;
    });
  };

  const toggleDotPoint = (sub: SubtopicNode, dp: DotPoint) => {
    // If subtopic is fully checked, switching to partial: uncheck subtopic, keep others
    if (checkedSubtopics.has(sub.key)) {
      setCheckedSubtopics((prev) => {
        const next = new Set(prev);
        next.delete(sub.key);
        return next;
      });
      // Mark all OTHER dot points as individually checked, then toggle this one off
      setCheckedDotPoints((prev) => {
        const next = new Set(prev);
        sub.dotPoints.forEach((p) => {
          if (p.id !== dp.id) next.add(p.id);
        });
        return next;
      });
    } else {
      setCheckedDotPoints((prev) => {
        const next = new Set(prev);
        if (next.has(dp.id)) {
          next.delete(dp.id);
        } else {
          next.add(dp.id);
        }
        // If all dot points are now individually checked, promote to subtopic-level
        const allChecked = sub.dotPoints.every((p) => next.has(p.id));
        if (allChecked) {
          setCheckedSubtopics((s) => {
            const sNext = new Set(s);
            sNext.add(sub.key);
            return sNext;
          });
          sub.dotPoints.forEach((p) => next.delete(p.id));
        }
        return next;
      });
    }
  };

  const toggleTopic = (topic: TopicNode) => {
    const state = topicCheckState(topic);
    if (state === 'checked') {
      // Uncheck all subtopics and their dot points
      setCheckedSubtopics((prev) => {
        const next = new Set(prev);
        topic.subtopics.forEach((s) => next.delete(s.key));
        return next;
      });
      setCheckedDotPoints((prev) => {
        const next = new Set(prev);
        topic.subtopics.forEach((s) => s.dotPoints.forEach((dp) => next.delete(dp.id)));
        return next;
      });
    } else {
      // Check all subtopics (clearing individual dot point checks)
      setCheckedSubtopics((prev) => {
        const next = new Set(prev);
        topic.subtopics.forEach((s) => next.add(s.key));
        return next;
      });
      setCheckedDotPoints((prev) => {
        const next = new Set(prev);
        topic.subtopics.forEach((s) => s.dotPoints.forEach((dp) => next.delete(dp.id)));
        return next;
      });
    }
  };

  const clearAll = () => {
    setCheckedSubtopics(new Set());
    setCheckedDotPoints(new Set());
  };

  // ── Filtered views ───────────────────────────────────────────────────────────

  const lowerSearch = search.toLowerCase().trim();

  const filteredTopics = topics.filter((t) => {
    if (!lowerSearch) return true;
    if (t.name.toLowerCase().includes(lowerSearch)) return true;
    return t.subtopics.some(
      (s) =>
        s.name.toLowerCase().includes(lowerSearch) ||
        s.dotPoints.some((dp) => dp.text.toLowerCase().includes(lowerSearch)),
    );
  });

  const activeTopicNode = topics.find((t) => t.name === activeTopic) || null;

  const filteredSubtopics: SubtopicNode[] = activeTopicNode
    ? lowerSearch
      ? activeTopicNode.subtopics.filter(
          (s) =>
            s.name.toLowerCase().includes(lowerSearch) ||
            s.dotPoints.some((dp) => dp.text.toLowerCase().includes(lowerSearch)),
        )
      : activeTopicNode.subtopics
    : [];

  const activeSubtopicNode = activeTopicNode?.subtopics.find((s) => s.key === activeSubtopic) || null;

  const filteredDotPoints: DotPoint[] = activeSubtopicNode
    ? lowerSearch
      ? activeSubtopicNode.dotPoints.filter((dp) => dp.text.toLowerCase().includes(lowerSearch))
      : activeSubtopicNode.dotPoints
    : [];

  // ── Selection summary ────────────────────────────────────────────────────────

  const totalSelectedSubtopics = checkedSubtopics.size;
  const totalSelectedDotPoints = checkedDotPoints.size;
  const hasAnySelection = totalSelectedSubtopics > 0 || totalSelectedDotPoints > 0;

  // ── Confirm ──────────────────────────────────────────────────────────────────

  const handleConfirm = () => {
    // Build subtopic name list from keys
    const subtopicNames: string[] = [];
    for (const t of topics) {
      for (const s of t.subtopics) {
        if (checkedSubtopics.has(s.key)) subtopicNames.push(s.name);
      }
    }
    // Build dot point text list from IDs
    const dotPointTexts: string[] = [];
    for (const t of topics) {
      for (const s of t.subtopics) {
        for (const dp of s.dotPoints) {
          if (checkedDotPoints.has(dp.id)) dotPointTexts.push(dp.text);
        }
      }
    }
    onConfirm({ subtopics: subtopicNames, dotPoints: dotPointTexts });
    onClose();
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-6xl mx-4 bg-white rounded-[2rem] shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: '90vh' }}>
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-neutral-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center">
              <Map className="w-5 h-5 text-[#b5a45d]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-neutral-900">Syllabus Mindmap</h2>
              <p className="text-xs text-neutral-400 font-medium">Select subtopics and dot points to restrict your exam</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-neutral-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        {/* ── Controls bar ── */}
        <div className="px-8 py-4 border-b border-neutral-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center shrink-0">
          <div className="flex gap-2 items-center">
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="h-9 rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-sm font-medium text-neutral-800 focus:outline-none focus:ring-1 focus:ring-[#b5a45d]"
            >
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="h-9 rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-sm font-medium text-neutral-800 focus:outline-none focus:ring-1 focus:ring-[#b5a45d]"
            >
              {(SUBJECTS_BY_YEAR[grade] || []).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex-1 relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search topics, subtopics, dot points…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-8 pr-3 rounded-xl border border-neutral-200 bg-neutral-50 text-sm focus:outline-none focus:ring-1 focus:ring-[#b5a45d]"
            />
          </div>
          {hasAnySelection && (
            <button
              type="button"
              onClick={clearAll}
              className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-800 transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Clear all
            </button>
          )}
        </div>

        {/* ── Three-panel mindmap ── */}
        <div className="flex-1 overflow-hidden flex min-h-0">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-neutral-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-sm font-medium">Loading syllabus…</p>
            </div>
          ) : topics.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-neutral-400 gap-3">
              <BookOpen className="w-10 h-10 opacity-30" />
              <p className="text-sm font-medium">No syllabus data available.</p>
            </div>
          ) : (
            <div className="flex-1 grid grid-cols-3 divide-x divide-neutral-100 overflow-hidden">

              {/* ── Column 1: Topics ── */}
              <div className="flex flex-col overflow-hidden">
                <div className="px-4 py-3 border-b border-neutral-100 shrink-0">
                  <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-neutral-400 flex items-center gap-1.5">
                    <BookOpen className="w-3 h-3" /> Topics
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-1">
                  {filteredTopics.map((topic) => {
                    const isActive = activeTopic === topic.name;
                    const checkState = topicCheckState(topic);
                    return (
                      <div
                        key={topic.name}
                        className={`group flex items-center gap-2 p-2.5 rounded-xl cursor-pointer transition-all ${
                          isActive
                            ? 'bg-neutral-900 text-white'
                            : 'hover:bg-neutral-50 text-neutral-700'
                        }`}
                        onClick={() => setActiveTopic(topic.name)}
                      >
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleTopic(topic); }}
                          className="shrink-0"
                          aria-label={`Toggle all subtopics in ${topic.name}`}
                        >
                          {checkState === 'checked' ? (
                            <CheckSquare className={`w-4 h-4 ${isActive ? 'text-[#b5a45d]' : 'text-[#b5a45d]'}`} />
                          ) : checkState === 'indeterminate' ? (
                            <Minus className={`w-4 h-4 ${isActive ? 'text-[#b5a45d]' : 'text-[#b5a45d]'}`} />
                          ) : (
                            <Square className={`w-4 h-4 ${isActive ? 'text-neutral-400' : 'text-neutral-300'}`} />
                          )}
                        </button>
                        <div className={`shrink-0 ${isActive ? 'text-[#b5a45d]' : 'text-neutral-400'}`}>
                          {topicIcon(topic.name)}
                        </div>
                        <span className={`text-xs font-medium leading-tight flex-1 min-w-0 ${isActive ? 'text-white' : ''}`}>
                          {topic.name}
                        </span>
                        {isActive && <ChevronRight className="w-3 h-3 text-neutral-400 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Column 2: Subtopics ── */}
              <div className="flex flex-col overflow-hidden">
                <div className="px-4 py-3 border-b border-neutral-100 shrink-0">
                  <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-neutral-400 flex items-center gap-1.5">
                    <Hash className="w-3 h-3" /> Subtopics
                    {activeTopic && (
                      <span className="ml-1 text-neutral-300 font-normal normal-case tracking-normal truncate">
                        — {activeTopic}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-1">
                  {filteredSubtopics.length === 0 ? (
                    <p className="text-xs text-neutral-300 p-2">
                      {activeTopic ? 'No subtopics match.' : 'Select a topic.'}
                    </p>
                  ) : (
                    filteredSubtopics.map((sub) => {
                      const isActive = activeSubtopic === sub.key;
                      const checkState = subtopicCheckState(sub);
                      return (
                        <div
                          key={sub.key}
                          className={`group flex items-center gap-2 p-2.5 rounded-xl cursor-pointer transition-all ${
                            isActive
                              ? 'bg-[#b5a45d]/10 border border-[#b5a45d]/30'
                              : 'hover:bg-neutral-50 border border-transparent'
                          }`}
                          onClick={() => setActiveSubtopic(isActive ? null : sub.key)}
                        >
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleSubtopic(sub); }}
                            className="shrink-0"
                            aria-label={`Toggle ${sub.name}`}
                          >
                            <CheckboxIcon state={checkState} />
                          </button>
                          <span className={`text-xs font-medium leading-tight flex-1 min-w-0 ${isActive ? 'text-[#b5a45d]' : 'text-neutral-700'}`}>
                            {sub.name}
                          </span>
                          <span className="text-[10px] text-neutral-300 shrink-0">
                            {sub.dotPoints.length}
                          </span>
                          {isActive && <ChevronRight className="w-3 h-3 text-[#b5a45d] shrink-0" />}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* ── Column 3: Dot Points ── */}
              <div className="flex flex-col overflow-hidden">
                <div className="px-4 py-3 border-b border-neutral-100 shrink-0">
                  <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-neutral-400 flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-neutral-300 shrink-0 inline-block" />
                    Dot Points
                    {activeSubtopicNode && (
                      <span className="ml-1 text-neutral-300 font-normal normal-case tracking-normal truncate">
                        — {activeSubtopicNode.name}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                  {!activeSubtopicNode ? (
                    <p className="text-xs text-neutral-300 p-2">Select a subtopic.</p>
                  ) : filteredDotPoints.length === 0 ? (
                    <p className="text-xs text-neutral-300 p-2">No dot points match.</p>
                  ) : (
                    filteredDotPoints.map((dp) => {
                      const isSubChecked = checkedSubtopics.has(activeSubtopicNode.key);
                      const isDpChecked = isSubChecked || checkedDotPoints.has(dp.id);
                      return (
                        <div
                          key={dp.id}
                          className={`flex items-start gap-2 p-2.5 rounded-xl cursor-pointer transition-all ${
                            isDpChecked
                              ? 'bg-[#b5a45d]/8 border border-[#b5a45d]/20'
                              : 'hover:bg-neutral-50 border border-transparent'
                          }`}
                          onClick={() => toggleDotPoint(activeSubtopicNode, dp)}
                          style={isDpChecked ? { backgroundColor: 'rgba(181,164,93,0.07)' } : undefined}
                        >
                          <div className="mt-0.5 shrink-0">
                            {isDpChecked ? (
                              <CheckSquare className="w-3.5 h-3.5 text-[#b5a45d]" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-neutral-300" />
                            )}
                          </div>
                          <p className={`text-xs leading-relaxed ${isDpChecked ? 'text-neutral-800 font-medium' : 'text-neutral-500'}`}>
                            {dp.text}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-8 py-5 border-t border-neutral-100 flex items-center justify-between gap-4 shrink-0 bg-neutral-50/60">
          <div className="text-sm text-neutral-500">
            {hasAnySelection ? (
              <span>
                <span className="font-bold text-neutral-800">{totalSelectedSubtopics}</span>{' '}
                {totalSelectedSubtopics === 1 ? 'subtopic' : 'subtopics'} selected
                {totalSelectedDotPoints > 0 && (
                  <>
                    {', '}
                    <span className="font-bold text-neutral-800">{totalSelectedDotPoints}</span>{' '}
                    {totalSelectedDotPoints === 1 ? 'dot point' : 'dot points'} selected
                  </>
                )}
              </span>
            ) : (
              <span className="text-neutral-400">No restrictions — all content will be included.</span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-neutral-600 bg-white border border-neutral-200 hover:bg-neutral-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-neutral-900 hover:bg-neutral-800 transition-all"
            >
              Apply Selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
