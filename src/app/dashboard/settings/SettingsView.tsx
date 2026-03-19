// @ts-nocheck
'use client';

import React from 'react';
import { X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BROWSE_YEARS as YEARS, SUBJECTS_BY_YEAR, CURRENT_EXAM_YEAR, MIN_EXAM_YEAR, getPaperKey, BROWSE_GRADES_SENIOR } from '../syllabus-config';
import { PdfImageExtractor } from '@/components/PdfImageExtractor';

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
  userPlan, userExportsUsed, userExportsLimit, userExportsResetAt, hasActiveSubscription,
  userQuestionTokensBalance,
  userCompanyName,
  userDefaultGrade,
  userDefaultSubject,
  userStripeCancelAt,
  userStripeCancelAtPeriodEnd,
  onSaveDefaultPreset,
  setExamPdfFile, setCriteriaPdfFile, setExamImageFiles, setPdfGrade, setPdfYear, setPdfSubject,
  setPdfOverwrite, setPdfGenerateCriteria, setPdfAutoGroupSubparts, setPdfSchoolName, setPdfPaperNumber,
  setSelectedSyllabusMappingPaper, setSyllabusWorkflowTestInput, setSyllabusImportText,
  setSyllabusImportSubject, setSyllabusImportGrade, setViewMode, setUserNameDraft,
  pdfYearRef, fetchAllQuestions, availablePapers,
  handleSaveName, runSyllabusWorkflowTest, runSyllabusDotPointMapping, runSyllabusImport,
  submitPdfPair,
  showDeveloperTools = false,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [unspecifiedTopicLimit, setUnspecifiedTopicLimit] = React.useState(10);
  const [isClassifyingUnspecifiedTopics, setIsClassifyingUnspecifiedTopics] = React.useState(false);
  const [unspecifiedTopicStatus, setUnspecifiedTopicStatus] = React.useState<'idle' | 'success' | 'error'>('idle');
  const [unspecifiedTopicResult, setUnspecifiedTopicResult] = React.useState('');
  const [unspecifiedTopicOutputs, setUnspecifiedTopicOutputs] = React.useState<any[]>([]);
  const [showQuestionTokensModal, setShowQuestionTokensModal] = React.useState(false);
  const [selectedQuestionPackage, setSelectedQuestionPackage] = React.useState<string | null>(null);
  const [isProcessingQuestionTokenPurchase, setIsProcessingQuestionTokenPurchase] = React.useState(false);
  const [questionTokenPurchaseMessage, setQuestionTokenPurchaseMessage] = React.useState('');
  const [questionTokensBalanceOverride, setQuestionTokensBalanceOverride] = React.useState<number | null>(null);
  const [isConfirmingQuestionTokenCheckout, setIsConfirmingQuestionTokenCheckout] = React.useState(false);
  const [defaultGradeDraft, setDefaultGradeDraft] = React.useState<string>(userDefaultGrade ?? 'Year 12');
  const [defaultSubjectDraft, setDefaultSubjectDraft] = React.useState<string>(userDefaultSubject ?? 'Mathematics Advanced');
  const [isSavingDefaultPreset, setIsSavingDefaultPreset] = React.useState(false);
  const [defaultPresetMessage, setDefaultPresetMessage] = React.useState<string | null>(null);
  const [questionsGeneratedThisMonth, setQuestionsGeneratedThisMonth] = React.useState<number | null>(null);
  const [questionsGeneratedLoading, setQuestionsGeneratedLoading] = React.useState(false);

  const checkoutStatus = searchParams.get('checkout');
  const checkoutType = searchParams.get('type');
  const checkoutSessionId = searchParams.get('session_id');

  React.useEffect(() => {
    if (checkoutStatus !== 'success' || checkoutType !== 'questions' || !checkoutSessionId || isConfirmingQuestionTokenCheckout) {
      return;
    }

    let cancelled = false;

    const confirmTokenCheckout = async () => {
      try {
        setIsConfirmingQuestionTokenCheckout(true);
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const response = await fetch(`/api/stripe/confirm-checkout?session_id=${encodeURIComponent(checkoutSessionId)}`, {
          method: 'GET',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
          questionTokensBalance?: number;
        };

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setQuestionTokenPurchaseMessage(
            data.error || data.message || 'Could not confirm your token purchase yet.'
          );
          return;
        }

        if (typeof data.questionTokensBalance === 'number') {
          setQuestionTokensBalanceOverride(data.questionTokensBalance);
        }

        setQuestionTokenPurchaseMessage('Your question tokens have been added to your account.');
      } catch (error) {
        if (cancelled) {
          return;
        }
        setQuestionTokenPurchaseMessage(
          error instanceof Error ? error.message : 'Could not confirm your token purchase yet.'
        );
      } finally {
        if (!cancelled) {
          setIsConfirmingQuestionTokenCheckout(false);
        }
      }
    };

    void confirmTokenCheckout();

    return () => {
      cancelled = true;
    };
  }, [checkoutStatus, checkoutType, checkoutSessionId, isConfirmingQuestionTokenCheckout]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;

    const loadMonthlyCount = async () => {
      setQuestionsGeneratedLoading(true);
      try {
        const response = await fetch('/api/hsc/questions-generated-this-month', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json().catch(() => ({}));
        const count = typeof data?.count === 'number' ? data.count : Number(data?.count);
        if (!cancelled && Number.isFinite(count)) {
          setQuestionsGeneratedThisMonth(Math.max(0, count));
        }
      } catch {
        // Keep placeholder if count can't be loaded.
      } finally {
        if (!cancelled) setQuestionsGeneratedLoading(false);
      }
    };

    void loadMonthlyCount();

    return () => {
      cancelled = true;
    };
  }, []);

  const runUnspecifiedTopicClassification = async () => {
    if (!selectedSyllabusMappingPaper) {
      setUnspecifiedTopicStatus('error');
      setUnspecifiedTopicResult('Select an exam first.');
      setUnspecifiedTopicOutputs([]);
      return;
    }

    const selectedPaper = availablePapers.find((paper: any) => getPaperKey(paper) === selectedSyllabusMappingPaper);
    if (!selectedPaper) {
      setUnspecifiedTopicStatus('error');
      setUnspecifiedTopicResult('Selected exam is no longer available.');
      setUnspecifiedTopicOutputs([]);
      return;
    }

    const limit = Number.isFinite(unspecifiedTopicLimit)
      ? Math.max(1, Math.min(200, Math.floor(unspecifiedTopicLimit)))
      : 10;

    try {
      setIsClassifyingUnspecifiedTopics(true);
      setUnspecifiedTopicStatus('idle');
      setUnspecifiedTopicResult('');
      setUnspecifiedTopicOutputs([]);

      const response = await fetch('/api/hsc/classify-unspecified-topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grade: selectedPaper.grade,
          year: selectedPaper.year,
          subject: selectedPaper.subject,
          school: selectedPaper.school,
          limit,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setUnspecifiedTopicStatus('error');
        setUnspecifiedTopicResult(String(data?.error || `Classification failed (${response.status})`));
        setUnspecifiedTopicOutputs(Array.isArray(data?.outputs) ? data.outputs : []);
        return;
      }

      const totals = data?.totals || {};
      const debugCounts = data?.debugCounts || {};
      const debugSuffix =
        Number(totals.processed || 0) === 0
          ? ` (year matches: ${debugCounts.allQuestionsByYear || 0}, paper-context matches: ${debugCounts.matchedPaperContext || 0})`
          : '';
      setUnspecifiedTopicStatus('success');
      setUnspecifiedTopicResult(
        `Processed ${totals.processed || 0} of ${totals.foundUnspecified || 0} unspecified questions. Updated ${totals.updated || 0}, failed ${totals.failed || 0}.${debugSuffix}`
      );
      setUnspecifiedTopicOutputs(Array.isArray(data?.outputs) ? data.outputs : []);
      fetchAllQuestions({ includeIncomplete: true });
    } catch (error) {
      setUnspecifiedTopicStatus('error');
      setUnspecifiedTopicResult(error instanceof Error ? error.message : 'Failed to classify unspecified topics');
      setUnspecifiedTopicOutputs([]);
    } finally {
      setIsClassifyingUnspecifiedTopics(false);
    }
  };

  const handleBuyQuestionTokens = async (packageKey: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      setQuestionTokenPurchaseMessage('You need to sign in first.');
      return;
    }

    setIsProcessingQuestionTokenPurchase(true);
    setQuestionTokenPurchaseMessage('');

    try {
      const response = await fetch('/api/stripe/create-payment-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          package: packageKey,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as any;

      if (!response.ok) {
        setQuestionTokenPurchaseMessage(data?.error || 'Failed to create checkout session');
        return;
      }

      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        setQuestionTokenPurchaseMessage('Failed to create checkout session');
      }
    } catch (error) {
      setQuestionTokenPurchaseMessage(error instanceof Error ? error.message : 'Failed to process request');
    } finally {
      setIsProcessingQuestionTokenPurchase(false);
    }
  };

  React.useEffect(() => {
    setDefaultGradeDraft(userDefaultGrade ?? 'Year 12');
    setDefaultSubjectDraft(userDefaultSubject ?? 'Mathematics Advanced');
  }, [userDefaultGrade, userDefaultSubject]);

  const defaultSubjectsForDraftGrade = (SUBJECTS_BY_YEAR as Record<string, string[]>)[defaultGradeDraft] ?? [];

  React.useEffect(() => {
    if (!defaultSubjectsForDraftGrade.includes(defaultSubjectDraft)) {
      setDefaultSubjectDraft(defaultSubjectsForDraftGrade[0] ?? 'Mathematics Advanced');
    }
  }, [defaultGradeDraft]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveDefaultPreset = async () => {
    if (typeof onSaveDefaultPreset !== 'function') return;
    setIsSavingDefaultPreset(true);
    setDefaultPresetMessage(null);
    try {
      const res = await onSaveDefaultPreset(defaultGradeDraft, defaultSubjectDraft);
      if (!res?.ok) {
        setDefaultPresetMessage(res?.message || 'Failed to save defaults');
        return;
      }
      setDefaultPresetMessage('Defaults saved.');
    } catch (err) {
      setDefaultPresetMessage(err instanceof Error ? err.message : 'Failed to save defaults');
    } finally {
      setIsSavingDefaultPreset(false);
    }
  };

  return (
    <div
      className="flex-1 flex flex-col items-center overflow-y-auto"
      style={{ background: '#fdfcfb' }}
    >
      <div className="w-full max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1
              style={{
                fontFamily:
                  '"DM Serif Display", system-ui, -apple-system, BlinkMacSystemFont, serif',
                fontSize: '2.5rem',
                lineHeight: 1.1,
                marginBottom: '0.5rem',
                color: '#1a1a1a',
                fontWeight: 400,
                letterSpacing: '-0.02em',
              }}
            >
              Account Settings
            </h1>
            <p style={{ color: '#4a4a4a', fontSize: '1rem' }}>
              Manage your HSC Question Bank account
            </p>
          </div>
          <button
            type="button"
            onClick={() => setViewMode('browse')}
            className="hidden sm:inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
            style={{
              border: '1px solid #e5e1da',
              background: '#ffffff',
              color: '#4a4a4a',
            }}
          >
            <X className="w-4 h-4" />
            Back
          </button>
        </div>

        <div
          className="rounded-xl bg-white"
          style={{
            border: '1px solid #e5e1da',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden',
          }}
        >
          {/* Account Information */}
          <section
            className="border-b"
            style={{ padding: '2rem', borderColor: '#e5e1da' }}
          >
            <div
              style={{
                fontSize: '0.75rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#8a8a8a',
                marginBottom: '1.5rem',
                fontWeight: 600,
              }}
            >
              Account Information
            </div>
            <div
              className="grid gap-6"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(0, 1fr))' }}
            >
              <div className="flex flex-col gap-1">
                <div style={{ fontSize: '0.95rem', color: '#8a8a8a' }}>Name</div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    value={userNameDraft}
                    onChange={(e) => setUserNameDraft(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full"
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: 6,
                      border: '1px solid #e5e1da',
                      fontSize: '0.95rem',
                      color: '#1a1a1a',
                      background: '#ffffff',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSaveName}
                    disabled={isSavingName || userNameDraft.trim() === userName}
                    className="mt-2 sm:mt-0 text-sm font-semibold disabled:opacity-50"
                    style={{
                      padding: '0.75rem 1.5rem',
                      borderRadius: 8,
                      border: 'none',
                      background: '#c77f3e',
                      color: '#ffffff',
                      cursor:
                        isSavingName || userNameDraft.trim() === userName
                          ? 'not-allowed'
                          : 'pointer',
                    }}
                  >
                    {isSavingName ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div style={{ fontSize: '0.95rem', color: '#8a8a8a' }}>Email</div>
                <div style={{ fontSize: '1rem', color: '#1a1a1a', fontWeight: 500 }}>
                  {userEmail}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div style={{ fontSize: '0.95rem', color: '#8a8a8a' }}>Company</div>
                <div style={{ fontSize: '1rem', color: '#1a1a1a', fontWeight: 500 }}>
                  {userCompanyName || '—'}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div style={{ fontSize: '0.95rem', color: '#8a8a8a' }}>Date Joined</div>
                <div style={{ fontSize: '1rem', color: '#1a1a1a', fontWeight: 500 }}>
                  {userCreatedAt
                    ? new Date(userCreatedAt).toLocaleDateString('en-AU', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'Not available'}
                </div>
              </div>
            </div>
          </section>

          {/* Usage This Month – placeholder */}
          <section
            className="border-b"
            style={{ padding: '2rem', borderColor: '#e5e1da' }}
          >
            <div
              style={{
                fontSize: '0.75rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#8a8a8a',
                marginBottom: '1.5rem',
                fontWeight: 600,
              }}
            >
              Usage This Month
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div style={{ fontSize: '0.95rem', color: '#8a8a8a' }}>
                  Questions Generated
                </div>
                <div>
                  <span
                    style={{
                      fontSize: '2rem',
                      fontWeight: 600,
                      color: '#c77f3e',
                      fontVariantNumeric: 'tabular-nums',
                      lineHeight: 1,
                    }}
                  >
                    {questionsGeneratedThisMonth ?? (questionsGeneratedLoading ? '…' : '—')}
                  </span>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: '#8a8a8a',
                      marginTop: '0.25rem',
                      textAlign: 'right',
                    }}
                  >
                    {questionsGeneratedLoading ? 'Loading…' : 'This month'}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div style={{ fontSize: '0.95rem', color: '#8a8a8a' }}>
                  Exam Generation Tokens
                </div>
                <div
                  style={{
                    fontSize: '1rem',
                    color: '#1a1a1a',
                    fontWeight: 500,
                  }}
                >
                  {userExportsLimit > 0 ? `${userExportsUsed} / ${userExportsLimit}` : '—'}
                </div>
              </div>
            </div>
          </section>

          {/* Subscription */}
          <section
            className="border-b"
            style={{ padding: '2rem', borderColor: '#e5e1da' }}
          >
            <div
              style={{
                fontSize: '0.75rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#8a8a8a',
                marginBottom: '1.5rem',
                fontWeight: 600,
              }}
            >
              Subscription
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div style={{ fontSize: '0.95rem', color: '#8a8a8a' }}>
                  Current Plan
                </div>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0.35rem 0.85rem',
                    borderRadius: 6,
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    letterSpacing: '0.02em',
                    background:
                      userPlan === 'pro'
                        ? '#fff3e0'
                        : userPlan === 'standard'
                        ? '#e8ddd3'
                        : '#f7f5f2',
                    color:
                      userPlan === 'pro'
                        ? '#e65100'
                        : userPlan === 'standard'
                        ? '#a66930'
                        : '#4a4a4a',
                  }}
                >
                  {userPlan === 'free'
                    ? 'Free'
                    : userPlan === 'standard'
                    ? 'Standard'
                    : 'Pro'}{' '}
                  Plan
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div style={{ fontSize: '0.95rem', color: '#8a8a8a' }}>
                  Next Billing Date
                </div>
                <div
                  style={{
                    fontSize: '1rem',
                    color: '#1a1a1a',
                    fontWeight: 500,
                  }}
                >
                  {userExportsResetAt
                    ? new Date(userExportsResetAt).toLocaleDateString('en-AU', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : '—'}
                </div>
              </div>
              <div
                className="flex flex-wrap gap-3"
                style={{ marginTop: '0.5rem' }}
              >
                <button
                  type="button"
                  onClick={() => router.push('/dashboard/settings/pricing')}
                  className="text-sm font-semibold"
                  style={{
                    padding: '0.75rem 1.5rem',
                    borderRadius: 8,
                    border: 'none',
                    background: '#c77f3e',
                    color: '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  {hasActiveSubscription ? 'Change Plan' : 'Upgrade Plan'}
                </button>
                {hasActiveSubscription && (
                  <button
                    type="button"
                    onClick={() =>
                      router.push('/dashboard/settings/manage-subscription')
                    }
                    className="text-sm font-semibold"
                    style={{
                      padding: '0.75rem 1.5rem',
                      borderRadius: 8,
                      border: '1px solid #e5e1da',
                      background: '#ffffff',
                      color: '#c77f3e',
                      cursor: 'pointer',
                    }}
                  >
                    Manage Subscription
                  </button>
                )}
              </div>

              {userStripeCancelAt && (
                <div
                  className="rounded-xl border px-4 py-3 text-sm"
                  style={{
                    backgroundColor: '#FEF2F2',
                    borderColor: '#FECACA',
                    color: '#991B1B',
                    marginTop: '0.5rem',
                  }}
                >
                  {userStripeCancelAtPeriodEnd
                    ? 'Your subscription will be cancelled on '
                    : 'Your subscription was cancelled on '}
                  {new Date(userStripeCancelAt).toLocaleDateString('en-AU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                  . You will keep access until then.
                </div>
              )}
            </div>
          </section>

          {/* Question Tokens */}
          <section
            className="border-b"
            style={{ padding: '2rem', borderColor: '#e5e1da' }}
          >
            <div
              style={{
                fontSize: '0.75rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#8a8a8a',
                marginBottom: '1.5rem',
                fontWeight: 600,
              }}
            >
              Question Tokens
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div style={{ fontSize: '0.95rem', color: '#8a8a8a' }}>
                  Available Tokens
                </div>
                <div className="flex items-center gap-2">
                  <span
                    style={{
                      fontSize: '1.5rem',
                      fontWeight: 600,
                      color: '#c77f3e',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {questionTokensBalanceOverride ??
                      userQuestionTokensBalance ??
                      0}
                  </span>
                  <span
                    style={{ fontSize: '0.875rem', color: '#8a8a8a' }}
                  >
                    questions
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => router.push('/dashboard/settings/question-tokens')}
                  className="text-sm font-semibold"
                  style={{
                    padding: '0.75rem 1.5rem',
                    borderRadius: 8,
                    border: 'none',
                    background: '#c77f3e',
                    color: '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  Buy Question Tokens
                </button>
              </div>
            </div>
          </section>

          {/* Preferences */}
          <section
            className="border-b"
            style={{ padding: '2rem', borderColor: '#e5e1da' }}
          >
            <div
              style={{
                fontSize: '0.75rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#8a8a8a',
                marginBottom: '1.5rem',
                fontWeight: 600,
              }}
            >
              Preferences
            </div>
            <div className="space-y-6">
              <div>
                <div
                  style={{
                    fontSize: '0.95rem',
                    color: '#8a8a8a',
                    marginBottom: '0.75rem',
                  }}
                >
                  Default Subjects
                </div>
                <div className="space-y-3">
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.9rem',
                        color: '#8a8a8a',
                        fontWeight: 500,
                      }}
                    >
                      Year Level
                    </div>
                    <div
                      style={{
                        position: 'relative',
                        width: '200px',
                      }}
                    >
                      <select
                        value={defaultGradeDraft}
                        onChange={(e) => setDefaultGradeDraft(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.65rem 2.5rem 0.65rem 1rem',
                          borderRadius: 6,
                          border: '1px solid #e5e1da',
                          background: '#ffffff',
                          color: '#1a1a1a',
                          fontSize: '0.95rem',
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        {BROWSE_GRADES_SENIOR.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                      <span
                        style={{
                          position: 'absolute',
                          right: '1rem',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontSize: '0.7rem',
                          color: '#8a8a8a',
                          pointerEvents: 'none',
                        }}
                      >
                        ▼
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {defaultSubjectsForDraftGrade.map((s) => (
                      <label
                        key={s}
                        className="flex items-center gap-2"
                        style={{
                          padding: '0.5rem 0.85rem',
                          borderRadius: 6,
                          background:
                            defaultSubjectDraft === s ? '#fff3e0' : '#f7f5f2',
                          border:
                            defaultSubjectDraft === s
                              ? '1px solid #c77f3e'
                              : '1px solid transparent',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="radio"
                          name="default-subject"
                          checked={defaultSubjectDraft === s}
                          onChange={() => setDefaultSubjectDraft(s)}
                          style={{
                            width: 16,
                            height: 16,
                            accentColor: '#c77f3e',
                            cursor: 'pointer',
                          }}
                        />
                        <span
                          style={{
                            fontSize: '0.9rem',
                            color: '#1a1a1a',
                            fontWeight: 500,
                          }}
                        >
                          {s}
                        </span>
                      </label>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void handleSaveDefaultPreset()}
                      disabled={isSavingDefaultPreset}
                      className="text-sm font-semibold disabled:opacity-50"
                      style={{
                        padding: '0.75rem 1.5rem',
                        borderRadius: 8,
                        border: 'none',
                        background: '#c77f3e',
                        color: '#ffffff',
                        cursor: isSavingDefaultPreset ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {isSavingDefaultPreset ? 'Saving…' : 'Save Defaults'}
                    </button>

                    {defaultPresetMessage && (
                      <span
                        style={{
                          fontSize: '0.85rem',
                          color: defaultPresetMessage.includes('saved') ? '#065F46' : '#991B1B',
                          fontWeight: 500,
                        }}
                      >
                        {defaultPresetMessage}
                      </span>
                    )}
                  </div>

                  <p
                    style={{
                      marginTop: '0.25rem',
                      fontSize: '0.8rem',
                      color: '#8a8a8a',
                    }}
                  >
                    This preset is used when you open the Exam Architect.
                  </p>
                </div>
              </div>
              {/* Default difficulty removed (not implemented yet) */}
            </div>
          </section>

          {/* Team Management – placeholder only */}
          <section
            className="border-b"
            style={{ padding: '2rem', borderColor: '#e5e1da' }}
          >
            <div
              style={{
                fontSize: '0.75rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#8a8a8a',
                marginBottom: '1.5rem',
                fontWeight: 600,
              }}
            >
              Team Management
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div style={{ fontSize: '0.95rem', color: '#8a8a8a' }}>
                  Active Seats
                </div>
                <div
                  style={{
                    fontSize: '1rem',
                    color: '#1a1a1a',
                    fontWeight: 500,
                  }}
                >
                  — / —
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div style={{ fontSize: '0.95rem', color: '#8a8a8a' }}>
                  Invite Team Member
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    type="email"
                    disabled
                    placeholder="tutor@example.com"
                    style={{
                      flex: 1,
                      padding: '0.75rem 1rem',
                      borderRadius: 6,
                      border: '1px solid #e5e1da',
                      fontSize: '0.95rem',
                      color: '#1a1a1a',
                      background: '#f7f5f2',
                    }}
                  />
                  <button
                    type="button"
                    disabled
                    className="text-sm font-semibold"
                    style={{
                      padding: '0.75rem 1.5rem',
                      borderRadius: 8,
                      border: 'none',
                      background: '#c77f3e',
                      color: '#ffffff',
                      cursor: 'not-allowed',
                      opacity: 0.6,
                    }}
                  >
                    Send Invite
                  </button>
                </div>
                <p
                  style={{
                    marginTop: '0.5rem',
                    fontSize: '0.8rem',
                    color: '#8a8a8a',
                  }}
                >
                  Placeholder — team management will let you add tutors and staff.
                </p>
              </div>
            </div>
          </section>

          {/* Billing History – placeholder only */}
          <section style={{ padding: '2rem' }}>
            <div
              style={{
                fontSize: '0.75rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#8a8a8a',
                marginBottom: '1.5rem',
                fontWeight: 600,
              }}
            >
              Billing History
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-4"
                  style={{
                    padding: '1rem 0',
                    borderBottom: i === 3 ? 'none' : '1px solid #e5e1da',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: '0.9rem',
                        color: '#4a4a4a',
                        fontWeight: 500,
                      }}
                    >
                      Invoice {i}
                    </div>
                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: '#8a8a8a',
                      }}
                    >
                      Placeholder — billing history not yet implemented.
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      style={{
                        fontSize: '1rem',
                        color: '#1a1a1a',
                        fontWeight: 600,
                      }}
                    >
                      —
                    </span>
                    <button
                      type="button"
                      disabled
                      style={{
                        fontSize: '0.85rem',
                        color: '#c77f3e',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'not-allowed',
                        opacity: 0.6,
                      }}
                    >
                      Download Invoice
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {isDevMode && (
            <section style={{ padding: '1.5rem 2rem', borderTop: '1px solid #e5e1da' }}>
              <div
                style={{
                  fontSize: '0.75rem',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: '#8a8a8a',
                  fontWeight: 600,
                  marginBottom: '0.75rem',
                }}
              >
                Developer Tools
              </div>
              <div className="flex flex-wrap gap-3" style={{ alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => router.push('/dashboard/settings/dev')}
                  className="text-sm font-semibold"
                  style={{
                    padding: '0.75rem 1.5rem',
                    borderRadius: 8,
                    border: 'none',
                    background: '#c77f3e',
                    color: '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  Open Dev Tools
                </button>
                <span style={{ fontSize: '0.8rem', color: '#8a8a8a' }}>
                  Dev features are hidden on this page.
                </span>
              </div>
            </section>
          )}
        </div>

                      {showQuestionTokensModal && (
                        <div
                          style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 50,
                          }}
                          onClick={() => setShowQuestionTokensModal(false)}
                        >
                          <div
                            className="bg-white rounded-2xl p-6 max-w-2xl w-full mx-4 shadow-lg"
                            style={{ backgroundColor: 'var(--clr-surface-a0)' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-between mb-4">
                              <h2 className="text-2xl font-bold" style={{ color: 'var(--clr-primary-a50)' }}>Buy Question Tokens</h2>
                              <button
                                type="button"
                                onClick={() => setShowQuestionTokensModal(false)}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                <X size={24} />
                              </button>
                            </div>

                            <p className="text-sm mb-6" style={{ color: 'var(--clr-surface-a40)' }}>
                              Each token lets you generate one question. Choose a package below:
                            </p>

                            <div className="overflow-x-auto mb-6">
                              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr>
                                    <th style={{ fontSize: '11px', color: 'var(--clr-surface-a40)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 12px', textAlign: 'left', borderBottom: '0.5px solid var(--clr-surface-tonal-a20)' }}>Questions</th>
                                    <th style={{ fontSize: '11px', color: 'var(--clr-surface-a40)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 12px', textAlign: 'right', borderBottom: '0.5px solid var(--clr-surface-tonal-a20)' }}>Price</th>
                                    <th style={{ fontSize: '11px', color: 'var(--clr-surface-a40)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 12px', textAlign: 'right', borderBottom: '0.5px solid var(--clr-surface-tonal-a20)' }}>Per Question</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {[
                                    { key: 'questions_200', qty: 200, price: '$69', cpp: '$0.35' },
                                    { key: 'questions_400', qty: 400, price: '$129', cpp: '$0.32' },
                                    { key: 'questions_600', qty: 600, price: '$179', cpp: '$0.30' },
                                    { key: 'questions_800', qty: 800, price: '$219', cpp: '$0.27' },
                                    { key: 'questions_1000', qty: 1000, price: '$249', cpp: '$0.25' },
                                    { key: 'questions_1500', qty: 1500, price: '$324', cpp: '$0.22' },
                                    { key: 'questions_2000', qty: 2000, price: '$384', cpp: '$0.19', isBest: true },
                                  ].map((pkg) => (
                                    <tr
                                      key={pkg.key}
                                      onClick={() => {
                                        setSelectedQuestionPackage(pkg.key);
                                        handleBuyQuestionTokens(pkg.key);
                                      }}
                                      style={{
                                        cursor: 'pointer',
                                        backgroundColor: selectedQuestionPackage === pkg.key ? 'var(--clr-surface-a10)' : 'transparent',
                                        borderBottom: '0.5px solid var(--clr-surface-tonal-a20)',
                                      }}
                                      onMouseEnter={(e) => {
                                        if (selectedQuestionPackage !== pkg.key) {
                                          e.currentTarget.style.backgroundColor = 'var(--clr-surface-a5)';
                                        }
                                      }}
                                      onMouseLeave={(e) => {
                                        if (selectedQuestionPackage !== pkg.key) {
                                          e.currentTarget.style.backgroundColor = 'transparent';
                                        }
                                      }}
                                    >
                                      <td style={{ padding: '11px 12px', fontSize: '14px', color: 'var(--clr-primary-a50)', fontWeight: '500' }}>
                                        {pkg.qty}
                                      </td>
                                      <td style={{ padding: '11px 12px', fontSize: '14px', color: 'var(--clr-primary-a50)', fontWeight: '500', textAlign: 'right' }}>
                                        {pkg.price}
                                      </td>
                                      <td style={{ padding: '11px 12px', fontSize: '12px', color: 'var(--clr-surface-a40)', textAlign: 'right' }}>
                                        {pkg.cpp}
                                        {pkg.isBest && (
                                          <span
                                            style={{
                                              display: 'inline-block',
                                              backgroundColor: '#D1FAE5',
                                              color: '#065F46',
                                              fontSize: '10px',
                                              padding: '2px 7px',
                                              borderRadius: '4px',
                                              marginLeft: '6px',
                                              verticalAlign: 'middle',
                                            }}
                                          >
                                            best value
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                if (selectedQuestionPackage) {
                                  handleBuyQuestionTokens(selectedQuestionPackage);
                                }
                              }}
                              disabled={!selectedQuestionPackage || isProcessingQuestionTokenPurchase}
                              className="w-full px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              style={{
                                backgroundColor: selectedQuestionPackage ? 'var(--clr-primary-a50)' : 'var(--clr-surface-a20)',
                                color: 'var(--clr-surface-a0)',
                              }}
                            >
                              {isProcessingQuestionTokenPurchase
                                ? 'Processing...'
                                : `Buy ${selectedQuestionPackage ? selectedQuestionPackage.split('_')[1] : ''} Question Tokens`}
                            </button>

                            {questionTokenPurchaseMessage && (
                              <div
                                className="p-3 rounded-lg mb-4 text-sm"
                                style={{
                                  backgroundColor: questionTokenPurchaseMessage.includes('Failed') ? '#FEE2E2' : '#D1FAE5',
                                  color: questionTokenPurchaseMessage.includes('Failed') ? '#991B1B' : '#065F46',
                                }}
                              >
                                {questionTokenPurchaseMessage}
                              </div>
                            )}

                            <p className="text-xs" style={{ color: 'var(--clr-surface-a40)' }}>
                              You'll be redirected to Stripe to complete your purchase. Your tokens will be added to your account immediately after payment is confirmed.
                            </p>
                          </div>
                        </div>
                      )}

                      {showDeveloperTools && isDevMode && (
                        <>
                        <div
                          className="p-6 rounded-2xl border mt-6"
                          style={{
                            backgroundColor: 'var(--clr-surface-a10)',
                            borderColor: 'var(--clr-surface-tonal-a20)',
                          }}
                        >
                          <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--clr-primary-a50)' }}>Subscription Testing (Dev)</h2>
                          <p className="text-sm mb-4" style={{ color: 'var(--clr-surface-a40)' }}>
                            Use the <code>/api/dev/set-plan</code> endpoint from the browser console to change your plan for testing:
                          </p>
                          <pre
                            className="rounded-lg p-3 text-xs overflow-x-auto mb-3"
                            style={{ backgroundColor: 'var(--clr-surface-a0)', color: 'var(--clr-primary-a50)', border: '1px solid var(--clr-surface-tonal-a20)' }}
                          >{`// Set plan to 'standard' (30 exam generation tokens/month):
await fetch('/api/dev/set-plan', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + localStorage.getItem('token')
  },
  body: JSON.stringify({ plan: 'standard' })
}).then(r => r.json()).then(console.log);

// Set plan to 'pro' (100 exam generation tokens/month):
// body: { plan: 'pro' }

// Set exports used to 29 (1 left on standard):
// body: { plan: 'standard', exportsUsed: 29 }

// Reset to free plan:
// body: { plan: 'free' }

// Reset exports only (keep plan):
// body: { resetExports: true }`}</pre>
                          <p className="text-xs" style={{ color: 'var(--clr-surface-a40)' }}>
                            Only available in non-production environments.
                          </p>
                        </div>
                        <div
                          className="p-6 rounded-2xl border mt-6"
                          style={{
                            backgroundColor: 'var(--clr-surface-a10)',
                            borderColor: 'var(--clr-surface-tonal-a20)',
                          }}
                        >
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
                          <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--clr-primary-a50)' }}>
                            Unspecified Topic Classifier
                          </h2>
                          <p className="text-sm mb-4" style={{ color: 'var(--clr-surface-a40)' }}>
                            Developer-only: send question text and question image (if present) to GPT, constrained to taxonomy topics/subtopics for this paper context.
                          </p>

                          <div className="space-y-4">
                            <div>
                              <label className="text-sm font-medium" style={{ color: 'var(--clr-surface-a50)' }}>
                                Questions to process
                              </label>
                              <input
                                type="number"
                                min={1}
                                max={200}
                                step={1}
                                value={unspecifiedTopicLimit}
                                onChange={(e) => {
                                  const parsed = Number.parseInt(e.target.value, 10);
                                  setUnspecifiedTopicLimit(Number.isFinite(parsed) ? parsed : 1);
                                }}
                                disabled={isClassifyingUnspecifiedTopics}
                                className="mt-2 w-full px-4 py-2 rounded-lg border"
                                style={{
                                  backgroundColor: 'var(--clr-surface-a0)',
                                  borderColor: 'var(--clr-surface-tonal-a20)',
                                  color: 'var(--clr-primary-a50)',
                                }}
                              />
                              <p className="mt-2 text-xs" style={{ color: 'var(--clr-surface-a40)' }}>
                                Uses the selected exam above. Year 11/12 papers automatically include both Year 11 and Year 12 taxonomy topics/subtopics.
                              </p>
                            </div>

                            <div className="flex items-center gap-3">
                              <button
                                onClick={runUnspecifiedTopicClassification}
                                disabled={isClassifyingUnspecifiedTopics || availablePapers.length === 0 || !selectedSyllabusMappingPaper}
                                className="px-4 py-2 rounded-lg font-medium cursor-pointer disabled:opacity-50"
                                style={{
                                  backgroundColor: 'var(--clr-primary-a0)',
                                  color: 'var(--clr-dark-a0)',
                                }}
                              >
                                {isClassifyingUnspecifiedTopics ? 'Classifying...' : 'Classify Unspecified Topics'}
                              </button>
                              {unspecifiedTopicResult && (
                                <span
                                  className="text-sm"
                                  style={{
                                    color:
                                      unspecifiedTopicStatus === 'error'
                                        ? 'var(--clr-danger-a10)'
                                        : unspecifiedTopicStatus === 'success'
                                          ? 'var(--clr-success-a10)'
                                          : 'var(--clr-surface-a50)',
                                  }}
                                >
                                  {unspecifiedTopicResult}
                                </span>
                              )}
                            </div>

                            {unspecifiedTopicOutputs.length > 0 && (
                              <div
                                className="mt-3 rounded-xl border p-4 max-h-96 overflow-y-auto custom-scrollbar"
                                style={{
                                  backgroundColor: 'var(--clr-surface-a0)',
                                  borderColor: 'var(--clr-surface-tonal-a20)',
                                }}
                              >
                                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--clr-primary-a50)' }}>
                                  Classification Output
                                </h3>
                                <div className="space-y-3">
                                  {unspecifiedTopicOutputs.map((entry, index) => {
                                    const topic = String(entry?.topic || '').trim();
                                    const subtopic = String(entry?.subtopic || '').trim();
                                    const reason = String(entry?.reason || '').trim();
                                    const rawText = String(entry?.rawTextOutput || entry?.rawModelOutput || '').trim();
                                    return (
                                      <div
                                        key={`${entry?.questionId || 'q'}-${index}`}
                                        className="rounded-lg border p-3"
                                        style={{
                                          backgroundColor: 'var(--clr-surface-a10)',
                                          borderColor: 'var(--clr-surface-tonal-a20)',
                                        }}
                                      >
                                        <p className="text-xs font-medium mb-2" style={{ color: 'var(--clr-surface-a50)' }}>
                                          Q{entry?.questionNumber || 'unknown'} • {entry?.success ? `${topic} → ${subtopic}` : 'Failed'}
                                        </p>
                                        {reason && (
                                          <p className="text-xs mb-2" style={{ color: 'var(--clr-surface-a40)' }}>
                                            {reason}
                                          </p>
                                        )}
                                        {rawText && (
                                          <pre
                                            className="text-xs whitespace-pre-wrap break-words rounded-md p-2 mt-2"
                                            style={{
                                              backgroundColor: 'var(--clr-dark-a0)',
                                              color: 'var(--clr-light-a0)',
                                            }}
                                          >
                                            {rawText}
                                          </pre>
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

                      {showDeveloperTools && isDevMode && (
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

                      {showDeveloperTools && isDevMode && (
                        <div
                          className="p-6 rounded-2xl border mt-6"
                          style={{
                            backgroundColor: 'var(--clr-surface-a10)',
                            borderColor: 'var(--clr-surface-tonal-a20)',
                          }}
                        >
                          <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--clr-primary-a50)' }}>
                            PDF Image Extraction (Dev)
                          </h2>
                          <p className="text-sm mb-4" style={{ color: 'var(--clr-surface-a40)' }}>
                            Upload a PDF to extract embedded images so you can inspect and download them.
                          </p>
                          <PdfImageExtractor />
                        </div>
                      )}
                    </div>
                  </div>
  );
}
