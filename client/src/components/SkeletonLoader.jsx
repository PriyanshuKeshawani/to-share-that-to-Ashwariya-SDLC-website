import React from 'react';

export const SkeletonBox = ({ width = '100%', height = '20px', borderRadius = '6px', style = {} }) => (
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
  <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', gap: '14px', alignItems: 'center' }}>
    <SkeletonBox width="44px" height="44px" borderRadius="10px" />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <SkeletonBox width="60%" height="14px" />
      <SkeletonBox width="40%" height="24px" />
    </div>
  </div>
);

export const SkeletonTable = ({ rows = 5, cols = 4 }) => (
  <div className="glass-panel" style={{ padding: '16px', overflow: 'hidden' }}>
    <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
      {Array.from({ length: cols }).map((_, i) => (
        <SkeletonBox key={i} width={`${100 / cols}%`} height="16px" />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} style={{ display: 'flex', gap: '12px', padding: '10px 0', borderTop: '1px solid var(--border-glass)' }}>
        {Array.from({ length: cols }).map((_, c) => (
          <SkeletonBox key={c} width={`${100 / cols}%`} height="20px" />
        ))}
      </div>
    ))}
  </div>
);

export const SkeletonCard = () => (
  <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
    <SkeletonBox width="100%" height="120px" borderRadius="8px" />
    <SkeletonBox width="70%" height="18px" />
    <SkeletonBox width="50%" height="14px" />
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
      <SkeletonBox width="30%" height="26px" borderRadius="6px" />
      <SkeletonBox width="30%" height="26px" borderRadius="6px" />
    </div>
  </div>
);

export default {
  SkeletonBox,
  SkeletonStatCard,
  SkeletonTable,
  SkeletonCard
};
