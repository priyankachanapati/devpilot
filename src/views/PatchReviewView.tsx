import React, { useState, useEffect } from 'react';
import {
  GitPullRequest,
  Check,
  X,
  RotateCcw,
  Download,
  FileCode,
  CheckCircle2,
  Clock,
  AlertCircle,
  MessageSquare,
  ShieldCheck,
  Send,
} from 'lucide-react';
import { Project, ProposedPatch } from '../types/index.ts';
import { DiffViewer } from '../components/DiffViewer.tsx';

interface PatchReviewViewProps {
  project: Project | null;
  activePatchId?: string | null;
  onSendToDebugger: (prompt: string) => void;
}

export const PatchReviewView: React.FC<PatchReviewViewProps> = ({
  project,
  activePatchId,
  onSendToDebugger,
}) => {
  const [patches, setPatches] = useState<ProposedPatch[]>([]);
  const [selectedPatch, setSelectedPatch] = useState<ProposedPatch | null>(null);
  const [loading, setLoading] = useState(false);
  const [revisionFeedback, setRevisionFeedback] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchPatches = () => {
    if (!project) return;
    setLoading(true);
    fetch(`/api/projects/${project.id}/patches`)
      .then(r => r.json())
      .then((data: ProposedPatch[]) => {
        setPatches(data || []);
        if (data && data.length > 0) {
          const match = activePatchId
            ? data.find(p => p.id === activePatchId)
            : data[0];
          setSelectedPatch(match || data[0]);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPatches();
  }, [project?.id, activePatchId]);

  const handleReviewAction = async (decision: 'approved' | 'rejected' | 'revised') => {
    if (!selectedPatch) return;

    try {
      const res = await fetch(`/api/patches/${selectedPatch.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          feedback: decision === 'revised' ? revisionFeedback : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Review submission failed');

      setSelectedPatch(data.patch);
      setPatches(prev => prev.map(p => (p.id === data.patch.id ? data.patch : p)));
      setActionSuccess(`Patch status updated to ${decision.toUpperCase()}`);
      setTimeout(() => setActionSuccess(null), 3000);

      if (decision === 'revised' && revisionFeedback) {
        onSendToDebugger(
          `Revise proposed patch "${selectedPatch.title}". Human Reviewer Feedback: "${revisionFeedback}"`
        );
      }
    } catch (err: any) {
      alert(`Error updating patch: ${err.message}`);
    }
  };

  const handleDownloadDiff = () => {
    if (!selectedPatch) return;
    window.location.href = `/api/patches/${selectedPatch.id}/download`;
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full bg-slate-950 text-slate-200 overflow-hidden">
      {/* Left List: Patches for project */}
      <div className="w-full lg:w-72 border-r border-slate-800 bg-slate-900/40 flex flex-col h-auto lg:h-full">
        <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
            <GitPullRequest className="w-4 h-4 text-emerald-400" />
            <span>Proposed Patches ({patches.length})</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 text-xs">
          {patches.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-xs">
              No proposed patches yet. Launch a debugging session to synthesize a patch.
            </div>
          ) : (
            patches.map(p => {
              const isSelected = selectedPatch?.id === p.id;

              let statusBadge = 'bg-amber-950/60 text-amber-400 border-amber-800/40';
              if (p.status === 'approved') statusBadge = 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40';
              if (p.status === 'rejected') statusBadge = 'bg-rose-950/60 text-rose-400 border-rose-800/40';
              if (p.status === 'revised') statusBadge = 'bg-blue-950/60 text-blue-400 border-blue-800/40';

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPatch(p)}
                  className={`p-3 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                    isSelected
                      ? 'bg-slate-900 border-cyan-500/50 shadow-md ring-1 ring-cyan-500/20'
                      : 'border-slate-800/80 bg-slate-950/60 hover:bg-slate-900/60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase border ${statusBadge}`}>
                        {p.status}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <h4 className="font-semibold text-slate-200 line-clamp-1">{p.title}</h4>
                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                      {p.description}
                    </p>
                  </div>

                  <div className="text-[10px] text-slate-500 mt-2 font-mono flex items-center justify-between pt-1 border-t border-slate-800/50">
                    <span>{p.files.length} file(s) changed</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Area: Selected Patch Review & Actions */}
      <div className="flex-1 flex flex-col overflow-y-auto p-6 space-y-6">
        {selectedPatch ? (
          <>
            {/* Top Bar for Selected Patch */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border border-slate-800 bg-slate-900/60">
              <div>
                <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400 mb-1">
                  <span>Patch ID: {selectedPatch.id}</span>
                  <span>•</span>
                  <span className="capitalize text-emerald-400">{selectedPatch.status}</span>
                </div>
                <h1 className="text-xl font-bold text-slate-100">{selectedPatch.title}</h1>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  {selectedPatch.description}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleDownloadDiff}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .diff</span>
                </button>
              </div>
            </div>

            {actionSuccess && (
              <div className="p-3 rounded-lg border border-emerald-500/40 bg-emerald-950/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{actionSuccess}</span>
              </div>
            )}

            {/* Human Decision Controls */}
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Human Review Gate &amp; Authorization
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Changes are isolated. Approved patches are applied to a dedicated working branch and never directly committed without authorization.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleReviewAction('approved')}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
                  >
                    <Check className="w-4 h-4" />
                    <span>Approve Patch</span>
                  </button>
                  <button
                    onClick={() => handleReviewAction('rejected')}
                    className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold text-xs transition flex items-center gap-1.5"
                  >
                    <X className="w-4 h-4" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>

              {/* Revision feedback */}
              <div className="pt-3 border-t border-slate-800 flex items-center space-x-2">
                <input
                  type="text"
                  value={revisionFeedback}
                  onChange={e => setRevisionFeedback(e.target.value)}
                  placeholder="Enter revision instructions for the agents (e.g., 'Use crypto.timingSafeEqual and add unit test for empty strings')..."
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
                <button
                  onClick={() => handleReviewAction('revised')}
                  disabled={!revisionFeedback.trim()}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition flex items-center gap-1.5 disabled:opacity-40"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Request Revision</span>
                </button>
              </div>

              {selectedPatch.userFeedback && (
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300">
                  <span className="font-semibold text-cyan-400">Recorded Feedback: </span>
                  {selectedPatch.userFeedback}
                </div>
              )}
            </div>

            {/* Diffs by file */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Impacted Files ({selectedPatch.files.length})
              </h3>

              {selectedPatch.files.map((file, i) => (
                <div key={i} className="space-y-2">
                  <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60 flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-xs">
                      <FileCode className="w-4 h-4 text-cyan-400" />
                      <span className="font-semibold text-slate-200">{file.filePath}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 italic">
                      {file.explanation}
                    </span>
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
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-500">
            <GitPullRequest className="w-12 h-12 text-slate-700 mb-3" />
            <p className="text-xs">Select a patch from the left list to review its diff.</p>
          </div>
        )}
      </div>
    </div>
  );
};
