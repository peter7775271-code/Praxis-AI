'use client';

import React, { useState, useEffect, useMemo } from 'react';
import RenderLatexText from '@/components/RenderLatexText';
import {
  ChevronRight,
  BookOpen,
  Hash,
  FunctionSquare,
  Calculator,
  TrendingUp,
  Search,
} from 'lucide-react';
import { SUBJECTS_BY_YEAR as SUBJECTS } from './syllabus-config';

type DotPoint = { id: string; text: string };
type TaxonomyGrouped = Record<string, Record<string, DotPoint[]>>;

type TopicSubtopic = {
  id: string;
  title: string;
  dotPoints: DotPoint[];
};

type Topic = {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  subtopics: TopicSubtopic[];
};

type Props = {
  onClose?: () => void;
  isDevMode?: boolean;
};

const YEARS = ['Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12'] as const;

const coerceDotPointText = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  if (value && typeof value === 'object') {
    const nested = (value as { text?: unknown }).text;
    if (nested !== undefined) return coerceDotPointText(nested);
  }
  return '';
};

const normalizeDotPoint = (value: unknown, fallbackId: string): DotPoint | null => {
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return null;
    return { id: fallbackId, text };
  }

  if (!value || typeof value !== 'object') return null;

  const obj = value as { id?: unknown; text?: unknown };
  const text = coerceDotPointText(obj.text ?? value);
  if (!text) return null;

  const id = typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : fallbackId;
  return { id, text };
};

const normalizeTaxonomyGrouped = (value: unknown): TaxonomyGrouped => {
  if (!value || typeof value !== 'object') return {};

  const groupedInput = value as Record<string, unknown>;
  const groupedOutput: TaxonomyGrouped = {};

  for (const [topicKey, subtopicsValue] of Object.entries(groupedInput)) {
    const topic = String(topicKey || '').trim();
    if (!topic || !subtopicsValue || typeof subtopicsValue !== 'object') continue;

    const subtopicsInput = subtopicsValue as Record<string, unknown>;
    const normalizedSubtopics: Record<string, DotPoint[]> = {};

    for (const [subtopicKey, pointsValue] of Object.entries(subtopicsInput)) {
      const subtopic = String(subtopicKey || '').trim();
      if (!subtopic) continue;

      const pointList = Array.isArray(pointsValue) ? pointsValue : [pointsValue];
      const normalizedPoints = pointList
        .map((point, index) => normalizeDotPoint(point, `${topic}-${subtopic}-${index}`))
        .filter((point): point is DotPoint => Boolean(point));

      if (normalizedPoints.length > 0) normalizedSubtopics[subtopic] = normalizedPoints;
    }

    if (Object.keys(normalizedSubtopics).length > 0) groupedOutput[topic] = normalizedSubtopics;
  }

  return groupedOutput;
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export default function SyllabusViewer({ isDevMode: _isDevMode = false }: Props) {
  const [selectedYear, setSelectedYear] = useState<(typeof YEARS)[number]>('Year 12');
  const [selectedSubject, setSelectedSubject] = useState<string>(SUBJECTS['Year 12'][0] || 'Mathematics');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [expandedSubtopics, setExpandedSubtopics] = useState<string[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const validSubjects = SUBJECTS[selectedYear];
    if (!validSubjects.includes(selectedSubject)) {
      setSelectedSubject(validSubjects[0]);
    }
  }, [selectedYear, selectedSubject]);

  useEffect(() => {
    if (!selectedYear || !selectedSubject) return;

    setLoading(true);
    setTopics([]);
    setActiveTopic(null);
    setExpandedSubtopics([]);

    fetch(
      `/api/hsc/taxonomy?grade=${encodeURIComponent(selectedYear)}&subject=${encodeURIComponent(selectedSubject)}`
    )
      .then((res) => res.json())
      .then((data) => {
        const grouped = normalizeTaxonomyGrouped(data?.grouped);

        const mappedTopics: Topic[] = Object.entries(grouped).map(([topicTitle, subtopics], topicIndex) => {
          const topicLower = topicTitle.toLowerCase();
          const icon =
            topicLower.includes('calculus') || topicLower.includes('differenti')
              ? <FunctionSquare className="w-5 h-5" />
              : topicLower.includes('statistics') || topicLower.includes('probability')
                ? <TrendingUp className="w-5 h-5" />
                : <Hash className="w-5 h-5" />;

          return {
            id: slugify(topicTitle) || `topic-${topicIndex}`,
            title: topicTitle,
            icon,
            color: 'text-primary',
            bgColor: 'bg-primary/10',
            subtopics: Object.entries(subtopics).map(([subtopicTitle, points], subtopicIndex) => ({
              id: `${slugify(topicTitle)}-${slugify(subtopicTitle)}-${subtopicIndex}`,
              title: subtopicTitle,
              dotPoints: points,
            })),
          };
        });

        setTopics(mappedTopics);

        if (mappedTopics.length > 0) {
          setActiveTopic(mappedTopics[0].id);
          const firstSub = mappedTopics[0].subtopics[0];
          setExpandedSubtopics(firstSub ? [firstSub.id] : []);
        }
      })
      .catch(() => {
        setTopics([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedYear, selectedSubject]);

  const filteredData = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return topics
      .map((topic) => {
        if (!query) return topic;

        const matchedSubtopics = topic.subtopics.filter(
          (sub) =>
            sub.title.toLowerCase().includes(query) ||
            sub.dotPoints.some((dot) => dot.text.toLowerCase().includes(query))
        );

        return {
          ...topic,
          subtopics: matchedSubtopics,
        };
      })
      .filter((topic) => topic.title.toLowerCase().includes(query) || topic.subtopics.length > 0);
  }, [topics, searchQuery]);

  useEffect(() => {
    if (filteredData.length === 0) {
      setActiveTopic(null);
      return;
    }

    const stillVisible = filteredData.some((topic) => topic.id === activeTopic);
    if (!stillVisible) {
      setActiveTopic(filteredData[0].id);
      const firstSub = filteredData[0].subtopics[0];
      setExpandedSubtopics(firstSub ? [firstSub.id] : []);
    }
  }, [filteredData, activeTopic]);

  const currentTopicData = filteredData.find((t) => t.id === activeTopic) || filteredData[0] || null;

  const toggleSubtopic = (id: string) => {
    setExpandedSubtopics((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row overflow-hidden">
      <aside className="w-full md:w-80 border-r border-border/50 glass-card flex flex-col h-[34vh] md:h-screen shrink-0 relative z-10">
        <div className="p-6 border-b border-border/50 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-nowrap">Study Syllabus</h1>
              <p className="text-sm text-muted-foreground">{selectedYear} • {selectedSubject}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value as (typeof YEARS)[number])}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              data-testid="select-year"
            >
              {YEARS.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>

            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              data-testid="select-subject"
            >
              {(SUBJECTS[selectedYear] || []).map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Find a topic..."
              className="w-full h-10 pl-9 pr-3 rounded-md border border-border/50 bg-background/50 focus-visible:ring-2 focus-visible:ring-primary/30 outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search"
            />
          </div>
        </div>

        <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
          <div className="space-y-2">
            {filteredData.map((topic) => {
              const isActive = activeTopic === topic.id;
              return (
                <button
                  key={topic.id}
                  onClick={() => setActiveTopic(topic.id)}
                  data-testid={`button-topic-${topic.id}`}
                  className={`w-full text-left p-3 rounded-xl transition-all duration-200 group relative overflow-hidden ${
                    isActive
                      ? 'bg-primary/10 border border-primary/20'
                      : 'hover:bg-muted/50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 relative z-10">
                    <div className={`rounded-lg p-1.5 ${isActive ? topic.bgColor : 'bg-muted'} ${isActive ? topic.color : 'text-muted-foreground'}`}>
                      {topic.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className={`font-medium text-sm leading-tight ${isActive ? 'text-primary' : 'text-foreground'}`}>
                        {topic.title}
                      </h3>
                    </div>
                  </div>

                  {isActive && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      <main className="flex-1 h-[66vh] md:h-screen flex flex-col relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] pointer-events-none -z-10 translate-x-1/3 -translate-y-1/3" />

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-10">
            <BookOpen className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-lg font-medium">Loading syllabus…</p>
          </div>
        ) : currentTopicData ? (
          <>
            <header className="p-6 md:p-10 pb-0 shrink-0">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <BookOpen className="w-4 h-4" />
                <span>Curriculum</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-primary font-medium">{currentTopicData.title}</span>
              </div>

              <div className="mb-8">
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">{currentTopicData.title}</h2>
                <p className="text-muted-foreground max-w-2xl">
                  Showing syllabus content from the database for {selectedYear} — {selectedSubject}.
                </p>
              </div>
            </header>

            <div className="flex-1 px-6 md:px-10 pb-10 overflow-y-auto custom-scrollbar">
              <div className="max-w-4xl space-y-4 pb-20">
                {currentTopicData.subtopics.map((subtopic) => {
                  const isExpanded = expandedSubtopics.includes(subtopic.id);

                  return (
                    <div key={subtopic.id} className="glass-card rounded-2xl overflow-hidden">
                      <button
                        onClick={() => toggleSubtopic(subtopic.id)}
                        data-testid={`button-subtopic-${subtopic.id}`}
                        className="w-full p-5 flex items-center justify-between hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-full bg-muted text-muted-foreground">
                            <Hash className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <h3 className="font-semibold text-lg">{subtopic.title}</h3>
                            <p className="text-xs text-muted-foreground">
                              {subtopic.dotPoints.length} Syllabus Dot Points
                            </p>
                          </div>
                        </div>
                        <div className={`p-2 rounded-full transition-transform duration-300 ${isExpanded ? 'rotate-90 bg-muted/50' : 'hover:bg-muted/50'}`}>
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="overflow-hidden border-t border-border/50">
                          <div className="p-5 pt-4 bg-muted/10 space-y-3">
                            {subtopic.dotPoints.map((point) => (
                              <div
                                key={point.id}
                                className="w-full flex items-start gap-3 p-4 rounded-xl bg-background border border-border/50 shadow-sm"
                              >
                                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                <RenderLatexText
                                  text={point.text}
                                  className="w-full min-w-0 overflow-x-auto text-sm leading-relaxed text-foreground font-medium"
                                  style={{ margin: 0, maxWidth: '100%' }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-10">
            <Search className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-lg font-medium">No syllabus data found</p>
            <p className="text-sm">Try a different year or subject.</p>
          </div>
        )}
      </main>
    </div>
  );
}
