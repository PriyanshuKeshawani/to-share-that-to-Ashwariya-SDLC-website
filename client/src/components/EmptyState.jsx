import { BookOpen } from 'lucide-react';

const EmptyState = ({
  icon: Icon = BookOpen,
  title = 'No items found',
  description = 'There are no records to display at this time.',
  actionLabel,
  onAction
}) => {
  return (
    <div className="empty-state-box animate-fade-in">
      <div className="empty-state-icon animate-float" style={{ boxShadow: '0 8px 24px var(--primary-glow)' }}>
        <Icon size={28} strokeWidth={1.8} />
      </div>
      <h4 style={{ 
        fontSize: '1.05rem', 
        fontWeight: 700, 
        color: 'var(--text-primary)', 
        marginBottom: '6px',
        letterSpacing: '-0.01em'
      }}>
        {title}
      </h4>
      <p style={{ 
        fontSize: '0.88rem', 
        color: 'var(--text-secondary)', 
        maxWidth: '400px', 
        marginBottom: actionLabel ? '18px' : '0',
        lineHeight: 1.6
      }}>
        {description}
      </p>
      {actionLabel && onAction && (
        <button 
          onClick={onAction} 
          className="btn btn-primary btn-shine" 
          style={{ 
            padding: '10px 20px', 
            fontSize: '0.84rem',
            borderRadius: '10px'
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
