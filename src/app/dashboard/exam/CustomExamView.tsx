'use client';

import React from 'react';
import { ArrowLeft, BookOpen, Eye, EyeOff } from 'lucide-react';
import { LatexText, QuestionTextWithDividers } from '../question-text-with-dividers';
import { stripOuterBraces } from '../view-helpers';

type CustomExamQuestion = {
  id: string;
  question_number?: string | null;
  subject: string;
  topic: string;
  subtopic?: string | null;
  year: number;
  school_name?: string | null;
  marks: number;
  question_text: string;
  question_type?: 'written' | 'multiple_choice' | null;
  sample_answer?: string | null;
  sample_answer_image?: string | null;
  sample_answer_image_size?: 'small' | 'medium' | 'large' | null;
  graph_image_data?: string | null;
  graph_image_size?: 'small' | 'medium' | 'large' | null;
  mcq_option_a?: string | null;
  mcq_option_b?: string | null;
  mcq_option_c?: string | null;
  mcq_option_d?: string | null;
  mcq_option_a_image?: string | null;
  mcq_option_b_image?: string | null;
  mcq_option_c_image?: string | null;
  mcq_option_d_image?: string | null;
  mcq_correct_answer?: 'A' | 'B' | 'C' | 'D' | null;
  mcq_explanation?: string | null;
};

export default function CustomExamView({
  examTitle,
  examMeta,
  questions,
  onBack,
}: {
  examTitle: string;
  examMeta?: string | null;
  questions: CustomExamQuestion[];
  onBack: () => void;
}) {
  const [showSolutions, setShowSolutions] = React.useState(false);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col gap-5 rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 text-sm font-medium text-neutral-500 transition hover:text-neutral-900 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Exam Architect
            </button>
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-neutral-400">Generated exam</p>
              <h1 className="text-4xl font-light text-neutral-900">
                {examTitle} <span className="font-bold italic">Questions</span>
              </h1>
              {examMeta ? <p className="text-sm text-neutral-500">{examMeta}</p> : null}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowSolutions((prev) => !prev)}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 cursor-pointer"
          >
            {showSolutions ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showSolutions ? 'Hide Solutions' : 'View Solutions'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 pb-1">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-t-2xl border border-b-0 border-neutral-200 bg-neutral-900 px-4 py-3 text-sm font-semibold text-white cursor-default"
            aria-current="page"
          >
            <BookOpen className="h-4 w-4" />
            Questions
          </button>
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-neutral-400">
            {questions.length} question{questions.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {!questions.length ? (
        <div className="rounded-[2rem] border border-dashed border-neutral-200 bg-white p-12 text-center text-neutral-500">
          No questions are available for this custom exam yet.
        </div>
      ) : (
        <div className="space-y-8">
          {questions.map((question, index) => {
            const isMcq = question.question_type === 'multiple_choice';
            const options = [
              { label: 'A' as const, text: stripOuterBraces(question.mcq_option_a || ''), image: question.mcq_option_a_image || null },
              { label: 'B' as const, text: stripOuterBraces(question.mcq_option_b || ''), image: question.mcq_option_b_image || null },
              { label: 'C' as const, text: stripOuterBraces(question.mcq_option_c || ''), image: question.mcq_option_c_image || null },
              { label: 'D' as const, text: stripOuterBraces(question.mcq_option_d || ''), image: question.mcq_option_d_image || null },
            ].filter((option) => option.text || option.image);

            return (
              <section key={`${question.id}-${index}`} className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm md:p-8">
                <div className="flex flex-col gap-4 border-b border-neutral-100 pb-6 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-[0.3em] text-neutral-400">
                      Question {question.question_number || index + 1}
                    </p>
                    <h2 className="text-2xl font-semibold text-neutral-900">
                      {question.marks} mark{question.marks === 1 ? '' : 's'}
                    </h2>
                    <p className="text-sm text-neutral-500">
                      {question.topic}
                      {question.subtopic ? ` • ${question.subtopic}` : ''}
                    </p>
                  </div>
                  <div className="text-sm text-neutral-500 md:text-right">
                    <p className="font-semibold text-neutral-700">{question.subject}</p>
                    <p>{question.year} {question.school_name || 'HSC'}</p>
                  </div>
                </div>

                <div className="space-y-6 pt-6">
                  <div className="rounded-[1.5rem] border border-neutral-200 bg-neutral-50 p-5 font-serif text-neutral-900">
                    <QuestionTextWithDividers text={question.question_text} />
                  </div>

                  {question.graph_image_data ? (
                    <div className="rounded-[1.5rem] border border-neutral-200 bg-white p-4">
                      <img
                        src={question.graph_image_data}
                        alt={`Question ${question.question_number || index + 1} graph`}
                        className={`mx-auto h-auto rounded-xl graph-image graph-image--${question.graph_image_size || 'medium'}`}
                      />
                    </div>
                  ) : null}

                  {isMcq && options.length > 0 ? (
                    <div className="space-y-3">
                      {options.map((option) => (
                        <div key={option.label} className="rounded-[1.25rem] border border-neutral-200 bg-white px-4 py-3">
                          <div className="flex items-start gap-3">
                            <span className="pt-0.5 text-sm font-bold text-neutral-700">{option.label}.</span>
                            <div className="min-w-0 flex-1 font-serif text-neutral-900">
                              {option.image ? (
                                <img src={option.image} alt={`Option ${option.label}`} className="max-w-full rounded-lg" />
                              ) : (
                                <LatexText text={option.text} />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {showSolutions ? (
                    <div className="rounded-[1.5rem] border border-[#b5a45d]/30 bg-amber-50/60 p-5">
                      <div className="mb-3 flex items-center gap-2">
                        <Eye className="h-4 w-4 text-[#8a7831]" />
                        <h3 className="text-sm font-bold uppercase tracking-[0.25em] text-[#8a7831]">Solutions</h3>
                      </div>
                      {isMcq ? (
                        <div className="space-y-3 text-neutral-800">
                          {question.mcq_correct_answer ? (
                            <p className="text-sm font-semibold">
                              Correct answer: <span className="text-[#8a7831]">{question.mcq_correct_answer}</span>
                            </p>
                          ) : null}
                          {question.mcq_explanation ? (
                            <LatexText text={stripOuterBraces(question.mcq_explanation)} />
                          ) : (
                            <p className="text-sm text-neutral-500">No solution explanation is available for this question yet.</p>
                          )}
                        </div>
                      ) : question.sample_answer || question.sample_answer_image ? (
                        <div className="space-y-4 text-neutral-800">
                          {question.sample_answer ? <LatexText text={question.sample_answer} /> : null}
                          {question.sample_answer_image ? (
                            <img src={question.sample_answer_image} alt="Sample solution" className="w-full rounded-xl border border-neutral-200 bg-white" />
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-sm text-neutral-500">No written solution is available for this question yet.</p>
                      )}
                    </div>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
