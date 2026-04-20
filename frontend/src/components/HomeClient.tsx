"use client";

import React, { useState, useEffect } from 'react';
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Send, Loader2, CheckCircle, AlertCircle, RefreshCcw, LogOut, FileText, Upload, Link as LinkIcon, Check, Sparkles, XCircle } from 'lucide-react';

interface AuditResponse {
  analysis_report: string[];
  draft_bullets: string[];
  audit_feedback: string;
  iteration_count: number;
  thread_id?: string;
  status?: 'waiting' | 'completed';
  full_resume?: string | null;
}

type StreamEvent =
  | { type: 'stage'; label: string }
  | { type: 'result' } & AuditResponse
  | { type: 'error'; detail: string };

// apiBaseUrl is passed as a prop for runtime configuration

function parseNdjsonLine(line: string): StreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as StreamEvent;
  } catch {
    return null;
  }
}

interface HomeClientProps {
  authEnabled: boolean;
  apiBaseUrl: string;
}

export default function HomeClient({ authEnabled, apiBaseUrl }: HomeClientProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [resumeText, setResumeText] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jd, setJd] = useState('');
  const [loading, setLoading] = useState(false);
  const [pipelineStages, setPipelineStages] = useState<string[]>([]);
  const [result, setResult] = useState<AuditResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const processStream = async (response: Response) => {
    const reader = response.body?.getReader();
    if (!reader) {
      setError('No response body from server.');
      return false;
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
          console.log("Received result:", evt);
          setResult({
            analysis_report: evt.analysis_report,
            draft_bullets: evt.draft_bullets,
            audit_feedback: evt.audit_feedback,
            iteration_count: evt.iteration_count,
            thread_id: evt.thread_id,
            status: evt.status,
            full_resume: evt.full_resume,
          });
          receivedResult = true;
        } else if (evt.type === 'error') {
          console.error("Received error:", evt.detail);
          setError(evt.detail);
          return false;
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
          thread_id: evt.thread_id,
          status: evt.status,
          full_resume: evt.full_resume,
        });
        receivedResult = true;
      } else if (evt?.type === 'error') {
        setError(evt.detail);
        return false;
      }
    }
    return receivedResult;
  };

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

      const success = await processStream(response);
      if (!success && !error) {
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

  const handleConfirm = async (approve: boolean) => {
    if (!result?.thread_id) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/audit/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thread_id: result.thread_id,
          approve,
        }),
      });

      if (!response.ok) {
        setError(`Confirmation failed (${response.status})`);
        return;
      }

      await processStream(response);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to continue audit.');
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
                      Agents are working on your resume
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
                  Invoking agents...
                </div>
              )}

              {loading && pipelineStages.length > 0 && (
                <div
                  className="space-y-3 mb-4"
                  role="status"
                  aria-live="polite"
                >
                  <div className="flex items-center gap-2 p-3 rounded-lg border border-blue-200 bg-blue-50/90 font-mono text-[11px] leading-snug text-blue-800">
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-600" aria-hidden />
                    <span className="font-medium">{pipelineStages[pipelineStages.length - 1]}</span>
                  </div>
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
                  {/* Analysis Report */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">Identified Gaps</h3>
                    {(result.analysis_report || []).length > 0 ? (
                      <ul className="space-y-1">
                        {result.analysis_report.map((gap, i) => (
                          <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                            <span className="text-blue-500 font-bold">•</span> {gap}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-500 italic">No specific gaps identified.</p>
                    )}
                  </div>

                  {/* HITL Prompt */}
                  {result.status === 'waiting' && !loading && (
                    <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl space-y-4 shadow-sm border-l-4 border-l-amber-500">
                      <div className="flex items-start gap-3">
                        <Sparkles className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-amber-900 mb-1">
                            Would you like to rewrite your resume?
                          </p>
                          <p className="text-xs text-amber-700 leading-relaxed">
                            The agents can rewrite your experience bullets using the STAR method to address the identified gaps while ensuring they remain fact-grounded.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleConfirm(true)}
                          disabled={loading}
                          className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white text-sm font-bold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                          Yes, Rewrite
                        </button>
                        <button
                          onClick={() => handleConfirm(false)}
                          disabled={loading}
                          className="flex-1 bg-white hover:bg-slate-50 disabled:bg-slate-100 text-slate-700 border border-slate-300 text-sm font-bold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                          No, I'm Done
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Draft Bullets - Only show after user decides or if completed */}
                  {result.draft_bullets && result.draft_bullets.length > 0 && result.status === 'completed' && (
                    <div className="space-y-6 animate-in fade-in duration-500">
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
                      {result.audit_feedback && (
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
                      )}
                    </div>
                  )}

                  {/* Optimized Full Resume */}
                  {result.full_resume && result.status === 'completed' && (
                    <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-700">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Optimized Full Resume</h3>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(result.full_resume || '');
                          }}
                          className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-tight flex items-center gap-1"
                        >
                          <FileText className="h-3 w-3" /> Copy to Clipboard
                        </button>
                      </div>
                      <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm font-serif text-sm text-slate-800 leading-relaxed whitespace-pre-wrap max-h-[600px] overflow-y-auto">
                        {result.full_resume}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
