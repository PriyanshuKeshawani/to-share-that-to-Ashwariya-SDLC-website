import React from 'react';
import { Home, BookOpen, Compass, Activity, Settings } from 'lucide-react';

const BottomNav = ({ activeTab, onSelectTab, onOpenMenu, badges = {} }) => {
  const navItems = [
    { id: 'all', label: 'Home', icon: Home },
    { id: 'home', label: 'My Branch', icon: BookOpen },
    { id: 'other', label: 'Other', icon: Compass },
    { id: 'history', label: 'Activity', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;

        return (
          <button
            key={item.id}
            onClick={(e) => {
              onSelectTab(item.id);
              const btn = e.currentTarget;
              btn.style.transform = 'scale(0.85)';
              setTimeout(() => { btn.style.transform = ''; }, 150);
            }}
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            type="button"
          >
            <div style={{ position: 'relative', display: 'inline-flex', transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
              <Icon size={21} strokeWidth={isActive ? 2.2 : 1.8} style={{ transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }} />
              {item.badge > 0 && (
                <span style={{
                  position: 'absolute', top: '-5px', right: '-9px',
                  background: 'linear-gradient(135deg, var(--primary), #1d4ed8)',
                  color: '#ffffff', fontSize: '0.6rem', fontWeight: 700,
                  width: '16px', height: '16px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(59, 130, 246, 0.4)',
                  animation: isActive ? 'pulseGlow 2s infinite' : 'none',
                  transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}>
                  {item.badge}
                </span>
              )}
            </div>
            <span style={{ transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)', transform: isActive ? 'scale(1.05)' : 'scale(1)' }}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
