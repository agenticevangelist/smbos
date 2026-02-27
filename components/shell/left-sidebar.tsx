'use client';

import { Button } from '@carbon/react';
import { Add, Home, Events, Activity, Settings, ChevronUp, ChevronDown, Folder, UserAvatar, Chat } from '@carbon/icons-react';
import { Plug, Archive, EditOff } from '@carbon/icons-react';

const AGENT_SUBPAGES = [
  { key: 'config', label: 'Config', icon: Settings },
  { key: 'channels', label: 'Channels', icon: Plug },
  { key: 'soul', label: 'Soul', icon: EditOff },
  { key: 'memory', label: 'Memory', icon: Archive },
  { key: 'tasks', label: 'Tasks', icon: Events },
  { key: 'sessions', label: 'Sessions', icon: Chat },
] as const;

interface LeftSidebarProps {
  activePage: string;
  agents: any[];
  projects: any[];
  skills: Array<{ id: string; name: string; icon: string }>;
  expandedProjectIds: string[];
  expandedAgentIds: string[];
  expandedAgentGroups: string[];
  version: string;
  onNavigate: (page: string) => void;
  onToggleProject: (id: string) => void;
  onToggleAgent: (id: string) => void;
  onToggleAgentGroup: (projectId: string) => void;
  onNewProject: () => void;
}

export function LeftSidebar({
  activePage,
  agents,
  projects,
  skills,
  expandedProjectIds,
  expandedAgentIds,
  expandedAgentGroups,
  version,
  onNavigate,
  onToggleProject,
  onToggleAgent,
  onToggleAgentGroup,
  onNewProject,
}: LeftSidebarProps) {
  const renderAgentTree = (agent: any, indent: number = 0) => {
    const isExpanded = expandedAgentIds.includes(agent.id);
    const agentName = agent.identity?.name || agent.name || agent.id;
    const agentEmoji = agent.identity?.emoji;

    return (
      <div key={agent.id} className="agent-tree-item">
        <button
          className={`sidebar-item ${activePage.startsWith(`agent-${agent.id}-`) ? 'active' : ''}`}
          onClick={() => onToggleAgent(agent.id)}
          style={{ paddingLeft: `${12 + indent * 12}px`, justifyContent: 'space-between' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {agentEmoji
              ? <span style={{ fontSize: '1rem', width: 16, textAlign: 'center', display: 'inline-block' }}>{agentEmoji}</span>
              : <UserAvatar size={16} />
            }
            <span>{agentName}</span>
          </div>
          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        <div className={`nested-list expandable ${isExpanded ? 'expanded' : ''}`}>
          <div className="expandable-inner">
            {AGENT_SUBPAGES.map(sp => {
              const pageKey = `agent-${agent.id}-${sp.key}`;
              const Icon = sp.icon;
              return (
                <button
                  key={sp.key}
                  className={`sidebar-item nested ${activePage === pageKey ? 'active' : ''}`}
                  style={{ paddingLeft: `${24 + indent * 12}px` }}
                  onClick={() => onNavigate(pageKey)}
                >
                  <Icon size={14} />
                  <span>{sp.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="panel-container">
      <div className="sidebar-workspace-switcher">
        <div className="workspace-icon">S</div>
        <div className="workspace-details">
          <span className="workspace-name">Smart BOS</span>
        </div>
        <ChevronDown size={14} className="workspace-chevron" />
      </div>

      <div className="sidebar-content">
        <div className="sidebar-nav">
          <div className="sidebar-section">
            <button
              className={`sidebar-item ${activePage === 'dashboard' ? 'active' : ''}`}
              onClick={() => onNavigate('dashboard')}
            >
              <Home size={16} />
              <span>Dashboard</span>
            </button>
            <button
              className={`sidebar-item ${activePage === 'tasks' ? 'active' : ''}`}
              onClick={() => onNavigate('tasks')}
            >
              <Events size={16} />
              <span>Scheduled Tasks</span>
            </button>
            {skills.map(skill => (
              <button
                key={skill.id}
                className={`sidebar-item ${activePage === skill.id ? 'active' : ''}`}
                onClick={() => onNavigate(skill.id)}
              >
                <Activity size={16} />
                <span>{skill.name}</span>
              </button>
            ))}
          </div>

          <div className="sidebar-section" style={{ marginTop: '1.5rem' }}>
            <div className="sidebar-header">
              <span>Projects</span>
              <Button
                hasIconOnly renderIcon={Add} kind="ghost" size="sm"
                iconDescription="New Project"
                onClick={(e) => { e.stopPropagation(); onNewProject(); }}
                tooltipPosition="left"
              />
            </div>
            {projects.length > 0 ? (
              <div className="project-list">
                {projects.map(project => {
                  const isExpanded = expandedProjectIds.includes(project.id);
                  return (
                    <div key={project.id} className="project-group">
                      <button
                        className="sidebar-item"
                        onClick={() => onToggleProject(project.id)}
                        style={{ justifyContent: 'space-between' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Folder size={16} />
                          <span>{project.name}</span>
                        </div>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>

                      <div className={`project-nav-group expandable ${isExpanded ? 'expanded' : ''}`}>
                        <div className="expandable-inner">
                          <div className="nested-group">
                            <button
                              className="sidebar-item nested"
                              onClick={(e) => { e.stopPropagation(); onToggleAgentGroup(project.id); }}
                              style={{ justifyContent: 'space-between' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <UserAvatar size={14} /> <span>Agents</span>
                              </div>
                              {expandedAgentGroups.includes(project.id) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>

                            <div className={`nested-list expandable ${expandedAgentGroups.includes(project.id) ? 'expanded' : ''}`}>
                              <div className="expandable-inner">
                                {agents.filter(a => project.agentIds?.includes(a.id)).map(agent =>
                                  renderAgentTree(agent, 1)
                                )}
                                <button
                                  className="sidebar-item nested add-item"
                                  style={{ paddingLeft: '3rem' }}
                                  onClick={() => onNavigate(`project-${project.id}-add-agent`)}
                                >
                                  <Add size={12} /> <span>Add Agent</span>
                                </button>
                              </div>
                            </div>
                          </div>

                          <button
                            className={`sidebar-item nested ${activePage === `project-${project.id}-tasks` ? 'active' : ''}`}
                            onClick={() => onNavigate(`project-${project.id}-tasks`)}
                          >
                            <Events size={14} /> <span>Tasks</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: '0 1rem', fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>
                <p style={{ marginBottom: '0.5rem' }}>No projects yet.</p>
                <Button kind="ghost" size="sm" onClick={() => onNavigate('project-new')}>Create one</Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="sidebar-footer" style={{ flexDirection: 'column', gap: '0.5rem', padding: '1rem', minHeight: 'auto', borderTop: 'none' }}>
        <button
          className={`sidebar-item ${activePage === 'settings' ? 'active' : ''}`}
          onClick={() => onNavigate('settings')}
        >
          <Settings size={16} />
          <span>Settings</span>
        </button>
        <div style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)', paddingLeft: '0.75rem', marginTop: '0.5rem' }}>
          SMBOS v{version}
        </div>
      </div>
    </div>
  );
}
