// @ts-nocheck
'use client';

import React from 'react';
import {
  ArrowLeft, BookOpen, ChevronRight, ChevronLeft, RefreshCw, Eye, Download, Bookmark,
  CheckCircle2, XCircle, TrendingUp, Edit2, Target, ChevronDown, ChevronUp,
  PanelLeftClose, PanelLeftOpen, Award, Clock, Hash
} from 'lucide-react';
import { LatexText, QuestionTextWithDividers } from '../question-text-with-dividers';
import { parseCriteriaForDisplay, stripOuterBraces } from '../view-helpers';
import CustomExamView from '../exam/CustomExamView';

interface Props {
  [key: string]: any;
}

export default function SavedView({
  savedAttempts, selectedAttempt, exportingSavedExamPdf, examAttempts,
  savedExamReviewMode, savedExamReviewIndex, savedQuestionsListExpanded,
  savedReviewSidebarCollapsed, isDevMode, feedback, submittedAnswer, question,
  setSelectedAttempt, setViewMode, setSavedExamReviewMode, setSavedExamReviewIndex,
  setSavedQuestionsListExpanded, setSavedReviewSidebarCollapsed, setDevTab,
  setSelectedManageQuestionId, setManageQuestionDraft, setManageQuestionEditMode,
  exportSavedExamPdf, openSavedExamAsPaper, removeSavedAttempt,
}: Props) {
  return (
                <>
                  {/* Saved Attempts View */}
                  <div className="flex flex-col gap-2 mb-8">
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
                                onClick={() => exportSavedExamPdf(false, true)}
                                disabled={exportingSavedExamPdf !== null}
                                className="flex items-center gap-2 px-5 py-3 rounded-lg font-medium border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                style={{ backgroundColor: '#fffbeb', borderColor: '#f59e0b', color: '#92400e' }}
                              >
                                <Download className="w-5 h-5" />
                                {exportingSavedExamPdf === 'autofix' ? 'Auto-fixing…' : 'Export PDF (Auto-fix LaTeX)'}
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
                                  onClick={() => {
                                    if (isExam) {
                                      openSavedExamAsPaper(attempt);
                                      return;
                                    }
                                    setSelectedAttempt(attempt);
                                    setSavedExamReviewMode(false);
                                    setSavedQuestionsListExpanded(false);
                                  }}
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
                                  View in Exam Viewer
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
  );
}
