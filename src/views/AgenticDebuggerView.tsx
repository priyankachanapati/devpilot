import React, { useState, useEffect } from 'react';
import {
  Bug,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  ArrowRight,
  GitPullRequest,
  Check,
  ShieldCheck,
  TestTube,
  Terminal,
  Sparkles,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { Project, WorkflowSession, AgentTask, ProposedPatch } from '../types/index.ts';
import { AgentFlowVisualizer } from '../components/AgentFlowVisualizer.tsx';
import { DiffViewer } from '../components/DiffViewer.tsx';

interface AgenticDebuggerViewProps {
  project: Project | null;
  initialPrompt?: string;
  onNavigateToPatch: (patchId: string) => void;
}

export const AgenticDebuggerView: React.FC<AgenticDebuggerViewProps> = ({
  project,
  initialPrompt = '',
  onNavigateToPatch,
}) => {
  const [errorPrompt, setErrorPrompt] = useState(initialPrompt);
  const [currentSession, setCurrentSession] = useState<WorkflowSession | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [liveLog, setLiveLog] = useState<string[]>([]);

  useEffect(() => {
    if (initialPrompt) {
      setErrorPrompt(initialPrompt);
    }
  }, [initialPrompt]);

  const handleStartInvestigation = async () => {
    if (!project || !errorPrompt.trim() || isRunning) return;

    setIsRunning(true);
    setErrorMessage(null);
    setLiveLog(['[Orchestrator] Initializing multi-agent session...']);

    // Setup initial placeholder session
    const initialTasks: AgentTask[] = [
      { id: '1', agentName: 'Planner', status: 'pending', summary: 'Analyzing issue' },
      { id: '2', agentName: 'Repository Analyst', status: 'pending', summary: 'RAG context retrieval' },
      { id: '3', agentName: 'Debugging Agent', status: 'pending', summary: 'Root cause hypotheses' },
      { id: '4', agentName: 'Security & Quality', status: 'pending', summary: 'Vulnerability audit' },
      { id: '5', agentName: 'Testing & Verification', status: 'pending', summary: 'Sandboxed verification' },
      { id: '6', agentName: 'Review Agent', status: 'pending', summary: 'Final adversarial review' },
    ];

    const tempSession: WorkflowSession = {
      id: `sess_init_${Date.now()}`,
      projectId: project.id,
      type: 'debug',
      title: errorPrompt,
      userPrompt: errorPrompt,
      createdAt: new Date().toISOString(),
      status: 'active',
      agents: initialTasks,
    };
    setCurrentSession(tempSession);

    try {
      const res = await fetch('/api/workflows/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          prompt: errorPrompt.trim(),
          type: 'debug',
        }),
      });

      const startData = await res.json();
      if (!res.ok) {
        throw new Error(startData.error || 'Failed to start agent workflow');
      }

      const activeSessionId = startData.sessionId;
      if (startData.session) {
        setCurrentSession(startData.session);
      }

      // 1. Setup EventSource for real-time SSE stream
      let eventSource: EventSource | null = null;
      try {
        eventSource = new EventSource(`/api/sessions/${activeSessionId}/stream`);
        eventSource.onmessage = (e) => {
          try {
            const ev = JSON.parse(e.data);
            if (ev.message) {
              setLiveLog(prev => [...prev, `[${ev.agentName || 'Agent'}] ${ev.message}`]);
            }
            if (ev.session) {
              setCurrentSession(ev.session);
            }
            if (ev.type === 'workflow_complete' || ev.type === 'workflow_error') {
              setIsRunning(false);
              eventSource?.close();
            }
          } catch {
            // Ignore
          }
        };
        eventSource.onerror = () => {
          eventSource?.close();
        };
      } catch {
        // Fallback to polling
      }

      // 2. Poll the exact active session ID as backup
      const pollInterval = setInterval(async () => {
        try {
          const sessionRes = await fetch(`/api/sessions/${activeSessionId}`);
          if (sessionRes.ok) {
            const latestSession: WorkflowSession = await sessionRes.json();
            setCurrentSession(latestSession);

            if (latestSession.status === 'completed' || latestSession.status === 'failed') {
              clearInterval(pollInterval);
              setIsRunning(false);
              eventSource?.close();
              if (latestSession.status === 'failed' && latestSession.failureReason) {
                setErrorMessage(latestSession.failureReason);
              }
              setLiveLog(prev => [
                ...prev,
                `[Workflow Engine] Session ${latestSession.id} finished with status: ${latestSession.status}`,
              ]);
            }
          }
        } catch {
          // Ignore transient poll error
        }
      }, 1500);

      // Timeout safety after 90s
      setTimeout(() => {
        clearInterval(pollInterval);
        eventSource?.close();
        setIsRunning(false);
      }, 90000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Workflow launch failed');
      setIsRunning(false);
    }
  };

  const sampleBugs = [
    'Investigate concurrency race condition in payment transfer where double-spending can occur during parallel requests',
    'Unhandled promise rejection crash in webhook listener when payload is corrupted',
    'SQL injection vulnerability in user record query with unsanitized parameters',
    'JWT algorithm "none" authentication bypass vulnerability in token verification',
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-200 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-amber-400 mb-1">
            <Bug className="w-4 h-4" />
            <span>Multi-Agent Autonomous Debugger</span>
          </div>
          <h1 className="text-xl font-bold text-slate-100">
            Investigate &amp; Propose Verifiable Fixes
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Orchestrates Planner, Repository Analyst, Debugger, Security, Tester, and Review agents to isolate root cause, generate tests, and formulate minimal patches.
          </p>
        </div>

        {currentSession?.patch && (
          <button
            onClick={() => onNavigateToPatch(currentSession.patch!.id)}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition flex items-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            <GitPullRequest className="w-4 h-4" />
            <span>Review Proposed Patch &rarr;</span>
          </button>
        )}
      </div>

      {/* Input Formulation Card */}
      <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-2">
            Error Description, Bug Report, or Target Behavior:
          </label>
          <textarea
            rows={3}
            value={errorPrompt}
            onChange={e => setErrorPrompt(e.target.value)}
            disabled={isRunning}
            placeholder="e.g. When two transfer requests arrive concurrently for the same user, both pass balance checks and result in negative wallet balance..."
            className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono leading-relaxed"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-500">Quick Scenarios:</span>
            {sampleBugs.map((bug, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setErrorPrompt(bug)}
                disabled={isRunning}
                className="px-2.5 py-1 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-[11px] text-slate-300 border border-slate-700/60 transition truncate max-w-xs"
              >
                {bug.split(' ').slice(0, 4).join(' ')}...
              </button>
            ))}
          </div>

          <button
            onClick={handleStartInvestigation}
            disabled={!errorPrompt.trim() || isRunning}
            className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition flex items-center gap-2 shadow-lg shadow-cyan-500/20 disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin" />
                <span>Investigating Across Agents...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-slate-950" />
                <span>Start Agent Investigation</span>
              </>
            )}
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-lg border border-rose-500/40 bg-rose-950/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Workflow Progress Visualizer */}
      {currentSession && (
        <AgentFlowVisualizer tasks={currentSession.agents} />
      )}

      {/* Investigation Plan (Planner Agent) */}
      {currentSession?.plan && (
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="flex items-center space-x-2 text-xs font-semibold text-sky-400 mb-2">
            <Layers className="w-4 h-4" />
            <span>Investigation Strategy &amp; Execution Plan</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            {currentSession.plan.steps.map((step, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300"
              >
                <div className="text-[10px] text-cyan-400 font-mono font-bold mb-1">
                  PHASE 0{idx + 1}
                </div>
                <div>{step}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Root-Cause Hypotheses (Debugging Agent) */}
      {currentSession?.hypotheses && currentSession.hypotheses.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-semibold text-amber-400">
              <Bug className="w-4 h-4" />
              <span>Ranked Root-Cause Hypotheses</span>
            </div>
            <span className="text-[11px] text-slate-500">
              Confidence scores calibrated against retrieved code evidence
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentSession.hypotheses.map(hyp => (
              <div
                key={hyp.id}
                className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-400 border border-amber-800/40 text-[10px] font-mono font-semibold">
                      Rank #{hyp.rank} • {hyp.confidence}% Confidence
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {hyp.evidence.length} evidence citations
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-100 mb-1.5">{hyp.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-3">
                    {hyp.description}
                  </p>
                </div>

                {/* Evidence snippet */}
                {hyp.evidence.length > 0 && (
                  <div className="pt-3 border-t border-slate-800/80">
                    <div className="text-[10px] font-semibold text-slate-400 mb-1">
                      Supporting Code Evidence:
                    </div>
                    {hyp.evidence.map((ev, i) => (
                      <div key={i} className="p-2 rounded bg-slate-950 border border-slate-800 font-mono text-[11px]">
                        <div className="text-emerald-400 font-medium mb-1">
                          {ev.filePath} (L{ev.startLine}-L{ev.endLine})
                        </div>
                        <div className="text-slate-400 text-[10px] italic mb-1.5">{ev.note}</div>
                        <pre className="text-slate-300 text-[10px] bg-slate-900 p-1.5 rounded overflow-x-auto">
                          {ev.snippet}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Targeted Proposed Patch */}
      {currentSession?.patch && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-400">
              <GitPullRequest className="w-4 h-4" />
              <span>Targeted Code Fix (Proposed Patch)</span>
            </div>
            <button
              onClick={() => onNavigateToPatch(currentSession.patch!.id)}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1"
            >
              <span>Dedicated Patch Review &amp; Approval</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100">{currentSession.patch.title}</h3>
              <p className="text-xs text-slate-400 mt-1">{currentSession.patch.description}</p>
            </div>

            {currentSession.patch.files.map((file, i) => (
              <div key={i} className="space-y-2">
                <div className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                  <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{file.filePath}</span>
                </div>
                <DiffViewer
                  diffText={file.diff}
                  originalCode={file.originalContent}
                  patchedCode={file.patchedContent}
                  filePath={file.filePath}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sandboxed Test & Verification Results */}
      {currentSession?.tests && currentSession.tests.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-semibold text-purple-400">
              <TestTube className="w-4 h-4" />
              <span>Regression Test Suite &amp; Sandboxed Verification</span>
            </div>
            <span className="text-[11px] text-slate-500">
              Honest execution in Node.js test harness
            </span>
          </div>

          <div className="space-y-3">
            {currentSession.tests.map(tc => (
              <div
                key={tc.id}
                className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 text-xs"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {tc.executionStatus === 'executed_passed' ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/40 text-[10px] font-mono font-bold">
                        PASS ({tc.durationMs}ms)
                      </span>
                    ) : tc.executionStatus === 'executed_failed' ? (
                      <span className="px-2 py-0.5 rounded-full bg-rose-950 text-rose-400 border border-rose-800/40 text-[10px] font-mono font-bold">
                        FAIL
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-mono">
                        PROPOSED / UNEXECUTED
                      </span>
                    )}
                    <span className="font-semibold text-slate-200">{tc.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono uppercase">
                    Framework: {tc.framework}
                  </span>
                </div>

                <p className="text-slate-400 mb-3">{tc.description}</p>

                {/* Execution output */}
                {tc.executionOutput && (
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 font-mono text-[11px] text-slate-300 leading-relaxed mb-3">
                    <pre className="whitespace-pre-wrap">{tc.executionOutput}</pre>
                  </div>
                )}

                {/* Test code */}
                <details className="text-[11px] text-slate-400">
                  <summary className="cursor-pointer hover:text-slate-200 font-medium">
                    Inspect Generated Test Code
                  </summary>
                  <pre className="mt-2 p-3 rounded bg-slate-950 border border-slate-800 font-mono text-[10px] text-slate-300 overflow-x-auto">
                    {tc.testCode}
                  </pre>
                </details>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review Agent Final Adversarial Audit */}
      {currentSession?.reviewReport && (
        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="font-bold text-slate-100 text-xs">
                Review Agent — Adversarial Verification Audit
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] text-slate-400">Final Verdict:</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase font-mono border ${
                  currentSession.reviewReport.verdict === 'verified'
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-800/60'
                    : 'bg-amber-950 text-amber-400 border-amber-800/60'
                }`}
              >
                {currentSession.reviewReport.verdict}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            {currentSession.reviewReport.summary}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div className="font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Unsupported Claims Checked</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
                {currentSession.reviewReport.unsupportedClaimsChecked.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div className="font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>Limitations &amp; Environmental Constraints</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
                {currentSession.reviewReport.limitations.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
