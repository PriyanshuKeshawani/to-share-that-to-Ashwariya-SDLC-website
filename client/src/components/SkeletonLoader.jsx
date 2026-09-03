import React from 'react';

export const SkeletonBox = ({ width = '100%', height = '20px', borderRadius = '8px', style = {} }) => (
  <div
    className="skeleton-box"
    style={{
      width,
      height,
      borderRadius,
      ...style
    }}
  />
);

export const SkeletonStatCard = () => (
  <div className="glass-panel stat-card" style={{ padding: '20px', display: 'flex', gap: '16px', alignItems: 'center' }}>
    <SkeletonBox width="48px" height="48px" borderRadius="12px" />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <SkeletonBox width="55%" height="12px" />
      <SkeletonBox width="35%" height="26px" />
    </div>
  </div>
);

export const SkeletonTable = ({ rows = 5, cols = 4 }) => (
  <div className="glass-panel" style={{ padding: '20px', overflow: 'hidden' }}>
    <div style={{ display: 'flex', gap: '14px', marginBottom: '20px' }}>
      {Array.from({ length: cols }).map((_, i) => (
        <SkeletonBox key={i} width={`${100 / cols}%`} height="14px" borderRadius="4px" />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} style={{ 
        display: 'flex', 
        gap: '14px', 
        padding: '14px 0', 
        borderTop: r === 0 ? '1px solid var(--border-glass)' : 'none',
        borderBottom: '1px solid var(--border-glass)'
      }}>
        {Array.from({ length: cols }).map((_, c) => (
          <SkeletonBox key={c} width={`${100 / cols}%`} height="18px" />
        ))}
      </div>
    ))}
  </div>
);

export const SkeletonCard = () => (
  <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
    <SkeletonBox width="100%" height="140px" borderRadius="12px" />
    <SkeletonBox width="65%" height="20px" />
    <SkeletonBox width="40%" height="14px" />
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
      <SkeletonBox width="28%" height="30px" borderRadius="8px" />
      <SkeletonBox width="28%" height="30px" borderRadius="8px" />
    </div>
  </div>
);

export default {
  SkeletonBox,
  SkeletonStatCard,
  SkeletonTable,
  SkeletonCard
};
