import React from 'react';

const STATUS_MAP = {
  // Circulation
  issued: { label: 'Issued', className: 'badge-primary' },
  returned: { label: 'Returned', className: 'badge-success' },
  overdue: { label: 'Overdue', className: 'badge-danger' },
  available: { label: 'Available', className: 'badge-success' },
  borrowed: { label: 'Borrowed', className: 'badge-warning' },
  maintenance: { label: 'Maintenance', className: 'badge-danger' },
  
  // Approvals & Permissions
  pending: { label: 'Pending', className: 'badge-warning' },
  approved: { label: 'Approved', className: 'badge-success' },
  rejected: { label: 'Rejected', className: 'badge-danger' },
  
  // Book Priority
  main: { label: 'Main Syllabus', className: 'badge-gold' },
  sub: { label: 'Reference', className: 'badge-secondary' },

  // User State
  blocked: { label: 'Blocked', className: 'badge-danger' },
  active: { label: 'Active', className: 'badge-success' },
};

const StatusBadge = ({ status, customLabel }) => {
  const normStatus = (status || '').toLowerCase();
  const config = STATUS_MAP[normStatus] || { label: status || 'Unknown', className: 'badge-secondary' };

  return (
    <span className={`badge ${config.className}`}>
      <span style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        backgroundColor: 'currentColor',
        display: 'inline-block'
      }} />
      {customLabel || config.label}
    </span>
  );
};

export default StatusBadge;
