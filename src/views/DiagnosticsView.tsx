import React, { useState, useEffect } from 'react';
import {
  Activity,
  Database,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RotateCcw,
  Layers,
  FileCode,
  ShieldAlert,
  Play,
  Cpu,
  Server,
  ArrowRight,
} from 'lucide-react';
import { Project, RAGDiagnosticResult, WorkflowSession, RetrievedChunk } from '../types/index.ts';

interface DiagnosticsViewProps {
  project: Project | null;
  onTriggerIndex: () => void;
  isIndexing: boolean;
}

export const DiagnosticsView: React.FC<DiagnosticsViewProps> = ({
  project,
  onTriggerIndex,
  isIndexing,
}) => {
  const [ragStats, setRagStats] = useState<any>(null);
  const [recentSession, setRecentSession] = useState<WorkflowSession | null>(null);
  const [testQuery, setTestQuery] = useState('transferBalance');
  const [testResult, setTestResult] = useState<RAGDiagnosticResult | null>(null);
  const [runningTest, setRunningTest] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);

  const fetchDiagnostics = async () => {
    if (!project) return;
    setLoadingStats(true);
    try {
      const [diagRes, sessRes] = await Promise.all([
        fetch(`/api/projects/${project.id}/diagnostics`).then(r => r.json()).catch(() => null),
        fetch(`/api/projects/${project.id}/sessions`).then(r => r.json()).catch(() => []),
      ]);

      setRagStats(diagRes);
      if (sessRes && sessRes.length > 0) {
        setRecentSession(sessRes[0]);
      }
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, [project?.id]);

  const handleRunTestQuery = async () => {
    if (!project || !testQuery.trim() || runningTest) return;
    setRunningTest(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/diagnostics/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: testQuery.trim() }),
      });
      const data: RAGDiagnosticResult = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({
        query: testQuery,
        projectId: project.id,
        durationMs: 0,
        totalChunksInStore: 0,
        results: [],
        diagnostics: {
          filesDiscovered: 0,
          filesParsed: 0,
          chunksCreated: 0,
          chunksEmbedded: 0,
          vectorsStored: 0,
          embeddingErrors: [err.message || 'Diagnostic execution failed'],
          vectorDimensions: 768,
        },
        error: err.message || 'Diagnostic request failed',
      });
    } finally {
      setRunningTest(false);
    }
  };

  if (!project) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-950 text-slate-400">
        <Activity className="w-12 h-12 text-slate-700 mb-3" />
        <p className="text-xs">Select a project to inspect RAG and Agent diagnostics.</p>
      </div>
    );
  }

  const sampleTestQueries = [
    'transferBalance',
    'verifyWebhookSignature',
    'ZeroDivisionError',
    'get_user_records',
    'updateUserProfile',
    'verifyJwtToken',
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-200 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-cyan-400 mb-1">
            <Activity className="w-4 h-4" />
            <span>Developer Diagnostics &amp; System Health</span>
          </div>
          <h1 className="text-xl font-bold text-slate-100">
            RAG Pipeline &amp; Multi-Agent Observability
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Live telemetry for vector embedding dimensions, cosine similarity retrieval, AST chunk counts, agent execution durations, and retry policies.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchDiagnostics}
            disabled={loadingStats}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition flex items-center gap-1.5"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loadingStats ? 'animate-spin' : ''}`} />
            <span>Refresh Diagnostics</span>
          </button>
        </div>
      </div>

      {/* RAG Telemetry Grid */}
      <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-semibold text-cyan-300">
            <Database className="w-4 h-4 text-cyan-400" />
            <span>RAG Vector Ingestion &amp; Storage Metrics</span>
          </div>
          <span className="text-[11px] font-mono text-emerald-400">
            Vector Dimension: 768 (Normalized)
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950">
            <div className="text-[10px] font-bold text-slate-500 uppercase">Files Discovered</div>
            <div className="text-xl font-bold text-slate-100 font-mono mt-1">
              {ragStats?.filesDiscovered ?? project.fileCount}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Source files scanned</div>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950">
            <div className="text-[10px] font-bold text-slate-500 uppercase">Files Parsed</div>
            <div className="text-xl font-bold text-slate-100 font-mono mt-1">
              {ragStats?.filesParsed ?? project.fileCount}
            </div>
            <div className="text-[10px] text-emerald-400 mt-0.5">AST syntax verified</div>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950">
            <div className="text-[10px] font-bold text-slate-500 uppercase">Chunks Created</div>
            <div className="text-xl font-bold text-cyan-400 font-mono mt-1">
              {ragStats?.chunksCreated ?? project.chunkCount ?? 0}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Symbol &amp; func blocks</div>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950">
            <div className="text-[10px] font-bold text-slate-500 uppercase">Chunks Embedded</div>
            <div className="text-xl font-bold text-indigo-400 font-mono mt-1">
              {ragStats?.chunksEmbedded ?? project.chunkCount ?? 0}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Gemini 768d vectors</div>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950">
            <div className="text-[10px] font-bold text-slate-500 uppercase">Vectors Stored</div>
            <div className="text-xl font-bold text-slate-100 font-mono mt-1">
              {ragStats?.vectorsStored ?? project.chunkCount ?? 0}
            </div>
            <div className="text-[10px] text-emerald-400 mt-0.5">Persistent disk store</div>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950">
            <div className="text-[10px] font-bold text-slate-500 uppercase">Embedding Errors</div>
            <div
              className={`text-xl font-bold font-mono mt-1 ${
                (ragStats?.embeddingErrors?.length || 0) > 0 ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {ragStats?.embeddingErrors?.length || 0}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {(ragStats?.embeddingErrors?.length || 0) > 0 ? 'Logged to diagnostics' : 'Clean (0 errors)'}
            </div>
          </div>
        </div>

        {/* Embedding Error Logs if any */}
        {ragStats?.embeddingErrors && ragStats.embeddingErrors.length > 0 && (
          <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-950/20 text-xs">
            <div className="font-semibold text-amber-300 mb-1 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Captured Embedding &amp; Ingestion Warnings:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-300 font-mono">
              {ragStats.embeddingErrors.map((err: string, i: number) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Interactive RAG Retrieval Test Harness */}
      <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-300">
            <Search className="w-4 h-4 text-emerald-400" />
            <span>Interactive RAG Retrieval Test Harness</span>
          </div>
          <span className="text-[11px] text-slate-500">
            Live query against indexed vectors with exact similarity score breakdown
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2">
          <input
            type="text"
            value={testQuery}
            onChange={e => setTestQuery(e.target.value)}
            placeholder="Enter symbol or search phrase to test vector retrieval..."
            className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
          />
          <button
            onClick={handleRunTestQuery}
            disabled={runningTest || !testQuery.trim()}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-md shadow-cyan-500/20 disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 fill-slate-950 ${runningTest ? 'animate-spin' : ''}`} />
            <span>{runningTest ? 'Searching...' : 'Run Retrieval Test'}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
          <span>Sample queries:</span>
          {sampleTestQueries.map(q => (
            <button
              key={q}
              onClick={() => setTestQuery(q)}
              className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 font-mono text-[10px]"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Test Result Display */}
        {testResult && (
          <div className="pt-3 border-t border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-slate-200">
                  Retrieval Execution:
                </span>
                <span className="font-mono text-cyan-400 font-bold">
                  {testResult.durationMs}ms
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">
                  {testResult.results.length} chunks returned from{' '}
                  {testResult.totalChunksInStore} stored vectors
                </span>
              </div>
            </div>

            {testResult.error && (
              <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-950/20 text-rose-300 text-xs">
                {testResult.error}
              </div>
            )}

            {testResult.results.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-950 text-center text-xs text-slate-500">
                No matching chunks found for &quot;{testResult.query}&quot;. Try re-indexing the codebase.
              </div>
            ) : (
              <div className="space-y-2">
                {testResult.results.map((chunk: RetrievedChunk, idx: number) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-slate-800 bg-slate-950 space-y-2 font-mono text-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center space-x-2 truncate">
                        <FileCode className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                        <span className="text-slate-200 font-bold">{chunk.filePath}</span>
                        <span className="text-slate-500 text-[11px]">
                          (Lines {chunk.startLine}-{chunk.endLine})
                        </span>
                        {chunk.symbolName && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400 font-medium">
                            {chunk.symbolName}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-3 text-[11px]">
                        <span className="text-indigo-400" title="Vector cosine similarity">
                          Cosine Sim: <strong>{(chunk.similarity * 100).toFixed(1)}%</strong>
                        </span>
                        <span className="text-amber-400" title="Lexical keyword frequency score">
                          Lexical: <strong>{(chunk.lexicalScore || 0).toFixed(2)}</strong>
                        </span>
                        <span className="text-emerald-400 font-bold" title="Combined hybrid retrieval score">
                          Combined: <strong>{(chunk.combinedScore * 100).toFixed(1)}%</strong>
                        </span>
                      </div>
                    </div>

                    <pre className="p-2.5 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-300 overflow-x-auto leading-relaxed">
                      {chunk.content.slice(0, 450)}
                      {chunk.content.length > 450 && '\n... [truncated for display]'}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Multi-Agent Workflow Health & Telemetry */}
      {recentSession && (
        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-semibold text-purple-300">
              <Layers className="w-4 h-4 text-purple-400" />
              <span>Agent Workflow Stage &amp; Latency Observability</span>
            </div>
            <div className="flex items-center space-x-2 text-[11px]">
              <span className="text-slate-500 font-mono">Session ID: {recentSession.id}</span>
              <span
                className={`px-2 py-0.5 rounded-full font-mono font-bold uppercase text-[9px] border ${
                  recentSession.status === 'completed'
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-800/40'
                    : recentSession.status === 'failed'
                    ? 'bg-rose-950 text-rose-400 border-rose-800/40'
                    : 'bg-cyan-950 text-cyan-400 border-cyan-800/40'
                }`}
              >
                {recentSession.status}
              </span>
            </div>
          </div>

          {recentSession.failureReason && (
            <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-950/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>Failure Reason: {recentSession.failureReason}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-2.5">
            {recentSession.agents.map((agent, i) => (
              <div
                key={agent.id || i}
                className="p-3 rounded-xl border border-slate-800 bg-slate-950 flex flex-col justify-between text-xs font-mono"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-slate-200 truncate">
                      {agent.agentName}
                    </span>
                    <span
                      className={`text-[9px] px-1 rounded uppercase ${
                        agent.status === 'completed'
                          ? 'text-emerald-400 bg-emerald-950/40'
                          : agent.status === 'failed'
                          ? 'text-rose-400 bg-rose-950/40'
                          : agent.status === 'running'
                          ? 'text-cyan-400 bg-cyan-950/40 animate-pulse'
                          : 'text-slate-600'
                      }`}
                    >
                      {agent.status}
                    </span>
                  </div>

                  <div className="text-[10px] text-slate-400 mb-2">
                    Duration: {agent.durationMs ? `${agent.durationMs}ms` : '—'}
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-900">
                  Retries: {agent.retryCount || 0}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
