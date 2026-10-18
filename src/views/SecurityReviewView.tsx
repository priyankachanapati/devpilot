import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  FileCode,
  Bug,
  RefreshCw,
  CheckCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';
import { Project, SecurityFinding } from '../types/index.ts';

interface SecurityReviewViewProps {
  project: Project | null;
  onSendToDebugger: (prompt: string) => void;
}

export const SecurityReviewView: React.FC<SecurityReviewViewProps> = ({
  project,
  onSendToDebugger,
}) => {
  const [findings, setFindings] = useState<SecurityFinding[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchFindings = () => {
    if (!project) return;
    setLoading(true);
    fetch(`/api/projects/${project.id}/findings`)
      .then(r => r.json())
      .then(data => setFindings(data || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchFindings();
  }, [project?.id]);

  const handleScan = async () => {
    if (!project || scanning) return;
    setScanning(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/findings/scan`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.findings) {
        setFindings(data.findings);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setScanning(false);
    }
  };

  const filtered = findings.filter(f =>
    severityFilter === 'all' ? true : f.severity === severityFilter
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-200 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-rose-400 mb-1">
            <ShieldAlert className="w-4 h-4" />
            <span>Security &amp; Vulnerability Review</span>
          </div>
          <h1 className="text-xl font-bold text-slate-100">
            OWASP / CWE Code Audit for {project?.name}
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Vulnerability scanning with verified code citations, remediation recommendations, and clear distinction between confirmed flaws vs potential architectural risks.
          </p>
        </div>

        <button
          onClick={handleScan}
          disabled={scanning}
          className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition flex items-center gap-2 shadow-lg shadow-cyan-500/20 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
          <span>{scanning ? 'Auditing Code Chunks...' : 'Run Security Scan'}</span>
        </button>
      </div>

      {/* Filter Tabs & Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
          {(['all', 'critical', 'high', 'medium', 'low'] as const).map(sev => {
            const count =
              sev === 'all'
                ? findings.length
                : findings.filter(f => f.severity === sev).length;

            return (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`px-3 py-1.5 rounded-lg font-medium transition capitalize flex items-center gap-1.5 ${
                  severityFilter === sev
                    ? 'bg-slate-800 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>{sev}</span>
                <span className="text-[10px] font-mono text-slate-400">({count})</span>
              </button>
            );
          })}
        </div>

        <div className="text-xs text-slate-400 flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
            Confirmed Flaw
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
            Potential Risk
          </span>
        </div>
      </div>

      {/* Findings List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/20">
          <ShieldCheck className="w-12 h-12 text-emerald-400 mb-3" />
          <h3 className="text-sm font-bold text-slate-200">No Findings Under Filter &quot;{severityFilter}&quot;</h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1">
            Click &quot;Run Security Scan&quot; above to audit all indexed repository files.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(f => {
            const isExpanded = expandedId === f.id;

            let badgeBg = 'bg-rose-950/60 text-rose-400 border-rose-800/40';
            if (f.severity === 'high') badgeBg = 'bg-amber-950/60 text-amber-400 border-amber-800/40';
            if (f.severity === 'medium') badgeBg = 'bg-blue-950/60 text-blue-400 border-blue-800/40';
            if (f.severity === 'low') badgeBg = 'bg-slate-800 text-slate-400 border-slate-700';

            return (
              <div
                key={f.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-sm"
              >
                {/* Header Row */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : f.id)}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-slate-900 transition"
                >
                  <div className="flex items-start space-x-3">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase border ${badgeBg}`}
                    >
                      {f.severity}
                    </span>

                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-bold text-slate-100">{f.title}</h3>
                        {f.cwe && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                            {f.cwe}
                          </span>
                        )}
                        <span
                          className={`text-[9px] px-2 py-0.5 rounded font-mono font-semibold ${
                            f.isConfirmed
                              ? 'bg-rose-950 text-rose-300 border border-rose-800/50'
                              : 'bg-amber-950 text-amber-300 border border-amber-800/50'
                          }`}
                        >
                          {f.isConfirmed ? 'CONFIRMED' : 'POTENTIAL RISK'}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 text-xs text-slate-400 mt-1 font-mono">
                        <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{f.filePath}</span>
                        <span>(Lines {f.startLine}-{f.endLine})</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onSendToDebugger(
                          `Fix security vulnerability: ${f.title} in ${f.filePath} lines ${f.startLine}-${f.endLine}. ${f.impact}`
                        );
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold transition flex items-center gap-1.5"
                    >
                      <Bug className="w-3.5 h-3.5" />
                      <span>Fix in Debugger</span>
                    </button>
                    <div className="text-slate-500">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="p-4 pt-0 border-t border-slate-800/80 mt-2 space-y-3 text-xs">
                    {/* Impact */}
                    <div>
                      <div className="font-semibold text-slate-300 mb-1">Impact Analysis:</div>
                      <p className="text-slate-400 leading-relaxed bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                        {f.impact}
                      </p>
                    </div>

                    {/* Evidence snippet */}
                    {f.evidence && (
                      <div>
                        <div className="font-semibold text-slate-300 mb-1">Code Evidence:</div>
                        <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-rose-300 overflow-x-auto">
                          {f.evidence}
                        </pre>
                      </div>
                    )}

                    {/* Remediation */}
                    <div>
                      <div className="font-semibold text-emerald-400 mb-1">
                        Remediation &amp; Mitigation Guidance:
                      </div>
                      <p className="text-slate-300 bg-emerald-950/20 p-3 rounded-lg border border-emerald-900/30 font-mono text-[11px] leading-relaxed">
                        {f.remediation}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
