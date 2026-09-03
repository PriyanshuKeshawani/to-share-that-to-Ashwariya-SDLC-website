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
              <Icon size={21} strokeWidth={isActive ? 2.2 : 1.8} />
              {item.badge > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-5px',
                  right: '-9px',
                  background: 'linear-gradient(135deg, var(--primary), #1d4ed8)',
                  color: '#ffffff',
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(59, 130, 246, 0.4)'
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
