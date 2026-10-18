import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  FileDown,
  Bug,
  BotMessageSquare,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { Project, WorkflowSession } from '../types/index.ts';

interface AnalysisHistoryViewProps {
  project: Project | null;
  onSelectSession: (sessionId: string) => void;
}

export const AnalysisHistoryView: React.FC<AnalysisHistoryViewProps> = ({
  project,
  onSelectSession,
}) => {
  const [sessions, setSessions] = useState<WorkflowSession[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSession, setSelectedSession] = useState<WorkflowSession | null>(null);

  useEffect(() => {
    if (!project) return;
    fetch(`/api/projects/${project.id}/sessions`)
      .then(r => r.json())
      .then((data: WorkflowSession[]) => {
        setSessions(data || []);
        if (data && data.length > 0) setSelectedSession(data[0]);
      });
  }, [project?.id]);

  const filtered = sessions.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.userPrompt.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const exportMarkdown = (session: WorkflowSession) => {
    let md = `# DevPilot AI Investigation Report: ${session.title}\n\n`;
    md += `**Date:** ${new Date(session.createdAt).toLocaleString()}\n`;
    md += `**Project:** ${project?.name}\n`;
    md += `**Status:** ${session.status}\n`;
    md += `**Verdict:** ${session.reviewReport?.verdict || 'N/A'}\n\n`;

    md += `## 1. Initial Inquiry / Issue\n${session.userPrompt}\n\n`;

    if (session.plan) {
      md += `## 2. Investigation Plan\n`;
      session.plan.steps.forEach((step, i) => {
        md += `- **Step ${i + 1}:** ${step}\n`;
      });
      md += `\n`;
    }

    if (session.hypotheses && session.hypotheses.length > 0) {
      md += `## 3. Root-Cause Hypotheses\n`;
      session.hypotheses.forEach(h => {
        md += `### ${h.title} (Confidence: ${h.confidence}%)\n`;
        md += `${h.description}\n\n`;
        if (h.evidence.length > 0) {
          md += `**Evidence:**\n`;
          h.evidence.forEach(ev => {
            md += `- File: \`${ev.filePath}\` (Lines ${ev.startLine}-${ev.endLine}): ${ev.note}\n`;
          });
          md += `\n`;
        }
      });
    }

    if (session.patch) {
      md += `## 4. Proposed Patch\n`;
      md += `**Title:** ${session.patch.title}\n`;
      md += `**Status:** ${session.patch.status}\n\n`;
      session.patch.files.forEach(f => {
        md += `### \`${f.filePath}\`\n`;
        md += `${f.explanation}\n\n`;
        md += `\`\`\`diff\n${f.diff}\n\`\`\`\n\n`;
      });
    }

    if (session.tests && session.tests.length > 0) {
      md += `## 5. Verification Test Suite\n`;
      session.tests.forEach(t => {
        md += `- **${t.name}**: ${t.executionStatus} (${t.durationMs || 0}ms)\n`;
      });
      md += `\n`;
    }

    if (session.reviewReport) {
      md += `## 6. Review Agent Adversarial Audit\n`;
      md += `**Verdict:** ${session.reviewReport.verdict}\n\n`;
      md += `${session.reviewReport.summary}\n\n`;
      if (session.reviewReport.limitations.length > 0) {
        md += `**Limitations & Environmental Constraints:**\n`;
        session.reviewReport.limitations.forEach(l => {
          md += `- ${l}\n`;
        });
        md += `\n`;
      }
    }

    // Trigger download
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `DevPilot_Report_${session.id}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full bg-slate-950 text-slate-200 overflow-hidden">
      {/* Sessions Left List */}
      <div className="w-full lg:w-80 border-r border-slate-800 bg-slate-900/40 flex flex-col h-auto lg:h-full">
        <div className="p-3 border-b border-slate-800">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search previous sessions..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 text-xs">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-xs">
              No sessions found.
            </div>
          ) : (
            filtered.map(s => {
              const isSelected = selectedSession?.id === s.id;
              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedSession(s)}
                  className={`p-3 rounded-xl border cursor-pointer transition ${
                    isSelected
                      ? 'bg-slate-900 border-cyan-500/50 shadow-md ring-1 ring-cyan-500/20'
                      : 'border-slate-800/80 bg-slate-950/60 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(s.createdAt).toLocaleDateString()}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-mono uppercase bg-slate-800 text-cyan-400">
                      {s.reviewReport?.verdict || s.status}
                    </span>
                  </div>
                  <h4 className="font-semibold text-slate-200 line-clamp-2">{s.title}</h4>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Session Details / Markdown Export */}
      <div className="flex-1 flex flex-col overflow-y-auto p-6 space-y-6">
        {selectedSession ? (
          <>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
              <div>
                <span className="text-xs font-mono text-cyan-400">Session ID: {selectedSession.id}</span>
                <h1 className="text-xl font-bold text-slate-100 mt-1">{selectedSession.title}</h1>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl">{selectedSession.userPrompt}</p>
              </div>

              <button
                onClick={() => exportMarkdown(selectedSession)}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition flex items-center gap-2 shadow-lg shadow-cyan-500/20"
              >
                <FileDown className="w-4 h-4" />
                <span>Export Markdown Report</span>
              </button>
            </div>

            {/* Structured Report Preview */}
            <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-6 text-xs">
              {/* Verdict */}
              {selectedSession.reviewReport && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="font-bold text-slate-200 text-sm flex items-center justify-between">
                    <span>Executive Audit Verdict</span>
                    <span className="text-emerald-400 font-mono uppercase">
                      {selectedSession.reviewReport.verdict}
                    </span>
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    {selectedSession.reviewReport.summary}
                  </p>
                </div>
              )}

              {/* Hypotheses */}
              {selectedSession.hypotheses && selectedSession.hypotheses.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-bold text-slate-200 text-sm">Root-Cause Hypotheses</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedSession.hypotheses.map(h => (
                      <div key={h.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-slate-200">{h.title}</span>
                          <span className="text-[10px] font-mono text-amber-400">
                            {h.confidence}% confidence
                          </span>
                        </div>
                        <p className="text-slate-400 text-[11px] leading-relaxed">{h.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Patches */}
              {selectedSession.patch && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="font-bold text-slate-200 text-sm">Targeted Patch</div>
                  <div className="text-slate-300 font-semibold">{selectedSession.patch.title}</div>
                  <p className="text-slate-400">{selectedSession.patch.description}</p>
                  <div className="text-[11px] font-mono text-slate-500">
                    Status: <span className="text-emerald-400">{selectedSession.patch.status}</span> • Files:{' '}
                    {selectedSession.patch.files.map(f => f.filePath).join(', ')}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-500">
            <History className="w-12 h-12 text-slate-700 mb-3" />
            <p className="text-xs">Select a previous analysis session to view the executive report.</p>
          </div>
        )}
      </div>
    </div>
  );
};
