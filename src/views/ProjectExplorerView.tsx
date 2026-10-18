import React, { useState, useEffect } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  Search,
  Code2,
  RefreshCw,
  Bug,
  FileText,
  PieChart,
} from 'lucide-react';
import { Project, RepoFile } from '../types/index.ts';
import { CodeViewer } from '../components/CodeViewer.tsx';

interface ProjectExplorerViewProps {
  project: Project | null;
  onSendToDebugger: (filePath: string, snippet: string) => void;
  onTriggerIndex: () => void;
  isIndexing: boolean;
}

export const ProjectExplorerView: React.FC<ProjectExplorerViewProps> = ({
  project,
  onSendToDebugger,
  onTriggerIndex,
  isIndexing,
}) => {
  const [files, setFiles] = useState<RepoFile[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<RepoFile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['src', 'services']));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!project) return;
    setLoading(true);
    fetch(`/api/projects/${project.id}/files`)
      .then(r => r.json())
      .then((data: RepoFile[]) => {
        setFiles(data || []);
        if (data && data.length > 0 && !selectedFilePath) {
          // Select main or first file
          const defaultFile = data.find(f => f.path.includes('index.') || f.path.includes('main.')) || data[0];
          setSelectedFilePath(defaultFile.path);
        }
      })
      .finally(() => setLoading(false));
  }, [project?.id]);

  useEffect(() => {
    if (!project || !selectedFilePath) return;
    fetch(`/api/projects/${project.id}/files/content?path=${encodeURIComponent(selectedFilePath)}`)
      .then(r => r.json())
      .then(data => setFileContent(data))
      .catch(() => setFileContent(null));
  }, [project?.id, selectedFilePath]);

  const toggleFolder = (folder: string) => {
    const next = new Set(expandedFolders);
    if (next.has(folder)) next.delete(folder);
    else next.add(folder);
    setExpandedFolders(next);
  };

  const filteredFiles = files.filter(f =>
    f.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group files into nested directory tree
  const tree: Record<string, RepoFile[]> = {};
  filteredFiles.forEach(f => {
    const parts = f.path.split('/');
    if (parts.length === 1) {
      if (!tree['root']) tree['root'] = [];
      tree['root'].push(f);
    } else {
      const folder = parts.slice(0, parts.length - 1).join('/');
      if (!tree[folder]) tree[folder] = [];
      tree[folder].push(f);
    }
  });

  return (
    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-950 text-slate-200">
      {/* Left Sidebar: File Tree & Languages */}
      <div className="w-full lg:w-80 border-r border-slate-800 bg-slate-900/40 flex flex-col h-auto lg:h-full">
        {/* Search Input */}
        <div className="p-3 border-b border-slate-800">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search repository files..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
            />
          </div>
        </div>

        {/* Language Distribution */}
        {project?.languages && (
          <div className="p-3 border-b border-slate-800 bg-slate-950/40">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Language Distribution</span>
              <PieChart className="w-3 h-3 text-cyan-400" />
            </div>
            <div className="flex rounded-full overflow-hidden h-1.5 bg-slate-800 mb-2">
              {Object.entries(project.languages).map(([lang, pct], idx) => {
                const colors = ['bg-cyan-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500'];
                return (
                  <div
                    key={lang}
                    style={{ width: `${pct}%` }}
                    className={`${colors[idx % colors.length]} h-full`}
                    title={`${lang}: ${pct}%`}
                  />
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
              {Object.entries(project.languages).map(([lang, pct]) => (
                <span key={lang} className="font-mono">
                  {lang}: <strong className="text-slate-200">{pct}%</strong>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* File Tree List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-xs">
          {filteredFiles.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-xs">
              No files match filter &quot;{searchQuery}&quot;
            </div>
          ) : (
            Object.entries(tree).map(([folder, folderFiles]) => {
              const isRoot = folder === 'root';
              const isExpanded = expandedFolders.has(folder) || isRoot;

              return (
                <div key={folder} className="space-y-0.5">
                  {!isRoot && (
                    <button
                      onClick={() => toggleFolder(folder)}
                      className="w-full flex items-center space-x-2 px-2 py-1.5 rounded hover:bg-slate-800/60 text-slate-400 text-left"
                    >
                      {isExpanded ? (
                        <FolderOpen className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      ) : (
                        <Folder className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      )}
                      <span className="truncate font-semibold text-slate-300">{folder}</span>
                    </button>
                  )}

                  {isExpanded && (
                    <div className={!isRoot ? 'pl-4 space-y-0.5' : 'space-y-0.5'}>
                      {folderFiles.map(file => {
                        const isSelected = selectedFilePath === file.path;
                        return (
                          <button
                            key={file.path}
                            onClick={() => setSelectedFilePath(file.path)}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded transition text-left ${
                              isSelected
                                ? 'bg-cyan-500/15 text-cyan-300 font-semibold border-l-2 border-cyan-400'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                            }`}
                          >
                            <div className="flex items-center space-x-2 truncate">
                              <FileCode className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                              <span className="truncate">{file.name}</span>
                            </div>
                            <span className="text-[10px] text-slate-600 pl-2">
                              {file.lineCount}L
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Area: Code Viewer */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden h-full">
        {fileContent ? (
          <CodeViewer
            filePath={fileContent.path}
            language={fileContent.language}
            content={fileContent.content}
            onInvestigateInDebugger={onSendToDebugger}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
            <Code2 className="w-12 h-12 text-slate-700 mb-3" />
            <p className="text-xs">Select a file from the repository tree to inspect its code.</p>
          </div>
        )}
      </div>
    </div>
  );
};
