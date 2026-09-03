import React from 'react';

const STATUS_MAP = {
  issued: { label: 'Issued', className: 'badge-primary' },
  returned: { label: 'Returned', className: 'badge-success' },
  overdue: { label: 'Overdue', className: 'badge-danger' },
  available: { label: 'Available', className: 'badge-success' },
  borrowed: { label: 'Borrowed', className: 'badge-warning' },
  maintenance: { label: 'Maintenance', className: 'badge-danger' },
  pending: { label: 'Pending', className: 'badge-warning' },
  approved: { label: 'Approved', className: 'badge-success' },
  rejected: { label: 'Rejected', className: 'badge-danger' },
  main: { label: 'Main Syllabus', className: 'badge-gold' },
  sub: { label: 'Reference', className: 'badge-secondary' },
  blocked: { label: 'Blocked', className: 'badge-danger' },
  active: { label: 'Active', className: 'badge-success' },
};

const STATUS_COLORS = {
  issued: '#60a5fa',
  returned: '#34d399',
  overdue: '#f87171',
  available: '#34d399',
  borrowed: '#fbbf24',
  maintenance: '#f87171',
  pending: '#fbbf24',
  approved: '#34d399',
  rejected: '#f87171',
  main: '#f59e0b',
  sub: '#22d3ee',
  blocked: '#f87171',
  active: '#34d399',
};

const StatusBadge = ({ status, customLabel }) => {
  const normStatus = (status || '').toLowerCase();
  const config = STATUS_MAP[normStatus] || { label: status || 'Unknown', className: 'badge-secondary' };
  const dotColor = STATUS_COLORS[normStatus] || 'var(--secondary)';

  return (
    <span className={`badge ${config.className}`}>
      <span style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        backgroundColor: dotColor,
        display: 'inline-block',
        boxShadow: `0 0 6px ${dotColor}40`
      }} />
      {customLabel || config.label}
    </span>
  );
};

export default StatusBadge;
