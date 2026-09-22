"use client";

import { useState, useEffect } from 'react';
import { 
  X, ExternalLink, Github, Globe, Heart, 
  Linkedin, Users, GraduationCap, Building2, Sparkles, FileText, Code, Award
} from 'lucide-react';

export default function ProjectDetailsModal({
  project,
  onClose,
  onVote = null
}) {
  if (!project) return null;

  const [currentLikes, setCurrentLikes] = useState(typeof project.likes_count === 'number' ? project.likes_count : 0);
  const [userReaction, setUserReaction] = useState((project.is_liked || project.user_reaction === 'like') ? 'like' : null);
  const [voting, setVoting] = useState(false);

  // Sync state whenever project prop updates
  useEffect(() => {
    setCurrentLikes(typeof project.likes_count === 'number' ? project.likes_count : 0);
    setUserReaction((project.is_liked || project.user_reaction === 'like') ? 'like' : null);
  }, [project.id, project.likes_count, project.is_liked, project.user_reaction]);

  // Lock background body scroll and bind Escape key
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const teamMembers = Array.isArray(project.team_members) && project.team_members.length > 0
    ? project.team_members
    : (project.branch_name || project.batch)
      ? [{ name: 'Project Lead / Team', branch: project.branch_name || '', passout_year: project.batch || '' }]
      : [];

  const skillsList = (() => {
    const s = project.required_skills;
    if (!s) return [];
    if (Array.isArray(s)) return s.map(x => String(x).trim()).filter(Boolean);
    if (typeof s === 'string') {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed.map(x => String(x).trim()).filter(Boolean);
      } catch {}
      return s.split(/[,;\n]/).map(x => x.trim()).filter(Boolean);
    }
    return [];
  })();

  const handleReactionClick = async () => {
    if (voting) return;
    setVoting(true);

    const isCurrentlyLiked = userReaction === 'like';
    const nextReaction = isCurrentlyLiked ? null : 'like';
    const nextLikes = isCurrentlyLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1;

    // 1. Optimistic UI update
    setUserReaction(nextReaction);
    setCurrentLikes(nextLikes);

    // 2. Call parent onVote (which communicates with Supabase)
    try {
      if (onVote) {
        const res = await onVote(project.id, 'like');
        if (res && res.success) {
          if (res.user_reaction !== undefined) setUserReaction(res.user_reaction);
          if (typeof res.likes_count === 'number') setCurrentLikes(res.likes_count);
        } else {
          // Rollback if onVote indicated failure or unauthenticated
          setUserReaction(isCurrentlyLiked ? 'like' : null);
          setCurrentLikes(currentLikes);
        }
      }
    } catch (err) {
      console.warn('Modal reaction error:', err);
      // Rollback on network failure
      setUserReaction(isCurrentlyLiked ? 'like' : null);
      setCurrentLikes(currentLikes);
    } finally {
      setVoting(false);
    }
  };

  const getCategoryColor = (type = '') => {
    const t = type.toLowerCase();
    if (t.includes('major')) return { bg: 'rgba(99, 102, 241, 0.16)', text: '#818cf8', border: 'rgba(99, 102, 241, 0.35)' };
    if (t.includes('minor')) return { bg: 'rgba(168, 85, 247, 0.16)', text: '#c084fc', border: 'rgba(168, 85, 247, 0.35)' };
    if (t.includes('hackathon')) return { bg: 'rgba(245, 158, 11, 0.16)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.35)' };
    if (t.includes('research')) return { bg: 'rgba(6, 182, 212, 0.16)', text: '#22d3ee', border: 'rgba(6, 182, 212, 0.35)' };
    if (t.includes('open source')) return { bg: 'rgba(16, 185, 129, 0.16)', text: '#34d399', border: 'rgba(16, 185, 129, 0.35)' };
    if (t.includes('internship')) return { bg: 'rgba(236, 72, 153, 0.16)', text: '#f472b6', border: 'rgba(236, 72, 153, 0.35)' };
    return { bg: 'rgba(255, 255, 255, 0.1)', text: 'var(--text-primary)', border: 'rgba(255, 255, 255, 0.18)' };
  };

  const catStyle = getCategoryColor(project.project_type);
  const isLiked = userReaction === 'like';

  return (
    <div 
      className="project-details-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="project-details-card" role="dialog" aria-modal="true" aria-labelledby="project-modal-title">
        {/* Banner Cover Image */}
        {project.image_url ? (
          <div className="project-details-banner">
            {/* Ambient Blurred Background for Logo/Cover */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={project.image_url} 
              alt=""
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: 'blur(30px) brightness(0.35)',
                transform: 'scale(1.15)',
                pointerEvents: 'none'
              }}
            />

            {/* Sharp Foreground Image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={project.image_url} 
              alt={project.title}
              style={{
                position: 'relative',
                maxHeight: '85%',
                maxWidth: '90%',
                objectFit: 'contain',
                borderRadius: '10px',
                zIndex: 1,
                boxShadow: '0 8px 30px rgba(0,0,0,0.55)'
              }}
            />

            {/* High-Visibility Close Button */}
            <button
              onClick={onClose}
              className="project-details-close-btn"
              title="Close modal"
              aria-label="Close modal"
            >
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          <div style={{
            position: 'relative',
            padding: '20px 24px',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.22) 0%, rgba(168, 85, 247, 0.18) 100%)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'flex-end',
            paddingTop: 'calc(14px + env(safe-area-inset-top, 0px))'
          }}>
            <button
              onClick={onClose}
              className="project-details-close-btn"
              title="Close modal"
              aria-label="Close modal"
            >
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="project-details-body">
          {/* Metadata Badges Row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{
              background: catStyle.bg,
              color: catStyle.text,
              border: `1px solid ${catStyle.border}`,
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '0.78rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              <Sparkles size={13} />
              {project.project_type || 'Academic Project'}
            </span>

            {project.branch_name && (
              <span style={{
                background: 'rgba(255, 255, 255, 0.06)',
                color: 'var(--text-secondary)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                padding: '4px 11px',
                borderRadius: '20px',
                fontSize: '0.76rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Building2 size={12} style={{ color: 'var(--text-muted)' }} />
                {project.branch_name}
              </span>
            )}

            {project.batch && (
              <span style={{
                background: 'rgba(255, 255, 255, 0.06)',
                color: 'var(--text-secondary)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                padding: '4px 11px',
                borderRadius: '20px',
                fontSize: '0.76rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <GraduationCap size={13} style={{ color: 'var(--text-muted)' }} />
                Batch {project.batch}
              </span>
            )}

            {project.mentor_name && (
              <span style={{
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.28)',
                padding: '4px 11px',
                borderRadius: '20px',
                fontSize: '0.76rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Award size={12} />
                Mentor: {project.mentor_name}
              </span>
            )}
          </div>

          {/* Title & Interactive Reaction Header */}
          <div className="project-details-title-row">
            <h1 id="project-modal-title" className="project-details-title">
              {project.title}
            </h1>

            {/* Instagram-Style Heart Like Reaction Button */}
            <div className="project-details-reaction-bar">
              <button
                onClick={handleReactionClick}
                disabled={voting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  background: isLiked ? 'rgba(239, 68, 68, 0.16)' : 'rgba(255, 255, 255, 0.04)',
                  border: isLiked ? '1px solid rgba(239, 68, 68, 0.45)' : '1px solid var(--border-glass)',
                  color: isLiked ? '#ef4444' : 'var(--text-secondary)',
                  borderRadius: '20px',
                  padding: '6px 14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  fontSize: '0.86rem',
                  fontWeight: 700
                }}
                title={isLiked ? "Unlike this project" : "Like this project"}
              >
                <Heart 
                  size={16} 
                  fill={isLiked ? '#ef4444' : 'none'} 
                  color={isLiked ? '#ef4444' : 'currentColor'} 
                />
                <span>{currentLikes}</span>
              </button>
            </div>
          </div>

          {/* Project Overview Card */}
          <div className="project-details-box">
            <h3 className="project-details-section-title">
              <FileText size={14} style={{ color: 'var(--primary, #6366f1)' }} />
              <span>Project Overview & Innovations</span>
            </h3>
            <p style={{
              fontSize: '0.9rem',
              color: '#cbd5e1',
              lineHeight: 1.65,
              margin: '8px 0 0 0',
              whiteSpace: 'pre-line'
            }}>
              {project.description || project.short_description || 'No detailed description provided for this project.'}
            </p>
          </div>

          {/* Technologies & Tech Stack Chips */}
          {skillsList.length > 0 && (
            <div className="project-details-box">
              <h3 className="project-details-section-title">
                <Code size={14} style={{ color: 'var(--primary, #6366f1)' }} />
                <span>Technologies & Skills</span>
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                {skillsList.map((skill, si) => (
                  <span
                    key={si}
                    style={{
                      background: 'rgba(99, 102, 241, 0.12)',
                      border: '1px solid rgba(99, 102, 241, 0.28)',
                      color: '#c7d2fe',
                      padding: '4px 12px',
                      borderRadius: '16px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      letterSpacing: '0.01em'
                    }}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Team Members List */}
          {teamMembers.length > 0 && (
            <div>
              <h3 className="project-details-section-title" style={{ marginBottom: '10px' }}>
                <Users size={14} style={{ color: 'var(--primary, #6366f1)' }} />
                <span>Team Members ({teamMembers.length})</span>
              </h3>

              <div className="project-team-grid">
                {teamMembers.map((member, idx) => (
                  <div
                    key={idx}
                    className="project-team-card"
                    style={{
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      justifyContent: 'space-between',
                      gap: '10px'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.35), rgba(168, 85, 247, 0.35))',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          color: '#818cf8',
                          flexShrink: 0
                        }}>
                          {(member.name || 'S').charAt(0).toUpperCase()}
                        </div>
                        <div style={{ overflow: 'hidden' }}>
                          <span style={{
                            display: 'block',
                            fontSize: '0.88rem',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {member.name || 'Student'}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                        {member.branch && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <Building2 size={11} style={{ color: 'var(--text-muted)' }} />
                            {member.branch}
                          </span>
                        )}
                        {member.passout_year && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <GraduationCap size={11} style={{ color: 'var(--text-muted)' }} />
                            Batch {member.passout_year}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* LinkedIn Profile Link */}
                    {member.linkedin_url ? (
                      <a
                        href={member.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'rgba(10, 102, 194, 0.16)',
                          border: '1px solid rgba(10, 102, 194, 0.35)',
                          color: '#38bdf8',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          fontSize: '0.76rem',
                          fontWeight: 600,
                          textDecoration: 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Linkedin size={13} style={{ color: '#0a66c2' }} />
                        <span>LinkedIn Profile</span>
                        <ExternalLink size={11} style={{ marginLeft: 'auto' }} />
                      </a>
                    ) : (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        No LinkedIn profile
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Links Bar */}
          <div className="project-details-actions">
            {project.live_url && (
              <a
                href={project.live_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{
                  flex: '1 1 180px',
                  minHeight: '42px',
                  padding: '10px 18px',
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  textDecoration: 'none',
                  borderRadius: '12px'
                }}
              >
                <Globe size={16} />
                <span>Live Project Demo</span>
                <ExternalLink size={14} />
              </a>
            )}

            {project.github_url && (
              <a
                href={project.github_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{
                  flex: '1 1 180px',
                  minHeight: '42px',
                  padding: '10px 18px',
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  textDecoration: 'none',
                  borderRadius: '12px'
                }}
              >
                <Github size={16} />
                <span>GitHub Repository</span>
                <ExternalLink size={14} />
              </a>
            )}

            {!project.live_url && !project.github_url && (
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No live deployment or repository link provided for this project.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
