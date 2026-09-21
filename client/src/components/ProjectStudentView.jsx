"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Rocket, Search, X, ThumbsUp, ThumbsDown, ExternalLink, 
  Github, Globe, Users, Plus, Sparkles, Building2, Calendar, 
  Layers, Filter
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import ProjectDetailsModal from './ProjectDetailsModal';
import ProjectFormModal, { PROJECT_TYPES } from './ProjectFormModal';
import EmptyState from './EmptyState';

export default function ProjectStudentView({
  branches = []
}) {
  const { apiCall, user } = useAuth();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedBatch, setSelectedBatch] = useState('all');

  const [viewingProject, setViewingProject] = useState(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const fetchProjects = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const data = await apiCall('/projects');
      setProjects(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const fetchProjectsRef = useRef(fetchProjects);
  useEffect(() => {
    fetchProjectsRef.current = fetchProjects;
  }, [fetchProjects]);

  // Realtime updates: single stable subscription on mount
  useEffect(() => {
    let channel = null;
    try {
      channel = supabase
        .channel('student-projects-sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'projects' },
          () => {
            fetchProjectsRef.current?.(true);
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('Realtime projects sync note:', e.message);
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // Handle Like / Dislike reaction
  const handleVote = async (projectId, reactionType) => {
    try {
      // Optimistic update
      setProjects(prev => prev.map(p => {
        if (p.id !== projectId) return p;
        let likes = typeof p.likes_count === 'number' ? p.likes_count : 0;
        let dislikes = typeof p.dislikes_count === 'number' ? p.dislikes_count : 0;
        let prevVote = p.user_reaction;
        let nextVote = reactionType;

        if (prevVote === reactionType) {
          // Toggle off
          nextVote = null;
          if (reactionType === 'like') likes = Math.max(0, likes - 1);
          else dislikes = Math.max(0, dislikes - 1);
        } else {
          // Switch or new
          if (reactionType === 'like') {
            likes = likes + 1;
            if (prevVote === 'dislike') dislikes = Math.max(0, dislikes - 1);
          } else {
            dislikes = dislikes + 1;
            if (prevVote === 'like') likes = Math.max(0, likes - 1);
          }
        }

        return { ...p, likes_count: likes, dislikes_count: dislikes, user_reaction: nextVote };
      }));

      const res = await apiCall(`/projects/${projectId}/vote`, {
        method: 'POST',
        body: JSON.stringify({
          reaction: reactionType,
          user_email: user?.email
        })
      });

      if (res && res.success) {
        // Sync project state with server response
        setProjects(prev => prev.map(p => {
          if (p.id !== projectId) return p;
          return {
            ...p,
            likes_count: res.likes_count,
            dislikes_count: res.dislikes_count,
            user_reaction: res.user_reaction
          };
        }));
        return res;
      }
    } catch (err) {
      console.error('Failed to register vote:', err);
      // Rollback
      fetchProjects(true);
    }
  };

  // Handle student project submission
  const handleStudentSubmit = async (payload) => {
    try {
      await apiCall('/projects', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setFeedback({ type: 'success', message: 'Project submitted successfully! It will be reviewed by admin.' });
      fetchProjects(true);
    } catch (err) {
      console.error('Submission failed:', err);
      throw err;
    }
  };

  // Unique options for filters
  const availableBatches = useMemo(() => {
    const set = new Set();
    projects.forEach(p => {
      if (p.batch && p.batch.trim()) set.add(p.batch.trim());
      if (Array.isArray(p.team_members)) {
        p.team_members.forEach(m => {
          if (m.passout_year && m.passout_year.trim()) set.add(m.passout_year.trim());
        });
      }
    });
    return Array.from(set).sort().reverse();
  }, [projects]);

  const availableBranches = useMemo(() => {
    const map = new Map();
    branches.forEach(b => {
      const name = b.name || b.code || b;
      if (name) map.set(name, name);
    });
    projects.forEach(p => {
      if (p.branch_name && p.branch_name.trim()) map.set(p.branch_name.trim(), p.branch_name.trim());
      if (Array.isArray(p.team_members)) {
        p.team_members.forEach(m => {
          if (m.branch && m.branch.trim()) map.set(m.branch.trim(), m.branch.trim());
        });
      }
    });
    return Array.from(map.values()).sort();
  }, [branches, projects]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      // Search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const titleMatch = (p.title || '').toLowerCase().includes(q);
        const descMatch = (p.short_description || p.description || '').toLowerCase().includes(q);
        const typeMatch = (p.project_type || '').toLowerCase().includes(q);
        const branchMatch = (p.branch_name || '').toLowerCase().includes(q);
        const batchMatch = (p.batch || '').toLowerCase().includes(q);

        const memberMatch = Array.isArray(p.team_members) && p.team_members.some(m => 
          (m.name || '').toLowerCase().includes(q) ||
          (m.branch || '').toLowerCase().includes(q) ||
          (m.passout_year || '').toLowerCase().includes(q)
        );

        if (!titleMatch && !descMatch && !typeMatch && !branchMatch && !batchMatch && !memberMatch) {
          return false;
        }
      }

      // Type filter
      if (selectedType !== 'all') {
        if ((p.project_type || '').toLowerCase() !== selectedType.toLowerCase()) {
          return false;
        }
      }

      // Branch filter
      if (selectedBranch !== 'all') {
        const matchesBranch = (p.branch_name || '').toLowerCase() === selectedBranch.toLowerCase();
        const memberMatchesBranch = Array.isArray(p.team_members) && p.team_members.some(m =>
          (m.branch || '').toLowerCase() === selectedBranch.toLowerCase()
        );
        if (!matchesBranch && !memberMatchesBranch) return false;
      }

      // Batch filter
      if (selectedBatch !== 'all') {
        const matchesBatch = (p.batch || '').toLowerCase() === selectedBatch.toLowerCase();
        const memberMatchesBatch = Array.isArray(p.team_members) && p.team_members.some(m =>
          (m.passout_year || '').toLowerCase() === selectedBatch.toLowerCase()
        );
        if (!matchesBatch && !memberMatchesBatch) return false;
      }

      return true;
    });
  }, [projects, searchTerm, selectedType, selectedBranch, selectedBatch]);

  const hasActiveFilters = searchTerm || selectedType !== 'all' || selectedBranch !== 'all' || selectedBatch !== 'all';

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedType('all');
    setSelectedBranch('all');
    setSelectedBatch('all');
  };

  const getCategoryColor = (type = '') => {
    const t = type.toLowerCase();
    if (t.includes('major')) return { bg: 'rgba(99, 102, 241, 0.15)', text: '#818cf8', border: 'rgba(99, 102, 241, 0.3)' };
    if (t.includes('minor')) return { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc', border: 'rgba(168, 85, 247, 0.3)' };
    if (t.includes('hackathon')) return { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)' };
    if (t.includes('research')) return { bg: 'rgba(6, 182, 212, 0.15)', text: '#22d3ee', border: 'rgba(6, 182, 212, 0.3)' };
    if (t.includes('open source')) return { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', border: 'rgba(16, 185, 129, 0.3)' };
    if (t.includes('internship')) return { bg: 'rgba(236, 72, 153, 0.15)', text: '#f472b6', border: 'rgba(236, 72, 153, 0.3)' };
    return { bg: 'rgba(255, 255, 255, 0.1)', text: 'var(--text-primary)', border: 'rgba(255, 255, 255, 0.15)' };
  };

  return (
    <div style={{ paddingBottom: '40px' }}>
      {/* Hero Showcase Header */}
      <div 
        className="glass-panel"
        style={{
          borderRadius: '24px',
          padding: '32px',
          marginBottom: '24px',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(168, 85, 247, 0.1) 50%, rgba(6, 182, 212, 0.08) 100%)',
          border: '1px solid var(--border-glass, rgba(255, 255, 255, 0.1))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '20px'
        }}
      >
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#818cf8', padding: '4px 12px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600, marginBottom: '10px' }}>
            <Sparkles size={13} />
            <span>SISTEC Innovation & Project Directory</span>
          </div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.25 }}>
            Projects Showcase
          </h1>
          <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', margin: '6px 0 0 0', maxWidth: '600px', lineHeight: 1.5 }}>
            Explore cutting-edge Major projects, Minor projects, hackathon innovations, and research papers built by students.
          </p>
        </div>

        <button
          onClick={() => setIsSubmitModalOpen(true)}
          className="btn btn-primary"
          style={{
            padding: '10px 22px',
            fontSize: '0.9rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderRadius: '12px'
          }}
        >
          <Plus size={18} />
          <span>Submit Project</span>
        </button>
      </div>

      {/* Notification Banner */}
      {feedback && (
        <div style={{
          padding: '12px 18px',
          borderRadius: '12px',
          background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          border: `1px solid ${feedback.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          color: feedback.type === 'success' ? '#34d399' : '#f87171',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.88rem'
        }}>
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Search & Category Filter Pills */}
      <div 
        className="glass-panel"
        style={{
          borderRadius: '20px',
          padding: '20px',
          marginBottom: '24px',
          border: '1px solid var(--border-glass)'
        }}
      >
        {/* Search Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '16px' }}>
          <div style={{ position: 'relative', gridColumn: 'span 2 / span 2' }}>
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
              placeholder="Search by project title, student name, tech, branch, or keywords..."
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
                title="Clear"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div>
            <select
              className="glass-input"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              style={{ width: '100%', height: '42px', fontSize: '0.86rem' }}
            >
              <option value="all">All Branches</option>
              {availableBranches.map(br => (
                <option key={br} value={br}>{br}</option>
              ))}
            </select>
          </div>

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

        {/* Category Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          <button
            onClick={() => setSelectedType('all')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.8rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              border: selectedType === 'all' ? '1px solid var(--primary, #6366f1)' : '1px solid var(--border-glass)',
              background: selectedType === 'all' ? 'var(--primary, #6366f1)' : 'rgba(255, 255, 255, 0.04)',
              color: selectedType === 'all' ? 'white' : 'var(--text-secondary)',
              transition: 'all 0.15s ease'
            }}
          >
            All Categories ({projects.length})
          </button>

          {PROJECT_TYPES.map(type => {
            const count = projects.filter(p => (p.project_type || '').toLowerCase() === type.toLowerCase()).length;
            if (count === 0 && selectedType !== type) return null;
            const isSelected = selectedType.toLowerCase() === type.toLowerCase();
            return (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  border: isSelected ? '1px solid var(--primary, #6366f1)' : '1px solid var(--border-glass)',
                  background: isSelected ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.03)',
                  color: isSelected ? 'var(--primary, #6366f1)' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease'
                }}
              >
                {type} {count > 0 && `(${count})`}
              </button>
            );
          })}
        </div>

        {hasActiveFilters && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-glass)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <span>Showing {filteredProjects.length} of {projects.length} projects</span>
            <button onClick={resetFilters} className="btn btn-secondary" style={{ padding: '2px 10px', fontSize: '0.75rem' }}>
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '20px'
        }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="glass-panel animate-pulse" style={{ height: '300px', borderRadius: '20px', padding: '16px' }}>
              <div style={{ height: '140px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', marginBottom: '14px' }} />
              <div style={{ height: '20px', width: '70%', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', marginBottom: '8px' }} />
              <div style={{ height: '14px', width: '90%', background: 'rgba(255,255,255,0.04)', borderRadius: '4px' }} />
            </div>
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          icon={Rocket}
          title={hasActiveFilters ? "No matching projects found" : "No projects published yet"}
          message={hasActiveFilters ? "Try adjusting your filters or search keywords." : "Student projects and major/minor innovations will appear here once added."}
          action={hasActiveFilters ? { label: "Clear Filters", onClick: resetFilters } : { label: "Submit First Project", onClick: () => setIsSubmitModalOpen(true) }}
        />
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
          gap: '22px'
        }}>
          {filteredProjects.map((project) => {
            const catStyle = getCategoryColor(project.project_type);
            const members = Array.isArray(project.team_members) ? project.team_members : [];
            const likes = typeof project.likes_count === 'number' ? project.likes_count : 0;
            const dislikes = typeof project.dislikes_count === 'number' ? project.dislikes_count : 0;

            return (
              <div
                key={project.id}
                className="glass-panel hover-card"
                style={{
                  borderRadius: '20px',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  border: '1px solid var(--border-glass)',
                  background: 'var(--bg-card, #121622)',
                  transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
                  cursor: 'pointer'
                }}
                onClick={() => setViewingProject(project)}
              >
                <div>
                  {/* Card Thumbnail Banner */}
                  <div style={{
                    position: 'relative',
                    width: '100%',
                    height: '160px',
                    background: project.image_url 
                      ? 'rgba(0,0,0,0.5)' 
                      : 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(168, 85, 247, 0.18) 50%, rgba(6, 182, 212, 0.12) 100%)',
                    overflow: 'hidden'
                  }}>
                    {project.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img 
                        src={project.image_url} 
                        alt={project.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        loading="lazy"
                      />
                    ) : (
                      <div style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'rgba(255,255,255,0.2)'
                      }}>
                        <Rocket size={40} />
                      </div>
                    )}

                    {/* Gradient Overlay */}
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(18,22,34,0.85) 100%)'
                    }} />

                    {/* Category Badge */}
                    <div style={{ position: 'absolute', top: '12px', left: '12px' }}>
                      <span style={{
                        background: catStyle.bg,
                        color: catStyle.text,
                        border: `1px solid ${catStyle.border}`,
                        padding: '3px 10px',
                        borderRadius: '20px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        backdropFilter: 'blur(8px)'
                      }}>
                        {project.project_type || 'Academic Project'}
                      </span>
                    </div>

                    {/* Branch/Batch Badge */}
                    <div style={{ position: 'absolute', bottom: '10px', left: '12px', display: 'flex', gap: '6px' }}>
                      {project.branch_name && (
                        <span style={{
                          background: 'rgba(0,0,0,0.6)',
                          color: 'var(--text-secondary)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.7rem'
                        }}>
                          {project.branch_name}
                        </span>
                      )}
                      {project.batch && (
                        <span style={{
                          background: 'rgba(0,0,0,0.6)',
                          color: 'var(--text-secondary)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.7rem'
                        }}>
                          Batch {project.batch}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div style={{ padding: '16px 18px 12px 18px' }}>
                    <h3 style={{
                      fontSize: '1.08rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      margin: '0 0 6px 0',
                      lineHeight: 1.35,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {project.title}
                    </h3>

                    <p style={{
                      fontSize: '0.84rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.5,
                      margin: '0 0 14px 0',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {project.short_description || project.description || 'No description provided.'}
                    </p>

                    {/* Team Members Avatar Stack */}
                    {members.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginLeft: '4px' }}>
                          {members.slice(0, 3).map((m, mi) => (
                            <div
                              key={mi}
                              style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.4), rgba(168, 85, 247, 0.4))',
                                border: '2px solid var(--bg-card, #121622)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                                marginLeft: mi > 0 ? '-8px' : 0
                              }}
                              title={`${m.name || 'Team member'} (${m.branch || ''})`}
                            >
                              {(m.name || 'S').charAt(0).toUpperCase()}
                            </div>
                          ))}
                        </div>

                        <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {members[0]?.name || 'Student'}
                          {members.length > 1 && ` +${members.length - 1} more`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer */}
                <div style={{
                  padding: '12px 18px',
                  borderTop: '1px solid var(--border-glass, rgba(255,255,255,0.06))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(255, 255, 255, 0.01)'
                }}>
                  {/* Reaction Buttons */}
                  <div 
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => handleVote(project.id, 'like')}
                      style={{
                        background: project.user_reaction === 'like' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.04)',
                        border: project.user_reaction === 'like' ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid var(--border-glass)',
                        color: project.user_reaction === 'like' ? 'var(--primary, #6366f1)' : 'var(--text-secondary)',
                        borderRadius: '8px',
                        padding: '4px 8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        transition: 'all 0.15s ease'
                      }}
                      title="Like"
                    >
                      <ThumbsUp size={13} />
                      <span>{likes}</span>
                    </button>

                    <button
                      onClick={() => handleVote(project.id, 'dislike')}
                      style={{
                        background: project.user_reaction === 'dislike' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.04)',
                        border: project.user_reaction === 'dislike' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border-glass)',
                        color: project.user_reaction === 'dislike' ? '#f87171' : 'var(--text-muted)',
                        borderRadius: '8px',
                        padding: '4px 8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        transition: 'all 0.15s ease'
                      }}
                      title="Dislike"
                    >
                      <ThumbsDown size={13} />
                      <span>{dislikes}</span>
                    </button>
                  </div>

                  {/* External Links Icon Badges */}
                  <div 
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {project.live_url && (
                      <a
                        href={project.live_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: 'var(--primary, #6366f1)',
                          background: 'rgba(99, 102, 241, 0.1)',
                          padding: '5px',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Open Live Demo"
                      >
                        <Globe size={15} />
                      </a>
                    )}

                    {project.github_url && (
                      <a
                        href={project.github_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: 'var(--text-secondary)',
                          background: 'rgba(255, 255, 255, 0.05)',
                          padding: '5px',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="View GitHub Repository"
                      >
                        <Github size={15} />
                      </a>
                    )}

                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginLeft: '2px' }}>
                      Details &rarr;
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Project Details Modal */}
      {viewingProject && (
        <ProjectDetailsModal
          project={viewingProject}
          onClose={() => setViewingProject(null)}
          onVote={handleVote}
        />
      )}

      {/* Submit Project Modal */}
      {isSubmitModalOpen && (
        <ProjectFormModal
          isOpen={isSubmitModalOpen}
          onClose={() => setIsSubmitModalOpen(false)}
          branches={branches}
          onSave={handleStudentSubmit}
        />
      )}
    </div>
  );
}
