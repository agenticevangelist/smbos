'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Theme,
  TextArea,
  Button,
  InlineLoading,
} from '@carbon/react';
import { Search, Notification, UserAvatar, Chat, Send, Asleep, Light, Events, Activity, Home, Menu, Stop, Play, Pause, Add, Settings, ChevronUp, ChevronDown, Folder, Plug, Document, EditOff } from '@carbon/icons-react';
import { DynamicSkillUI } from './DynamicSkillUI';
import { AgentConfig, AgentChannels, AgentSoul, AgentWorkspace } from './agent-pages';
import { ScheduledTasks } from './ScheduledTasks';
import { Dashboard } from './Dashboard';
import { ProjectManager } from './ProjectManager';
import { SettingsPage, getOpenClawSettings } from './SettingsPage';
import { useOpenClaw } from '@/lib/useOpenClaw';
import './AppShell.scss';
import packageJson from '../package.json';

// Sub-pages under each agent
const AGENT_SUBPAGES = [
  { key: 'config', label: 'Config', icon: Settings },
  { key: 'channels', label: 'Channels', icon: Plug },
  { key: 'soul', label: 'Soul', icon: EditOff },
  { key: 'workspace', label: 'Workspace', icon: Document },
  { key: 'tasks', label: 'Tasks', icon: Events },
] as const;

export function AppShell() {
  const [activePage, setActivePage] = useState('dashboard');
  const [skills, setSkills] = useState<Array<{ id: string, name: string, icon: string }>>([]);
  const [theme, setTheme] = useState<'white' | 'g100'>('white');
  const [rightSideNavExpanded, setRightSideNavExpanded] = useState(true);
  const [leftSideNavExpanded, setLeftSideNavExpanded] = useState(true);
  const [gatewayRunning, setGatewayRunning] = useState<boolean | null>(null);
  const [gatewayLoading, setGatewayLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Resizable sidebars
  const [rightSidebarWidth, setRightSidebarWidth] = useState(320);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(280);
  const [isResizingLeft, setIsResizingLeft] = useState(false);

  const { status: ocStatus, messages, isStreaming, connect, disconnect, sendMessage, abortRun, rpc, agentId: chatAgentId, setAgentId: setChatAgentId } = useOpenClaw();
  const [agents, setAgents] = useState<any[]>([]);

  const [chatInput, setChatInput] = useState('');
  const [projects, setProjects] = useState<any[]>([]);
  const [expandedProjectIds, setExpandedProjectIds] = useState<string[]>([]);
  const [expandedAgentIds, setExpandedAgentIds] = useState<string[]>([]);
  const [expandedAgentGroups, setExpandedAgentGroups] = useState<string[]>([]);

  const toggleProject = (id: string) => {
    setExpandedProjectIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const toggleAgent = (id: string) => {
    setExpandedAgentIds(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  };

  const toggleAgentGroup = (projectId: string) => {
    setExpandedAgentGroups(prev => prev.includes(projectId) ? prev.filter(p => p !== projectId) : [...prev, projectId]);
  };

  // When navigating to an agent page, auto-expand it
  const navigateTo = useCallback((page: string) => {
    setActivePage(page);
    // Auto-expand agent in sidebar when navigating to agent sub-page
    const agentMatch = page.match(/^agent-(.+?)-(config|channels|soul|workspace|tasks)$/);
    if (agentMatch) {
      const id = agentMatch[1];
      setExpandedAgentIds(prev => prev.includes(id) ? prev : [...prev, id]);
    }
  }, []);

  // Persistence: Load from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('smbos_theme');
    if (savedTheme) setTheme(savedTheme as any);
    const savedActivePage = localStorage.getItem('smbos_active_page');
    if (savedActivePage) setActivePage(savedActivePage);
    const savedLeftWidth = localStorage.getItem('smbos_left_sidebar_width');
    if (savedLeftWidth) setLeftSidebarWidth(parseInt(savedLeftWidth, 10));
    const savedRightWidth = localStorage.getItem('smbos_right_sidebar_width');
    if (savedRightWidth) setRightSidebarWidth(parseInt(savedRightWidth, 10));
    const savedLeftExpanded = localStorage.getItem('smbos_left_sidebar_expanded');
    if (savedLeftExpanded !== null) setLeftSideNavExpanded(savedLeftExpanded === 'true');
    const savedRightExpanded = localStorage.getItem('smbos_right_sidebar_expanded');
    if (savedRightExpanded !== null) setRightSideNavExpanded(savedRightExpanded === 'true');
  }, []);

  // Persistence: Sync to localStorage
  useEffect(() => { localStorage.setItem('smbos_theme', theme); }, [theme]);
  useEffect(() => { localStorage.setItem('smbos_active_page', activePage); }, [activePage]);
  useEffect(() => { localStorage.setItem('smbos_left_sidebar_width', leftSidebarWidth.toString()); }, [leftSidebarWidth]);
  useEffect(() => { localStorage.setItem('smbos_right_sidebar_width', rightSidebarWidth.toString()); }, [rightSidebarWidth]);
  useEffect(() => { localStorage.setItem('smbos_left_sidebar_expanded', leftSideNavExpanded.toString()); }, [leftSideNavExpanded]);
  useEffect(() => { localStorage.setItem('smbos_right_sidebar_expanded', rightSideNavExpanded.toString()); }, [rightSideNavExpanded]);

  // Fetch skills
  useEffect(() => {
    fetch('/api/skills').then(r => r.json()).then(setSkills).catch(() => {});
  }, []);

  // Fetch projects
  const fetchProjects = useCallback(() => {
    fetch('/api/projects').then(r => r.json()).then(d => setProjects(d.projects || [])).catch(console.error);
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  // Fetch agents
  const fetchAgents = useCallback(() => {
    if (ocStatus === 'connected') {
      rpc<any>('config.get', {}).then(res => {
        const parsed = res.parsed ?? (res.raw ? JSON.parse(res.raw) : {});
        const list = parsed.agents?.list ?? [];
        if (!list.find((a: any) => a.id === 'main')) {
          list.unshift({ id: 'main', name: 'Main' });
        }
        setAgents(list);
      }).catch(console.error);
    }
  }, [ocStatus, rpc]);

  useEffect(() => {
    if (ocStatus === 'connected') fetchAgents();
  }, [ocStatus, fetchAgents]);

  // Poll gateway status and auto-connect if settings allow
  useEffect(() => {
    const checkGateway = () => {
      fetch('/api/openclaw/gateway').then(r => r.json()).then(d => {
        setGatewayRunning(d.running);
        if (d.running && ocStatus === 'disconnected') {
          const s = getOpenClawSettings();
          if (s.autoConnect && s.gatewayToken) connect();
        }
      }).catch(() => setGatewayRunning(false));
    };
    checkGateway();
    const id = setInterval(checkGateway, 5000);
    return () => clearInterval(id);
  }, [ocStatus, connect]);

  // Scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const toggleGateway = async () => {
    setGatewayLoading(true);
    const action = gatewayRunning ? 'stop' : 'start';
    if (action === 'stop') disconnect();
    try {
      const res = await fetch('/api/openclaw/gateway', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      }).then(r => r.json());
      if (action === 'stop') setGatewayRunning(false);
      else if (res.ok) { setGatewayRunning(true); connect(); }
    } catch {
      const check = await fetch('/api/openclaw/gateway').then(r => r.json()).catch(() => ({ running: false }));
      setGatewayRunning(check.running);
    }
    setGatewayLoading(false);
  };

  const startResizingRight = useCallback(() => setIsResizingRight(true), []);
  const startResizingLeft = useCallback(() => setIsResizingLeft(true), []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingRight) setRightSidebarWidth(Math.max(250, Math.min(600, window.innerWidth - e.clientX)));
      if (isResizingLeft) setLeftSidebarWidth(Math.max(200, Math.min(400, e.clientX)));
    };
    const handleMouseUp = () => { setIsResizingRight(false); setIsResizingLeft(false); };
    if (isResizingRight || isResizingLeft) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [isResizingRight, isResizingLeft]);

  const handleSend = () => {
    if (!chatInput.trim()) return;
    sendMessage(chatInput);
    setChatInput('');
  };


  // Parse active page to determine agent context
  const parseAgentPage = (page: string) => {
    const m = page.match(/^agent-(.+)-(config|channels|soul|workspace|tasks)$/);
    if (m) return { agentId: m[1], subpage: m[2] };
    const newAgent = page.match(/^project-(.+)-add-agent$/);
    if (newAgent) return { agentId: 'new', subpage: 'config', projectId: newAgent[1] };
    return null;
  };

  const renderAgentSidebar = (agent: any, indent: number = 0) => {
    const isExpanded = expandedAgentIds.includes(agent.id);
    const agentName = agent.identity?.name || agent.name || agent.id;
    const agentEmoji = agent.identity?.emoji;

    return (
      <div key={agent.id} className="agent-tree-item">
        <button
          className={`sidebar-item ${activePage.startsWith(`agent-${agent.id}-`) ? 'active' : ''}`}
          onClick={() => toggleAgent(agent.id)}
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
                  onClick={() => navigateTo(pageKey)}
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

  // Render main content based on active page
  const renderContent = () => {
    if (activePage === 'dashboard') {
      return <Dashboard onNavigate={navigateTo} rpc={rpc} connected={ocStatus === 'connected'} />;
    }

    if (activePage === 'project-new') {
      return <ProjectManager mode="create" onNavigate={navigateTo} onProjectCreated={fetchProjects} />;
    }

    if (activePage === 'settings') {
      return <SettingsPage onNavigate={navigateTo} />;
    }

    if (activePage === 'tasks') {
      return <ScheduledTasks rpc={rpc} connected={ocStatus === 'connected'} />;
    }

    // Project-scoped tasks
    const projectTaskMatch = activePage.match(/^project-(.+)-tasks$/);
    if (projectTaskMatch) {
      const pid = projectTaskMatch[1];
      const agentIds = projects.find(p => p.id === pid)?.agentIds;
      return <ScheduledTasks rpc={rpc} connected={ocStatus === 'connected'} agentIds={agentIds} />;
    }

    // Agent sub-pages
    const agentPage = parseAgentPage(activePage);
    if (agentPage) {
      const props = {
        rpc,
        connected: ocStatus === 'connected',
        agentId: agentPage.agentId,
        isNew: agentPage.agentId === 'new',
        projectId: agentPage.projectId,
        onAgentChange: () => { fetchAgents(); fetchProjects(); },
        onNavigate: navigateTo,
      };

      switch (agentPage.subpage) {
        case 'config': return <AgentConfig {...props} />;
        case 'channels': return <AgentChannels {...props} />;
        case 'soul': return <AgentSoul {...props} />;
        case 'workspace': return <AgentWorkspace {...props} />;
        case 'tasks': return <ScheduledTasks rpc={rpc} connected={ocStatus === 'connected'} agentIds={[agentPage.agentId]} />;
        default: return <AgentConfig {...props} />;
      }
    }

    // Skill pages
    return <DynamicSkillUI skillId={activePage} />;
  };

  return (
    <Theme theme={theme} className="app-shell">

      {/* Left Sidebar */}
      <div
        className={`left-sidebar ${leftSideNavExpanded ? 'expanded' : 'collapsed'}`}
        style={{
          width: leftSideNavExpanded ? leftSidebarWidth : 0,
          flex: leftSideNavExpanded ? `0 0 ${leftSidebarWidth}px` : undefined,
          transition: isResizingLeft ? 'none' : 'width 0.2s, flex 0.2s',
        }}
      >
        <div className="panel-container">
          {/* Workspace Switcher */}
          <div className="sidebar-workspace-switcher">
            <div className="workspace-icon">S</div>
            <div className="workspace-details">
              <span className="workspace-name">Smart BOS</span>
            </div>
            <ChevronDown size={14} className="workspace-chevron" />
          </div>

          <div className="sidebar-content">
            <div className="sidebar-nav">
              {/* Platform Section */}
              <div className="sidebar-section">
                <button
                  className={`sidebar-item ${activePage === 'dashboard' ? 'active' : ''}`}
                  onClick={() => navigateTo('dashboard')}
                >
                  <Home size={16} />
                  <span>Dashboard</span>
                </button>
                <button
                  className={`sidebar-item ${activePage === 'tasks' ? 'active' : ''}`}
                  onClick={() => navigateTo('tasks')}
                >
                  <Events size={16} />
                  <span>Scheduled Tasks</span>
                </button>
                {skills.map(skill => (
                  <button
                    key={skill.id}
                    className={`sidebar-item ${activePage === skill.id ? 'active' : ''}`}
                    onClick={() => navigateTo(skill.id)}
                  >
                    <Activity size={16} />
                    <span>{skill.name}</span>
                  </button>
                ))}
              </div>

              {/* Projects Section */}
              <div className="sidebar-section" style={{ marginTop: '1.5rem' }}>
                <div className="sidebar-header">
                  <span>Projects</span>
                  <Button
                    hasIconOnly renderIcon={Add} kind="ghost" size="sm"
                    iconDescription="New Project"
                    onClick={(e) => { e.stopPropagation(); navigateTo('project-new'); }}
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
                            onClick={() => toggleProject(project.id)}
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
                              {/* Project agents */}
                              <div className="nested-group">
                                <button
                                  className="sidebar-item nested"
                                  onClick={(e) => { e.stopPropagation(); toggleAgentGroup(project.id); }}
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
                                      renderAgentSidebar(agent, 1)
                                    )}
                                    <button
                                      className="sidebar-item nested add-item"
                                      style={{ paddingLeft: '3rem' }}
                                      onClick={() => navigateTo(`project-${project.id}-add-agent`)}
                                    >
                                      <Add size={12} /> <span>Add Agent</span>
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Project tasks */}
                              <button
                                className={`sidebar-item nested ${activePage === `project-${project.id}-tasks` ? 'active' : ''}`}
                                onClick={() => navigateTo(`project-${project.id}-tasks`)}
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
                  <div className="sidebar-empty-state" style={{ padding: '0 1rem', fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>
                    <p style={{ marginBottom: '0.5rem' }}>No projects yet.</p>
                    <Button kind="ghost" size="sm" onClick={() => navigateTo('project-new')}>Create one</Button>
                  </div>
                )}

              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="sidebar-footer" style={{ flexDirection: 'column', gap: '0.5rem', padding: '1rem', minHeight: 'auto', borderTop: 'none' }}>
            <button
              className={`sidebar-item ${activePage === 'settings' ? 'active' : ''}`}
              onClick={() => navigateTo('settings')}
            >
              <Settings size={16} />
              <span>Settings</span>
            </button>
            <div style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)', paddingLeft: '0.75rem', marginTop: '0.5rem' }}>
              SMBOS v{packageJson.version}
            </div>
          </div>
        </div>
      </div>

      {/* Left Resizer */}
      {leftSideNavExpanded && (
        <div className={`resizer ${isResizingLeft ? 'resizing' : ''}`} onMouseDown={startResizingLeft} />
      )}

      {/* Main Area */}
      <div className="main-area">
        <div className="app-header">
          <div className="app-header__left">
            <button className="app-header__btn" onClick={() => setLeftSideNavExpanded(!leftSideNavExpanded)} title="Toggle sidebar">
              <Menu size={18} />
            </button>
            <span className="app-header__title">SMBOS</span>
          </div>
          <div className="app-header__right">
            <button className="app-header__btn" title="Search"><Search size={18} /></button>
            <button className="app-header__btn" title="Notifications"><Notification size={18} /></button>
            <button className="app-header__btn" onClick={() => setTheme(theme === 'white' ? 'g100' : 'white')} title="Toggle theme">
              {theme === 'white' ? <Asleep size={18} /> : <Light size={18} />}
            </button>
            <button className="app-header__btn" onClick={() => setRightSideNavExpanded(!rightSideNavExpanded)} title="Toggle chat">
              <Chat size={18} />
            </button>
            <button className="app-header__btn" title="Profile"><UserAvatar size={18} /></button>
          </div>
        </div>

        <div className="app-content">
          {renderContent()}
        </div>
      </div>

      {/* Right Resizer */}
      {rightSideNavExpanded && (
        <div className={`resizer ${isResizingRight ? 'resizing' : ''}`} onMouseDown={startResizingRight} />
      )}

      {/* Right Sidebar — OpenClaw Chat */}
      <div
        className={`right-sidebar ${rightSideNavExpanded ? 'expanded' : 'collapsed'}`}
        style={{
          width: rightSideNavExpanded ? rightSidebarWidth : 0,
          flex: rightSideNavExpanded ? `0 0 ${rightSidebarWidth}px` : undefined,
          transition: isResizingRight ? 'none' : 'width 0.2s, flex 0.2s',
        }}
      >
        <div className="panel-container">
          <div className="chat-header">
            <select
              className="chat-agent-select"
              value={chatAgentId}
              onChange={(e) => setChatAgentId(e.target.value)}
              disabled={ocStatus !== 'connected'}
            >
              {agents.length === 0 && <option value="main">Main</option>}
              {agents.map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.identity?.name || agent.name || agent.id}
                </option>
              ))}
            </select>
            <button
              className="app-header__btn"
              onClick={toggleGateway}
              disabled={gatewayLoading || gatewayRunning === null}
              title={gatewayRunning ? 'Stop gateway' : 'Start gateway'}
            >
              {gatewayRunning ? <Pause size={16} /> : <Play size={16} />}
            </button>
          </div>

          <div className="sidebar-content">
            <div className="chat-messages">
              {messages.length === 0 && !isStreaming ? (
                <div className="chat-empty">
                  <Chat size={48} />
                  {ocStatus === 'connected'
                    ? <p>How can I help you today?</p>
                    : ocStatus === 'connecting'
                    ? <p>Connecting to OpenClaw…</p>
                    : <p>OpenClaw is {gatewayRunning ? 'unreachable' : 'stopped'}. {!gatewayRunning && 'Press ▶ to start.'}</p>
                  }
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <div key={msg.id} className={`chat-message ${msg.role}`}>
                      <div className="message-content" style={{ whiteSpace: 'pre-wrap' }}>
                        {msg.content}
                        {msg.partial && <span className="typing-cursor">▋</span>}
                      </div>
                      {msg.timestamp && (
                        <div className="message-meta">
                          <span className="message-time">{msg.timestamp}</span>
                        </div>
                      )}
                    </div>
                  ))}
                  {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
                    <div className="loading-indicator" style={{ padding: '1rem' }}>
                      <InlineLoading description="Thinking…" />
                    </div>
                  )}
                </>
              )}
              <div ref={chatBottomRef} />
            </div>
          </div>

          <div className="sidebar-footer">
            <div className="chat-input-area">
              <div className="left-input-container">
                <TextArea
                  id="chat-input"
                  labelText=""
                  placeholder={ocStatus === 'connected' ? 'Ask OpenClaw…' : 'Gateway not connected'}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                  }}
                  disabled={ocStatus !== 'connected' || isStreaming}
                  rows={1}
                />
              </div>
              <div className="right-button-container">
                {isStreaming ? (
                  <Button renderIcon={Stop} iconDescription="Stop" hasIconOnly size="md" kind="danger--ghost" onClick={abortRun} />
                ) : (
                  <Button renderIcon={Send} iconDescription="Send" hasIconOnly size="md" onClick={handleSend} disabled={!chatInput.trim() || ocStatus !== 'connected'} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Theme>
  );
}
