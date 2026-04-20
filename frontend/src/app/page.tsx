"use client";

import React, { useState, useEffect } from 'react';
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Send, Loader2, CheckCircle, AlertCircle, RefreshCcw, LogOut, FileText, Upload, Link as LinkIcon, Check } from 'lucide-react';

interface AuditResponse {
  analysis_report: string[];
  draft_bullets: string[];
  audit_feedback: string;
  iteration_count: number;
}

type StreamEvent =
  | { type: 'stage'; label: string }
  | { type: 'result' } & AuditResponse
  | { type: 'error'; detail: string };

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

function parseNdjsonLine(line: string): StreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as StreamEvent;
  } catch {
    return null;
  }
}

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [resumeText, setResumeText] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jd, setJd] = useState('');
  const [loading, setLoading] = useState(false);
  const [pipelineStages, setPipelineStages] = useState<string[]>([]);
  const [result, setResult] = useState<AuditResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED !== 'false';

  useEffect(() => {
    if (authEnabled && status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router, authEnabled]);

  if (authEnabled && (status === "loading" || !session)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const handleAudit = async () => {
    if ((!resumeText && !resumeFile) || !jd) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setPipelineStages([]);

    const formData = new FormData();
    if (resumeFile) {
      formData.append('resume_file', resumeFile);
    } else {
      formData.append('resume_text', resumeText);
    }
    formData.append('jd_input', jd);

    try {
      const response = await fetch(`${apiBaseUrl}/audit/stream`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let detail = `Request failed (${response.status})`;
        try {
          const errBody = await response.json();
          if (errBody && typeof errBody === 'object' && 'detail' in errBody) {
            detail = String((errBody as { detail: unknown }).detail);
          }
        } catch {
          const text = await response.text();
          if (text) detail = text.slice(0, 200);
        }
        setError(detail);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setError('No response body from server.');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let receivedResult = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const evt = parseNdjsonLine(line);
          if (!evt) continue;

          if (evt.type === 'stage') {
            setPipelineStages((prev) => [...prev, evt.label]);
          } else if (evt.type === 'result') {
            setResult({
              analysis_report: evt.analysis_report,
              draft_bullets: evt.draft_bullets,
              audit_feedback: evt.audit_feedback,
              iteration_count: evt.iteration_count,
            });
            receivedResult = true;
          } else if (evt.type === 'error') {
            setError(evt.detail);
            return;
          }
        }
      }

      if (buffer.trim()) {
        const evt = parseNdjsonLine(buffer);
        if (evt?.type === 'result') {
          setResult({
            analysis_report: evt.analysis_report,
            draft_bullets: evt.draft_bullets,
            audit_feedback: evt.audit_feedback,
            iteration_count: evt.iteration_count,
          });
          receivedResult = true;
        } else if (evt?.type === 'error') {
          setError(evt.detail);
          return;
        }
      }

      if (!receivedResult) {
        setError('No result payload from server.');
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to connect to the Agentic Engine. Make sure the backend is running.'
      );
    } finally {
      setLoading(false);
    }
  };

  const lastStageIndex = pipelineStages.length - 1;

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <RefreshCcw className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">JDAlign</h1>
              <p className="text-xs text-slate-500">Agentic Resume Auditor</p>
            </div>
          </div>
          
          {authEnabled && session && (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-900">{session.user?.name}</p>
                <p className="text-xs text-slate-500">{session.user?.email}</p>
              </div>
              <button
                onClick={() => signOut()}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
                title="Sign Out"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                User Inputs
              </h2>
              <div className="space-y-6">
                {/* Resume Input */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Your Resume
                  </label>
                  
                  <div className="space-y-3">
                    {/* File Upload */}
                    <div className="relative border-2 border-dashed border-slate-300 rounded-lg p-4 hover:border-blue-500 transition-colors group">
                      <input
                        type="file"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        accept=".pdf,.docx,.txt,.md"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            setResumeFile(e.target.files[0]);
                            setResumeText('');
                          }
                        }}
                      />
                      <div className="flex flex-col items-center justify-center space-y-1 text-slate-500">
                        <Upload className="h-8 w-8 group-hover:text-blue-500" />
                        <p className="text-sm">
                          {resumeFile ? resumeFile.name : 'Upload PDF, DOCX, TXT, or MD'}
                        </p>
                      </div>
                    </div>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center" aria-hidden="true">
                        <div className="w-full border-t border-slate-200"></div>
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white px-2 text-slate-400 font-medium tracking-wider">Or paste text</span>
                      </div>
                    </div>

                    <textarea
                      className="w-full h-32 p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm text-black"
                      placeholder="Paste your resume content here..."
                      value={resumeText}
                      onChange={(e) => {
                        setResumeText(e.target.value);
                        setResumeFile(null);
                      }}
                    />
                  </div>
                </div>

                {/* JD Input */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                    <LinkIcon className="h-4 w-4" /> Job Description (Text or URL)
                  </label>
                  <textarea
                    className="w-full h-40 p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm text-black"
                    placeholder="Paste the job description text OR a direct link to the posting..."
                    value={jd}
                    onChange={(e) => setJd(e.target.value)}
                  />
                  <p className="mt-1 text-[10px] text-slate-400 italic">
                    URLs must start with http:// or https://
                  </p>
                </div>

                <button
                  onClick={handleAudit}
                  disabled={loading || (!resumeText && !resumeFile) || !jd}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-medium py-3 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin h-5 w-5" />
                      Agents are Thinking...
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5" />
                      Start Agentic Audit
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Output Section */}
          <div className="space-y-6">
            <div
              className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 min-h-[500px]"
              aria-busy={loading}
            >
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 flex-wrap">
                Audit Results
                {loading && (
                  <Loader2
                    className="h-5 w-5 animate-spin text-blue-600 shrink-0"
                    aria-hidden
                  />
                )}
              </h2>

              {loading && pipelineStages.length === 0 && (
                <div
                  className="flex flex-col items-center justify-center min-h-[320px] px-4 text-center text-slate-500 text-sm"
                  role="status"
                >
                  <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" aria-hidden />
                  Starting agent pipeline…
                </div>
              )}

              {loading && pipelineStages.length > 0 && (
                <div
                  className="space-y-3 mb-4"
                  role="status"
                  aria-live="polite"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Live pipeline (same stages as server logs)
                  </p>
                  <ul className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/90 p-3 max-h-[min(360px,50vh)] overflow-y-auto">
                    {pipelineStages.map((label, i) => {
                      const isLast = i === lastStageIndex;
                      return (
                        <li
                          key={`${i}-${label.slice(0, 24)}`}
                          className="flex items-start gap-2 font-mono text-[11px] leading-snug text-slate-800"
                        >
                          {isLast ? (
                            <Loader2 className="h-3.5 w-3.5 shrink-0 mt-0.5 animate-spin text-blue-600" aria-hidden />
                          ) : (
                            <Check className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-600" aria-hidden />
                          )}
                          <span className={isLast ? 'font-medium' : 'text-slate-600'}>{label}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {!result && !loading && !error && (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2 mt-20">
                  <RefreshCcw className="h-12 w-12 opacity-20" />
                  <p>Results will appear here after analysis.</p>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {result && (
                <div className="space-y-6 animate-in fade-in duration-500">
                  {pipelineStages.length > 0 && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
                        Pipeline trace
                      </p>
                      <ul className="space-y-1.5 max-h-32 overflow-y-auto font-mono text-[11px] text-slate-700">
                        {pipelineStages.map((label, i) => (
                          <li key={`done-${i}-${label.slice(0, 16)}`} className="flex gap-2">
                            <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 mt-0.5" aria-hidden />
                            <span>{label}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Analysis Report */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">Identified Gaps</h3>
                    <ul className="space-y-1">
                      {result.analysis_report.map((gap, i) => (
                        <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                          <span className="text-blue-500 font-bold">•</span> {gap}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Draft Bullets */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">Optimized Bullets</h3>
                    <div className="space-y-3">
                      {result.draft_bullets.map((bullet, i) => (
                        <div key={i} className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-slate-800 leading-relaxed">
                          {bullet}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Audit Feedback */}
                  <div className={`p-4 rounded-lg border ${result.audit_feedback.includes('APPROVED') ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {result.audit_feedback.includes('APPROVED') ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-amber-600" />
                      )}
                      <span className="font-bold text-slate-900">
                        Agent Verification
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {result.audit_feedback}
                    </p>
                    <div className="mt-2 text-[10px] text-slate-400 font-medium italic">
                      Finalized in {result.iteration_count} agentic iterations.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
