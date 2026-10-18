import React from 'react';
import {
  LayoutDashboard,
  FolderTree,
  BotMessageSquare,
  Bug,
  ShieldAlert,
  GitPullRequest,
  History,
  FileCheck2,
  ChevronLeft,
  ChevronRight,
  Activity,
} from 'lucide-react';

export type ActiveView =
  | 'dashboard'
  | 'explorer'
  | 'assistant'
  | 'debugger'
  | 'security'
  | 'patches'
  | 'history'
  | 'diagnostics';

interface SidebarProps {
  currentView: ActiveView;
  onSelectView: (view: ActiveView) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  patchesCount?: number;
  findingsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  collapsed,
  onToggleCollapse,
  patchesCount = 0,
  findingsCount = 0,
}) => {
  const menuItems = [
    {
      id: 'dashboard' as ActiveView,
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
      badge: null,
    },
    {
      id: 'explorer' as ActiveView,
      label: 'Project Explorer',
      icon: <FolderTree className="w-4 h-4" />,
      badge: null,
    },
    {
      id: 'assistant' as ActiveView,
      label: 'AI Code Assistant',
      icon: <BotMessageSquare className="w-4 h-4" />,
      badge: 'RAG',
    },
    {
      id: 'debugger' as ActiveView,
      label: 'Agentic Debugger',
      icon: <Bug className="w-4 h-4" />,
      badge: 'Multi-Agent',
    },
    {
      id: 'security' as ActiveView,
      label: 'Security Review',
      icon: <ShieldAlert className="w-4 h-4" />,
      badge: findingsCount > 0 ? `${findingsCount}` : null,
      badgeColor: 'bg-rose-950 text-rose-400 border border-rose-800/40',
    },
    {
      id: 'patches' as ActiveView,
      label: 'Patch Review',
      icon: <GitPullRequest className="w-4 h-4" />,
      badge: patchesCount > 0 ? `${patchesCount}` : null,
      badgeColor: 'bg-emerald-950 text-emerald-400 border border-emerald-800/40',
    },
    {
      id: 'history' as ActiveView,
      label: 'Analysis History',
      icon: <History className="w-4 h-4" />,
      badge: null,
    },
    {
      id: 'diagnostics' as ActiveView,
      label: 'System Diagnostics',
      icon: <Activity className="w-4 h-4" />,
      badge: 'RAG & Agents',
      badgeColor: 'bg-cyan-950 text-cyan-300 border border-cyan-800/40',
    },
  ];

  return (
    <aside
      className={`border-r border-slate-800 bg-slate-950/95 flex flex-col justify-between transition-all duration-200 z-20 select-none ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      <div className="p-3 space-y-1.5">
        {!collapsed && (
          <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Repository Intelligence
          </div>
        )}

        {menuItems.map(item => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectView(item.id)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                isActive
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
              } ${collapsed ? 'justify-center' : 'justify-between'}`}
            >
              <div className="flex items-center space-x-3">
                <span className={isActive ? 'text-cyan-400' : 'text-slate-400'}>
                  {item.icon}
                </span>
                {!collapsed && <span>{item.label}</span>}
              </div>

              {!collapsed && item.badge && (
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono font-medium ${
                    item.badgeColor || 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer & Collapse toggle */}
      <div className="p-3 border-t border-slate-800 space-y-2">
        {!collapsed && (
          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400">
            <div className="flex items-center space-x-1.5 text-slate-300 font-medium mb-1">
              <FileCheck2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Grounded Engine</span>
            </div>
            <p className="text-[10px] text-slate-500">
              Zero mock hallucination. Citations directly tied to parsed AST chunks.
            </p>
          </div>
        )}

        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition text-xs"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
};
