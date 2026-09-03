import React from 'react';
import { Home, BookOpen, BookMarked, Activity, Menu } from 'lucide-react';

const BottomNav = ({ activeTab, onSelectTab, onOpenMenu, badges = {} }) => {
  const navItems = [
    { id: 'all', label: 'Home', icon: Home },
    { id: 'catalog', label: 'Books', icon: BookOpen },
    { id: 'loans', label: 'My Books', icon: BookMarked, badge: badges.loans },
    { id: 'history', label: 'Activity', icon: Activity },
    { id: 'menu', label: 'More', icon: Menu, isAction: true },
  ];

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = !item.isAction && activeTab === item.id;

        return (
          <button
            key={item.id}
            onClick={() => (item.isAction ? onOpenMenu() : onSelectTab(item.id))}
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            type="button"
          >
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <Icon size={20} />
              {item.badge > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-8px',
                  background: 'var(--primary)',
                  color: '#ffffff',
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  width: '15px',
                  height: '15px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {item.badge}
                </span>
              )}
            </div>
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
