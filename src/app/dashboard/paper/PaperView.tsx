// @ts-nocheck
'use client';

import React from 'react';
import {
  Send, Upload, ArrowLeft, BookOpen, ChevronRight, ChevronLeft, RefreshCw,
  Pencil, Eraser,
  Eye, Download, Bookmark, CheckCircle2, XCircle, TrendingUp, Edit2, Timer, Info
} from 'lucide-react';
import { LatexText, QuestionTextWithDividers } from '../question-text-with-dividers';
import { parseCriteriaForDisplay, stripOuterBraces } from '../view-helpers';

interface Props {
  [key: string]: any;
}

export default function PaperView({
  question, isGenerating, showAnswer, appState, canvasHeight, loading, isIpad, error, feedback,
  submittedAnswer, selectedMcqAnswer, mcqImageSize, isSaving, paperQuestions, paperIndex,
  showPaperQuestionNavigator, showQuestionInfo, exportingPaperPdf, examConditionsActive, examAttempts,
  examEnded, showFinishExamPrompt, examReviewMode, examReviewIndex, isDevMode, allQuestions,
  setShowAnswer, setAppState, setFeedback, setUploadedFile, setSubmittedAnswer, setSelectedMcqAnswer,
  setMcqImageSize, setViewMode, setShowPaperQuestionNavigator, setShowQuestionInfo, setExamReviewMode,
  setExamReviewIndex, excalidrawSceneRef, excalidrawApiRef, getDisplayGroupAt, generateQuestion,
  submitAnswer, clearPaperState, isPaperMode, activePaperGroupStartIndex, Excalidraw,
  exportPaperPdf, goToPaperQuestion, openInlineQuestionEditor, resetCanvas, startExamSimulation,
  handleEndExam,
  saveExam, endExam, handleNextQuestion, uploadImage, saveAttempt,
  awardedMarks, maxMarks, isMultipleChoiceReview, isMarking, examTimeRemainingLabel,
  paperDisplayGroups,
}: Props) {
  const [drawTool, setDrawTool] = React.useState<'pen' | 'eraser'>('pen');
  const applyDrawToolToApi = React.useCallback((api: any, nextTool: 'pen' | 'eraser') => {
    if (nextTool === 'eraser') {
      api.setActiveTool({ type: 'eraser' });
      return;
    }

    api.setActiveTool({ type: 'freedraw' });
    api.updateScene({
      appState: {
        currentItemStrokeWidth: 1,
      },
    });
  }, []);

  React.useEffect(() => {
    const api = excalidrawApiRef?.current;
    if (!api) return;
    applyDrawToolToApi(api, drawTool);
  }, [drawTool, excalidrawApiRef, applyDrawToolToApi]);

  React.useEffect(() => {
    setDrawTool('pen');
  }, [question?.id]);

  const activeDisplayGroup = React.useMemo(() => {
    if (!isPaperMode || !Array.isArray(paperQuestions) || paperQuestions.length === 0) {
      return [];
    }

    const groupInfo = getDisplayGroupAt(paperQuestions, paperIndex);
    if (!groupInfo || !Array.isArray(groupInfo.group)) {
      return [];
    }

    return groupInfo.group;
  }, [isPaperMode, paperQuestions, paperIndex, getDisplayGroupAt]);

  const activeDisplayGroupIds = React.useMemo(() => {
    const seen = new Set<string>();
    const ids: string[] = [];

    activeDisplayGroup.forEach((item: any) => {
      const id = String(item?.id || '').trim();
      if (!id || seen.has(id)) return;
      seen.add(id);
      ids.push(id);
    });

    return ids;
  }, [activeDisplayGroup]);

  return (
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
                                    <p><strong>ID{activeDisplayGroupIds.length > 1 ? 's' : ''}:</strong> {(activeDisplayGroupIds.length ? activeDisplayGroupIds : [question.id]).filter(Boolean).join(', ') || '-'}</p>
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
                            className="minimal-excalidraw-shell rounded-xl bg-white border border-neutral-100"
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
                                UIOptions={{
                                  canvasActions: {
                                    changeViewBackgroundColor: false,
                                    clearCanvas: false,
                                    export: false,
                                    loadScene: false,
                                    saveToActiveFile: false,
                                    saveAsImage: false,
                                    toggleTheme: false,
                                  },
                                  tools: {
                                    image: false,
                                  },
                                  welcomeScreen: false,
                                }}
                                initialData={{
                                  appState: {
                                    currentItemStrokeWidth: 1,
                                    activeTool: {
                                      type: 'freedraw',
                                    },
                                  },
                                }}
                                excalidrawAPI={(api) => {
                                  excalidrawApiRef.current = api;
                                  requestAnimationFrame(() => {
                                    if (excalidrawApiRef.current !== api) return;
                                    applyDrawToolToApi(api, drawTool);
                                  });
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
                          <div className="flex flex-wrap gap-2 sm:ml-auto">
                            <button
                              type="button"
                              onClick={() => {
                                setDrawTool((prev) => {
                                  const next = prev === 'pen' ? 'eraser' : 'pen';
                                  const api = excalidrawApiRef?.current;
                                  if (api) {
                                    applyDrawToolToApi(api, next);
                                  }
                                  return next;
                                });
                              }}
                              className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition cursor-pointer text-sm"
                              style={{
                                backgroundColor: drawTool === 'eraser' ? 'var(--clr-btn-danger)' : 'var(--clr-surface-a20)',
                                color: drawTool === 'eraser' ? 'var(--clr-btn-danger-text)' : 'var(--clr-primary-a50)',
                                border: drawTool === 'eraser' ? '1px solid var(--clr-btn-danger-hover)' : '1px solid var(--clr-surface-tonal-a20)',
                              }}
                            >
                              {drawTool === 'eraser' ? <Eraser className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                              <span>{drawTool === 'eraser' ? 'Eraser On' : 'Pen On'}</span>
                            </button>

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
  );
}
