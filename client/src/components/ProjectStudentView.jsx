"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Rocket, Search, X, Heart, ExternalLink, 
  Github, Globe, Users, Plus, Sparkles, Building2, Calendar, 
  Layers, Filter
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import ProjectDetailsModal from './ProjectDetailsModal';
import EmptyState from './EmptyState';

export const PROJECT_TYPES = [
  'Major Project',
  'Minor Project',
  'Academic Project',
  'Research Project',
  'Internship Project',
  'Hackathon / Competition',
  'Faculty Project',
  'Industry Project',
  'Open Source / Innovation',
  'Other'
];

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
  const [feedback, setFeedback] = useState(null);

  const fetchProjects = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      // Ensure any legacy localStorage votes are purged so Supabase is 100% source of truth
      try {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('sistec_project_votes');
        }
      } catch (e) {}

      const data = await apiCall('/projects');
      const list = Array.isArray(data) ? data : [];
      setProjects(list);
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

  // Handle Instagram-style Heart Like toggle with instant optimistic UI and Supabase persistence
  const handleVote = async (projectId, reactionType = 'like') => {
    // 1. Unauthenticated users cannot like projects
    if (!user || !user.id) {
      setFeedback({
        type: 'info',
        message: 'Please sign in with your student account to like projects.'
      });
      return { success: false, unauthorized: true };
    }

    // 2. Snapshot current state for optimistic update and rollback
    const curr = projects.find(p => p.id === projectId);
    const prevLiked = Boolean(curr?.is_liked || curr?.user_reaction === 'like');
    const prevCount = typeof curr?.likes_count === 'number' ? curr.likes_count : 0;

    const optimisticLiked = !prevLiked;
    const optimisticCount = optimisticLiked ? prevCount + 1 : Math.max(0, prevCount - 1);

    // 3. Optimistic UI update
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        is_liked: optimisticLiked,
        user_reaction: optimisticLiked ? 'like' : null,
        likes_count: optimisticCount
      };
    }));

    setViewingProject(prev => {
      if (!prev || prev.id !== projectId) return prev;
      return {
        ...prev,
        is_liked: optimisticLiked,
        user_reaction: optimisticLiked ? 'like' : null,
        likes_count: optimisticCount
      };
    });

    // 4. Send authoritative request to Supabase
    try {
      const res = await apiCall(`/projects/${projectId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ reaction: 'like' })
      });

      const verifiedLiked = res?.is_liked ?? optimisticLiked;
      const verifiedCount = typeof res?.likes_count === 'number' ? res.likes_count : optimisticCount;

      setProjects(prev => prev.map(p => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          is_liked: verifiedLiked,
          user_reaction: verifiedLiked ? 'like' : null,
          likes_count: verifiedCount
        };
      }));

      setViewingProject(prev => {
        if (!prev || prev.id !== projectId) return prev;
        return {
          ...prev,
          is_liked: verifiedLiked,
          user_reaction: verifiedLiked ? 'like' : null,
          likes_count: verifiedCount
        };
      });

      return {
        success: true,
        is_liked: verifiedLiked,
        user_reaction: verifiedLiked ? 'like' : null,
        likes_count: verifiedCount
      };
    } catch (err) {
      console.warn('Like toggle error in Supabase:', err.message);

      // Rollback optimistic update
      setProjects(prev => prev.map(p => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          is_liked: prevLiked,
          user_reaction: prevLiked ? 'like' : null,
          likes_count: prevCount
        };
      }));

      setViewingProject(prev => {
        if (!prev || prev.id !== projectId) return prev;
        return {
          ...prev,
          is_liked: prevLiked,
          user_reaction: prevLiked ? 'like' : null,
          likes_count: prevCount
        };
      });

      setFeedback({
        type: 'error',
        message: err.message || 'Unable to update like. Please try again.'
      });

      return {
        success: false,
        is_liked: prevLiked,
        user_reaction: prevLiked ? 'like' : null,
        likes_count: prevCount
      };
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
    <div className="project-showcase-container">
      {/* Hero Showcase Header */}
      <div className="project-showcase-hero">
        <div>
          <div className="project-hero-badge">
            <Sparkles size={13} />
            <span>SISTEC Innovation & Project Directory</span>
          </div>
          <h1 className="project-hero-title">
            Projects Showcase
          </h1>
          <p className="project-hero-subtitle">
            Explore cutting-edge Major projects, Minor projects, hackathon innovations, and research papers built by students.
          </p>
        </div>
      </div>

      {/* Notification Banner */}
      {feedback && (
        <div style={{
          padding: '12px 18px',
          borderRadius: '12px',
          background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          border: `1px solid ${feedback.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          color: feedback.type === 'success' ? '#34d399' : '#f87171',
          marginBottom: '16px',
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
      <div className="project-filter-panel">
        {/* Search Row */}
        <div className="project-filter-grid">
          <div className="project-search-col">
            <Search 
              size={15} 
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                pointerEvents: 'none'
              }} 
            />
            <input
              type="text"
              className="project-search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by project title, student name, tech, branch, or keywords..."
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Clear"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div>
            <select
              className="project-select"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
            >
              <option value="all">All Branches</option>
              {availableBranches.map(br => (
                <option key={br} value={br}>{br}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              className="project-select"
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
            >
              <option value="all">All Batches / Years</option>
              {availableBatches.map(b => (
                <option key={b} value={b}>Batch {b}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Category Pills */}
        <div className="project-type-pills-scroll">
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
        <div className="project-card-grid">
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
          message={hasActiveFilters ? "Try adjusting your filters or search keywords." : "Student projects and major/minor innovations will appear here once added by library administration."}
          action={hasActiveFilters ? { label: "Clear Filters", onClick: resetFilters } : null}
        />
      ) : (
        <div className="project-card-grid">
          {filteredProjects.map((project) => {
            const catStyle = getCategoryColor(project.project_type);
            const members = Array.isArray(project.team_members) ? project.team_members : [];
            const likes = typeof project.likes_count === 'number' ? project.likes_count : 0;
            const dislikes = typeof project.dislikes_count === 'number' ? project.dislikes_count : 0;

            return (
              <div
                key={project.id}
                className="project-card"
                onClick={() => setViewingProject(project)}
              >
                <div>
                  {/* Card Thumbnail Banner */}
                  <div className="project-card-banner">
                    {project.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img 
                        src={project.image_url} 
                        alt={project.title}
                        className="project-card-img"
                        loading="lazy"
                      />
                    ) : (
                      <div style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'rgba(255,255,255,0.2)',
                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.18) 0%, rgba(168, 85, 247, 0.15) 50%, rgba(6, 182, 212, 0.1) 100%)'
                      }}>
                        <Rocket size={36} />
                      </div>
                    )}

                    {/* Gradient Overlay */}
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(18,22,34,0.85) 100%)',
                      pointerEvents: 'none'
                    }} />

                    {/* Category Badge */}
                    <div style={{ position: 'absolute', top: '10px', left: '10px' }}>
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
                    <div style={{ position: 'absolute', bottom: '8px', left: '10px', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      {project.branch_name && (
                        <span style={{
                          background: 'rgba(0,0,0,0.65)',
                          color: 'var(--text-secondary)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontSize: '0.68rem',
                          fontWeight: 500
                        }}>
                          {project.branch_name}
                        </span>
                      )}
                      {project.batch && (
                        <span style={{
                          background: 'rgba(0,0,0,0.65)',
                          color: 'var(--text-secondary)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontSize: '0.68rem',
                          fontWeight: 500
                        }}>
                          Batch {project.batch}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div style={{ padding: '14px 16px 10px 16px' }}>
                    <h3 className="project-card-title">
                      {project.title}
                    </h3>

                    <p className="project-card-desc">
                      {project.short_description || project.description || 'No description provided.'}
                    </p>

                    {/* Team Members Avatar Stack */}
                    {members.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginLeft: '2px' }}>
                          {members.slice(0, 3).map((m, mi) => (
                            <div
                              key={mi}
                              style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.4), rgba(168, 85, 247, 0.4))',
                                border: '2px solid var(--bg-card, #121622)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                                marginLeft: mi > 0 ? '-6px' : 0
                              }}
                              title={`${m.name || 'Team member'} (${m.branch || ''})`}
                            >
                              {(m.name || 'S').charAt(0).toUpperCase()}
                            </div>
                          ))}
                        </div>

                        <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                  {/* Instagram-Style Heart Like Button */}
                  <div 
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {(() => {
                      const isLiked = Boolean(project.is_liked || project.user_reaction === 'like');
                      return (
                        <button
                          onClick={() => handleVote(project.id, 'like')}
                          style={{
                            background: isLiked ? 'rgba(239, 68, 68, 0.16)' : 'rgba(255,255,255,0.04)',
                            border: isLiked ? '1px solid rgba(239, 68, 68, 0.45)' : '1px solid var(--border-glass)',
                            color: isLiked ? '#ef4444' : 'var(--text-secondary)',
                            borderRadius: '20px',
                            padding: '5px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                          }}
                          title={isLiked ? "Unlike" : "Like this project"}
                        >
                          <Heart 
                            size={15} 
                            fill={isLiked ? '#ef4444' : 'none'} 
                            color={isLiked ? '#ef4444' : 'currentColor'} 
                          />
                          <span>{likes}</span>
                        </button>
                      );
                    })()}
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

    </div>
  );
}
