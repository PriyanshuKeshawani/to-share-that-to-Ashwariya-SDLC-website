"use client";

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, ExternalLink, Github, Globe, Heart, 
  Linkedin, Users, GraduationCap, Building2, Sparkles, FileText, Code, Award
} from 'lucide-react';

export default function ProjectDetailsModal({
  project,
  onClose,
  onVote = null
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [currentLikes, setCurrentLikes] = useState(typeof project?.likes_count === 'number' ? project.likes_count : 0);
  const [userReaction, setUserReaction] = useState((project?.is_liked || project?.user_reaction === 'like') ? 'like' : null);
  const [voting, setVoting] = useState(false);

  // Sync state whenever project prop updates
  useEffect(() => {
    if (!project) return;
    setCurrentLikes(typeof project.likes_count === 'number' ? project.likes_count : 0);
    setUserReaction((project.is_liked || project.user_reaction === 'like') ? 'like' : null);
  }, [project?.id, project?.likes_count, project?.is_liked, project?.user_reaction]);

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

  const isLiked = userReaction === 'like';

  if (!project || !mounted || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
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
          <div className="project-details-header-fallback">
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
            <span className={`project-details-cat-badge ${(project.project_type || '').toLowerCase().replace(/\s+/g, '-')}`}>
              <Sparkles size={13} />
              {project.project_type || 'Academic Project'}
            </span>

            {project.branch_name && (
              <span className="project-details-meta-tag">
                <Building2 size={12} />
                {project.branch_name}
              </span>
            )}

            {project.batch && (
              <span className="project-details-meta-tag">
                <GraduationCap size={13} />
                Batch {project.batch}
              </span>
            )}

            {project.mentor_name && (
              <span className="project-details-mentor-tag">
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
                className={`project-details-like-btn ${isLiked ? 'liked' : ''}`}
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
              <FileText size={14} />
              <span>Project Overview & Innovations</span>
            </h3>
            <p className="project-details-desc">
              {project.description || project.short_description || 'No detailed description provided for this project.'}
            </p>
          </div>

          {/* Technologies & Tech Stack Chips */}
          {skillsList.length > 0 && (
            <div className="project-details-box">
              <h3 className="project-details-section-title">
                <Code size={14} />
                <span>Technologies & Skills</span>
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                {skillsList.map((skill, si) => (
                  <span
                    key={si}
                    className="project-details-skill-chip"
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
                <Users size={14} />
                <span>Team Members ({teamMembers.length})</span>
              </h3>

              <div className="project-team-grid">
                {teamMembers.map((member, idx) => (
                  <div
                    key={idx}
                    className="project-team-card"
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <div className="project-member-avatar">
                          {(member.name || 'S').charAt(0).toUpperCase()}
                        </div>
                        <div style={{ overflow: 'hidden', minWidth: 0 }}>
                          <span className="project-member-name">
                            {member.name || 'Student'}
                          </span>
                        </div>
                      </div>

                      <div className="project-member-meta">
                        {member.branch && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <Building2 size={11} />
                            {member.branch}
                          </span>
                        )}
                        {member.passout_year && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <GraduationCap size={11} />
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
                        className="project-member-linkedin"
                      >
                        <Linkedin size={13} style={{ color: '#0a66c2' }} />
                        <span>LinkedIn Profile</span>
                        <ExternalLink size={11} style={{ marginLeft: 'auto' }} />
                      </a>
                    ) : (
                      <span className="project-member-no-linkedin">
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
                className="project-action-demo-btn"
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
                className="project-action-github-btn"
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
    </div>,
    document.body
  );
}
