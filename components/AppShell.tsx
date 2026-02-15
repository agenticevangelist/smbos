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
  TextArea,
  Button,
  InlineLoading,
  HeaderMenuButton,
  ContainedList,
  ContainedListItem,
} from '@carbon/react';
import { Search, Notification, UserAvatar, Chat, Send, Asleep, Light, Group, Events, Activity, Home, Menu } from '@carbon/icons-react';
import { DynamicSkillUI } from './DynamicSkillUI';
import { Agents } from './Agents';
import { ScheduledTasks } from './ScheduledTasks';
import { Dashboard } from './Dashboard';
import './AppShell.scss';

export function AppShell() {
  const [activePage, setActivePage] = useState('dashboard');
  const [skills, setSkills] = useState<Array<{ id: string, name: string, icon: string }>>([]);
  const [theme, setTheme] = useState<'white' | 'g100'>('white');
  const [rightSideNavExpanded, setRightSideNavExpanded] = useState(true);
  const [leftSideNavExpanded, setLeftSideNavExpanded] = useState(true);
  
  // Resizable sidebars
  const [rightSidebarWidth, setRightSidebarWidth] = useState(320);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(280);
  const [isResizingLeft, setIsResizingLeft] = useState(false);

  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const response = await fetch('/api/skills');
        const data = await response.json();
        setSkills(data);
      } catch (e) {
        console.error('Failed to fetch skills');
      }
    };
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

  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant', content: string, timestamp: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setChatMessages(prev => [...prev, { role: 'user', content: chatInput, timestamp }]);
    setChatInput('');
    setIsAiThinking(true);

    setTimeout(() => {
      const aiTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I have analyzed your request. I can help you automate this task using the tools available.',
        timestamp: aiTimestamp
      }]);
      setIsAiThinking(false);
    }, 1000);
  };

  return (
    <Theme theme={theme} className="app-shell">

      {/* Left Sidebar */}
      <div
        className={`left-sidebar ${leftSideNavExpanded ? 'expanded' : 'collapsed'}`}
        style={{
          width: leftSideNavExpanded ? leftSidebarWidth : 0,
          flex: leftSideNavExpanded ? `0 0 ${leftSidebarWidth}px` : undefined,
          transition: isResizingLeft ? 'none' : 'width 0.2s, flex 0.2s'
        }}
      >
        <div className="panel-container">
          <div className="panel-header">
            <h3>Explorer</h3>
          </div>
          <div className="sidebar-content">
            <ContainedList label="General" kind="on-page">
              <ContainedListItem
                onClick={() => setActivePage('dashboard')}
                className={activePage === 'dashboard' ? 'active-item' : ''}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Home size={16} />
                  Dashboard
                </div>
              </ContainedListItem>
            </ContainedList>

            <ContainedList label="Skills" kind="on-page">
              {skills.map((skill) => (
                <ContainedListItem
                  key={skill.id}
                  onClick={() => setActivePage(skill.id)}
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
                onClick={() => setActivePage('agents')}
                className={activePage === 'agents' ? 'active-item' : ''}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Group size={16} />
                  Manage Agents
                </div>
              </ContainedListItem>
              <ContainedListItem
                onClick={() => setActivePage('tasks')}
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
              SMBOS v1.0.0
            </div>
          </div>
        </div>
      </div>

      {/* Left Resizer */}
      {leftSideNavExpanded && (
        <div
          className={`resizer ${isResizingLeft ? 'resizing' : ''}`}
          onMouseDown={startResizingLeft}
        />
      )}

      {/* Main Area (Header + Content) */}
      <div className="main-area">
        <Header aria-label="SMBOS">
          <SkipToContent />
          <HeaderName href="#" prefix="Smart">
            SMBOS
          </HeaderName>
          <HeaderGlobalBar>
            <HeaderGlobalAction
              aria-label={leftSideNavExpanded ? 'Close navigation' : 'Open navigation'}
              onClick={() => setLeftSideNavExpanded(!leftSideNavExpanded)}
              isActive={leftSideNavExpanded}
            >
              <Menu size={20} />
            </HeaderGlobalAction>
            <HeaderGlobalAction aria-label="Search">
              <Search size={20} />
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
              <Dashboard onNavigate={setActivePage} />
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
      {rightSideNavExpanded && (
        <div
          className={`resizer ${isResizingRight ? 'resizing' : ''}`}
          onMouseDown={startResizingRight}
        />
      )}

      {/* Right Sidebar - Chat */}
      <div
        className={`right-sidebar ${rightSideNavExpanded ? 'expanded' : 'collapsed'}`}
        style={{
          width: rightSideNavExpanded ? rightSidebarWidth : 0,
          flex: rightSideNavExpanded ? `0 0 ${rightSidebarWidth}px` : undefined,
          transition: isResizingRight ? 'none' : 'width 0.2s, flex 0.2s'
        }}
      >
        <div className="panel-container">
          <div className="panel-header">
            <h3>SMBOS Agent</h3>
          </div>

          <div className="sidebar-content">
            <div className="chat-messages">
              {chatMessages.length === 0 && !isAiThinking ? (
                <div className="chat-empty">
                  <Chat size={48} />
                  <p>How can I help you today?</p>
                </div>
              ) : (
                <>
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`chat-message ${msg.role}`}>
                      <div className="message-content">{msg.content}</div>
                      <div className="message-meta">
                        <span className="message-time">{msg.timestamp}</span>
                      </div>
                    </div>
                  ))}
                  {isAiThinking && (
                    <div className="loading-indicator">
                      <InlineLoading description="Analyzing context..." />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="sidebar-footer">
            <div className="chat-input-area">
              <div className="left-input-container">
                <TextArea
                  id="chat-input"
                  labelText=""
                  placeholder="Ask SMBOS Agent..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  rows={1}
                />
              </div>
              <div className="right-button-container">
                <Button
                  renderIcon={Send}
                  iconDescription="Send"
                  hasIconOnly
                  size='md'
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim()}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Theme>
  );
}
