import { Home, BookOpen, BookMarked, Activity, Settings, Rocket } from 'lucide-react';

const BottomNav = ({ activeTab, onSelectTab, badges = {} }) => {
  const navItems = [
    { id: 'all', label: 'Catalog', icon: Home },
    { id: 'projects', label: 'Projects', icon: Rocket, badge: badges.projects },
    { id: 'home', label: 'Branch', icon: BookOpen },
    { id: 'requests', label: 'Requests', icon: BookMarked, badge: badges.requests },
    { id: 'history', label: 'Activity', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id || (item.id === 'projects' && (activeTab === 'projects' || activeTab === 'majors-minors'));
        const badgeCount = item.badge || badges[item.id] || 0;

        return (
          <button
            key={item.id}
            onClick={() => onSelectTab(item.id)}
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            type="button"
            style={{ WebkitTapHighlightColor: 'transparent', outline: 'none' }}
          >
            <div style={{ position: 'relative', display: 'inline-flex', transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
              <Icon size={21} strokeWidth={isActive ? 2.2 : 1.8} style={{ transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }} />
              {badgeCount > 0 && (
                <span style={{
                  position: 'absolute', top: '-5px', right: '-9px',
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  color: '#ffffff', fontSize: '0.62rem', fontWeight: 800,
                  minWidth: '16px', height: '16px', borderRadius: '8px',
                  padding: '0 4px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(239, 68, 68, 0.5)',
                  animation: isActive ? 'pulseGlow 2s infinite' : 'none',
                  transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}>
                  {badgeCount > 99 ? '99+' : badgeCount}
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
