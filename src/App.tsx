import React, { useState, useEffect } from 'react';
import { Project } from './types/index.ts';
import { Navbar } from './components/Navbar.tsx';
import { Sidebar, ActiveView } from './components/Sidebar.tsx';
import { NewProjectModal } from './components/NewProjectModal.tsx';
import { DashboardView } from './views/DashboardView.tsx';
import { ProjectExplorerView } from './views/ProjectExplorerView.tsx';
import { CodeAssistantView } from './views/CodeAssistantView.tsx';
import { AgenticDebuggerView } from './views/AgenticDebuggerView.tsx';
import { SecurityReviewView } from './views/SecurityReviewView.tsx';
import { PatchReviewView } from './views/PatchReviewView.tsx';
import { AnalysisHistoryView } from './views/AnalysisHistoryView.tsx';

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [currentView, setCurrentView] = useState<ActiveView>('dashboard');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);

  // Cross-view state transfer
  const [debuggerPrompt, setDebuggerPrompt] = useState<string>('');
  const [selectedPatchId, setSelectedPatchId] = useState<string | null>(null);

  // Badge counters
  const [patchesCount, setPatchesCount] = useState<number>(0);
  const [findingsCount, setFindingsCount] = useState<number>(0);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data: Project[] = await res.json();
      setProjects(data || []);

      if (data && data.length > 0) {
        if (!activeProject || !data.some(p => p.id === activeProject.id)) {
          setActiveProject(data[0]);
        } else {
          const current = data.find(p => p.id === activeProject.id);
          if (current) setActiveProject(current);
        }
      }
    } catch (err) {
      console.error('[Fetch Projects Error]', err);
    }
  };

  const fetchCounters = async (projectId: string) => {
    try {
      const [pRes, fRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/patches`).then(r => r.json()).catch(() => []),
        fetch(`/api/projects/${projectId}/findings`).then(r => r.json()).catch(() => []),
      ]);
      setPatchesCount(pRes?.length || 0);
      setFindingsCount(fRes?.length || 0);
    } catch (err) {
      // Ignore
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (activeProject) {
      fetchCounters(activeProject.id);
    }
  }, [activeProject?.id]);

  const handleTriggerIndex = async () => {
    if (!activeProject || isIndexing) return;
    setIsIndexing(true);

    try {
      const res = await fetch(`/api/projects/${activeProject.id}/index`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.project) {
        setActiveProject(data.project);
        setProjects(prev => prev.map(p => (p.id === data.project.id ? data.project : p)));
      }
    } catch (err) {
      console.error('[Indexing Error]', err);
    } finally {
      setIsIndexing(false);
      fetchProjects();
    }
  };

  const handleStartInvestigation = (prompt: string) => {
    setDebuggerPrompt(prompt);
    setCurrentView('debugger');
  };

  const handleNavigateToPatch = (patchId: string) => {
    setSelectedPatchId(patchId);
    setCurrentView('patches');
  };

  const handleSendFileToDebugger = (filePath: string, snippet: string) => {
    setDebuggerPrompt(`Investigate and verify code behavior in ${filePath}:\n${snippet}`);
    setCurrentView('debugger');
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 font-sans text-slate-100 antialiased select-none">
      {/* Top Navigation */}
      <Navbar
        projects={projects}
        activeProject={activeProject}
        onSelectProject={p => {
          setActiveProject(p);
          fetchCounters(p.id);
        }}
        onOpenNewModal={() => setIsNewModalOpen(true)}
        onTriggerIndex={handleTriggerIndex}
        isIndexing={isIndexing}
      />

      {/* Main Body with Sidebar + Active View */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          currentView={currentView}
          onSelectView={v => setCurrentView(v)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          patchesCount={patchesCount}
          findingsCount={findingsCount}
        />

        <main className="flex-1 flex flex-col overflow-hidden bg-slate-950">
          {currentView === 'dashboard' && (
            <DashboardView
              project={activeProject}
              onNavigate={v => setCurrentView(v)}
              onOpenNewProject={() => setIsNewModalOpen(true)}
              onStartInvestigation={handleStartInvestigation}
            />
          )}

          {currentView === 'explorer' && (
            <ProjectExplorerView
              project={activeProject}
              onSendToDebugger={handleSendFileToDebugger}
              onTriggerIndex={handleTriggerIndex}
              isIndexing={isIndexing}
            />
          )}

          {currentView === 'assistant' && (
            <CodeAssistantView
              project={activeProject}
              onInvestigateSnippet={handleSendFileToDebugger}
            />
          )}

          {currentView === 'debugger' && (
            <AgenticDebuggerView
              project={activeProject}
              initialPrompt={debuggerPrompt}
              onNavigateToPatch={handleNavigateToPatch}
            />
          )}

          {currentView === 'security' && (
            <SecurityReviewView
              project={activeProject}
              onSendToDebugger={handleStartInvestigation}
            />
          )}

          {currentView === 'patches' && (
            <PatchReviewView
              project={activeProject}
              activePatchId={selectedPatchId}
              onSendToDebugger={handleStartInvestigation}
            />
          )}

          {currentView === 'history' && (
            <AnalysisHistoryView
              project={activeProject}
              onSelectSession={sessionId => {
                // Handle session selection
              }}
            />
          )}
        </main>
      </div>

      {/* New Project / Import Modal */}
      <NewProjectModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onProjectCreated={newProj => {
          setProjects(prev => [newProj, ...prev]);
          setActiveProject(newProj);
          fetchCounters(newProj.id);
        }}
      />
    </div>
  );
}
