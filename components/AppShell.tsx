'use client';

import { useState, useCallback, useEffect } from 'react';
import { Theme } from '@carbon/react';
import { DynamicSkillUI } from './DynamicSkillUI';
import { AgentConfig, AgentChannels, AgentSoul, AgentMemory, AgentTasks, AgentSessions } from './agent-pages';
import { ScheduledTasks } from './ScheduledTasks';
import { Dashboard } from './Dashboard';
import { ProjectManager } from './ProjectManager';
import { SettingsPage, getOpenClawSettings } from './SettingsPage';
import { LeftSidebar } from './shell/left-sidebar';
import { AppHeader } from './shell/app-header';
import { ChatSidebar } from './chat/chat-sidebar';
import { useOpenClaw } from '@/lib/useOpenClaw';
import './AppShell.scss';
import packageJson from '../package.json';

export function AppShell() {
  const [activePage, setActivePage] = useState('dashboard');
  const [skills, setSkills] = useState<Array<{ id: string; name: string; icon: string }>>([]);
  const [theme, setTheme] = useState<'white' | 'g100'>('white');
  const [rightSideNavExpanded, setRightSideNavExpanded] = useState(true);
  const [leftSideNavExpanded, setLeftSideNavExpanded] = useState(true);
  const [gatewayRunning, setGatewayRunning] = useState<boolean | null>(null);
  const [gatewayLoading, setGatewayLoading] = useState(false);

  // Resizable sidebars
  const [rightSidebarWidth, setRightSidebarWidth] = useState(320);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(280);
  const [isResizingLeft, setIsResizingLeft] = useState(false);

  const { status: ocStatus, messages, isStreaming, connect, disconnect, sendMessage, abortRun, rpc, agentId: chatAgentId, setAgentId: setChatAgentId } = useOpenClaw();
  const [agents, setAgents] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [expandedProjectIds, setExpandedProjectIds] = useState<string[]>([]);
  const [expandedAgentIds, setExpandedAgentIds] = useState<string[]>([]);
  const [expandedAgentGroups, setExpandedAgentGroups] = useState<string[]>([]);

  const toggleProject = (id: string) =>
    setExpandedProjectIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  const toggleAgent = (id: string) =>
    setExpandedAgentIds(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  const toggleAgentGroup = (projectId: string) =>
    setExpandedAgentGroups(prev => prev.includes(projectId) ? prev.filter(p => p !== projectId) : [...prev, projectId]);

  const navigateTo = useCallback((page: string) => {
    setActivePage(page);
    const agentMatch = page.match(/^agent-(.+?)-(config|channels|soul|memory|tasks|sessions)$/);
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

  useEffect(() => {
    fetch('/api/skills').then(r => r.json()).then(setSkills).catch(() => {});
  }, []);

  const fetchProjects = useCallback(() => {
    fetch('/api/projects').then(r => r.json()).then(d => setProjects(d.projects || [])).catch(console.error);
  }, []);
  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const fetchAgents = useCallback(() => {
    if (ocStatus === 'connected') {
      rpc<any>('config.get', {}).then(res => {
        const parsed = res.parsed ?? (res.raw ? JSON.parse(res.raw) : {});
        const list = parsed.agents?.list ?? [];
        if (!list.find((a: any) => a.id === 'main')) list.unshift({ id: 'main', name: 'Main' });
        setAgents(list);
      }).catch(console.error);
    }
  }, [ocStatus, rpc]);
  useEffect(() => { if (ocStatus === 'connected') fetchAgents(); }, [ocStatus, fetchAgents]);

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
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingRight, isResizingLeft]);

  const parseAgentPage = (page: string) => {
    const m = page.match(/^agent-(.+)-(config|channels|soul|memory|tasks|sessions)$/);
    if (m) return { agentId: m[1], subpage: m[2] };
    const newAgent = page.match(/^project-(.+)-add-agent$/);
    if (newAgent) return { agentId: 'new', subpage: 'config', projectId: newAgent[1] };
    return null;
  };

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
    const projectTaskMatch = activePage.match(/^project-(.+)-tasks$/);
    if (projectTaskMatch) {
      const pid = projectTaskMatch[1];
      const agentIds = projects.find(p => p.id === pid)?.agentIds;
      return <ScheduledTasks rpc={rpc} connected={ocStatus === 'connected'} agentIds={agentIds} />;
    }
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
        case 'memory': return <AgentMemory {...props} />;
        case 'tasks': return <AgentTasks rpc={rpc} connected={ocStatus === 'connected'} agentId={agentPage.agentId} />;
        case 'sessions': return <AgentSessions rpc={rpc} connected={ocStatus === 'connected'} agentId={agentPage.agentId} />;
        default: return <AgentConfig {...props} />;
      }
    }
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
        <LeftSidebar
          activePage={activePage}
          agents={agents}
          projects={projects}
          skills={skills}
          expandedProjectIds={expandedProjectIds}
          expandedAgentIds={expandedAgentIds}
          expandedAgentGroups={expandedAgentGroups}
          version={packageJson.version}
          onNavigate={navigateTo}
          onToggleProject={toggleProject}
          onToggleAgent={toggleAgent}
          onToggleAgentGroup={toggleAgentGroup}
          onNewProject={() => navigateTo('project-new')}
        />
      </div>

      {/* Left Resizer */}
      {leftSideNavExpanded && (
        <div className={`resizer ${isResizingLeft ? 'resizing' : ''}`} onMouseDown={startResizingLeft} />
      )}

      {/* Main Area */}
      <div className="main-area">
        <AppHeader
          theme={theme}
          onToggleLeftSidebar={() => setLeftSideNavExpanded(!leftSideNavExpanded)}
          onToggleRightSidebar={() => setRightSideNavExpanded(!rightSideNavExpanded)}
          onToggleTheme={() => setTheme(theme === 'white' ? 'g100' : 'white')}
        />
        <div className="app-content">
          {renderContent()}
        </div>
      </div>

      {/* Right Resizer */}
      {rightSideNavExpanded && (
        <div className={`resizer ${isResizingRight ? 'resizing' : ''}`} onMouseDown={startResizingRight} />
      )}

      {/* Right Sidebar — Chat */}
      <div
        className={`right-sidebar ${rightSideNavExpanded ? 'expanded' : 'collapsed'}`}
        style={{
          width: rightSideNavExpanded ? rightSidebarWidth : 0,
          flex: rightSideNavExpanded ? `0 0 ${rightSidebarWidth}px` : undefined,
          transition: isResizingRight ? 'none' : 'width 0.2s, flex 0.2s',
        }}
      >
        <ChatSidebar
          agents={agents}
          agentId={chatAgentId}
          setAgentId={setChatAgentId}
          messages={messages}
          isStreaming={isStreaming}
          ocStatus={ocStatus}
          gatewayRunning={gatewayRunning}
          gatewayLoading={gatewayLoading}
          onToggleGateway={toggleGateway}
          onSend={sendMessage}
          onAbort={abortRun}
        />
      </div>
    </Theme>
  );
}
