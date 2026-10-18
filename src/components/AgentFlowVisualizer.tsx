import React, { useState } from 'react';
import {
  Compass,
  FileSearch,
  Bug,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Loader2,
  Layers,
  Sparkles,
} from 'lucide-react';
import { AgentTask } from '../types/index.ts';

interface AgentFlowVisualizerProps {
  tasks: AgentTask[];
  activeAgent?: string;
  onSelectTask?: (task: AgentTask) => void;
}

const AGENT_ICONS: Record<string, React.ReactNode> = {
  Planner: <Compass className="w-4 h-4 text-sky-400" />,
  'Repository Analyst': <FileSearch className="w-4 h-4 text-indigo-400" />,
  'Debugging Agent': <Bug className="w-4 h-4 text-amber-400" />,
  'Security & Quality': <ShieldCheck className="w-4 h-4 text-rose-400" />,
  'Testing & Verification': <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
  'Review Agent': <Sparkles className="w-4 h-4 text-purple-400" />,
};

export const AgentFlowVisualizer: React.FC<AgentFlowVisualizerProps> = ({
  tasks,
  activeAgent,
  onSelectTask,
}) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl backdrop-blur-sm">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4">
        <div className="flex items-center space-x-2 text-slate-200 font-semibold text-sm">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span>Multi-Agent Orchestration Pipeline</span>
        </div>
        <div className="text-xs text-slate-400 flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Stateful Orchestrator Engine</span>
        </div>
      </div>

      {/* Progress Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        {tasks.map((task, idx) => {
          const isRunning = task.status === 'running';
          const isCompleted = task.status === 'completed';
          const isFailed = task.status === 'failed';
          const isPending = task.status === 'pending';
          const isSkipped = task.status === 'skipped';

          let borderCol = 'border-slate-800 bg-slate-950/60';
          if (isRunning) borderCol = 'border-cyan-500/60 bg-cyan-950/20 shadow-cyan-500/10 shadow-lg ring-1 ring-cyan-500/40';
          if (isCompleted) borderCol = 'border-emerald-500/40 bg-emerald-950/10';
          if (isFailed) borderCol = 'border-rose-500/40 bg-rose-950/10';
          if (isSkipped) borderCol = 'border-slate-800/60 bg-slate-950/30 opacity-60';

          return (
            <div
              key={task.id || idx}
              onClick={() => {
                toggleExpand(idx);
                if (onSelectTask) onSelectTask(task);
              }}
              className={`rounded-lg border p-3 cursor-pointer transition hover:border-slate-700 flex flex-col justify-between ${borderCol}`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-1.5">
                    {AGENT_ICONS[task.agentName] || <Compass className="w-4 h-4 text-slate-400" />}
                    <span className="text-[11px] font-bold text-slate-200 truncate">
                      {task.agentName}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1">
                    {task.retryCount !== undefined && task.retryCount > 0 && (
                      <span className="text-[9px] px-1 rounded bg-amber-950 text-amber-300 border border-amber-800/40 font-mono">
                        {task.retryCount}r
                      </span>
                    )}
                    {isRunning && <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />}
                    {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    {isFailed && <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
                    {isSkipped && <Clock className="w-3.5 h-3.5 text-slate-600 line-through" />}
                    {isPending && <Clock className="w-3.5 h-3.5 text-slate-600" />}
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-2">
                  {task.error ? (
                    <span className="text-rose-400 font-semibold">{task.error}</span>
                  ) : (
                    task.summary || 'Awaiting activation...'
                  )}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[10px] text-slate-500 font-mono">
                <span className="capitalize">
                  {task.durationMs ? `${task.durationMs}ms` : task.status}
                </span>
                <span className="flex items-center gap-0.5 text-slate-400">
                  {expandedIndex === idx ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Expanded Details Panel */}
      {expandedIndex !== null && tasks[expandedIndex] && (
        <div className="mt-4 p-3.5 rounded-lg border border-slate-800 bg-slate-950 text-xs">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80">
            <div className="font-semibold text-slate-200 flex items-center gap-2">
              {AGENT_ICONS[tasks[expandedIndex].agentName]}
              <span>{tasks[expandedIndex].agentName} — Structured Execution Output</span>
            </div>
            <button
              onClick={() => setExpandedIndex(null)}
              className="text-slate-500 hover:text-slate-300"
            >
              Close
            </button>
          </div>

          <div className="text-slate-300 leading-relaxed mb-3">
            <span className="font-semibold text-slate-400">Agent Summary: </span>
            {tasks[expandedIndex].summary}
          </div>

          {tasks[expandedIndex].output && (
            <div className="bg-slate-900 rounded p-2.5 font-mono text-[11px] max-h-48 overflow-auto border border-slate-800 text-slate-300">
              <pre>{JSON.stringify(tasks[expandedIndex].output, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
