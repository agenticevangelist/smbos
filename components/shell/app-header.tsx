'use client';

import { Search, Notification, UserAvatar, Chat, Menu, Asleep, Light } from '@carbon/icons-react';

interface AppHeaderProps {
  theme: 'white' | 'g100';
  onToggleLeftSidebar: () => void;
  onToggleRightSidebar: () => void;
  onToggleTheme: () => void;
}

export function AppHeader({ theme, onToggleLeftSidebar, onToggleRightSidebar, onToggleTheme }: AppHeaderProps) {
  return (
    <div className="app-header">
      <div className="app-header__left">
        <button className="app-header__btn" onClick={onToggleLeftSidebar} title="Toggle sidebar">
          <Menu size={18} />
        </button>
        <span className="app-header__title">SMBOS</span>
      </div>
      <div className="app-header__right">
        <button className="app-header__btn" title="Search"><Search size={18} /></button>
        <button className="app-header__btn" title="Notifications"><Notification size={18} /></button>
        <button className="app-header__btn" onClick={onToggleTheme} title="Toggle theme">
          {theme === 'white' ? <Asleep size={18} /> : <Light size={18} />}
        </button>
        <button className="app-header__btn" onClick={onToggleRightSidebar} title="Toggle chat">
          <Chat size={18} />
        </button>
        <button className="app-header__btn" title="Profile"><UserAvatar size={18} /></button>
      </div>
    </div>
  );
}
