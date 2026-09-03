import React from 'react';
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
      <div className="empty-state-icon">
        <Icon size={24} />
      </div>
      <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
        {title}
      </h4>
      <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', maxWidth: '380px', marginBottom: actionLabel ? '14px' : '0' }}>
        {description}
      </p>
      {actionLabel && onAction && (
        <button onClick={onAction} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.82rem' }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
