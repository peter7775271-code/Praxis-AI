// @ts-nocheck
'use client';

import React from 'react';
import { X } from 'lucide-react';
import { BROWSE_YEARS as YEARS, SUBJECTS_BY_YEAR, CURRENT_EXAM_YEAR, MIN_EXAM_YEAR, getPaperKey } from '../syllabus-config';

interface Props {
  [key: string]: any;
}

export default function SettingsView({
  question, error, examPdfFile, examImageFiles, pdfStatus, pdfMessage, pdfChatGptResponse,
  pdfRawInputs, pdfGrade, pdfYear, pdfSubject, pdfOverwrite, pdfGenerateCriteria,
  pdfAutoGroupSubparts, pdfSchoolName, pdfPaperNumber, selectedSyllabusMappingPaper,
  isMappingSyllabusDotPoints, syllabusMappingResult, syllabusMappingStatus,
  syllabusMappingProgress, syllabusMappingDebugOutputs, syllabusWorkflowTestInput,
  isRunningSyllabusWorkflowTest, syllabusWorkflowTestStatus, syllabusWorkflowTestResult,
  syllabusWorkflowTestOutput, syllabusImportText, syllabusImportSubject, syllabusImportGrade,
  syllabusImporting, syllabusImportResult, syllabusImportStatus, userEmail, userCreatedAt,
  userName, userNameDraft, isSavingName, isDevMode, loadingQuestions,
  setExamPdfFile, setCriteriaPdfFile, setExamImageFiles, setPdfGrade, setPdfYear, setPdfSubject,
  setPdfOverwrite, setPdfGenerateCriteria, setPdfAutoGroupSubparts, setPdfSchoolName, setPdfPaperNumber,
  setSelectedSyllabusMappingPaper, setSyllabusWorkflowTestInput, setSyllabusImportText,
  setSyllabusImportSubject, setSyllabusImportGrade, setViewMode, setUserNameDraft,
  pdfYearRef, fetchAllQuestions, availablePapers,
  handleSaveName, runSyllabusWorkflowTest, runSyllabusDotPointMapping, runSyllabusImport,
  submitPdfPair,
}: Props) {
  return (
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--clr-surface-tonal-a20)' }}>
                    <h1 className="text-3xl font-bold" style={{ color: 'var(--clr-primary-a50)' }}>Settings</h1>
                    <button
                      onClick={() => setViewMode('browse')}
                      className="p-2 rounded-lg cursor-pointer"
                      style={{ color: 'var(--clr-surface-a40)' }}
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="flex-1 p-8 overflow-y-auto">
                    <div className="max-w-2xl">
                      <div
                        className="p-6 rounded-2xl border"
                        style={{
                          backgroundColor: 'var(--clr-surface-a10)',
                          borderColor: 'var(--clr-surface-tonal-a20)',
                        }}
                      >
                        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--clr-primary-a50)' }}>Account Information</h2>

                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>Name</label>
                            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                              <input
                                type="text"
                                value={userNameDraft}
                                onChange={(e) => setUserNameDraft(e.target.value)}
                                placeholder="Enter your name"
                                className="w-full px-4 py-2 rounded-lg border"
                                style={{
                                  backgroundColor: 'var(--clr-surface-a0)',
                                  borderColor: 'var(--clr-surface-tonal-a20)',
                                  color: 'var(--clr-primary-a50)',
                                }}
                              />
                              <button
                                type="button"
                                onClick={handleSaveName}
                                disabled={isSavingName || userNameDraft.trim() === userName}
                                className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                                style={{
                                  backgroundColor: 'var(--clr-primary-a50)',
                                  color: 'var(--clr-surface-a0)',
                                }}
                              >
                                {isSavingName ? 'Saving...' : 'Save'}
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="text-sm font-medium" style={{ color: 'var(--clr-primary-a50)' }}>Email</label>
                            <p className="mt-1 text-lg" style={{ color: 'var(--clr-primary-a50)' }}>{userEmail}</p>
                          </div>

                          <div>
                            <label className="text-sm font-medium" style={{ color: 'var(--clr-primary-a50)' }}>Date Joined</label>
                            <p className="mt-1 text-lg" style={{ color: 'var(--clr-primary-a50)' }}>
                              {userCreatedAt ? new Date(userCreatedAt).toLocaleDateString('en-AU', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              }) : 'Not available'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {isDevMode && (
                        <>
                        <div
                          className="p-6 rounded-2xl border mt-6"
                          style={{
                            backgroundColor: 'var(--clr-surface-a10)',
                            borderColor: 'var(--clr-surface-tonal-a20)',
                          }}
                        >
                        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--clr-primary-a50)' }}>Syllabus Dot Point Mapping</h2>
                        <p className="text-sm mb-4" style={{ color: 'var(--clr-surface-a40)' }}>
                          Select an exam paper and map each question using your custom classify → specialist ChatGPT syllabus workflow.
                        </p>

                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>Exam</label>
                            <div className="mt-2 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-3 items-center">
                              <select
                                value={selectedSyllabusMappingPaper}
                                onChange={(e) => setSelectedSyllabusMappingPaper(e.target.value)}
                                disabled={isMappingSyllabusDotPoints || loadingQuestions || availablePapers.length === 0}
                                className="w-full px-4 py-2 rounded-lg border"
                                style={{
                                  backgroundColor: 'var(--clr-surface-a0)',
                                  borderColor: 'var(--clr-surface-tonal-a20)',
                                  color: 'var(--clr-primary-a50)',
                                }}
                              >
                                {availablePapers.length === 0 ? (
                                  <option value="">{loadingQuestions ? 'Loading exams…' : 'No exam papers loaded'}</option>
                                ) : (
                                  availablePapers.map((paper) => (
                                    <option key={getPaperKey(paper)} value={getPaperKey(paper)}>
                                      {paper.year} • {paper.grade} • {paper.subject} • {paper.school} ({paper.count} questions)
                                    </option>
                                  ))
                                )}
                              </select>
                              <button
                                type="button"
                                onClick={() => void fetchAllQuestions({ includeIncomplete: true })}
                                disabled={loadingQuestions || isMappingSyllabusDotPoints}
                                className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50"
                                style={{ backgroundColor: 'var(--clr-surface-a20)', color: 'var(--clr-primary-a50)' }}
                              >
                                {loadingQuestions ? 'Loading…' : 'Load Exams'}
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>
                              Manual Workflow Test Question (LaTeX)
                            </label>
                            <textarea
                              value={syllabusWorkflowTestInput}
                              onChange={(e) => setSyllabusWorkflowTestInput(e.target.value)}
                              disabled={isRunningSyllabusWorkflowTest}
                              rows={6}
                              placeholder="Paste a question here to test classify → specialist workflow output..."
                              className="mt-2 w-full px-4 py-3 rounded-lg border text-sm"
                              style={{
                                backgroundColor: 'var(--clr-surface-a0)',
                                borderColor: 'var(--clr-surface-tonal-a20)',
                                color: 'var(--clr-primary-a50)',
                                resize: 'vertical',
                              }}
                            />
                          </div>

                          <div className="flex items-center gap-3">
                            <button
                              onClick={runSyllabusWorkflowTest}
                              disabled={isRunningSyllabusWorkflowTest || !syllabusWorkflowTestInput.trim()}
                              className="px-4 py-2 rounded-lg font-medium cursor-pointer disabled:opacity-50"
                              style={{
                                backgroundColor: 'var(--clr-primary-a0)',
                                color: 'var(--clr-dark-a0)',
                              }}
                            >
                              {isRunningSyllabusWorkflowTest ? 'Testing...' : 'Run Workflow Test'}
                            </button>
                            {syllabusWorkflowTestResult && (
                              <span
                                className="text-sm"
                                style={{
                                  color:
                                    syllabusWorkflowTestStatus === 'error'
                                      ? 'var(--clr-danger-a10)'
                                      : syllabusWorkflowTestStatus === 'success'
                                        ? 'var(--clr-success-a10)'
                                        : 'var(--clr-surface-a50)',
                                }}
                              >
                                {syllabusWorkflowTestResult}
                              </span>
                            )}
                          </div>

                          {syllabusWorkflowTestOutput && (
                            <div
                              className="rounded-xl border p-4"
                              style={{
                                backgroundColor: 'var(--clr-surface-a0)',
                                borderColor: 'var(--clr-surface-tonal-a20)',
                              }}
                            >
                              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--clr-primary-a50)' }}>
                                Workflow Test Output
                              </h3>
                              <div className="space-y-3 mb-3">
                                <div>
                                  <label className="text-xs font-medium" style={{ color: 'var(--clr-surface-a50)' }}>
                                    Classifier ChatGPT Output
                                  </label>
                                  <textarea
                                    readOnly
                                    rows={4}
                                    value={String(syllabusWorkflowTestOutput.classifier_raw_output || '')}
                                    className="mt-1 w-full px-3 py-2 rounded-md border text-xs"
                                    style={{
                                      backgroundColor: 'var(--clr-dark-a0)',
                                      borderColor: 'var(--clr-surface-tonal-a20)',
                                      color: 'var(--clr-light-a0)',
                                      resize: 'vertical',
                                    }}
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-medium" style={{ color: 'var(--clr-surface-a50)' }}>
                                    Specialist ChatGPT Output
                                  </label>
                                  <textarea
                                    readOnly
                                    rows={6}
                                    value={String(syllabusWorkflowTestOutput.specialist_raw_output || '')}
                                    className="mt-1 w-full px-3 py-2 rounded-md border text-xs"
                                    style={{
                                      backgroundColor: 'var(--clr-dark-a0)',
                                      borderColor: 'var(--clr-surface-tonal-a20)',
                                      color: 'var(--clr-light-a0)',
                                      resize: 'vertical',
                                    }}
                                  />
                                </div>
                              </div>
                              <pre
                                className="text-xs whitespace-pre-wrap break-words rounded-md p-3"
                                style={{
                                  backgroundColor: 'var(--clr-dark-a0)',
                                  color: 'var(--clr-light-a0)',
                                }}
                              >
                                {JSON.stringify(syllabusWorkflowTestOutput, null, 2)}
                              </pre>
                            </div>
                          )}

                          <div className="flex items-center gap-3">
                            <button
                              onClick={runSyllabusDotPointMapping}
                              disabled={isMappingSyllabusDotPoints || availablePapers.length === 0}
                              className="px-4 py-2 rounded-lg font-medium cursor-pointer disabled:opacity-50"
                              style={{
                                backgroundColor: 'var(--clr-primary-a0)',
                                color: 'var(--clr-dark-a0)',
                              }}
                            >
                              {isMappingSyllabusDotPoints ? 'Mapping...' : 'Automate Syllabus Mapping'}
                            </button>
                            {syllabusMappingResult && (
                              <span
                                className="text-sm"
                                style={{
                                  color:
                                    syllabusMappingStatus === 'error'
                                      ? 'var(--clr-danger-a10)'
                                      : syllabusMappingStatus === 'success'
                                        ? 'var(--clr-success-a10)'
                                        : 'var(--clr-surface-a50)',
                                }}
                              >
                                {syllabusMappingResult}
                              </span>
                            )}
                          </div>

                          {isMappingSyllabusDotPoints && syllabusMappingProgress && (
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs" style={{ color: 'var(--clr-surface-a40)' }}>
                                <span>Processing questions…</span>
                                <span>{syllabusMappingProgress.current} / {syllabusMappingProgress.total}</span>
                              </div>
                              <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--clr-surface-tonal-a20)' }}>
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${syllabusMappingProgress.total > 0 ? Math.round((syllabusMappingProgress.current / syllabusMappingProgress.total) * 100) : 0}%`,
                                    backgroundColor: 'var(--clr-primary-a0)',
                                  }}
                                />
                              </div>
                            </div>
                          )}

                          {syllabusMappingDebugOutputs.length > 0 && (
                            <div
                              className="mt-3 rounded-xl border p-4 max-h-96 overflow-y-auto custom-scrollbar"
                              style={{
                                backgroundColor: 'var(--clr-surface-a0)',
                                borderColor: 'var(--clr-surface-tonal-a20)',
                              }}
                            >
                              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--clr-primary-a50)' }}>
                                Workflow Mapping Debug Output
                              </h3>
                              <div className="space-y-3">
                                {syllabusMappingDebugOutputs.map((entry, index) => {
                                  const rawText = String(entry?.rawModelOutput || '').trim();
                                  const parsedText = entry?.parsedModelOutput
                                    ? JSON.stringify(entry.parsedModelOutput, null, 2)
                                    : '';
                                  return (
                                    <div
                                      key={`${entry.questionId}-${index}`}
                                      className="rounded-lg border p-3"
                                      style={{
                                        backgroundColor: 'var(--clr-surface-a10)',
                                        borderColor: 'var(--clr-surface-tonal-a20)',
                                      }}
                                    >
                                      <p className="text-xs font-medium mb-2" style={{ color: 'var(--clr-surface-a50)' }}>
                                        Q{entry.questionNumber || 'unknown'} • {entry.topic} • {entry.reason}
                                      </p>
                                      {rawText ? (
                                        <pre
                                          className="text-xs whitespace-pre-wrap break-words rounded-md p-2"
                                          style={{
                                            backgroundColor: 'var(--clr-dark-a0)',
                                            color: 'var(--clr-light-a0)',
                                          }}
                                        >
                                          {rawText}
                                        </pre>
                                      ) : (
                                        <p className="text-xs" style={{ color: 'var(--clr-surface-a40)' }}>
                                          No raw model output returned.
                                        </p>
                                      )}
                                      {parsedText && (
                                        <details className="mt-2">
                                          <summary className="text-xs cursor-pointer" style={{ color: 'var(--clr-primary-a50)' }}>
                                            Parsed JSON
                                          </summary>
                                          <pre
                                            className="text-xs whitespace-pre-wrap break-words rounded-md p-2 mt-2"
                                            style={{
                                              backgroundColor: 'var(--clr-surface-a20)',
                                              color: 'var(--clr-primary-a50)',
                                            }}
                                          >
                                            {parsedText}
                                          </pre>
                                        </details>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                        </div>

                        <div
                          className="p-6 rounded-2xl border mt-6"
                          style={{
                            backgroundColor: 'var(--clr-surface-a10)',
                            borderColor: 'var(--clr-surface-tonal-a20)',
                          }}
                        >
                        <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--clr-primary-a50)' }}>Syllabus Import</h2>
                        <p className="text-sm mb-4" style={{ color: 'var(--clr-surface-a40)' }}>
                          Paste syllabus dot points to populate the taxonomy database. Use the format below.
                        </p>

                        <div className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>Grade</label>
                              <select
                                value={syllabusImportGrade}
                                onChange={(e) => setSyllabusImportGrade(e.target.value as typeof syllabusImportGrade)}
                                disabled={syllabusImporting}
                                className="mt-2 w-full px-4 py-2 rounded-lg border"
                                style={{
                                  backgroundColor: 'var(--clr-surface-a0)',
                                  borderColor: 'var(--clr-surface-tonal-a20)',
                                  color: 'var(--clr-primary-a50)',
                                }}
                              >
                                {Object.keys(SUBJECTS_BY_YEAR).map((g) => (
                                  <option key={g} value={g}>{g}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>Subject</label>
                              <select
                                value={syllabusImportSubject}
                                onChange={(e) => setSyllabusImportSubject(e.target.value)}
                                disabled={syllabusImporting}
                                className="mt-2 w-full px-4 py-2 rounded-lg border"
                                style={{
                                  backgroundColor: 'var(--clr-surface-a0)',
                                  borderColor: 'var(--clr-surface-tonal-a20)',
                                  color: 'var(--clr-primary-a50)',
                                }}
                              >
                                {(SUBJECTS_BY_YEAR[syllabusImportGrade] || []).map((s) => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>Syllabus Content</label>
                            <textarea
                              value={syllabusImportText}
                              onChange={(e) => setSyllabusImportText(e.target.value)}
                              disabled={syllabusImporting}
                              rows={16}
                              placeholder={`TOPIC Financial mathematics A\n\nSUBTOPIC Solve problems involving earning money\nPOINT_1 Solve problems involving wages given an hourly rate…\nPOINT_2 Calculate earnings from non-wage sources…\n\nSUBTOPIC Solve problems involving simple interest\nPOINT_1 Establish and use the formula $I = Prn$…`}
                              className="mt-2 w-full px-4 py-3 rounded-lg border font-mono text-sm leading-relaxed"
                              style={{
                                backgroundColor: 'var(--clr-surface-a0)',
                                borderColor: 'var(--clr-surface-tonal-a20)',
                                color: 'var(--clr-primary-a50)',
                                resize: 'vertical',
                              }}
                            />
                          </div>

                          <details className="text-xs" style={{ color: 'var(--clr-surface-a40)' }}>
                            <summary className="cursor-pointer font-medium hover:underline">Format reference</summary>
                            <pre className="mt-2 p-3 rounded-lg overflow-x-auto text-xs leading-relaxed" style={{ backgroundColor: 'var(--clr-surface-a0)', color: 'var(--clr-surface-a50)' }}>
                              {`TOPIC <topic name>

SUBTOPIC <subtopic name>
POINT_1 <dot point text, may include LaTeX>
POINT_2 <dot point text>
...

SUBTOPIC <another subtopic>
POINT_1 ...`}
                            </pre>
                            <p className="mt-2">
                              The <strong>GRADE</strong> line is optional — if omitted, the grade selected above is used automatically.
                              You can include multiple TOPIC blocks. Each TOPIC can have multiple SUBTOPICs.
                            </p>
                          </details>

                          <div className="flex items-center gap-3">
                            <button
                              onClick={runSyllabusImport}
                              disabled={syllabusImporting || !syllabusImportText.trim()}
                              className="px-5 py-2 rounded-lg font-medium cursor-pointer disabled:opacity-50"
                              style={{
                                backgroundColor: 'var(--clr-primary-a0)',
                                color: 'var(--clr-dark-a0)',
                              }}
                            >
                              {syllabusImporting ? 'Importing…' : 'Import Syllabus'}
                            </button>
                            {syllabusImportResult && (
                              <span
                                className="text-sm"
                                style={{
                                  color:
                                    syllabusImportStatus === 'error'
                                      ? 'var(--clr-danger-a10)'
                                      : syllabusImportStatus === 'success'
                                        ? 'var(--clr-success-a10)'
                                        : 'var(--clr-surface-a50)',
                                }}
                              >
                                {syllabusImportResult}
                              </span>
                            )}
                          </div>
                        </div>
                        </div>
                        </>
                      )}

                      {isDevMode && (
                        <div
                          className="p-6 rounded-2xl border mt-6"
                          style={{
                            backgroundColor: 'var(--clr-surface-a10)',
                            borderColor: 'var(--clr-surface-tonal-a20)',
                          }}
                        >
                          <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--clr-primary-a50)' }}>PDF Intake</h2>
                          <p className="text-sm mb-4" style={{ color: 'var(--clr-surface-a40)' }}>
                            Upload the exam PDF and/or the marking criteria PDF. The response will be used to create new questions automatically.
                          </p>

                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>Grade</label>
                                <select
                                  value={pdfGrade}
                                  onChange={(e) => {
                                    const nextGrade = e.target.value as 'Year 7' | 'Year 8' | 'Year 9' | 'Year 10' | 'Year 11' | 'Year 12';
                                    const nextSubjects = SUBJECTS_BY_YEAR[nextGrade];
                                    setPdfGrade(nextGrade);
                                    if (!nextSubjects.includes(pdfSubject)) {
                                      setPdfSubject(nextSubjects[0]);
                                    }
                                  }}
                                  className="mt-2 w-full px-4 py-2 rounded-lg border"
                                  style={{
                                    backgroundColor: 'var(--clr-surface-a0)',
                                    borderColor: 'var(--clr-surface-tonal-a20)',
                                    color: 'var(--clr-primary-a50)',
                                  }}
                                >
                                  <option value="Year 7">Year 7</option>
                                  <option value="Year 8">Year 8</option>
                                  <option value="Year 9">Year 9</option>
                                  <option value="Year 10">Year 10</option>
                                  <option value="Year 11">Year 11</option>
                                  <option value="Year 12">Year 12</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>Exam Year</label>
                                <select
                                  id="pdf-intake-year"
                                  value={pdfYear}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    pdfYearRef.current = v;
                                    setPdfYear(v);
                                  }}
                                  className="mt-2 w-full px-4 py-2 rounded-lg border"
                                  style={{
                                    backgroundColor: 'var(--clr-surface-a0)',
                                    borderColor: 'var(--clr-surface-tonal-a20)',
                                    color: 'var(--clr-primary-a50)',
                                  }}
                                >
                                  {YEARS.map((year) => (
                                    <option key={year} value={year}>{year}</option>
                                  ))}
                                </select>
                                <p className="mt-2 text-xs" style={{ color: 'var(--clr-surface-a40)' }}>
                                  Accepted years: {MIN_EXAM_YEAR}–{CURRENT_EXAM_YEAR}
                                </p>
                              </div>
                              <div>
                                <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>Subject</label>
                                <select
                                  value={pdfSubject}
                                  onChange={(e) => setPdfSubject(e.target.value)}
                                  className="mt-2 w-full px-4 py-2 rounded-lg border"
                                  style={{
                                    backgroundColor: 'var(--clr-surface-a0)',
                                    borderColor: 'var(--clr-surface-tonal-a20)',
                                    color: 'var(--clr-primary-a50)',
                                  }}
                                >
                                  {SUBJECTS_BY_YEAR[pdfGrade].map((subject) => (
                                    <option key={subject} value={subject}>{subject}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>School Name</label>
                                <input
                                  type="text"
                                  value={pdfSchoolName}
                                  onChange={(e) => setPdfSchoolName(e.target.value)}
                                  placeholder="e.g., Riverside High School"
                                  className="mt-2 w-full px-4 py-2 rounded-lg border"
                                  style={{
                                    backgroundColor: 'var(--clr-surface-a0)',
                                    borderColor: 'var(--clr-surface-tonal-a20)',
                                    color: 'var(--clr-primary-a50)',
                                  }}
                                />
                              </div>
                              <div>
                                <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>Paper Number (optional)</label>
                                <input
                                  type="number"
                                  min={1}
                                  step={1}
                                  value={pdfPaperNumber}
                                  onChange={(e) => setPdfPaperNumber(e.target.value)}
                                  placeholder="Auto if blank"
                                  className="mt-2 w-full px-4 py-2 rounded-lg border"
                                  style={{
                                    backgroundColor: 'var(--clr-surface-a0)',
                                    borderColor: 'var(--clr-surface-tonal-a20)',
                                    color: 'var(--clr-primary-a50)',
                                  }}
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>Exam PDF (optional)</label>
                              <input
                                type="file"
                                accept="application/pdf"
                                onChange={(e) => setExamPdfFile(e.target.files?.[0] || null)}
                                className="mt-2 w-full px-4 py-2 rounded-lg border"
                                style={{
                                  backgroundColor: 'var(--clr-surface-a0)',
                                  borderColor: 'var(--clr-surface-tonal-a20)',
                                  color: 'var(--clr-primary-a50)',
                                }}
                              />
                              {examPdfFile && (
                                <p className="mt-2 text-xs" style={{ color: 'var(--clr-surface-a50)' }}>
                                  Selected: {examPdfFile.name}
                                </p>
                              )}
                            </div>

                            <div>
                              <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>Marking Criteria PDF (optional)</label>
                              <input
                                type="file"
                                accept="application/pdf"
                                onChange={(e) => setCriteriaPdfFile(e.target.files?.[0] || null)}
                                className="mt-2 w-full px-4 py-2 rounded-lg border"
                                style={{
                                  backgroundColor: 'var(--clr-surface-a0)',
                                  borderColor: 'var(--clr-surface-tonal-a20)',
                                  color: 'var(--clr-primary-a50)',
                                }}
                              />
                            </div>
                          </div>
                          <div className="mt-4">
                            <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>
                              Exam Images (JPEG/PNG) – alternative to Exam PDF
                            </label>
                            <input
                              type="file"
                              accept="image/jpeg,image/png"
                              multiple
                              onChange={(e) => {
                                const files = Array.from(e.target.files || []);
                                setExamImageFiles(files);
                              }}
                              className="mt-2 w-full px-4 py-2 rounded-lg border"
                              style={{
                                backgroundColor: 'var(--clr-surface-a0)',
                                borderColor: 'var(--clr-surface-tonal-a20)',
                                color: 'var(--clr-primary-a50)',
                              }}
                            />
                            {examImageFiles.length > 0 && (
                              <p className="mt-2 text-xs" style={{ color: 'var(--clr-surface-a50)' }}>
                                Selected {examImageFiles.length} image{examImageFiles.length > 1 ? 's' : ''}.
                              </p>
                            )}

                            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--clr-surface-a50)' }}>
                              <input
                                type="checkbox"
                                checked={pdfOverwrite}
                                onChange={(e) => setPdfOverwrite(e.target.checked)}
                              />
                              Overwrite existing questions and marking criteria for this grade/year/subject/school/paper number
                            </label>

                            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--clr-surface-a50)' }}>
                              <input
                                type="checkbox"
                                checked={pdfGenerateCriteria}
                                onChange={(e) => setPdfGenerateCriteria(e.target.checked)}
                              />
                              Generate marking criteria from mark count
                            </label>

                            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--clr-surface-a50)' }}>
                              <input
                                type="checkbox"
                                checked={pdfAutoGroupSubparts}
                                onChange={(e) => setPdfAutoGroupSubparts(e.target.checked)}
                              />
                              Auto-group lettered subparts (e.g. 11(a), 11(b), 11(c)) for Custom Exam
                            </label>

                            <div className="flex items-center gap-3">
                              <button
                                onClick={submitPdfPair}
                                disabled={pdfStatus === 'uploading'}
                                className="px-4 py-2 rounded-lg font-medium cursor-pointer disabled:opacity-50"
                                style={{
                                  backgroundColor: 'var(--clr-primary-a0)',
                                  color: 'var(--clr-dark-a0)',
                                }}
                              >
                                {pdfStatus === 'uploading' ? 'Uploading...' : 'Upload Files'}
                              </button>
                              {pdfMessage && (
                                <span
                                  className="text-sm"
                                  style={{ color: pdfStatus === 'error' ? 'var(--clr-danger-a10)' : 'var(--clr-surface-a50)' }}
                                >
                                  {pdfMessage}
                                </span>
                              )}
                            </div>

                            {pdfRawInputs && (
                              <div className="mt-4">
                                <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>
                                  Raw Model Input
                                </label>
                                <textarea
                                  readOnly
                                  value={pdfRawInputs}
                                  rows={12}
                                  className="mt-2 w-full px-4 py-2 rounded-lg border font-mono text-sm"
                                  style={{
                                    backgroundColor: 'var(--clr-surface-a0)',
                                    borderColor: 'var(--clr-surface-tonal-a20)',
                                    color: 'var(--clr-primary-a50)',
                                  }}
                                />
                              </div>
                            )}

                            {pdfChatGptResponse && (
                              <div className="mt-4">
                                <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>
                                  Model Response
                                </label>
                                <textarea
                                  readOnly
                                  value={pdfChatGptResponse}
                                  rows={12}
                                  className="mt-2 w-full px-4 py-2 rounded-lg border font-mono text-sm"
                                  style={{
                                    backgroundColor: 'var(--clr-surface-a0)',
                                    borderColor: 'var(--clr-surface-tonal-a20)',
                                    color: 'var(--clr-primary-a50)',
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
  );
}
