import React, { useState } from 'react';
import { Copy, Check, Split, AlignJustify } from 'lucide-react';

interface DiffViewerProps {
  diffText: string;
  originalCode?: string;
  patchedCode?: string;
  filePath?: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  diffText,
  originalCode,
  patchedCode,
  filePath,
}) => {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified');

  const copyDiff = () => {
    navigator.clipboard.writeText(diffText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = diffText.split('\n');

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950 font-mono text-xs overflow-hidden shadow-xl">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-slate-300">
        <div className="flex items-center space-x-2 font-medium truncate">
          <span className="text-emerald-400">DIFF</span>
          <span className="text-slate-500">/</span>
          <span className="text-slate-200 truncate">{filePath || 'patch.diff'}</span>
        </div>
        <div className="flex items-center space-x-2">
          {originalCode && patchedCode && (
            <div className="flex bg-slate-800 rounded p-0.5 border border-slate-700">
              <button
                onClick={() => setViewMode('unified')}
                className={`px-2 py-1 rounded flex items-center gap-1 text-[11px] ${
                  viewMode === 'unified' ? 'bg-slate-700 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Unified view"
              >
                <AlignJustify className="w-3 h-3" /> Unified
              </button>
              <button
                onClick={() => setViewMode('split')}
                className={`px-2 py-1 rounded flex items-center gap-1 text-[11px] ${
                  viewMode === 'split' ? 'bg-slate-700 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Split side-by-side view"
              >
                <Split className="w-3 h-3" /> Split
              </button>
            </div>
          )}
          <button
            onClick={copyDiff}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Copy Diff'}</span>
          </button>
        </div>
      </div>

      {viewMode === 'split' && originalCode && patchedCode ? (
        <div className="grid grid-cols-2 divide-x divide-slate-800 max-h-[500px] overflow-auto">
          {/* Left: Original */}
          <div className="bg-slate-950 p-3">
            <div className="text-[11px] font-semibold text-rose-400 pb-2 border-b border-rose-950/40 mb-2">
              Original Code
            </div>
            <pre className="text-slate-300 whitespace-pre leading-relaxed select-text">
              {originalCode.split('\n').map((line, idx) => (
                <div key={idx} className="flex">
                  <span className="w-8 text-slate-600 select-none text-right pr-3">{idx + 1}</span>
                  <span className="text-rose-200/90">{line}</span>
                </div>
              ))}
            </pre>
          </div>
          {/* Right: Patched */}
          <div className="bg-slate-950 p-3">
            <div className="text-[11px] font-semibold text-emerald-400 pb-2 border-b border-emerald-950/40 mb-2">
              Proposed Fix
            </div>
            <pre className="text-slate-300 whitespace-pre leading-relaxed select-text">
              {patchedCode.split('\n').map((line, idx) => (
                <div key={idx} className="flex">
                  <span className="w-8 text-slate-600 select-none text-right pr-3">{idx + 1}</span>
                  <span className="text-emerald-200/90">{line}</span>
                </div>
              ))}
            </pre>
          </div>
        </div>
      ) : (
        <div className="max-h-[500px] overflow-auto p-3 bg-slate-950 select-text leading-relaxed">
          {lines.map((line, idx) => {
            const isAdd = line.startsWith('+') && !line.startsWith('+++');
            const isDel = line.startsWith('-') && !line.startsWith('---');
            const isHeader = line.startsWith('@@') || line.startsWith('---') || line.startsWith('+++') || line.startsWith('#');

            let rowClass = 'text-slate-300 hover:bg-slate-900/50';
            if (isAdd) rowClass = 'bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50';
            if (isDel) rowClass = 'bg-rose-950/40 text-rose-300 hover:bg-rose-900/50 line-through decoration-rose-500/40';
            if (isHeader) rowClass = 'text-cyan-400 bg-slate-900/70 font-semibold';

            return (
              <div key={idx} className={`px-2 py-0.5 rounded-sm flex items-start ${rowClass}`}>
                <span className="w-8 text-slate-600 select-none text-right pr-3 flex-shrink-0">
                  {idx + 1}
                </span>
                <span className="whitespace-pre-wrap break-all">{line}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
