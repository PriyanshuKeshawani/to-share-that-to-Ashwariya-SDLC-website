"use client";

import { useState } from 'react';
import { 
  X, ExternalLink, Github, Globe, ThumbsUp, ThumbsDown, 
  Linkedin, Users, GraduationCap, Building2, Sparkles, FileText
} from 'lucide-react';

export default function ProjectDetailsModal({
  project,
  onClose,
  onVote = null
}) {
  if (!project) return null;

  const [currentLikes, setCurrentLikes] = useState(typeof project.likes_count === 'number' ? project.likes_count : 0);
  const [currentDislikes, setCurrentDislikes] = useState(typeof project.dislikes_count === 'number' ? project.dislikes_count : 0);
  const [userReaction, setUserReaction] = useState(project.user_reaction || null);
  const [voting, setVoting] = useState(false);

  const teamMembers = Array.isArray(project.team_members) && project.team_members.length > 0
    ? project.team_members
    : (project.branch_name || project.batch)
      ? [{ name: 'Project Lead / Team', branch: project.branch_name || '', passout_year: project.batch || '' }]
      : [];

  const handleReactionClick = async (reactionType) => {
    if (voting) return;
    setVoting(true);

    let nextReaction = reactionType;
    let nextLikes = currentLikes;
    let nextDislikes = currentDislikes;

    // Optimistic calculation
    if (userReaction === reactionType) {
      nextReaction = null;
      if (reactionType === 'like') nextLikes = Math.max(0, nextLikes - 1);
      else nextDislikes = Math.max(0, nextDislikes - 1);
    } else {
      if (reactionType === 'like') {
        nextLikes = nextLikes + 1;
        if (userReaction === 'dislike') nextDislikes = Math.max(0, nextDislikes - 1);
      } else {
        nextDislikes = nextDislikes + 1;
        if (userReaction === 'like') nextLikes = Math.max(0, nextLikes - 1);
      }
    }

    // Update local modal state immediately
    setUserReaction(nextReaction);
    setCurrentLikes(nextLikes);
    setCurrentDislikes(nextDislikes);

    // Persist immediately in localStorage
    try {
      const stored = JSON.parse(localStorage.getItem('sistec_project_votes') || '{}');
      stored[project.id] = { reaction: nextReaction, likes: nextLikes, dislikes: nextDislikes };
      localStorage.setItem('sistec_project_votes', JSON.stringify(stored));
    } catch (e) {}

    // Call onVote handler
    try {
      if (onVote) {
        const res = await onVote(project.id, reactionType);
        if (res && res.success) {
          if (res.user_reaction !== undefined) setUserReaction(res.user_reaction);
          if (typeof res.likes_count === 'number') setCurrentLikes(res.likes_count);
          if (typeof res.dislikes_count === 'number') setCurrentDislikes(res.dislikes_count);
        }
      }
    } catch (err) {
      console.warn('Reaction error:', err);
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

  return (
    <div 
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(3, 7, 18, 0.82)',
        backdropFilter: 'blur(12px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto'
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div 
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '24px',
          background: 'linear-gradient(180deg, #0f172a 0%, #0b1120 100%)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.85), 0 0 35px rgba(99, 102, 241, 0.12)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out'
        }}
      >
        {/* Banner Cover Image */}
        {project.image_url ? (
          <div style={{
            position: 'relative',
            width: '100%',
            height: '240px',
            background: '#070b14',
            overflow: 'hidden',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
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
                filter: 'blur(30px) brightness(0.4)',
                transform: 'scale(1.15)',
                pointerEvents: 'none'
              }}
            />

            {/* Sharp Foreground Image (Never Cropped or Stretched) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={project.image_url} 
              alt={project.title}
              style={{
                position: 'relative',
                maxHeight: '220px',
                maxWidth: '92%',
                objectFit: 'contain',
                borderRadius: '10px',
                zIndex: 1,
                boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
              }}
            />

            {/* Close Button */}
            <button
              onClick={onClose}
              style={{
                position: 'absolute',
                top: '14px',
                right: '14px',
                background: 'rgba(0, 0, 0, 0.7)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                cursor: 'pointer',
                zIndex: 3,
                transition: 'transform 0.15s ease, background 0.15s ease'
              }}
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        ) : (
          <div style={{
            position: 'relative',
            padding: '24px',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(168, 85, 247, 0.15) 100%)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'flex-end'
          }}>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                cursor: 'pointer'
              }}
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div style={{
          padding: '24px 28px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          {/* Metadata Badges Row (Cleanly above title) */}
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
          </div>

          {/* Title & Interactive Reaction Header */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap'
          }}>
            <h1 style={{
              fontSize: '1.48rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              margin: 0,
              lineHeight: 1.3,
              flex: 1,
              letterSpacing: '-0.015em'
            }}>
              {project.title}
            </h1>

            {/* Like & Dislike Reaction Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '4px 8px'
            }}>
              <button
                onClick={() => handleReactionClick('like')}
                disabled={voting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: userReaction === 'like' ? 'rgba(99, 102, 241, 0.28)' : 'transparent',
                  border: userReaction === 'like' ? '1px solid #6366f1' : '1px solid transparent',
                  color: userReaction === 'like' ? '#818cf8' : 'var(--text-secondary)',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  fontSize: '0.86rem',
                  fontWeight: 700
                }}
                title="Like this project"
              >
                <ThumbsUp size={15} style={{ color: userReaction === 'like' ? '#818cf8' : 'currentColor' }} />
                <span>{currentLikes}</span>
              </button>

              <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.1)' }} />

              <button
                onClick={() => handleReactionClick('dislike')}
                disabled={voting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: userReaction === 'dislike' ? 'rgba(239, 68, 68, 0.22)' : 'transparent',
                  border: userReaction === 'dislike' ? '1px solid #ef4444' : '1px solid transparent',
                  color: userReaction === 'dislike' ? '#f87171' : 'var(--text-muted)',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  fontSize: '0.86rem',
                  fontWeight: 700
                }}
                title="Dislike"
              >
                <ThumbsDown size={15} style={{ color: userReaction === 'dislike' ? '#f87171' : 'currentColor' }} />
                <span>{currentDislikes}</span>
              </button>
            </div>
          </div>

          {/* Project Overview Card */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.025)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '18px 20px'
          }}>
            <h3 style={{
              fontSize: '0.78rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-muted)',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <FileText size={13} style={{ color: 'var(--primary, #6366f1)' }} />
              <span>Project Overview & Innovations</span>
            </h3>
            <p style={{
              fontSize: '0.92rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.65,
              margin: 0,
              whiteSpace: 'pre-line'
            }}>
              {project.short_description || project.description || 'No description provided for this project.'}
            </p>
          </div>

          {/* Team Members List */}
          {teamMembers.length > 0 && (
            <div>
              <h3 style={{
                fontSize: '0.82rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-muted)',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <Users size={15} style={{ color: 'var(--primary, #6366f1)' }} />
                <span>Team Members ({teamMembers.length})</span>
              </h3>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                gap: '12px'
              }}>
                {teamMembers.map((member, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.09)',
                      borderRadius: '14px',
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
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
                            fontSize: '0.92rem',
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
                          fontSize: '0.78rem',
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
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            paddingTop: '16px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            marginTop: '4px'
          }}>
            {project.live_url && (
              <a
                href={project.live_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{
                  flex: 1,
                  minWidth: '160px',
                  padding: '11px 20px',
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
                  flex: 1,
                  minWidth: '160px',
                  padding: '11px 20px',
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
