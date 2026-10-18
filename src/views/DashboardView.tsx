import React, { useState, useEffect } from 'react';
import {
  FolderGit2,
  Database,
  Bug,
  ShieldAlert,
  GitPullRequest,
  ArrowRight,
  Sparkles,
  Clock,
  Layers,
  Terminal,
  FileCode,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { Project, WorkflowSession, SecurityFinding, ProposedPatch, AuditLog } from '../types/index.ts';
import { ActiveView } from '../components/Sidebar.tsx';

interface DashboardViewProps {
  project: Project | null;
  onNavigate: (view: ActiveView) => void;
  onOpenNewProject: () => void;
  onStartInvestigation: (prompt: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  project,
  onNavigate,
  onOpenNewProject,
  onStartInvestigation,
}) => {
  const [sessions, setSessions] = useState<WorkflowSession[]>([]);
  const [findings, setFindings] = useState<SecurityFinding[]>([]);
  const [patches, setPatches] = useState<ProposedPatch[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!project) return;
    setLoading(true);

    Promise.all([
      fetch(`/api/projects/${project.id}/sessions`).then(r => r.json()).catch(() => []),
      fetch(`/api/projects/${project.id}/findings`).then(r => r.json()).catch(() => []),
      fetch(`/api/projects/${project.id}/patches`).then(r => r.json()).catch(() => []),
      fetch(`/api/audit?projectId=${project.id}`).then(r => r.json()).catch(() => []),
    ])
      .then(([sessData, findData, patchData, auditData]) => {
        setSessions(sessData || []);
        setFindings(findData || []);
        setPatches(patchData || []);
        setAuditLogs(auditData || []);
      })
      .finally(() => setLoading(false));
  }, [project?.id]);

  if (!project) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-950">
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4 shadow-xl">
          <FolderGit2 className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-100 mb-2">No Repository Selected</h2>
        <p className="text-sm text-slate-400 max-w-md mb-6">
          Import a public Git repository, upload a ZIP archive, or explore our built-in curated microservices with real-world concurrency and security bugs.
        </p>
        <button
          onClick={onOpenNewProject}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition shadow-lg shadow-cyan-500/20"
        >
          Select or Create Project
        </button>
      </div>
    );
  }

  const criticalFindings = findings.filter(f => f.severity === 'critical');
  const highFindings = findings.filter(f => f.severity === 'high');
  const mediumFindings = findings.filter(f => f.severity === 'medium');
  const lowFindings = findings.filter(f => f.severity === 'low');

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-950 text-slate-200">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/30">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-cyan-400 mb-1">
            <span className="inline-block w-2 h-2 rounded-full bg-cyan-400" />
            <span>Active Repository</span>
          </div>
          <h1 className="text-xl font-bold text-slate-100">{project.name}</h1>
          <p className="text-xs text-slate-400 max-w-2xl mt-1 leading-relaxed">
            {project.description}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('debugger')}
            className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition flex items-center gap-1.5 shadow-md shadow-cyan-500/20"
          >
            <Bug className="w-4 h-4" />
            <span>Launch Debugger</span>
          </button>
          <button
            onClick={() => onNavigate('assistant')}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Ask Code Assistant</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div
          onClick={() => onNavigate('explorer')}
          className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 cursor-pointer transition shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Repository Scope</span>
            <FileCode className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100 font-mono">{project.fileCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {project.totalLines.toLocaleString()} total lines of code
          </div>
        </div>

        {/* Metric 2 */}
        <div
          onClick={() => onNavigate('explorer')}
          className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 cursor-pointer transition shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">RAG Vector Index</span>
            <Database className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100 font-mono">
            {project.chunkCount || (project.indexingStatus === 'indexed' ? project.fileCount * 3 : 0)}
          </div>
          <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>AST Language-Aware Chunks</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div
          onClick={() => onNavigate('security')}
          className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 cursor-pointer transition shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Security Vulnerabilities</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100 font-mono">{findings.length}</div>
          <div className="text-[11px] text-rose-400 mt-1">
            {criticalFindings.length} Critical • {highFindings.length} High
          </div>
        </div>

        {/* Metric 4 */}
        <div
          onClick={() => onNavigate('patches')}
          className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 cursor-pointer transition shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Proposed Patches</span>
            <GitPullRequest className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100 font-mono">{patches.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            {patches.filter(p => p.status === 'approved').length} approved •{' '}
            {patches.filter(p => p.status === 'draft').length} pending review
          </div>
        </div>
      </div>

      {/* Suggested Quick-Investigate Scenarios */}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Recommended Agent Investigations for this Codebase</span>
          </div>
          <span className="text-[11px] text-slate-500">1-click automated diagnosis</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div
            onClick={() =>
              onStartInvestigation(
                'Investigate concurrency race condition in payment transfer where double-spending can occur during parallel requests'
              )
            }
            className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/70 hover:border-amber-500/50 hover:bg-slate-900/80 cursor-pointer transition group"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-slate-200 group-hover:text-amber-300">
              <span>Concurrency Double-Spending</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-300 transition" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              Traces balance read, asynchronous latency gap, and missing atomic lock.
            </p>
          </div>

          <div
            onClick={() =>
              onStartInvestigation(
                'Audit codebase for injection vulnerabilities and unparameterized database query construction'
              )
            }
            className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/70 hover:border-rose-500/50 hover:bg-slate-900/80 cursor-pointer transition group"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-slate-200 group-hover:text-rose-300">
              <span>SQL / Injection Audit</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-rose-300 transition" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              Identifies direct string formatting in database filter query and proposes prepared statements.
            </p>
          </div>

          <div
            onClick={() =>
              onStartInvestigation(
                'Verify authentication security, timing attacks, and JWT algorithm validation'
              )
            }
            className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/70 hover:border-cyan-500/50 hover:bg-slate-900/80 cursor-pointer transition group"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-slate-200 group-hover:text-cyan-300">
              <span>Auth & Secret Validation</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-300 transition" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              Checks timingSafeEqual vs plain string equality and token bypass.
            </p>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Recent Sessions & Security Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Debugging Sessions */}
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
                <Bug className="w-4 h-4 text-amber-400" />
                <span>Recent Agentic Debugging Sessions</span>
              </div>
              <button
                onClick={() => onNavigate('history')}
                className="text-[11px] text-cyan-400 hover:text-cyan-300"
              >
                View All
              </button>
            </div>

            {sessions.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No debugging sessions executed yet. Launch one from the Agentic Debugger.
              </div>
            ) : (
              <div className="space-y-2.5">
                {sessions.slice(0, 4).map(s => (
                  <div
                    key={s.id}
                    onClick={() => onNavigate('debugger')}
                    className="p-3 rounded-lg border border-slate-800/80 bg-slate-950/60 hover:border-slate-700 cursor-pointer transition flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-medium text-slate-200 truncate max-w-sm">
                        {s.title}
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-1">
                        <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span className="capitalize text-emerald-400">{s.reviewReport?.verdict || s.status}</span>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Security Findings By Severity */}
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Vulnerabilities by Severity</span>
            </div>
            <button
              onClick={() => onNavigate('security')}
              className="text-[11px] text-cyan-400 hover:text-cyan-300"
            >
              Full Security Report
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-rose-950/20 border border-rose-900/30">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-xs font-medium text-rose-300">Critical Severity</span>
              </div>
              <span className="text-xs font-bold text-rose-400 font-mono">
                {criticalFindings.length}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-950/20 border border-amber-900/30">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-xs font-medium text-amber-300">High Severity</span>
              </div>
              <span className="text-xs font-bold text-amber-400 font-mono">
                {highFindings.length}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-950/20 border border-blue-900/30">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span className="text-xs font-medium text-blue-300">Medium Severity</span>
              </div>
              <span className="text-xs font-bold text-blue-400 font-mono">
                {mediumFindings.length}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                <span className="text-xs font-medium text-slate-300">Low / Informational</span>
              </div>
              <span className="text-xs font-bold text-slate-400 font-mono">
                {lowFindings.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Trail & Activity */}
      <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span>Audit Trail & Activity Log</span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">{auditLogs.length} events logged</span>
        </div>

        <div className="space-y-2 max-h-48 overflow-y-auto">
          {auditLogs.slice(0, 6).map(log => (
            <div
              key={log.id}
              className="flex items-start justify-between text-xs p-2 rounded bg-slate-950/50 border border-slate-800/60 font-mono"
            >
              <div className="flex items-start space-x-2 truncate">
                <span className="text-cyan-400">[{log.action}]</span>
                <span className="text-slate-300 truncate">{log.details}</span>
              </div>
              <span className="text-[10px] text-slate-500 whitespace-nowrap pl-2">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
