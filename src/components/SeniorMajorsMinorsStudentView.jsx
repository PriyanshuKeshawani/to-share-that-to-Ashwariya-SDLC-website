"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  GraduationCap, Search, Sparkles, Layers, 
  UserCheck, X, Compass
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import EmptyState from './EmptyState';

export default function SeniorMajorsMinorsStudentView({
  branches = []
}) {
  const { apiCall } = useAuth();

  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedBatch, setSelectedBatch] = useState('all');

  const fetchProfiles = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);

      const data = await apiCall('/academic/majors-minors');
      // Normal students will only receive published profiles from AuthContext/RLS
      setProfiles(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load published senior profiles:', err);
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const fetchProfilesRef = useRef(fetchProfiles);
  useEffect(() => {
    fetchProfilesRef.current = fetchProfiles;
  }, [fetchProfiles]);

  // Realtime updates: subscribed once on mount with stable channel
  useEffect(() => {
    let channel = null;
    try {
      channel = supabase
        .channel('student-senior-profiles-sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'senior_academic_profiles' },
          () => {
            fetchProfilesRef.current?.(true);
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('Realtime student senior profiles subscribe note:', e.message);
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // Unique batches from records
  const availableBatches = useMemo(() => {
    const set = new Set();
    profiles.forEach(p => {
      if (p.batch && p.batch.trim()) set.add(p.batch.trim());
    });
    return Array.from(set).sort().reverse();
  }, [profiles]);

  // Unique branches from records and branches prop
  const availableBranches = useMemo(() => {
    const map = new Map();
    branches.forEach(b => {
      if (b && b.name) map.set(b.name, b.name);
    });
    profiles.forEach(p => {
      if (p.branch_name && p.branch_name.trim()) {
        map.set(p.branch_name.trim(), p.branch_name.trim());
      }
    });
    return Array.from(map.values()).sort();
  }, [branches, profiles]);

  // Filter and search
  const filteredProfiles = useMemo(() => {
    return profiles.filter(item => {
      if (selectedBranch !== 'all' && item.branch_name !== selectedBranch) {
        return false;
      }
      if (selectedBatch !== 'all' && item.batch !== selectedBatch) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const name = (item.full_name || '').toLowerCase();
        const roll = (item.roll_number || '').toLowerCase();
        const major = (item.major || '').toLowerCase();
        const minor = (item.minor || '').toLowerCase();
        const branch = (item.branch_name || '').toLowerCase();
        const batch = (item.batch || '').toLowerCase();
        const desc = (item.description || '').toLowerCase();

        return (
          name.includes(q) ||
          roll.includes(q) ||
          major.includes(q) ||
          minor.includes(q) ||
          branch.includes(q) ||
          batch.includes(q) ||
          desc.includes(q)
        );
      }
      return true;
    });
  }, [profiles, selectedBranch, selectedBatch, searchTerm]);

  return (
    <div className="animate-section-enter">
      {/* Header Banner */}
      <div className="glass-panel" style={{
        padding: '24px 28px',
        marginBottom: '24px',
        borderRadius: '16px',
        background: 'linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(14,165,233,0.04) 100%), var(--modal-card-bg, var(--bg-card))',
        border: '1px solid var(--border-glass)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          right: '-20px',
          top: '-20px',
          opacity: 0.05,
          pointerEvents: 'none'
        }}>
          <GraduationCap size={160} />
        </div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span className="badge badge-primary" style={{ padding: '4px 10px', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <Compass size={12} /> Academic Mentorship & Guidance
            </span>
            <span className="badge badge-secondary" style={{ padding: '4px 10px', fontSize: '0.74rem' }}>
              {profiles.length} Senior Mentors
            </span>
          </div>

          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px 0', letterSpacing: '-0.01em' }}>
            Senior Majors & Minors Directory
          </h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '720px', lineHeight: 1.55 }}>
            Discover the specializations chosen by seniors across different engineering, pharmacy, and management batches. Use this directory to evaluate course pathways, choose your minor subjects, and seek senior academic guidance.
          </p>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '24px', borderRadius: '14px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px',
          alignItems: 'center'
        }}>
          {/* Search Box */}
          <div style={{ position: 'relative', gridColumn: 'span 2 / span 2' }} className="majors-search-col">
            <Search 
              size={16} 
              style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                pointerEvents: 'none'
              }} 
            />
            <input
              type="text"
              className="glass-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by senior name, major, minor, or branch..."
              style={{ paddingLeft: '40px', paddingRight: searchTerm ? '38px' : '14px', width: '100%', height: '42px', fontSize: '0.88rem' }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Branch Filter */}
          <div>
            <select
              className="glass-input"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              style={{ width: '100%', height: '42px', fontSize: '0.86rem' }}
            >
              <option value="all">All Departments / Branches</option>
              {availableBranches.map(br => (
                <option key={br} value={br}>{br}</option>
              ))}
            </select>
          </div>

          {/* Batch Filter */}
          <div>
            <select
              className="glass-input"
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              style={{ width: '100%', height: '42px', fontSize: '0.86rem' }}
            >
              <option value="all">All Batches / Years</option>
              {availableBatches.map(b => (
                <option key={b} value={b}>Batch {b}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Filter Tag Bar */}
        {(searchTerm || selectedBranch !== 'all' || selectedBatch !== 'all') && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '12px',
            paddingTop: '10px',
            borderTop: '1px solid var(--border-glass)',
            fontSize: '0.82rem',
            color: 'var(--text-secondary)',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span>Active filters:</span>
              {searchTerm && <span className="badge badge-secondary">Keyword: "{searchTerm}"</span>}
              {selectedBranch !== 'all' && <span className="badge badge-primary">Branch: {selectedBranch}</span>}
              {selectedBatch !== 'all' && <span className="badge badge-gold">Batch: {selectedBatch}</span>}
            </div>

            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedBranch('all');
                setSelectedBatch('all');
              }}
              className="btn btn-secondary"
              style={{ padding: '3px 10px', fontSize: '0.76rem' }}
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Directory Grid */}
      {loading ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '20px'
        }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="glass-panel animate-pulse" style={{ height: '220px', borderRadius: '14px', padding: '20px' }}>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: '16px', width: '60%', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', marginBottom: '8px' }} />
                  <div style={{ height: '12px', width: '40%', background: 'rgba(255,255,255,0.04)', borderRadius: '4px' }} />
                </div>
              </div>
              <div style={{ height: '40px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', marginBottom: '12px' }} />
              <div style={{ height: '30px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }} />
            </div>
          ))}
        </div>
      ) : filteredProfiles.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title={profiles.length === 0 ? "No Senior Profiles Published Yet" : "No Matching Senior Profiles"}
          description={
            profiles.length === 0
              ? "The library administration is currently preparing senior major & minor guidance records. Please check back soon."
              : "No senior records matched your search filters. Try clearing your search keyword or selecting all branches."
          }
          actionLabel={searchTerm || selectedBranch !== 'all' || selectedBatch !== 'all' ? "Clear Filters" : null}
          onAction={() => {
            setSearchTerm('');
            setSelectedBranch('all');
            setSelectedBatch('all');
          }}
        />
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '20px',
          marginBottom: '28px'
        }}>
          {filteredProfiles.map((item, idx) => (
            <div
              key={item.id}
              className="glass-panel animate-stagger-in"
              style={{
                padding: '22px',
                borderRadius: '16px',
                border: '1px solid var(--border-glass)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.25s ease',
                background: 'var(--modal-card-bg, var(--bg-card))',
                position: 'relative',
                animationDelay: `${(idx % 6) * 0.05}s`
              }}
            >
              <div>
                {/* Header: Avatar, Name, Branch, Batch */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '16px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, rgba(37,99,235,0.2), rgba(14,165,233,0.15))',
                    border: '1px solid rgba(37,99,235,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#60a5fa',
                    fontWeight: 800,
                    fontSize: '1.05rem',
                    flexShrink: 0
                  }}>
                    {item.full_name ? item.full_name.charAt(0).toUpperCase() : 'S'}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 800,
                      fontSize: '1.02rem',
                      color: 'var(--text-primary)',
                      lineHeight: 1.25,
                      marginBottom: '4px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {item.full_name}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {item.branch_name || 'General Branch'}
                      </span>
                      {item.batch && (
                        <span className="badge badge-gold" style={{ padding: '1px 7px', fontSize: '0.68rem' }}>
                          Batch {item.batch}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Major & Minor Card Box */}
                <div style={{
                  padding: '14px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-glass)',
                  marginBottom: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  {/* MAJOR */}
                  <div>
                    <div style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      marginBottom: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Sparkles size={11} color="var(--primary)" /> MAJOR SPECIALIZATION
                    </div>
                    <div style={{
                      fontWeight: 700,
                      fontSize: '0.94rem',
                      color: '#60a5fa',
                      background: 'rgba(37, 99, 235, 0.1)',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(37, 99, 235, 0.25)',
                      display: 'inline-block',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}>
                      {item.major}
                    </div>
                  </div>

                  {/* MINOR */}
                  <div>
                    <div style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      marginBottom: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Layers size={11} color="#38bdf8" /> MINOR SPECIALIZATION
                    </div>
                    <div style={{
                      fontWeight: 700,
                      fontSize: '0.94rem',
                      color: '#38bdf8',
                      background: 'rgba(14, 165, 233, 0.1)',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(14, 165, 233, 0.25)',
                      display: 'inline-block',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}>
                      {item.minor}
                    </div>
                  </div>
                </div>

                {/* Description / Advice */}
                {item.description && (
                  <div style={{
                    fontSize: '0.82rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.04)',
                    marginBottom: '10px'
                  }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '2px', fontSize: '0.74rem' }}>
                      Senior's Guidance / Notes:
                    </span>
                    {item.description}
                  </div>
                )}
              </div>

              {/* Card Footer: Verified / Roll info */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '10px',
                borderTop: '1px solid var(--border-glass)',
                fontSize: '0.74rem',
                color: 'var(--text-muted)'
              }}>
                <div>
                  {item.roll_number ? (
                    <span>Roll: <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{item.roll_number}</strong></span>
                  ) : (
                    <span>SISTEC Senior Profile</span>
                  )}
                </div>

                {item.student_user_id && (
                  <span className="badge badge-success" style={{ padding: '2px 7px', fontSize: '0.68rem' }}>
                    <UserCheck size={10} /> Verified Student
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
