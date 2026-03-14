// @ts-nocheck
'use client';

import React from 'react';
import { RefreshCw } from 'lucide-react';

interface Props {
  [key: string]: any;
}

export default function PapersView({
  loadingQuestions, questionsFetchError, availablePapers, startPaperAttempt,
}: Props) {
  return (
                <>
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                    <div>
                      <h1
                        className="text-4xl font-bold mb-2"
                        style={{ color: 'var(--clr-primary-a50)' }}
                      >Browse HSC Papers</h1>
                      <p
                        className="text-lg"
                        style={{ color: 'var(--clr-surface-a40)' }}
                      >Select a paper to start a full exam attempt.</p>
                    </div>
                  </div>

                  {loadingQuestions ? (
                    <div className="flex items-center justify-center min-h-[240px]">
                      <RefreshCw className="w-8 h-8 animate-spin" style={{ color: 'var(--clr-surface-a40)' }} />
                    </div>
                  ) : questionsFetchError ? (
                    <div className="text-center py-16">
                      <p className="text-lg" style={{ color: 'var(--clr-warning-a10)' }}>Could not load questions</p>
                      <p className="text-sm mt-2 max-w-md mx-auto" style={{ color: 'var(--clr-surface-a50)' }}>{questionsFetchError}</p>
                      <p className="text-xs mt-2" style={{ color: 'var(--clr-surface-a40)' }}>Check DATABASE_URL or NEON_DATABASE_URL in .env.local</p>
                    </div>
                  ) : availablePapers.length === 0 ? (
                    <div className="text-center py-16">
                      <p className="text-lg" style={{ color: 'var(--clr-surface-a40)' }}>No papers available yet.</p>
                      <p className="text-sm mt-2" style={{ color: 'var(--clr-surface-a50)' }}>Upload exam questions to create papers.</p>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {availablePapers.map((paper) => (
                        <button
                          key={`${paper.year}-${paper.grade}-${paper.subject}-${paper.school}`}
                          onClick={() => startPaperAttempt(paper)}
                          className="text-left border rounded-2xl p-6 transition-all hover:-translate-y-0.5 hover:shadow-xl cursor-pointer"
                          style={{
                            backgroundColor: 'var(--clr-surface-a10)',
                            borderColor: 'var(--clr-surface-tonal-a20)',
                          }}
                        >
                          <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--clr-surface-a40)' }}>
                            {paper.year}
                          </div>
                          <div className="text-xl font-semibold mt-2" style={{ color: 'var(--clr-primary-a50)' }}>
                            {paper.subject}
                          </div>
                          <div className="text-sm mt-1" style={{ color: 'var(--clr-surface-a50)' }}>
                            {paper.grade}
                          </div>
                          <div className="text-xs mt-2" style={{ color: 'var(--clr-surface-a40)' }}>
                            {paper.school || 'HSC'}
                          </div>
                          <div className="text-xs mt-4" style={{ color: 'var(--clr-surface-a40)' }}>
                            {paper.count} question{paper.count === 1 ? '' : 's'} available
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
  );
}
