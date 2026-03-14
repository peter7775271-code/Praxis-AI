// @ts-nocheck
'use client';

import React from 'react';
import { ArrowLeft, RefreshCw, Search, X } from 'lucide-react';
import { LatexText, QuestionTextWithDividers } from '../question-text-with-dividers';
import { stripOuterBraces } from '../view-helpers';
import { ComboboxDemo } from '@/components/ui/demo';
import { FilterType as ManageQuestionFilterType } from '@/components/ui/filters';
import { SUBJECTS_BY_YEAR, getPaperKey, getTopics } from '../syllabus-config';

interface Props {
  [key: string]: any;
}

export default function DevQuestionsView({
  question, error, taxonomyGrouped, taxonomyLoading, devTab, allQuestions, loadingQuestions,
  questionsFetchError, deletingQuestionId, manageQuestionDraft, manageQuestionEditMode,
  selectedManageQuestionIds, bulkActionLoading, manageFilters, manageSearchQuery,
  manageFiltersApplied, manageSortKey, manageSortDirection, manageSubView,
  selectedVisibilityExamKey, examVisibilityUpdatingKey, examVisibilityMessage,
  imageMapSelectedPaperKey, imageMapQuestions, imageMapDraftById, imageMapSaving,
  selectedGroupingPaperKey, groupingPaperLoading, groupingPaperMessage,
  selectedVerifySolutionsExamKey, verifySolutionsApplyUpdates, isVerifyingSolutions,
  verifySolutionsStatus, verifySolutionsMessage, verifySolutionsOutput, newQuestion, isAddingQuestion,
  setViewMode, setDevTab, setSelectedManageQuestionId, setManageQuestionDraft,
  setManageQuestionEditMode, setManageFilters, setManageSearchQuery, setManageSortKey,
  setManageSortDirection, setManageSubView, setSelectedVisibilityExamKey,
  setImageMapSelectedPaperKey, setImageMapDraftById, setSelectedGroupingPaperKey,
  setSelectedVerifySolutionsExamKey, setVerifySolutionsApplyUpdates, setNewQuestion,
  manageListScrollYRef,
  isExamIncomplete, customExamGroupByQuestionId, getGroupBadgeLabel, fetchAllQuestions,
  applyManageFilters, beginManageDragSelection, addQuestionToDatabase, deleteQuestion,
  assignSelectedQuestionsToGroup, autoGroupSubpartQuestions, saveImageMapChanges,
  reviewVerifyExamOptions, ALL_TOPICS, availablePapers,
  filteredManageQuestions, filteredManageQuestionIds,
  continueManageDragSelection, setAllManageSelections, setSelectedExamIncomplete,
  fetchTaxonomy, handleClipboardImagePaste, loadImageMapExam, handleGraphPaste, handleGraphUpload,
  openManageImageMap, manageExamBuckets, groupingPaperBuckets, deleteSelectedQuestions,
  clearSelectedMarkingCriteria, clearSelectedQuestionGroups, manageQuestionFilterConfig,
  manageQuestionFilterGroups, hasManageFilters, resetManageFilters, saveManageQuestion,
  runVerifySolutionsReview,
}: Props) {
  return (
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}>
                    <h1 className="text-3xl font-bold" style={{ color: 'var(--clr-primary-a50)' }}>Developer Tools</h1>
                    <button
                      onClick={() => setViewMode('browse')}
                      className="p-2 rounded-lg cursor-pointer"
                      style={{ color: 'var(--clr-surface-a40)' }}
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-4 p-6 border-b" style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}>
                    <button
                      onClick={() => setDevTab('add')}
                      className="px-4 py-2 rounded-lg font-medium transition cursor-pointer"
                      style={{
                        backgroundColor: devTab === 'add' ? 'var(--clr-primary-a0)' : 'transparent',
                        color: devTab === 'add' ? 'var(--clr-dark-a0)' : 'var(--clr-surface-a40)',
                        borderBottom: devTab === 'add' ? `2px solid var(--clr-primary-a0)` : 'none',
                      }}
                    >
                      Add Question
                    </button>
                    <button
                      onClick={() => setDevTab('manage')}
                      className="px-4 py-2 rounded-lg font-medium transition cursor-pointer"
                      style={{
                        backgroundColor: devTab === 'manage' ? 'var(--clr-primary-a0)' : 'transparent',
                        color: devTab === 'manage' ? 'var(--clr-dark-a0)' : 'var(--clr-surface-a40)',
                        borderBottom: devTab === 'manage' ? `2px solid var(--clr-primary-a0)` : 'none',
                      }}
                    >
                      Manage Questions ({allQuestions.length})
                    </button>
                    <button
                      onClick={() => setDevTab('review')}
                      className="px-4 py-2 rounded-lg font-medium transition cursor-pointer"
                      style={{
                        backgroundColor: devTab === 'review' ? 'var(--clr-primary-a0)' : 'transparent',
                        color: devTab === 'review' ? 'var(--clr-dark-a0)' : 'var(--clr-surface-a40)',
                        borderBottom: devTab === 'review' ? `2px solid var(--clr-primary-a0)` : 'none',
                      }}
                    >
                      Review solutions
                    </button>
                  </div>

                  <div className="flex-1 p-8 overflow-y-auto">
                    {devTab === 'add' && (
                      <div className="max-w-2xl">
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clr-primary-a50)' }}>Grade</label>
                            <select
                              value={newQuestion.grade}
                              onChange={(e) => {
                                const nextGrade = e.target.value as 'Year 7' | 'Year 8' | 'Year 9' | 'Year 10' | 'Year 11' | 'Year 12';
                                const nextSubject = SUBJECTS_BY_YEAR[nextGrade][0];
                                const nextTopic = getTopics(nextGrade, nextSubject)[0] || '';
                                setNewQuestion({
                                  ...newQuestion,
                                  grade: nextGrade,
                                  subject: nextSubject,
                                  topic: nextTopic,
                                });
                              }}
                              className="w-full px-4 py-2 rounded-lg border"
                              style={{
                                backgroundColor: 'var(--clr-surface-a0)',
                                borderColor: 'var(--clr-surface-tonal-a20)',
                                color: 'var(--clr-primary-a50)',
                              }}
                            >
                              <option>Year 7</option>
                              <option>Year 8</option>
                              <option>Year 9</option>
                              <option>Year 10</option>
                              <option>Year 11</option>
                              <option>Year 12</option>
                            </select>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clr-primary-a50)' }}>Year</label>
                              <input
                                type="number"
                                value={newQuestion.year}
                                onChange={(e) => setNewQuestion({ ...newQuestion, year: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg border"
                                style={{
                                  backgroundColor: 'var(--clr-surface-a0)',
                                  borderColor: 'var(--clr-surface-tonal-a20)',
                                  color: 'var(--clr-primary-a50)',
                                }}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clr-primary-a50)' }}>Marks</label>
                              <input
                                type="number"
                                value={newQuestion.marks}
                                onChange={(e) => setNewQuestion({ ...newQuestion, marks: parseInt(e.target.value) })}
                                className="w-full px-4 py-2 rounded-lg border"
                                style={{
                                  backgroundColor: 'var(--clr-surface-a0)',
                                  borderColor: 'var(--clr-surface-tonal-a20)',
                                  color: 'var(--clr-primary-a50)',
                                }}
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clr-primary-a50)' }}>Question Type</label>
                            <select
                              value={newQuestion.questionType}
                              onChange={(e) => setNewQuestion({ ...newQuestion, questionType: e.target.value })}
                              className="w-full px-4 py-2 rounded-lg border"
                              style={{
                                backgroundColor: 'var(--clr-surface-a0)',
                                borderColor: 'var(--clr-surface-tonal-a20)',
                                color: 'var(--clr-primary-a50)',
                              }}
                            >
                              <option value="written">Written Response</option>
                              <option value="multiple_choice">Multiple Choice</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clr-primary-a50)' }}>Subject</label>
                            <select
                              value={newQuestion.subject}
                              onChange={(e) => {
                                const nextSubject = e.target.value;
                                const nextTopics = getTopics(newQuestion.grade, nextSubject);
                                setNewQuestion({
                                  ...newQuestion,
                                  subject: nextSubject,
                                  topic: nextTopics[0] || '',
                                });
                              }}
                              className="w-full px-4 py-2 rounded-lg border"
                              style={{
                                backgroundColor: 'var(--clr-surface-a0)',
                                borderColor: 'var(--clr-surface-tonal-a20)',
                                color: 'var(--clr-primary-a50)',
                              }}
                            >
                              {SUBJECTS_BY_YEAR[newQuestion.grade as 'Year 7' | 'Year 8' | 'Year 9' | 'Year 10' | 'Year 11' | 'Year 12']?.map((subject) => (
                                <option key={subject} value={subject}>{subject}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clr-primary-a50)' }}>Topic</label>
                            <select
                              value={newQuestion.topic}
                              onChange={(e) => setNewQuestion({ ...newQuestion, topic: e.target.value })}
                              className="w-full px-4 py-2 rounded-lg border"
                              style={{
                                backgroundColor: 'var(--clr-surface-a0)',
                                borderColor: 'var(--clr-surface-tonal-a20)',
                                color: 'var(--clr-primary-a50)',
                              }}
                            >
                              {(() => {
                                const scopedTopics = getTopics(newQuestion.grade, newQuestion.subject);
                                const current = newQuestion.topic?.trim();
                                const baseOptions = scopedTopics.length > 0 ? scopedTopics : ALL_TOPICS;
                                const options = current && !baseOptions.includes(current) ? [current, ...baseOptions] : baseOptions;
                                return options.map((topic) => <option key={topic} value={topic}>{topic}</option>);
                              })()}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clr-primary-a50)' }}>Question Number</label>
                            <input
                              type="text"
                              value={newQuestion.questionNumber}
                              onChange={(e) => setNewQuestion({ ...newQuestion, questionNumber: e.target.value })}
                              placeholder="e.g., 11 or 11a)"
                              className="w-full px-4 py-2 rounded-lg border"
                              style={{
                                backgroundColor: 'var(--clr-surface-a0)',
                                borderColor: 'var(--clr-surface-tonal-a20)',
                                color: 'var(--clr-primary-a50)',
                              }}
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clr-primary-a50)' }}>Question Text</label>
                            <textarea
                              value={newQuestion.questionText}
                              onChange={(e) => setNewQuestion({ ...newQuestion, questionText: e.target.value })}
                              placeholder="Enter question (use $ for LaTeX)"
                              rows={4}
                              className="w-full px-4 py-2 rounded-lg border"
                              style={{
                                backgroundColor: 'var(--clr-surface-a0)',
                                borderColor: 'var(--clr-surface-tonal-a20)',
                                color: 'var(--clr-primary-a50)',
                              }}
                            />
                          </div>

                          {newQuestion.questionType === 'multiple_choice' ? (
                            <>
                              <div className="space-y-4">
                                <div className="p-3 rounded-lg border" style={{ borderColor: 'var(--clr-surface-tonal-a20)', backgroundColor: 'var(--clr-surface-a05)' }}>
                                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--clr-primary-a50)' }}>Option A</label>
                                  <input type="text" placeholder="Text (LaTeX)" value={newQuestion.mcqOptionA} onChange={(e) => setNewQuestion({ ...newQuestion, mcqOptionA: e.target.value })} className="w-full px-3 py-2 rounded border text-sm mb-2" style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }} />
                                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--clr-surface-a40)' }}>Or image URL (shows image instead of text)</label>
                                  <input type="url" placeholder="https://... or data:image/..." value={newQuestion.mcqOptionAImage} onChange={(e) => setNewQuestion({ ...newQuestion, mcqOptionAImage: e.target.value })} className="w-full px-3 py-2 rounded border text-sm" style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }} />
                                </div>
                                <div className="p-3 rounded-lg border" style={{ borderColor: 'var(--clr-surface-tonal-a20)', backgroundColor: 'var(--clr-surface-a05)' }}>
                                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--clr-primary-a50)' }}>Option B</label>
                                  <input type="text" placeholder="Text (LaTeX)" value={newQuestion.mcqOptionB} onChange={(e) => setNewQuestion({ ...newQuestion, mcqOptionB: e.target.value })} className="w-full px-3 py-2 rounded border text-sm mb-2" style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }} />
                                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--clr-surface-a40)' }}>Or image URL</label>
                                  <input type="url" placeholder="https://... or data:image/..." value={newQuestion.mcqOptionBImage} onChange={(e) => setNewQuestion({ ...newQuestion, mcqOptionBImage: e.target.value })} className="w-full px-3 py-2 rounded border text-sm" style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }} />
                                </div>
                                <div className="p-3 rounded-lg border" style={{ borderColor: 'var(--clr-surface-tonal-a20)', backgroundColor: 'var(--clr-surface-a05)' }}>
                                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--clr-primary-a50)' }}>Option C</label>
                                  <input type="text" placeholder="Text (LaTeX)" value={newQuestion.mcqOptionC} onChange={(e) => setNewQuestion({ ...newQuestion, mcqOptionC: e.target.value })} className="w-full px-3 py-2 rounded border text-sm mb-2" style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }} />
                                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--clr-surface-a40)' }}>Or image URL</label>
                                  <input type="url" placeholder="https://... or data:image/..." value={newQuestion.mcqOptionCImage} onChange={(e) => setNewQuestion({ ...newQuestion, mcqOptionCImage: e.target.value })} className="w-full px-3 py-2 rounded border text-sm" style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }} />
                                </div>
                                <div className="p-3 rounded-lg border" style={{ borderColor: 'var(--clr-surface-tonal-a20)', backgroundColor: 'var(--clr-surface-a05)' }}>
                                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--clr-primary-a50)' }}>Option D</label>
                                  <input type="text" placeholder="Text (LaTeX)" value={newQuestion.mcqOptionD} onChange={(e) => setNewQuestion({ ...newQuestion, mcqOptionD: e.target.value })} className="w-full px-3 py-2 rounded border text-sm mb-2" style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }} />
                                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--clr-surface-a40)' }}>Or image URL</label>
                                  <input type="url" placeholder="https://... or data:image/..." value={newQuestion.mcqOptionDImage} onChange={(e) => setNewQuestion({ ...newQuestion, mcqOptionDImage: e.target.value })} className="w-full px-3 py-2 rounded border text-sm" style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }} />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clr-primary-a50)' }}>Correct Answer</label>
                                  <select
                                    value={newQuestion.mcqCorrectAnswer}
                                    onChange={(e) => setNewQuestion({ ...newQuestion, mcqCorrectAnswer: e.target.value })}
                                    className="w-full px-4 py-2 rounded-lg border"
                                    style={{
                                      backgroundColor: 'var(--clr-surface-a0)',
                                      borderColor: 'var(--clr-surface-tonal-a20)',
                                      color: 'var(--clr-primary-a50)',
                                    }}
                                  >
                                    <option value="A">A</option>
                                    <option value="B">B</option>
                                    <option value="C">C</option>
                                    <option value="D">D</option>
                                  </select>
                                </div>
                              </div>

                              <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clr-primary-a50)' }}>Answer Explanation</label>
                                <textarea
                                  value={newQuestion.mcqExplanation}
                                  onChange={(e) => setNewQuestion({ ...newQuestion, mcqExplanation: e.target.value })}
                                  placeholder="Enter explanation (use $ for LaTeX)"
                                  rows={4}
                                  className="w-full px-4 py-2 rounded-lg border"
                                  style={{
                                    backgroundColor: 'var(--clr-surface-a0)',
                                    borderColor: 'var(--clr-surface-tonal-a20)',
                                    color: 'var(--clr-primary-a50)',
                                  }}
                                />
                              </div>
                            </>
                          ) : (
                            <>
                              <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clr-primary-a50)' }}>Marking Criteria</label>
                                <textarea
                                  value={newQuestion.markingCriteria}
                                  onChange={(e) => setNewQuestion({ ...newQuestion, markingCriteria: e.target.value })}
                                  placeholder="Enter marking criteria (format: criteria - X marks)"
                                  rows={3}
                                  className="w-full px-4 py-2 rounded-lg border"
                                  style={{
                                    backgroundColor: 'var(--clr-surface-a0)',
                                    borderColor: 'var(--clr-surface-tonal-a20)',
                                    color: 'var(--clr-primary-a50)',
                                  }}
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clr-primary-a50)' }}>Sample Answer (LaTeX)</label>
                                <textarea
                                  value={newQuestion.sampleAnswer}
                                  onChange={(e) => setNewQuestion({ ...newQuestion, sampleAnswer: e.target.value })}
                                  placeholder="Enter sample answer (use $ for LaTeX)"
                                  rows={4}
                                  className="w-full px-4 py-2 rounded-lg border"
                                  style={{
                                    backgroundColor: 'var(--clr-surface-a0)',
                                    borderColor: 'var(--clr-surface-tonal-a20)',
                                    color: 'var(--clr-primary-a50)',
                                  }}
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clr-primary-a50)' }}>Sample Answer Image URL</label>
                                <input
                                  type="text"
                                  value={newQuestion.sampleAnswerImage}
                                  onChange={(e) => setNewQuestion({ ...newQuestion, sampleAnswerImage: e.target.value })}
                                  placeholder="https://... or data:image/png;base64,..."
                                  className="w-full px-4 py-2 rounded-lg border"
                                  style={{
                                    backgroundColor: 'var(--clr-surface-a0)',
                                    borderColor: 'var(--clr-surface-tonal-a20)',
                                    color: 'var(--clr-primary-a50)',
                                  }}
                                />
                                <p className="text-xs mt-1" style={{ color: 'var(--clr-surface-a40)' }}>If provided, image will be shown instead of LaTeX text</p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-2 mt-2" style={{ color: 'var(--clr-primary-a50)' }}>Sample Answer Image Size</label>
                                <select
                                  value={newQuestion.sampleAnswerImageSize}
                                  onChange={(e) => setNewQuestion({ ...newQuestion, sampleAnswerImageSize: e.target.value as 'small' | 'medium' | 'large' })}
                                  className="w-full px-4 py-2 rounded-lg border"
                                  style={{
                                    backgroundColor: 'var(--clr-surface-a0)',
                                    borderColor: 'var(--clr-surface-tonal-a20)',
                                    color: 'var(--clr-primary-a50)',
                                  }}
                                >
                                  <option value="small">Small</option>
                                  <option value="medium">Medium</option>
                                  <option value="large">Large</option>
                                </select>
                              </div>
                            </>
                          )}

                          <div>
                            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clr-primary-a50)' }}>Graph Image (data URL)</label>
                            <textarea
                              value={newQuestion.graphImageData}
                              onChange={(e) => setNewQuestion({ ...newQuestion, graphImageData: e.target.value })}
                              onPaste={handleGraphPaste}
                              placeholder="Paste a data:image/png;base64,... URL (optional)"
                              rows={3}
                              className="w-full px-4 py-2 rounded-lg border"
                              style={{
                                backgroundColor: 'var(--clr-surface-a0)',
                                borderColor: 'var(--clr-surface-tonal-a20)',
                                color: 'var(--clr-primary-a50)',
                              }}
                            />
                            <div className="mt-3">
                              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clr-primary-a50)' }}>Graph Size</label>
                              <select
                                value={newQuestion.graphImageSize}
                                onChange={(e) => setNewQuestion({ ...newQuestion, graphImageSize: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg border"
                                style={{
                                  backgroundColor: 'var(--clr-surface-a0)',
                                  borderColor: 'var(--clr-surface-tonal-a20)',
                                  color: 'var(--clr-primary-a50)',
                                }}
                              >
                                <option value="small">Small</option>
                                <option value="medium">Medium</option>
                                <option value="large">Large</option>
                              </select>
                            </div>
                            <div className="mt-3 flex items-center gap-3">
                              <label
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer"
                                style={{
                                  backgroundColor: 'var(--clr-surface-a20)',
                                  color: 'var(--clr-primary-a50)',
                                }}
                              >
                                Upload PNG
                                <input type="file" accept="image/png" hidden onChange={handleGraphUpload} />
                              </label>
                              {newQuestion.graphImageData && (
                                <span className="text-xs" style={{ color: 'var(--clr-surface-a40)' }}>
                                  Image loaded
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex gap-3 pt-4">
                            <button
                              onClick={addQuestionToDatabase}
                              disabled={isAddingQuestion}
                              className="flex-1 px-4 py-3 rounded-lg font-medium cursor-pointer disabled:opacity-50"
                              style={{
                                backgroundColor: 'var(--clr-success-a0)',
                                color: 'var(--clr-light-a0)',
                              }}
                            >
                              {isAddingQuestion ? 'Adding...' : 'Add Question'}
                            </button>
                            <button
                              onClick={() => setViewMode('browse')}
                              className="flex-1 px-4 py-3 rounded-lg font-medium cursor-pointer"
                              style={{
                                backgroundColor: 'var(--clr-surface-a20)',
                                color: 'var(--clr-primary-a50)',
                              }}
                            >
                              Back
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {devTab === 'manage' && (
                      <div className="max-w-6xl">
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-lg font-semibold" style={{ color: 'var(--clr-primary-a50)' }}>Manage Questions</h2>
                        </div>

                        <div className="flex items-center gap-2 mb-6">
                          <button
                            type="button"
                            onClick={() => setManageSubView('list')}
                            className="px-3 py-2 rounded-lg text-sm font-medium cursor-pointer"
                            style={{
                              backgroundColor: manageSubView === 'list' ? 'var(--clr-primary-a0)' : 'var(--clr-surface-a20)',
                              color: manageSubView === 'list' ? 'var(--clr-dark-a0)' : 'var(--clr-primary-a50)',
                            }}
                          >
                            Questions
                          </button>
                          <button
                            type="button"
                            onClick={openManageImageMap}
                            className="px-3 py-2 rounded-lg text-sm font-medium cursor-pointer"
                            style={{
                              backgroundColor: manageSubView === 'image-map' ? 'var(--clr-primary-a0)' : 'var(--clr-surface-a20)',
                              color: manageSubView === 'image-map' ? 'var(--clr-dark-a0)' : 'var(--clr-primary-a50)',
                            }}
                          >
                            Exam Image Mapping
                          </button>
                        </div>

                        {manageSubView === 'list' ? (
                          <div>
                        <div className="mb-4 rounded-xl border p-4" style={{ borderColor: 'var(--clr-surface-tonal-a20)', backgroundColor: 'var(--clr-surface-a05)' }}>
                          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                            <div className="lg:w-[420px]">
                              <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--clr-surface-a40)' }}>
                                Exam Visibility (Dev)
                              </label>
                              <select
                                value={selectedVisibilityExamKey}
                                onChange={(e) => setSelectedVisibilityExamKey(e.target.value)}
                                disabled={!manageExamBuckets.length || !!examVisibilityUpdatingKey}
                                className="w-full px-3 py-2 rounded-lg border text-sm"
                                style={{
                                  backgroundColor: 'var(--clr-surface-a0)',
                                  borderColor: 'var(--clr-surface-tonal-a20)',
                                  color: 'var(--clr-primary-a50)',
                                }}
                              >
                                {manageExamBuckets.length === 0 ? (
                                  <option value="">No exams loaded</option>
                                ) : (
                                  manageExamBuckets.map((exam) => (
                                    <option key={exam.key} value={exam.key}>
                                      {exam.year} • {exam.grade} • {exam.subject} • {exam.school} ({exam.count}) [{exam.status}]
                                    </option>
                                  ))
                                )}
                              </select>
                            </div>

                            <div className="flex items-center gap-2 pt-1 lg:pt-6">
                              <button
                                type="button"
                                onClick={() => setSelectedExamIncomplete(true)}
                                disabled={!selectedVisibilityExamKey || !!examVisibilityUpdatingKey}
                                className="px-3 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50"
                                style={{ backgroundColor: 'var(--clr-warning-a0)', color: 'var(--clr-light-a0)' }}
                              >
                                {examVisibilityUpdatingKey ? 'Updating…' : 'Mark Incomplete'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedExamIncomplete(false)}
                                disabled={!selectedVisibilityExamKey || !!examVisibilityUpdatingKey}
                                className="px-3 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50"
                                style={{ backgroundColor: 'var(--clr-success-a0)', color: 'var(--clr-light-a0)' }}
                              >
                                {examVisibilityUpdatingKey ? 'Updating…' : 'Mark Complete'}
                              </button>
                            </div>
                          </div>
                          {examVisibilityMessage && (
                            <p className="mt-2 text-sm" style={{ color: 'var(--clr-surface-a50)' }}>
                              {examVisibilityMessage}
                            </p>
                          )}
                        </div>

                        <div className="mb-4 rounded-xl border p-4" style={{ borderColor: 'var(--clr-surface-tonal-a20)', backgroundColor: 'var(--clr-surface-a05)' }}>
                          <div className="flex flex-col lg:flex-row lg:items-end gap-3">
                            <div className="lg:w-[520px]">
                              <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--clr-surface-a40)' }}>
                                Auto-Group Paper Subparts
                              </label>
                              <select
                                value={selectedGroupingPaperKey}
                                onChange={(e) => setSelectedGroupingPaperKey(e.target.value)}
                                disabled={!groupingPaperBuckets.length || groupingPaperLoading}
                                className="w-full px-3 py-2 rounded-lg border text-sm"
                                style={{
                                  backgroundColor: 'var(--clr-surface-a0)',
                                  borderColor: 'var(--clr-surface-tonal-a20)',
                                  color: 'var(--clr-primary-a50)',
                                }}
                              >
                                {groupingPaperBuckets.length === 0 ? (
                                  <option value="">No Mathematics or Mathematics Advanced papers loaded</option>
                                ) : (
                                  groupingPaperBuckets.map((paper) => (
                                    <option key={paper.key} value={paper.key}>
                                      {paper.year} • {paper.grade} • {paper.subject} • {paper.school} • {paper.paperNumber == null ? 'No paper #' : `Paper ${paper.paperNumber}`} ({paper.count})
                                    </option>
                                  ))
                                )}
                              </select>
                              <p className="mt-2 text-xs" style={{ color: 'var(--clr-surface-a40)' }}>
                                This groups lettered subparts like 11(a), 11(b), 11(c), and any nested roman numeral parts under the same main question.
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={autoGroupSubpartQuestions}
                              disabled={!selectedGroupingPaperKey || groupingPaperLoading}
                              className="px-3 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50"
                              style={{ backgroundColor: 'var(--clr-primary-a0)', color: 'var(--clr-dark-a0)' }}
                            >
                              {groupingPaperLoading ? 'Grouping…' : 'Auto-Group Selected Paper'}
                            </button>
                          </div>
                          {groupingPaperMessage && (
                            <p className="mt-2 text-sm" style={{ color: 'var(--clr-surface-a50)' }}>
                              {groupingPaperMessage}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 mb-4">
                          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--clr-surface-a50)' }}>
                            <input
                              type="checkbox"
                              checked={
                                filteredManageQuestionIds.length > 0 &&
                                filteredManageQuestionIds.every((id) => selectedManageQuestionIds.includes(id))
                              }
                              onChange={(e) => setAllManageSelections(e.target.checked, filteredManageQuestionIds)}
                              className="h-6 w-6 min-h-6 min-w-6 cursor-pointer shrink-0"
                            />
                            Select all (filtered)
                          </label>
                          <span className="text-xs" style={{ color: 'var(--clr-surface-a40)' }}>
                            {selectedManageQuestionIds.length} selected • {filteredManageQuestions.length} showing of {allQuestions.length}
                          </span>
                          <button
                            onClick={deleteSelectedQuestions}
                            disabled={!selectedManageQuestionIds.length || bulkActionLoading}
                            className="px-3 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50"
                            style={{ backgroundColor: 'var(--clr-danger-a0)', color: 'var(--clr-light-a0)' }}
                          >
                            {bulkActionLoading ? 'Working...' : 'Delete Selected'}
                          </button>
                          <button
                            onClick={clearSelectedMarkingCriteria}
                            disabled={!selectedManageQuestionIds.length || bulkActionLoading}
                            className="px-3 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50"
                            style={{ backgroundColor: 'var(--clr-surface-a20)', color: 'var(--clr-primary-a50)' }}
                          >
                            {bulkActionLoading ? 'Working...' : 'Clear Marking Criteria'}
                          </button>
                          <button
                            onClick={assignSelectedQuestionsToGroup}
                            disabled={!selectedManageQuestionIds.length || bulkActionLoading}
                            className="px-3 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50"
                            style={{ backgroundColor: 'var(--clr-primary-a0)', color: 'var(--clr-dark-a0)' }}
                          >
                            Group Selected
                          </button>
                          <button
                            onClick={clearSelectedQuestionGroups}
                            disabled={!selectedManageQuestionIds.length || bulkActionLoading}
                            className="px-3 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50"
                            style={{ backgroundColor: 'var(--clr-surface-a20)', color: 'var(--clr-primary-a50)' }}
                          >
                            Clear Group
                          </button>
                        </div>

                        <div className="mb-6 rounded-xl border p-4" style={{ borderColor: 'var(--clr-surface-tonal-a20)', backgroundColor: 'var(--clr-surface-a05)' }}>
                          <div className="flex flex-col gap-4">
                            <div className="flex flex-col xl:flex-row xl:items-start gap-3">
                              <div className="relative flex-1 min-w-0 xl:max-w-xl">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--clr-surface-a40)' }} />
                                <input
                                  type="text"
                                  value={manageSearchQuery}
                                  onChange={(e) => setManageSearchQuery(e.target.value)}
                                  placeholder="Search question number, topic, text, school..."
                                  className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm"
                                  style={{
                                    backgroundColor: 'var(--clr-surface-a0)',
                                    borderColor: 'var(--clr-surface-tonal-a20)',
                                    color: 'var(--clr-primary-a50)',
                                  }}
                                />
                              </div>
                              <ComboboxDemo
                                filters={manageFilters}
                                setFilters={setManageFilters}
                                config={manageQuestionFilterConfig}
                                filterGroups={manageQuestionFilterGroups}
                                triggerLabel="Add filter"
                                clearLabel="Clear chips"
                              />
                            </div>

                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                              <div className="flex gap-2 flex-wrap">
                                <select
                                  value={manageSortKey}
                                  onChange={(e) => setManageSortKey(e.target.value as typeof manageSortKey)}
                                  className="px-3 py-2 rounded-lg border text-sm"
                                  style={{
                                    backgroundColor: 'var(--clr-surface-a0)',
                                    borderColor: 'var(--clr-surface-tonal-a20)',
                                    color: 'var(--clr-primary-a50)',
                                  }}
                                >
                                  <option value="question_number">Sort by Question #</option>
                                  <option value="year">Sort by Year</option>
                                  <option value="grade">Sort by Grade</option>
                                  <option value="subject">Sort by Subject</option>
                                  <option value="topic">Sort by Topic</option>
                                  <option value="school">Sort by School</option>
                                  <option value="marks">Sort by Marks</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => setManageSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                                  className="px-3 py-2 rounded-lg border text-sm font-medium"
                                  style={{
                                    backgroundColor: 'var(--clr-surface-a0)',
                                    borderColor: 'var(--clr-surface-tonal-a20)',
                                    color: 'var(--clr-primary-a50)',
                                  }}
                                >
                                  {manageSortDirection === 'asc' ? '↑ Asc' : '↓ Desc'}
                                </button>
                              </div>

                              <div className="flex gap-2 flex-wrap">
                                <button
                                  type="button"
                                  onClick={applyManageFilters}
                                  disabled={loadingQuestions || !hasManageFilters}
                                  className="px-3 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50"
                                  style={{ backgroundColor: 'var(--clr-primary-a0)', color: 'var(--clr-dark-a0)' }}
                                >
                                  {loadingQuestions ? 'Applying…' : 'Apply Filters'}
                                </button>
                                <button
                                  type="button"
                                  onClick={resetManageFilters}
                                  className="px-3 py-2 rounded-lg text-sm font-medium cursor-pointer"
                                  style={{ backgroundColor: 'var(--clr-surface-a20)', color: 'var(--clr-primary-a50)' }}
                                >
                                  Reset Filters
                                </button>
                              </div>
                            </div>

                            <p className="text-xs" style={{ color: 'var(--clr-surface-a40)' }}>
                              Add one or more chips for grade, year, subject, topic, school, question type, or missing images, then apply the filter set to load matching questions.
                            </p>
                          </div>
                        </div>

                        {!manageFiltersApplied ? (
                          <div className="text-center py-12 rounded-xl border" style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}>
                            <p style={{ color: 'var(--clr-surface-a40)' }}>No questions loaded yet.</p>
                            <p className="text-sm mt-2" style={{ color: 'var(--clr-surface-a50)' }}>
                              Apply at least one filter, then click Apply Filters.
                            </p>
                          </div>
                        ) : loadingQuestions ? (
                          <div className="flex items-center justify-center py-12">
                            <div className="text-center">
                              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" style={{ color: 'var(--clr-primary-a50)' }} />
                              <p style={{ color: 'var(--clr-surface-a40)' }}>Loading questions...</p>
                            </div>
                          </div>
                        ) : allQuestions.length === 0 ? (
                          <div className="text-center py-12">
                            {questionsFetchError ? (
                              <>
                                <p style={{ color: 'var(--clr-warning-a10)' }}>Could not load questions</p>
                                <p className="text-sm mt-2 max-w-md mx-auto" style={{ color: 'var(--clr-surface-a50)' }}>{questionsFetchError}</p>
                                <p className="text-xs mt-2" style={{ color: 'var(--clr-surface-a40)' }}>Check .env.local for your Neon database URL</p>
                              </>
                            ) : (
                              <p style={{ color: 'var(--clr-surface-a40)' }}>No questions found</p>
                            )}
                          </div>
                        ) : (
                          <div>
                            {!manageQuestionDraft ? (
                              <div className="space-y-3">
                                {filteredManageQuestions.length === 0 ? (
                                  <div className="text-center py-10">
                                    <p style={{ color: 'var(--clr-surface-a40)' }}>No questions match the current filters</p>
                                  </div>
                                ) : (
                                  filteredManageQuestions.map((q) => {
                                    const isSelected = selectedManageQuestionIds.includes(q.id);
                                    return (
                                      <div
                                        key={q.id}
                                        className="w-full flex items-stretch gap-3"
                                        onMouseEnter={() => continueManageDragSelection(q.id)}
                                      >
                                        <div
                                          className="w-10 rounded-lg border flex items-center justify-center select-none"
                                          style={{
                                            backgroundColor: isSelected ? 'var(--clr-surface-a20)' : 'var(--clr-surface-a10)',
                                            borderColor: 'var(--clr-surface-tonal-a20)',
                                          }}
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            beginManageDragSelection(q.id, !isSelected);
                                          }}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            readOnly
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              beginManageDragSelection(q.id, !isSelected);
                                            }}
                                            className="h-6 w-6 min-h-6 min-w-6 cursor-pointer"
                                          />
                                        </div>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (typeof window !== 'undefined') {
                                              manageListScrollYRef.current = window.scrollY;
                                            }
                                            setSelectedManageQuestionId(q.id);
                                            setManageQuestionDraft(q);
                                            setManageQuestionEditMode(false);
                                          }}
                                          className="flex-1 text-left p-4 rounded-lg border transition-colors"
                                          style={{
                                            backgroundColor: isSelected ? 'var(--clr-surface-a20)' : 'var(--clr-surface-a10)',
                                            borderColor: 'var(--clr-surface-tonal-a20)',
                                          }}
                                        >
                                          <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                              <span className="text-sm font-semibold" style={{ color: 'var(--clr-primary-a50)' }}>{q.subject}</span>
                                              {q.question_number && (
                                                <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--clr-surface-a20)', color: 'var(--clr-surface-a50)' }}>{q.question_number}</span>
                                              )}
                                              {customExamGroupByQuestionId[q.id] && (
                                                <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--clr-primary-a0)', color: 'var(--clr-dark-a0)' }}>
                                                  {getGroupBadgeLabel(customExamGroupByQuestionId[q.id])}
                                                </span>
                                              )}
                                              {!q.graph_image_data && q.graph_image_size === 'missing' && (
                                                <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--clr-warning-a0)', color: 'var(--clr-light-a0)' }}>Missing Image</span>
                                              )}
                                              {isExamIncomplete(q.exam_incomplete) && (
                                                <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--clr-warning-a0)', color: 'var(--clr-light-a0)' }}>
                                                  Incomplete Exam
                                                </span>
                                              )}
                                              <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--clr-surface-a20)', color: 'var(--clr-surface-a50)' }}>{q.year}</span>
                                              {q.school_name && (
                                                <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--clr-surface-a20)', color: 'var(--clr-surface-a50)' }}>{q.school_name}</span>
                                              )}
                                              <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--clr-surface-a20)', color: 'var(--clr-surface-a50)' }}>{q.marks}m</span>
                                            </div>
                                            <p style={{ color: 'var(--clr-surface-a40)' }} className="text-sm">{q.topic}</p>
                                            <p className="text-xs mt-1 line-clamp-1 text-neutral-700">{q.question_text}</p>
                                          </div>
                                        </button>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            ) : (
                              <div className="space-y-6">
                                <button
                                  onClick={() => {
                                    setManageQuestionDraft(null);
                                    setSelectedManageQuestionId(null);
                                    setManageQuestionEditMode(false);
                                    if (typeof window !== 'undefined') {
                                      const savedScrollY = manageListScrollYRef.current;
                                      window.requestAnimationFrame(() => {
                                        window.scrollTo({ top: savedScrollY });
                                      });
                                    }
                                  }}
                                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium cursor-pointer"
                                  style={{ backgroundColor: 'var(--clr-surface-a20)', color: 'var(--clr-primary-a50)' }}
                                >
                                  <ArrowLeft className="w-4 h-4" />
                                  Back to list
                                </button>

                                <div className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--clr-surface-a10)', borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
                                    <div className="space-y-6 min-w-0 overflow-hidden">
                                      <div className="flex items-start justify-between">
                                        <div>
                                          <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--clr-surface-a40)' }}>
                                            {manageQuestionDraft.year} {manageQuestionDraft.school_name || 'HSC'}
                                          </span>
                                          <h3 className="text-2xl font-bold" style={{ color: 'var(--clr-primary-a50)' }}>{manageQuestionDraft.subject}</h3>
                                          <p className="text-sm" style={{ color: 'var(--clr-surface-a40)' }}>{manageQuestionDraft.topic}</p>
                                          {isExamIncomplete(manageQuestionDraft.exam_incomplete) && (
                                            <span className="inline-flex mt-2 text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--clr-warning-a0)', color: 'var(--clr-light-a0)' }}>
                                              Incomplete Exam
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-right">
                                          <span className="block font-bold text-lg" style={{ color: 'var(--clr-primary-a50)' }}>Question {manageQuestionDraft.question_number || ''}</span>
                                          <span className="text-sm" style={{ color: 'var(--clr-surface-a50)' }}>{manageQuestionDraft.marks} Marks</span>
                                        </div>
                                      </div>

                                      <div className="text-lg leading-relaxed space-y-4 font-serif text-neutral-800 min-w-0 break-words">
                                        <QuestionTextWithDividers text={manageQuestionDraft.question_text || ''} />
                                        {manageQuestionDraft.graph_image_data && (
                                          <div className="my-4">
                                            <img
                                              src={manageQuestionDraft.graph_image_data}
                                              alt="Question graph"
                                              className={`rounded-lg border graph-image graph-image--${manageQuestionDraft.graph_image_size || 'medium'}`}
                                              style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}
                                            />
                                          </div>
                                        )}
                                      </div>

                                      {manageQuestionDraft.question_type === 'multiple_choice' && (
                                        <div className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                          <h4 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--clr-surface-a40)' }}>Answer Options</h4>
                                          <div className="space-y-3">
                                            {[
                                              { label: 'A', text: stripOuterBraces(manageQuestionDraft.mcq_option_a || ''), image: manageQuestionDraft.mcq_option_a_image || null },
                                              { label: 'B', text: stripOuterBraces(manageQuestionDraft.mcq_option_b || ''), image: manageQuestionDraft.mcq_option_b_image || null },
                                              { label: 'C', text: stripOuterBraces(manageQuestionDraft.mcq_option_c || ''), image: manageQuestionDraft.mcq_option_c_image || null },
                                              { label: 'D', text: stripOuterBraces(manageQuestionDraft.mcq_option_d || ''), image: manageQuestionDraft.mcq_option_d_image || null },
                                            ].map((opt) => (
                                              <div key={opt.label} className="flex items-start gap-3 rounded-lg border px-4 py-3" style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                                <span className="font-bold text-sm" style={{ color: 'var(--clr-primary-a50)' }}>{opt.label}.</span>
                                                <div className="flex-1 font-serif min-w-0 text-neutral-800">
                                                  {opt.image ? (
                                                    <img src={opt.image} alt={`Option ${opt.label}`} className="max-h-28 max-w-full object-contain rounded" style={{ borderColor: 'var(--clr-surface-tonal-a20)' }} />
                                                  ) : (
                                                    <LatexText text={opt.text || ''} />
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                            {manageQuestionDraft.mcq_correct_answer && (
                                              <p className="text-sm mt-2" style={{ color: 'var(--clr-surface-a50)' }}>Correct: <strong>{manageQuestionDraft.mcq_correct_answer}</strong></p>
                                            )}
                                            {manageQuestionDraft.mcq_explanation && (
                                              <div className="mt-3 pt-3 border-t text-neutral-800" style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                                <h5 className="text-xs font-bold uppercase mb-2" style={{ color: 'var(--clr-surface-a40)' }}>Explanation</h5>
                                                <LatexText text={stripOuterBraces(manageQuestionDraft.mcq_explanation)} />
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      {manageQuestionDraft.marking_criteria && (
                                        <div className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                          <h4 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--clr-surface-a40)' }}>Marking Criteria</h4>
                                          <div className="font-serif text-base leading-relaxed space-y-2 text-neutral-800 min-w-0 break-words">
                                            <LatexText text={manageQuestionDraft.marking_criteria} />
                                          </div>
                                        </div>
                                      )}

                                      {manageQuestionDraft.sample_answer && (
                                        <div className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-success-a10)' }}>
                                          <h4 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--clr-success-a20)' }}>Sample Answer</h4>
                                          <div className="font-serif text-base leading-relaxed space-y-2 text-neutral-800 min-w-0 break-words">
                                            <LatexText text={manageQuestionDraft.sample_answer} />
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    <div className="space-y-3">
                                      <button
                                        onClick={() => setManageQuestionEditMode((prev) => !prev)}
                                        className="w-full px-4 py-2 rounded-lg font-medium cursor-pointer"
                                        style={{ backgroundColor: 'var(--clr-primary-a0)', color: 'var(--clr-dark-a0)' }}
                                      >
                                        {manageQuestionEditMode ? 'Hide LaTeX Editor' : 'Edit LaTeX'}
                                      </button>
                                      <button
                                        onClick={saveManageQuestion}
                                        className="w-full px-4 py-2 rounded-lg font-medium cursor-pointer"
                                        style={{ backgroundColor: 'var(--clr-success-a0)', color: 'var(--clr-light-a0)' }}
                                      >
                                        Save Changes
                                      </button>
                                      <button
                                        onClick={() => deleteQuestion(manageQuestionDraft.id)}
                                        disabled={deletingQuestionId === manageQuestionDraft.id}
                                        className="w-full px-4 py-2 rounded-lg font-medium cursor-pointer disabled:opacity-50"
                                        style={{ backgroundColor: 'var(--clr-danger-a0)', color: 'var(--clr-light-a0)' }}
                                      >
                                        {deletingQuestionId === manageQuestionDraft.id ? 'Deleting...' : 'Delete'}
                                      </button>

                                      {manageQuestionEditMode && (
                                        <div className="mt-4">
                                          <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>Question Number</label>
                                          <input
                                            type="text"
                                            value={manageQuestionDraft.question_number || ''}
                                            onChange={(e) => setManageQuestionDraft({ ...manageQuestionDraft, question_number: e.target.value })}
                                            placeholder="e.g., 11 (a)"
                                            className="mt-2 w-full px-4 py-2 rounded-lg border text-sm"
                                            style={{
                                              backgroundColor: 'var(--clr-surface-a0)',
                                              borderColor: 'var(--clr-surface-tonal-a20)',
                                              color: 'var(--clr-primary-a50)',
                                            }}
                                          />
                                          <label className="text-sm font-medium mt-4 block" style={{ color: 'var(--clr-surface-a50)' }}>Marks</label>
                                          <input
                                            type="number"
                                            min={0}
                                            step={1}
                                            value={manageQuestionDraft.marks ?? 0}
                                            onChange={(e) => {
                                              const parsed = Number.parseInt(e.target.value, 10);
                                              setManageQuestionDraft({
                                                ...manageQuestionDraft,
                                                marks: Number.isNaN(parsed) ? 0 : Math.max(0, parsed),
                                              });
                                            }}
                                            className="mt-2 w-full px-4 py-2 rounded-lg border text-sm"
                                            style={{
                                              backgroundColor: 'var(--clr-surface-a0)',
                                              borderColor: 'var(--clr-surface-tonal-a20)',
                                              color: 'var(--clr-primary-a50)',
                                            }}
                                          />
                                          <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>Topic</label>
                                          <select
                                            value={manageQuestionDraft.topic || ''}
                                            onChange={(e) => setManageQuestionDraft({ ...manageQuestionDraft, topic: e.target.value, subtopic: '', syllabus_dot_point: '' })}
                                            className="mt-2 w-full px-4 py-2 rounded-lg border text-sm"
                                            style={{
                                              backgroundColor: 'var(--clr-surface-a0)',
                                              borderColor: 'var(--clr-surface-tonal-a20)',
                                              color: 'var(--clr-primary-a50)',
                                            }}
                                          >
                                            {(() => {
                                              const current = manageQuestionDraft.topic?.trim();
                                              const options = current && !ALL_TOPICS.includes(current) ? [current, ...ALL_TOPICS] : ALL_TOPICS;
                                              return options.map((t: string) => <option key={t} value={t}>{t}</option>);
                                            })()}
                                          </select>

                                          {/* Subtopic cascading dropdown */}
                                          <label className="text-sm font-medium mt-4 block" style={{ color: 'var(--clr-surface-a50)' }}>Subtopic</label>
                                          {Object.keys(taxonomyGrouped).length === 0 ? (
                                            <div className="mt-2 flex items-center gap-2">
                                              <button
                                                type="button"
                                                onClick={() => fetchTaxonomy(manageQuestionDraft.grade, manageQuestionDraft.subject)}
                                                disabled={taxonomyLoading}
                                                className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-50"
                                                style={{ backgroundColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }}
                                              >
                                                {taxonomyLoading ? 'Loading…' : 'Load taxonomy'}
                                              </button>
                                              <input
                                                type="text"
                                                value={manageQuestionDraft.subtopic || ''}
                                                onChange={(e) => setManageQuestionDraft({ ...manageQuestionDraft, subtopic: e.target.value })}
                                                placeholder="Type subtopic or load taxonomy"
                                                className="flex-1 px-4 py-2 rounded-lg border text-sm"
                                                style={{
                                                  backgroundColor: 'var(--clr-surface-a0)',
                                                  borderColor: 'var(--clr-surface-tonal-a20)',
                                                  color: 'var(--clr-primary-a50)',
                                                }}
                                              />
                                            </div>
                                          ) : (
                                            <select
                                              value={manageQuestionDraft.subtopic || ''}
                                              onChange={(e) => setManageQuestionDraft({ ...manageQuestionDraft, subtopic: e.target.value, syllabus_dot_point: '' })}
                                              className="mt-2 w-full px-4 py-2 rounded-lg border text-sm"
                                              style={{
                                                backgroundColor: 'var(--clr-surface-a0)',
                                                borderColor: 'var(--clr-surface-tonal-a20)',
                                                color: 'var(--clr-primary-a50)',
                                              }}
                                            >
                                              <option value="">— Select subtopic —</option>
                                              {(() => {
                                                const topicData = taxonomyGrouped[manageQuestionDraft.topic || ''] || {};
                                                const subtopics = Object.keys(topicData);
                                                const current = manageQuestionDraft.subtopic?.trim();
                                                if (current && !subtopics.includes(current)) subtopics.unshift(current);
                                                return subtopics.map((st: string) => <option key={st} value={st}>{st}</option>);
                                              })()}
                                            </select>
                                          )}

                                          {/* Dot Point cascading dropdown */}
                                          <label className="text-sm font-medium mt-4 block" style={{ color: 'var(--clr-surface-a50)' }}>Syllabus Dot Point</label>
                                          {(() => {
                                            const topic = manageQuestionDraft.topic || '';
                                            const subtopic = manageQuestionDraft.subtopic || '';
                                            const dotPoints: { id: string; text: string }[] = (taxonomyGrouped[topic]?.[subtopic]) || [];
                                            if (dotPoints.length > 0) {
                                              return (
                                                <select
                                                  value={manageQuestionDraft.syllabus_dot_point || ''}
                                                  onChange={(e) => setManageQuestionDraft({ ...manageQuestionDraft, syllabus_dot_point: e.target.value })}
                                                  className="mt-2 w-full px-4 py-2 rounded-lg border text-sm"
                                                  style={{
                                                    backgroundColor: 'var(--clr-surface-a0)',
                                                    borderColor: 'var(--clr-surface-tonal-a20)',
                                                    color: 'var(--clr-primary-a50)',
                                                  }}
                                                >
                                                  <option value="">— Select dot point —</option>
                                                  {(() => {
                                                    const dotPointTexts = dotPoints.map((dp) => dp.text);
                                                    const current = manageQuestionDraft.syllabus_dot_point?.trim();
                                                    const allDots = current && !dotPointTexts.includes(current) ? [current, ...dotPointTexts] : dotPointTexts;
                                                    return allDots.map((dp: string) => <option key={dp} value={dp}>{dp}</option>);
                                                  })()}
                                                </select>
                                              );
                                            }
                                            return (
                                              <input
                                                type="text"
                                                value={manageQuestionDraft.syllabus_dot_point || ''}
                                                onChange={(e) => setManageQuestionDraft({ ...manageQuestionDraft, syllabus_dot_point: e.target.value })}
                                                placeholder={subtopic ? 'No dot points in taxonomy — type manually' : 'Select a subtopic first, or type manually'}
                                                className="mt-2 w-full px-4 py-2 rounded-lg border text-sm"
                                                style={{
                                                  backgroundColor: 'var(--clr-surface-a0)',
                                                  borderColor: 'var(--clr-surface-tonal-a20)',
                                                  color: 'var(--clr-primary-a50)',
                                                }}
                                              />
                                            );
                                          })()}
                                          <label className="text-sm font-medium mt-4 block" style={{ color: 'var(--clr-surface-a50)' }}>Question (LaTeX)</label>
                                          <textarea
                                            value={manageQuestionDraft.question_text || ''}
                                            onChange={(e) => setManageQuestionDraft({ ...manageQuestionDraft, question_text: e.target.value })}
                                            rows={10}
                                            className="mt-2 w-full px-4 py-2 rounded-lg border font-mono text-sm"
                                            style={{
                                              backgroundColor: 'var(--clr-surface-a0)',
                                              borderColor: 'var(--clr-surface-tonal-a20)',
                                              color: 'var(--clr-primary-a50)',
                                            }}
                                          />
                                          <label className="text-sm font-medium mt-4 block" style={{ color: 'var(--clr-surface-a50)' }}>Marking Criteria (LaTeX)</label>
                                          <textarea
                                            value={manageQuestionDraft.marking_criteria || ''}
                                            onChange={(e) => setManageQuestionDraft({ ...manageQuestionDraft, marking_criteria: e.target.value })}
                                            rows={6}
                                            className="mt-2 w-full px-4 py-2 rounded-lg border font-mono text-sm"
                                            style={{
                                              backgroundColor: 'var(--clr-surface-a0)',
                                              borderColor: 'var(--clr-surface-tonal-a20)',
                                              color: 'var(--clr-primary-a50)',
                                            }}
                                          />
                                          <label className="text-sm font-medium mt-4 block" style={{ color: 'var(--clr-surface-a50)' }}>Sample Answer (LaTeX)</label>
                                          <textarea
                                            value={manageQuestionDraft.sample_answer || ''}
                                            onChange={(e) => setManageQuestionDraft({ ...manageQuestionDraft, sample_answer: e.target.value })}
                                            rows={6}
                                            className="mt-2 w-full px-4 py-2 rounded-lg border font-mono text-sm"
                                            style={{
                                              backgroundColor: 'var(--clr-surface-a0)',
                                              borderColor: 'var(--clr-surface-tonal-a20)',
                                              color: 'var(--clr-primary-a50)',
                                            }}
                                          />
                                          <label className="text-sm font-medium mt-4 block" style={{ color: 'var(--clr-surface-a50)' }}>Sample Answer Image URL</label>
                                          <input
                                            type="text"
                                            value={manageQuestionDraft.sample_answer_image || ''}
                                            onChange={(e) => setManageQuestionDraft({ ...manageQuestionDraft, sample_answer_image: e.target.value })}
                                            placeholder="https://... or data:image/png;base64,..."
                                            className="mt-2 w-full px-4 py-2 rounded-lg border text-sm"
                                            style={{
                                              backgroundColor: 'var(--clr-surface-a0)',
                                              borderColor: 'var(--clr-surface-tonal-a20)',
                                              color: 'var(--clr-primary-a50)',
                                            }}
                                          />
                                          <p className="text-xs mt-1" style={{ color: 'var(--clr-surface-a40)' }}>If provided, image will be shown instead of LaTeX text</p>
                                          <label className="text-sm font-medium mt-4 block" style={{ color: 'var(--clr-surface-a50)' }}>Sample Answer Image Size</label>
                                          <select
                                            value={manageQuestionDraft.sample_answer_image_size || 'medium'}
                                            onChange={(e) => setManageQuestionDraft({ ...manageQuestionDraft, sample_answer_image_size: e.target.value })}
                                            className="mt-2 w-full px-4 py-2 rounded-lg border text-sm"
                                            style={{
                                              backgroundColor: 'var(--clr-surface-a0)',
                                              borderColor: 'var(--clr-surface-tonal-a20)',
                                              color: 'var(--clr-primary-a50)',
                                            }}
                                          >
                                            <option value="small">Small</option>
                                            <option value="medium">Medium</option>
                                            <option value="large">Large</option>
                                          </select>
                                          <label className="text-sm font-medium mt-4 block" style={{ color: 'var(--clr-surface-a50)' }}>Graph Image URL</label>
                                          <input
                                            type="text"
                                            value={manageQuestionDraft.graph_image_data || ''}
                                            onChange={(e) => {
                                              const nextUrl = e.target.value;
                                              setManageQuestionDraft({
                                                ...manageQuestionDraft,
                                                graph_image_data: nextUrl,
                                                graph_image_size: nextUrl ? (manageQuestionDraft.graph_image_size || 'medium') : manageQuestionDraft.graph_image_size,
                                              });
                                            }}
                                            placeholder="https://... or data:image/png;base64,..."
                                            className="mt-2 w-full px-4 py-2 rounded-lg border text-sm"
                                            style={{
                                              backgroundColor: 'var(--clr-surface-a0)',
                                              borderColor: 'var(--clr-surface-tonal-a20)',
                                              color: 'var(--clr-primary-a50)',
                                            }}
                                          />
                                          <label className="text-sm font-medium mt-4 block" style={{ color: 'var(--clr-surface-a50)' }}>Graph Image Size</label>
                                          <select
                                            value={manageQuestionDraft.graph_image_size || 'medium'}
                                            onChange={(e) => setManageQuestionDraft({ ...manageQuestionDraft, graph_image_size: e.target.value })}
                                            className="mt-2 w-full px-4 py-2 rounded-lg border text-sm"
                                            style={{
                                              backgroundColor: 'var(--clr-surface-a0)',
                                              borderColor: 'var(--clr-surface-tonal-a20)',
                                              color: 'var(--clr-primary-a50)',
                                            }}
                                          >
                                            <option value="small">Small</option>
                                            <option value="medium">Medium</option>
                                            <option value="large">Large</option>
                                            <option value="missing">Missing</option>
                                          </select>

                                          {manageQuestionDraft.question_type === 'multiple_choice' && (
                                            <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                              <h5 className="text-sm font-bold mb-3" style={{ color: 'var(--clr-surface-a50)' }}>MCQ Options (text or image URL)</h5>
                                              <div className="space-y-4">
                                                {[
                                                  { key: 'A', text: 'mcq_option_a', image: 'mcq_option_a_image' },
                                                  { key: 'B', text: 'mcq_option_b', image: 'mcq_option_b_image' },
                                                  { key: 'C', text: 'mcq_option_c', image: 'mcq_option_c_image' },
                                                  { key: 'D', text: 'mcq_option_d', image: 'mcq_option_d_image' },
                                                ].map(({ key, text, image }) => (
                                                  <div key={key} className="p-3 rounded border" style={{ borderColor: 'var(--clr-surface-tonal-a20)', backgroundColor: 'var(--clr-surface-a05)' }}>
                                                    <label className="block text-xs font-medium mb-1">Option {key}</label>
                                                    <input type="text" placeholder="Text (LaTeX)" value={manageQuestionDraft[text] || ''} onChange={(e) => setManageQuestionDraft({ ...manageQuestionDraft, [text]: e.target.value })} className="w-full px-3 py-2 rounded border text-sm mb-2" style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }} />
                                                    <input type="url" placeholder="Or image URL" value={manageQuestionDraft[image] || ''} onChange={(e) => setManageQuestionDraft({ ...manageQuestionDraft, [image]: e.target.value })} className="w-full px-3 py-2 rounded border text-sm" style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }} />
                                                  </div>
                                                ))}
                                                <div>
                                                  <label className="block text-xs font-medium mb-1">Correct Answer</label>
                                                  <select value={manageQuestionDraft.mcq_correct_answer || 'A'} onChange={(e) => setManageQuestionDraft({ ...manageQuestionDraft, mcq_correct_answer: e.target.value })} className="w-full px-3 py-2 rounded border text-sm" style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }}>
                                                    <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
                                                  </select>
                                                </div>
                                                <div>
                                                  <label className="block text-xs font-medium mb-1">Explanation (LaTeX)</label>
                                                  <textarea value={manageQuestionDraft.mcq_explanation || ''} onChange={(e) => setManageQuestionDraft({ ...manageQuestionDraft, mcq_explanation: e.target.value })} rows={3} className="w-full px-3 py-2 rounded border text-sm" style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }} />
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                          </div>
                        ) : (
                          <div className="space-y-6">
                            <div className="rounded-xl border p-4" style={{ backgroundColor: 'var(--clr-surface-a10)', borderColor: 'var(--clr-surface-tonal-a20)' }}>
                              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
                                <div>
                                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clr-surface-a50)' }}>Exam</label>
                                  <select
                                    value={imageMapSelectedPaperKey}
                                    onChange={(e) => {
                                      const nextKey = e.target.value;
                                      setImageMapSelectedPaperKey(nextKey);
                                      loadImageMapExam(nextKey);
                                    }}
                                    disabled={loadingQuestions || availablePapers.length === 0}
                                    className="w-full px-3 py-2 rounded-lg border text-sm"
                                    style={{
                                      backgroundColor: 'var(--clr-surface-a0)',
                                      borderColor: 'var(--clr-surface-tonal-a20)',
                                      color: 'var(--clr-primary-a50)',
                                    }}
                                  >
                                    {availablePapers.length === 0 ? (
                                      <option value="">No exams loaded</option>
                                    ) : (
                                      availablePapers.map((paper) => (
                                        <option key={getPaperKey(paper)} value={getPaperKey(paper)}>
                                          {paper.year} • {paper.grade} • {paper.subject} • {paper.school} ({paper.count})
                                        </option>
                                      ))
                                    )}
                                  </select>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void fetchAllQuestions();
                                  }}
                                  disabled={loadingQuestions}
                                  className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50"
                                  style={{ backgroundColor: 'var(--clr-surface-a20)', color: 'var(--clr-primary-a50)' }}
                                >
                                  {loadingQuestions ? 'Loading…' : 'Reload Exams'}
                                </button>
                              </div>
                            </div>

                            {loadingQuestions ? (
                              <div className="py-10 text-center" style={{ color: 'var(--clr-surface-a40)' }}>Loading exam questions...</div>
                            ) : imageMapQuestions.length === 0 ? (
                              <div className="py-10 text-center rounded-xl border" style={{ color: 'var(--clr-surface-a40)', borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                Select an exam to edit image data.
                              </div>
                            ) : (
                              <>
                                <div className="space-y-4">
                                  {imageMapQuestions.map((question) => {
                                    const draft = imageMapDraftById[question.id] || {
                                      graph_image_data: '',
                                      sample_answer_image: '',
                                      mcq_option_a_image: '',
                                      mcq_option_b_image: '',
                                      mcq_option_c_image: '',
                                      mcq_option_d_image: '',
                                      mcq_correct_answer: 'A' as 'A' | 'B' | 'C' | 'D',
                                    };

                                    const setDraftField = (field: keyof typeof draft, value: string) => {
                                      setImageMapDraftById((prev) => ({
                                        ...prev,
                                        [question.id]: {
                                          ...draft,
                                          [field]: value,
                                        },
                                      }));
                                    };

                                    return (
                                      <div
                                        key={question.id}
                                        className="rounded-xl border p-4 space-y-3"
                                        style={{ backgroundColor: 'var(--clr-surface-a10)', borderColor: 'var(--clr-surface-tonal-a20)' }}
                                      >
                                        <div className="text-sm font-semibold" style={{ color: 'var(--clr-primary-a50)' }}>
                                          Question {question.question_number || '?'}
                                        </div>

                                        <div>
                                          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--clr-surface-a50)' }}>Question Image</label>
                                          <textarea
                                            value={draft.graph_image_data}
                                            onChange={(e) => setDraftField('graph_image_data', e.target.value)}
                                            onPaste={(e) => handleClipboardImagePaste(e, (dataUrl) => setDraftField('graph_image_data', dataUrl))}
                                            rows={2}
                                            placeholder="Paste image directly, or paste data:image/... / URL"
                                            className="w-full px-3 py-2 rounded-lg border text-xs"
                                            style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }}
                                          />
                                        </div>

                                        <div>
                                          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--clr-surface-a50)' }}>Sample Answer Image</label>
                                          <textarea
                                            value={draft.sample_answer_image}
                                            onChange={(e) => setDraftField('sample_answer_image', e.target.value)}
                                            onPaste={(e) => handleClipboardImagePaste(e, (dataUrl) => setDraftField('sample_answer_image', dataUrl))}
                                            rows={2}
                                            placeholder="Paste image directly, or paste data:image/... / URL"
                                            className="w-full px-3 py-2 rounded-lg border text-xs"
                                            style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }}
                                          />
                                        </div>

                                        {question.question_type === 'multiple_choice' && (
                                          <div className="space-y-2 pt-1">
                                            <div className="text-xs font-semibold" style={{ color: 'var(--clr-surface-a50)' }}>MCQ Option Images</div>
                                            {([
                                              ['A', 'mcq_option_a_image'],
                                              ['B', 'mcq_option_b_image'],
                                              ['C', 'mcq_option_c_image'],
                                              ['D', 'mcq_option_d_image'],
                                            ] as Array<['A' | 'B' | 'C' | 'D', 'mcq_option_a_image' | 'mcq_option_b_image' | 'mcq_option_c_image' | 'mcq_option_d_image']>).map(([label, field]) => (
                                              <div key={field}>
                                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--clr-surface-a50)' }}>Option {label} Image</label>
                                                <textarea
                                                  value={draft[field]}
                                                  onChange={(e) => setDraftField(field, e.target.value)}
                                                  onPaste={(e) => handleClipboardImagePaste(e, (dataUrl) => setDraftField(field, dataUrl))}
                                                  rows={2}
                                                  placeholder="Paste image directly, or paste data:image/... / URL"
                                                  className="w-full px-3 py-2 rounded-lg border text-xs"
                                                  style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }}
                                                />
                                              </div>
                                            ))}

                                            <div>
                                              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--clr-surface-a50)' }}>Correct MCQ Answer</label>
                                              <select
                                                value={draft.mcq_correct_answer}
                                                onChange={(e) => setDraftField('mcq_correct_answer', e.target.value as 'A' | 'B' | 'C' | 'D')}
                                                className="w-full px-3 py-2 rounded-lg border text-sm"
                                                style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)', color: 'var(--clr-primary-a50)' }}
                                              >
                                                <option value="A">A</option>
                                                <option value="B">B</option>
                                                <option value="C">C</option>
                                                <option value="D">D</option>
                                              </select>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>

                                <div className="pt-2">
                                  <button
                                    type="button"
                                    onClick={saveImageMapChanges}
                                    disabled={imageMapSaving}
                                    className="w-full px-4 py-3 rounded-lg font-semibold cursor-pointer disabled:opacity-50"
                                    style={{ backgroundColor: 'var(--clr-success-a0)', color: 'var(--clr-light-a0)' }}
                                  >
                                    {imageMapSaving ? 'Saving...' : 'Save'}
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {devTab === 'review' && (
                      <div className="max-w-4xl mx-auto">
                        <p className="text-sm mb-6" style={{ color: 'var(--clr-surface-a50)' }}>
                          Sample solutions in order (same filters as Manage). Compare with your actual solutions to verify correctness.
                        </p>

                        <div
                          className="mb-6 rounded-2xl border p-4 space-y-4"
                          style={{
                            backgroundColor: 'var(--clr-surface-a10)',
                            borderColor: 'var(--clr-surface-tonal-a20)',
                          }}
                        >
                          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
                            <div>
                              <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>
                                Verify Exam
                              </label>
                              <select
                                value={selectedVerifySolutionsExamKey}
                                onChange={(e) => setSelectedVerifySolutionsExamKey(e.target.value)}
                                disabled={isVerifyingSolutions || reviewVerifyExamOptions.length === 0}
                                className="mt-2 w-full px-4 py-2 rounded-lg border"
                                style={{
                                  backgroundColor: 'var(--clr-surface-a0)',
                                  borderColor: 'var(--clr-surface-tonal-a20)',
                                  color: 'var(--clr-primary-a50)',
                                }}
                              >
                                {reviewVerifyExamOptions.length === 0 ? (
                                  <option value="">No exam with paper number available</option>
                                ) : (
                                  reviewVerifyExamOptions.map((option) => (
                                    <option key={option.key} value={option.key}>
                                      {option.year} • {option.grade} • {option.subject} • {option.schoolName} • Paper {option.paperNumber} ({option.count} questions)
                                    </option>
                                  ))
                                )}
                              </select>
                            </div>

                            <button
                              type="button"
                              onClick={runVerifySolutionsReview}
                              disabled={isVerifyingSolutions || reviewVerifyExamOptions.length === 0 || !selectedVerifySolutionsExamKey}
                              className="px-4 py-2 rounded-lg font-medium cursor-pointer disabled:opacity-50"
                              style={{
                                backgroundColor: 'var(--clr-primary-a0)',
                                color: 'var(--clr-dark-a0)',
                              }}
                            >
                              {isVerifyingSolutions
                                ? 'Verifying...'
                                : verifySolutionsApplyUpdates
                                  ? 'Verify + Apply Updates'
                                  : 'Verify (Dry Run)'}
                            </button>
                          </div>

                          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--clr-surface-a50)' }}>
                            <input
                              type="checkbox"
                              checked={verifySolutionsApplyUpdates}
                              onChange={(e) => setVerifySolutionsApplyUpdates(e.target.checked)}
                              disabled={isVerifyingSolutions}
                            />
                            Apply corrected sample answers to database
                          </label>

                          {verifySolutionsMessage && (
                            <p
                              className="text-sm"
                              style={{
                                color:
                                  verifySolutionsStatus === 'error'
                                    ? 'var(--clr-danger-a10)'
                                    : verifySolutionsStatus === 'success'
                                      ? 'var(--clr-success-a10)'
                                      : 'var(--clr-surface-a50)',
                              }}
                            >
                              {verifySolutionsMessage}
                            </p>
                          )}

                          {verifySolutionsOutput && (
                            <details>
                              <summary className="text-sm font-medium cursor-pointer" style={{ color: 'var(--clr-surface-a50)' }}>
                                Verification response details
                              </summary>
                              <pre
                                className="mt-2 p-3 rounded-lg text-xs whitespace-pre-wrap break-words"
                                style={{
                                  backgroundColor: 'var(--clr-dark-a0)',
                                  color: 'var(--clr-light-a0)',
                                }}
                              >
                                {JSON.stringify(verifySolutionsOutput, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>

                        {loadingQuestions ? (
                          <div className="py-12 text-center" style={{ color: 'var(--clr-surface-a40)' }}>Loading questions…</div>
                        ) : filteredManageQuestions.length === 0 ? (
                          <div className="py-12 text-center rounded-xl border" style={{ color: 'var(--clr-surface-a40)', borderColor: 'var(--clr-surface-tonal-a20)' }}>
                            No questions to review. Add questions or adjust filters in Manage.
                          </div>
                        ) : (
                          <div className="space-y-8">
                            {filteredManageQuestions.map((q, index) => (
                              <article
                                key={q.id}
                                className="rounded-2xl border overflow-hidden"
                                style={{ backgroundColor: 'var(--clr-surface-a0)', borderColor: 'var(--clr-surface-tonal-a20)' }}
                              >
                                <div className="px-5 py-3 border-b flex flex-wrap items-center gap-x-4 gap-y-1" style={{ borderColor: 'var(--clr-surface-tonal-a20)', backgroundColor: 'var(--clr-surface-a05)' }}>
                                  <span className="font-semibold text-neutral-800">
                                    #{index + 1} · Q{q.question_number ?? '?'}
                                  </span>
                                  <span className="text-sm text-neutral-600">{q.year} {q.school_name || 'HSC'}</span>
                                  <span className="text-sm text-neutral-600">{q.subject}</span>
                                  <span className="text-sm text-neutral-600">{q.topic}</span>
                                  {q.question_type === 'multiple_choice' && (
                                    <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--clr-surface-a20)', color: 'var(--clr-surface-a50)' }}>MCQ</span>
                                  )}
                                </div>
                                <div className="p-5">
                                  <details className="mb-4">
                                    <summary className="text-sm font-medium cursor-pointer" style={{ color: 'var(--clr-surface-a50)' }}>Question text</summary>
                                    <div className="mt-2 font-serif text-sm leading-relaxed text-neutral-800 border-l-2 pl-4" style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}>
                                      <LatexText text={q.question_text || ''} />
                                    </div>
                                  </details>
                                  <div className="rounded-xl border p-4" style={{ borderColor: 'var(--clr-success-a10)', backgroundColor: 'var(--clr-surface-a05)' }}>
                                    <h4 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--clr-success-a20)' }}>Sample solution</h4>
                                    {q.sample_answer ? (
                                      <div className="font-serif text-base leading-relaxed space-y-2 text-neutral-800">
                                        <LatexText text={q.sample_answer} />
                                      </div>
                                    ) : q.question_type === 'multiple_choice' ? (
                                      <div className="text-neutral-700">
                                        <p className="font-medium">Correct: {q.mcq_correct_answer ?? '—'}</p>
                                        {q.mcq_explanation && (
                                          <div className="mt-2 font-serif text-sm">
                                            <LatexText text={stripOuterBraces(q.mcq_explanation)} />
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <p className="text-sm italic" style={{ color: 'var(--clr-surface-a40)' }}>No sample answer</p>
                                    )}
                                  </div>
                                </div>
                              </article>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
  );
}
