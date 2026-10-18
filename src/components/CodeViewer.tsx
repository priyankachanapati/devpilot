import React, { useState } from 'react';
import { Copy, Check, Bug, ShieldAlert, FileCode } from 'lucide-react';

interface CodeViewerProps {
  filePath: string;
  language: string;
  content: string;
  highlightLines?: [number, number];
  onInvestigateInDebugger?: (filePath: string, snippet: string) => void;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({
  filePath,
  language,
  content,
  highlightLines,
  onInvestigateInDebugger,
}) => {
  const [copied, setCopied] = useState(false);
  const lines = content.split('\n');

  const copyCode = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 font-mono text-xs overflow-hidden shadow-2xl flex flex-col h-full">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800">
        <div className="flex items-center space-x-2 text-slate-300">
          <FileCode className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-slate-100">{filePath}</span>
          <span className="px-2 py-0.5 text-[10px] rounded bg-slate-800 text-slate-400 border border-slate-700">
            {language}
          </span>
          <span className="text-slate-500 text-[11px]">{lines.length} lines</span>
        </div>

        <div className="flex items-center space-x-2">
          {onInvestigateInDebugger && (
            <button
              onClick={() => onInvestigateInDebugger(filePath, content.slice(0, 1500))}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition text-[11px]"
              title="Send to Agentic Debugger"
            >
              <Bug className="w-3.5 h-3.5" />
              <span>Debug File</span>
            </button>
          )}

          <button
            onClick={copyCode}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition text-[11px]"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Code Area */}
      <div className="overflow-auto flex-1 p-3 select-text bg-slate-950/80 leading-relaxed">
        {lines.map((line, idx) => {
          const lineNum = idx + 1;
          const isHighlighted =
            highlightLines && lineNum >= highlightLines[0] && lineNum <= highlightLines[1];

          return (
            <div
              key={idx}
              className={`flex items-start group hover:bg-slate-900/40 rounded-sm px-1 ${
                isHighlighted ? 'bg-amber-500/15 border-l-2 border-amber-400' : ''
              }`}
            >
              <span className="w-10 text-slate-600 select-none text-right pr-4 flex-shrink-0 group-hover:text-slate-400">
                {lineNum}
              </span>
              <span className="whitespace-pre-wrap break-all text-slate-200">
                {line || ' '}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
