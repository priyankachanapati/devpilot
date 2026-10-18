import React, { useState } from 'react';
import {
  X,
  Sparkles,
  GitBranch,
  UploadCloud,
  Check,
  AlertCircle,
  Loader2,
  FolderGit2,
} from 'lucide-react';
import { Project } from '../types/index.ts';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: (project: Project) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  onProjectCreated,
}) => {
  const [activeTab, setActiveTab] = useState<'sample' | 'github' | 'zip'>('sample');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sample tab state
  const [selectedSample, setSelectedSample] = useState<string>('payflow-gateway');

  // GitHub tab state
  const [githubUrl, setGithubUrl] = useState<string>('https://github.com/expressjs/express');
  const [githubName, setGithubName] = useState<string>('');

  // ZIP tab state
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [zipProjectName, setZipProjectName] = useState<string>('');

  if (!isOpen) return null;

  const handleCreateSample = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceType: 'sample', sampleId: selectedSample }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to initialize sample project');
      onProjectCreated(data);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error creating project');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGitHub = async () => {
    if (!githubUrl.trim()) {
      setError('Please provide a valid GitHub repository URL.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceType: 'github',
          githubUrl: githubUrl.trim(),
          name: githubName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to import GitHub repository');
      onProjectCreated(data);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error importing repository');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateZip = async () => {
    if (!zipFile) {
      setError('Please select a ZIP file to upload.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];
          const res = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sourceType: 'zip',
              name: zipProjectName.trim() || zipFile.name.replace(/\.zip$/i, ''),
              zipBase64: base64,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to upload and extract ZIP');
          onProjectCreated(data);
          onClose();
        } catch (innerErr: any) {
          setError(innerErr.message || 'Failed processing archive');
        } finally {
          setLoading(false);
        }
      };
      reader.onerror = () => {
        setError('Failed to read selected ZIP archive');
        setLoading(false);
      };
      reader.readAsDataURL(zipFile);
    } catch (err: any) {
      setError(err.message || 'Upload error');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <FolderGit2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">Create / Import Repository</h2>
              <p className="text-xs text-slate-400">Select source repository for multi-agent indexing & RAG analysis</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-6">
          <button
            onClick={() => { setActiveTab('sample'); setError(null); }}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'sample'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Curated Sample Repos
          </button>
          <button
            onClick={() => { setActiveTab('github'); setError(null); }}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'github'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitBranch className="w-4 h-4" />
            Public Git Repository
          </button>
          <button
            onClick={() => { setActiveTab('zip'); setError(null); }}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'zip'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            Upload Source ZIP
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-950/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Tab 1: Samples */}
          {activeTab === 'sample' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Instantly load a pre-configured, production-style microservice with real-world concurrency bugs and security flaws:
              </p>

              <div className="space-y-2.5">
                {/* PayFlow */}
                <label
                  onClick={() => setSelectedSample('payflow-gateway')}
                  className={`flex items-start p-3.5 rounded-xl border cursor-pointer transition ${
                    selectedSample === 'payflow-gateway'
                      ? 'border-cyan-500/80 bg-cyan-950/20 ring-1 ring-cyan-500/30'
                      : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="sampleRepo"
                    checked={selectedSample === 'payflow-gateway'}
                    onChange={() => setSelectedSample('payflow-gateway')}
                    className="mt-0.5 text-cyan-500 focus:ring-0 mr-3"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200 text-xs">PayFlow Payment Gateway</span>
                      <span className="px-2 py-0.5 text-[10px] rounded bg-blue-950/60 text-blue-400 border border-blue-800/40">
                        TypeScript / Express
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      High-throughput wallet ledger service. Contains concurrency double-spending race condition & webhook timing vulnerability.
                    </p>
                  </div>
                </label>

                {/* DataForge */}
                <label
                  onClick={() => setSelectedSample('dataforge-pipeline')}
                  className={`flex items-start p-3.5 rounded-xl border cursor-pointer transition ${
                    selectedSample === 'dataforge-pipeline'
                      ? 'border-cyan-500/80 bg-cyan-950/20 ring-1 ring-cyan-500/30'
                      : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="sampleRepo"
                    checked={selectedSample === 'dataforge-pipeline'}
                    onChange={() => setSelectedSample('dataforge-pipeline')}
                    className="mt-0.5 text-cyan-500 focus:ring-0 mr-3"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200 text-xs">DataForge Analytics Pipeline</span>
                      <span className="px-2 py-0.5 text-[10px] rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                        Python / FastAPI
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Data ingestion & SQL querying service. Contains SQL injection flaw, ZeroDivisionError on empty batches, and unbounded cache leak.
                    </p>
                  </div>
                </label>

                {/* AuthNexus */}
                <label
                  onClick={() => setSelectedSample('authnexus-identity')}
                  className={`flex items-start p-3.5 rounded-xl border cursor-pointer transition ${
                    selectedSample === 'authnexus-identity'
                      ? 'border-cyan-500/80 bg-cyan-950/20 ring-1 ring-cyan-500/30'
                      : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="sampleRepo"
                    checked={selectedSample === 'authnexus-identity'}
                    onChange={() => setSelectedSample('authnexus-identity')}
                    className="mt-0.5 text-cyan-500 focus:ring-0 mr-3"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200 text-xs">AuthNexus Identity Service</span>
                      <span className="px-2 py-0.5 text-[10px] rounded bg-purple-950/60 text-purple-400 border border-purple-800/40">
                        TypeScript / JWT
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Enterprise token issuer. Contains critical JWT &quot;none&quot; algorithm authentication bypass and privilege escalation in RBAC.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Tab 2: GitHub URL */}
          {activeTab === 'github' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Public GitHub Repository URL
                </label>
                <input
                  type="text"
                  value={githubUrl}
                  onChange={e => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/owner/repository"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-cyan-400 font-mono"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  DevPilot AI retrieves files, language breakdown, and directory hierarchy directly from the repository.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Project Name (Optional)
                </label>
                <input
                  type="text"
                  value={githubName}
                  onChange={e => setGithubName(e.target.value)}
                  placeholder="e.g. My App Service"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          )}

          {/* Tab 3: Upload ZIP */}
          {activeTab === 'zip' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Source Archive (ZIP)
                </label>
                <div className="border-2 border-dashed border-slate-700 hover:border-slate-500 rounded-xl p-6 text-center bg-slate-950/40 cursor-pointer">
                  <input
                    type="file"
                    accept=".zip"
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        setZipFile(e.target.files[0]);
                        if (!zipProjectName) {
                          setZipProjectName(e.target.files[0].name.replace(/\.zip$/i, ''));
                        }
                      }
                    }}
                    className="hidden"
                    id="zip-upload-input"
                  />
                  <label htmlFor="zip-upload-input" className="cursor-pointer flex flex-col items-center">
                    <UploadCloud className="w-8 h-8 text-cyan-400 mb-2" />
                    <span className="text-xs font-semibold text-slate-200">
                      {zipFile ? zipFile.name : 'Click to select or drag a source code .zip archive'}
                    </span>
                    <span className="text-[11px] text-slate-500 mt-1">
                      Excluded automatically: node_modules, .git, binaries, and oversized files
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  value={zipProjectName}
                  onChange={e => setZipProjectName(e.target.value)}
                  placeholder="e.g. Custom Microservice"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            Protected against ZipSlip traversal & malicious injection
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 transition"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (activeTab === 'sample') handleCreateSample();
                else if (activeTab === 'github') handleCreateGitHub();
                else handleCreateZip();
              }}
              disabled={loading}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{loading ? 'Ingesting...' : 'Import & Open Project'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
