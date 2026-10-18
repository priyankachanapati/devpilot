import React, { useState } from 'react';
import {
  FolderGit2,
  ChevronDown,
  Plus,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Database,
  Cpu,
} from 'lucide-react';
import { Project } from '../types/index.ts';

interface NavbarProps {
  projects: Project[];
  activeProject: Project | null;
  onSelectProject: (project: Project) => void;
  onOpenNewModal: () => void;
  onTriggerIndex: () => void;
  isIndexing: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  projects,
  activeProject,
  onSelectProject,
  onOpenNewModal,
  onTriggerIndex,
  isIndexing,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="h-14 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-4 flex items-center justify-between sticky top-0 z-30">
      {/* Brand & Project Switcher */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white font-black text-sm">
            DP
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-slate-100 text-sm tracking-tight flex items-center gap-1.5">
              DevPilot <span className="text-cyan-400 font-extrabold">AI</span>
              <span className="px-1.5 py-0.2 text-[9px] rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-mono">
                RAG 2.0
              </span>
            </span>
          </div>
        </div>

        <div className="h-4 w-px bg-slate-800" />

        {/* Project Dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800/90 border border-slate-800 text-xs text-slate-200 transition"
          >
            <FolderGit2 className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold max-w-[160px] truncate">
              {activeProject ? activeProject.name : 'Select Project'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {dropdownOpen && (
            <div className="absolute left-0 mt-2 w-64 rounded-xl border border-slate-800 bg-slate-900 shadow-2xl p-1.5 z-50">
              <div className="text-[10px] font-semibold text-slate-400 px-2 py-1 uppercase tracking-wider">
                Active Projects ({projects.length})
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {projects.map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      onSelectProject(p);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex flex-col transition ${
                      activeProject?.id === p.id
                        ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between font-medium">
                      <span className="truncate">{p.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {p.fileCount} files
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 truncate mt-0.5">
                      {p.indexingStatus === 'indexed' ? 'Indexed' : 'Unindexed'} •{' '}
                      {Object.keys(p.languages || {})[0] || 'Code'}
                    </span>
                  </button>
                ))}
              </div>

              <div className="pt-1.5 mt-1 border-t border-slate-800">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    onOpenNewModal();
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-cyan-400 hover:bg-cyan-500/10 flex items-center gap-1.5 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create / Import Repository</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Controls: Indexing status & Action */}
      <div className="flex items-center space-x-3">
        {activeProject && (
          <div className="flex items-center space-x-2">
            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                activeProject.indexingStatus === 'indexed'
                  ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                  : activeProject.indexingStatus === 'indexing' || isIndexing
                  ? 'bg-amber-950/40 text-amber-400 border-amber-800/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {activeProject.indexingStatus === 'indexed' ? (
                <>
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                  <span>Indexed ({activeProject.chunkCount || activeProject.fileCount} chunks)</span>
                </>
              ) : activeProject.indexingStatus === 'indexing' || isIndexing ? (
                <>
                  <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
                  <span>
                    {activeProject.indexingProgress
                      ? `${activeProject.indexingProgress.percent}% (${activeProject.indexingProgress.current}/${activeProject.indexingProgress.total})`
                      : 'Indexing Chunks...'}
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3 h-3 text-slate-400" />
                  <span>Not Indexed</span>
                </>
              )}
            </div>

            {activeProject.indexingStatus !== 'indexed' && !isIndexing && (
              <button
                onClick={onTriggerIndex}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition flex items-center gap-1 shadow-sm"
              >
                <Database className="w-3 h-3" />
                <span>Index Codebase</span>
              </button>
            )}

            {activeProject.indexingStatus === 'indexed' && (
              <button
                onClick={onTriggerIndex}
                disabled={isIndexing}
                title="Reindex Codebase"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isIndexing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        )}

        <button
          onClick={onOpenNewModal}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 transition flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-3.5 h-3.5 text-cyan-400" />
          <span>New Project</span>
        </button>

        <div className="flex items-center space-x-1.5 pl-2 border-l border-slate-800 text-slate-400 text-xs">
          <Cpu className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline font-mono text-[11px] text-slate-300">Gemini 3.8</span>
        </div>
      </div>
    </header>
  );
};
