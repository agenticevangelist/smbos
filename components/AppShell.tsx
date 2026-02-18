'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Theme,
  Header,
  HeaderName,
  HeaderGlobalBar,
  HeaderGlobalAction,
  Content,
  SkipToContent,
  ContainedList,
  ContainedListItem,
} from '@carbon/react';
import { Search, Notification, UserAvatar, Chat, Asleep, Light, Group, Events, Activity, Home, Menu, Settings, Close } from '@carbon/icons-react';
import { DynamicSkillUI } from './DynamicSkillUI';
import { Agents } from './Agents';
import { ScheduledTasks } from './ScheduledTasks';
import { Dashboard } from './Dashboard';
import { SkillsManagement } from './SkillsManagement';
import { AgentChat } from './AgentChat';
import './AppShell.scss';
import packageJson from '../package.json';

export function AppShell() {
  const [activePage, setActivePage] = useState('dashboard');
  const [skills, setSkills] = useState<Array<{ id: string, name: string, description: string, icon: string, hidden: boolean }>>([]);
  const [theme, setTheme] = useState<'white' | 'g100'>('white');
  const [rightSideNavExpanded, setRightSideNavExpanded] = useState(true);
  const [leftSideNavExpanded, setLeftSideNavExpanded] = useState(true);
  
  // Resizable sidebars
  const [rightSidebarWidth, setRightSidebarWidth] = useState(320);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(280);
  const [isResizingLeft, setIsResizingLeft] = useState(false);

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
  useEffect(() => {
    localStorage.setItem('smbos_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('smbos_active_page', activePage);
  }, [activePage]);

  useEffect(() => {
    localStorage.setItem('smbos_left_sidebar_width', leftSidebarWidth.toString());
  }, [leftSidebarWidth]);

  useEffect(() => {
    localStorage.setItem('smbos_right_sidebar_width', rightSidebarWidth.toString());
  }, [rightSidebarWidth]);

  useEffect(() => {
    localStorage.setItem('smbos_left_sidebar_expanded', leftSideNavExpanded.toString());
  }, [leftSideNavExpanded]);

  useEffect(() => {
    localStorage.setItem('smbos_right_sidebar_expanded', rightSideNavExpanded.toString());
  }, [rightSideNavExpanded]);

  const fetchSkills = async () => {
    try {
      const response = await fetch('/api/skills');
      const data = await response.json();
      setSkills(data);
    } catch (e) {
      console.error('Failed to fetch skills');
    }
  };

  useEffect(() => {
    fetchSkills();
  }, []);

  const startResizingRight = useCallback(() => {
    setIsResizingRight(true);
  }, []);

  const startResizingLeft = useCallback(() => {
    setIsResizingLeft(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingRight) {
        const newWidth = Math.max(250, Math.min(600, window.innerWidth - e.clientX));
        setRightSidebarWidth(newWidth);
      }
      if (isResizingLeft) {
        const newWidth = Math.max(200, Math.min(400, e.clientX));
        setLeftSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizingRight(false);
      setIsResizingLeft(false);
    };

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

  const [isMobile, setIsMobile] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setLeftSideNavExpanded(false);
        setRightSideNavExpanded(false);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleNavigation = (page: string) => {
    setActivePage(page);
    if (isMobile) {
      setIsMobileMenuOpen(false);
      setLeftSideNavExpanded(false);
    }
  };

  return (
    <Theme theme={theme} className="app-shell">

      {/* Mobile overlay backdrop */}
      {isMobile && (isMobileMenuOpen || rightSideNavExpanded) && (
        <div
          className="mobile-overlay"
          onClick={() => {
            setIsMobileMenuOpen(false);
            setRightSideNavExpanded(false);
          }}
        />
      )}

      {/* Left Sidebar */}
      <div
        className={`left-sidebar ${isMobile ? (isMobileMenuOpen ? 'expanded mobile-drawer' : 'collapsed') : (leftSideNavExpanded ? 'expanded' : 'collapsed')}`}
        style={isMobile ? undefined : {
          width: leftSideNavExpanded ? leftSidebarWidth : 0,
          flex: leftSideNavExpanded ? `0 0 ${leftSidebarWidth}px` : undefined,
          transition: isResizingLeft ? 'none' : 'width 0.2s, flex 0.2s'
        }}
      >
        <div className="panel-container">
          <div className="panel-header">
            <h3>Explorer</h3>
            {isMobile && (
              <button className="mobile-close-btn" onClick={() => setIsMobileMenuOpen(false)}>
                <Close size={20} />
              </button>
            )}
          </div>
          <div className="sidebar-content">
            <ContainedList label="General" kind="on-page">
              <ContainedListItem
                onClick={() => handleNavigation('dashboard')}
                className={activePage === 'dashboard' ? 'active-item' : ''}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Home size={16} />
                  Dashboard
                </div>
              </ContainedListItem>
            </ContainedList>

            <ContainedList label="Skills" kind="on-page">
              {skills.filter(s => !s.hidden).map((skill) => (
                <ContainedListItem
                  key={skill.id}
                  onClick={() => handleNavigation(skill.id)}
                  className={activePage === skill.id ? 'active-item' : ''}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                     <Activity size={16} />
                     {skill.name}
                  </div>
                </ContainedListItem>
              ))}
            </ContainedList>

            <ContainedList label="Management" kind="on-page">
              <ContainedListItem
                onClick={() => handleNavigation('agents')}
                className={activePage === 'agents' ? 'active-item' : ''}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Group size={16} />
                  Agents
                </div>
              </ContainedListItem>
              <ContainedListItem
                onClick={() => handleNavigation('tasks')}
                className={activePage === 'tasks' ? 'active-item' : ''}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Events size={16} />
                  Scheduled Tasks
                </div>
              </ContainedListItem>
            </ContainedList>
          </div>
          <div className="sidebar-footer" style={{ padding: '0 1rem', alignItems: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)' }}>
              SMBOS v{packageJson.version}
            </div>
          </div>
        </div>
      </div>

      {/* Left Resizer */}
      {!isMobile && leftSideNavExpanded && (
        <div
          className={`resizer ${isResizingLeft ? 'resizing' : ''}`}
          onMouseDown={startResizingLeft}
        />
      )}

      {/* Main Area (Header + Content) */}
      <div className="main-area">
        <Header aria-label="SMBOS">
          <SkipToContent />
          <HeaderGlobalAction
            aria-label={isMobile ? (isMobileMenuOpen ? 'Close menu' : 'Open menu') : (leftSideNavExpanded ? 'Close navigation' : 'Open navigation')}
            onClick={() => {
              if (isMobile) {
                setIsMobileMenuOpen(!isMobileMenuOpen);
              } else {
                setLeftSideNavExpanded(!leftSideNavExpanded);
              }
            }}
            isActive={isMobile ? isMobileMenuOpen : leftSideNavExpanded}
            className="header-menu-btn"
          >
            <Menu size={20} />
          </HeaderGlobalAction>
          <HeaderName href="#" prefix="Smart" onClick={(e) => { e.preventDefault(); handleNavigation('dashboard'); }}>
            SMBOS
          </HeaderName>
          <HeaderGlobalBar>
            <HeaderGlobalAction aria-label="Search">
              <Search size={20} />
            </HeaderGlobalAction>
            <HeaderGlobalAction
              aria-label="Manage Skills"
              onClick={() => handleNavigation('skills-management')}
              isActive={activePage === 'skills-management'}
              tooltipAlignment="end"
            >
              <Settings size={20} />
            </HeaderGlobalAction>
            <HeaderGlobalAction aria-label="Notifications">
              <Notification size={20} />
            </HeaderGlobalAction>
            <HeaderGlobalAction
              aria-label="Toggle Theme"
              onClick={() => setTheme(theme === 'white' ? 'g100' : 'white')}
            >
              {theme === 'white' ? <Asleep size={20} /> : <Light size={20} />}
            </HeaderGlobalAction>
            <HeaderGlobalAction
              aria-label={rightSideNavExpanded ? 'Close chat' : 'Open chat'}
              onClick={() => setRightSideNavExpanded(!rightSideNavExpanded)}
              isActive={rightSideNavExpanded}
            >
              <Chat size={20} />
            </HeaderGlobalAction>
            <HeaderGlobalAction aria-label="User Profile">
              <UserAvatar size={20} />
            </HeaderGlobalAction>
          </HeaderGlobalBar>
        </Header>

        <Content id="main-content">
          {activePage === 'dashboard' ? (
              <Dashboard onNavigate={handleNavigation} />
          ) : activePage === 'skills-management' ? (
              <SkillsManagement onSkillsChanged={fetchSkills} />
          ) : activePage === 'agents' ? (
              <Agents />
          ) : activePage === 'tasks' ? (
              <ScheduledTasks />
          ) : (
              <DynamicSkillUI skillId={activePage} />
          )}
        </Content>
      </div>

      {/* Right Resizer */}
      {!isMobile && rightSideNavExpanded && (
        <div
          className={`resizer ${isResizingRight ? 'resizing' : ''}`}
          onMouseDown={startResizingRight}
        />
      )}

      {/* Right Sidebar - Chat */}
      <div
        className={`right-sidebar ${isMobile ? (rightSideNavExpanded ? 'expanded mobile-drawer mobile-drawer-right' : 'collapsed') : (rightSideNavExpanded ? 'expanded' : 'collapsed')}`}
        style={isMobile ? undefined : {
          width: rightSideNavExpanded ? rightSidebarWidth : 0,
          flex: rightSideNavExpanded ? `0 0 ${rightSidebarWidth}px` : undefined,
          transition: isResizingRight ? 'none' : 'width 0.2s, flex 0.2s'
        }}
      >
        <div className="panel-container">
          <div className="panel-header">
            <h3>SMBOS Agent</h3>
            {isMobile && (
              <button className="mobile-close-btn" onClick={() => setRightSideNavExpanded(false)}>
                <Close size={20} />
              </button>
            )}
          </div>

          <AgentChat />
        </div>
      </div>
    </Theme>
  );
}
