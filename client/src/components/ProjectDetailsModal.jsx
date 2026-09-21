"use client";

import { useState } from 'react';
import { 
  X, ExternalLink, Github, Globe, ThumbsUp, ThumbsDown, 
  Linkedin, Users, GraduationCap, Building2, Calendar, Sparkles 
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
    if (voting || !onVote) return;
    setVoting(true);
    try {
      const res = await onVote(project.id, reactionType);
      if (res && res.success) {
        setUserReaction(res.user_reaction);
        setCurrentLikes(res.likes_count);
        setCurrentDislikes(res.dislikes_count);
      }
    } catch (err) {
      console.error('Voting error in modal:', err);
    } finally {
      setVoting(false);
    }
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

  const catStyle = getCategoryColor(project.project_type);

  return (
    <div 
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
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
          maxWidth: '740px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '24px',
          background: 'var(--bg-card, #121622)',
          border: '1px solid var(--border-glass, rgba(255,255,255,0.12))',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out'
        }}
      >
        {/* Banner Cover Image or Fallback Header */}
        <div style={{
          position: 'relative',
          width: '100%',
          height: project.image_url ? '240px' : '140px',
          background: project.image_url 
            ? 'rgba(0,0,0,0.5)' 
            : 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(168, 85, 247, 0.2) 50%, rgba(6, 182, 212, 0.15) 100%)',
          overflow: 'hidden',
          borderBottom: '1px solid var(--border-glass)'
        }}>
          {project.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img 
              src={project.image_url} 
              alt={project.title}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
          )}

          {/* Top Gradient Overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.1) 50%, rgba(18,22,34,0.95) 100%)'
          }} />

          {/* Close Button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              cursor: 'pointer',
              zIndex: 2,
              transition: 'transform 0.15s ease'
            }}
            title="Close"
          >
            <X size={18} />
          </button>

          {/* Category Badge on Banner */}
          <div style={{
            position: 'absolute',
            bottom: '16px',
            left: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
            zIndex: 2
          }}>
            <span style={{
              background: catStyle.bg,
              color: catStyle.text,
              border: `1px solid ${catStyle.border}`,
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '0.78rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              backdropFilter: 'blur(6px)'
            }}>
              <Sparkles size={12} />
              {project.project_type || 'Academic Project'}
            </span>

            {project.branch_name && (
              <span style={{
                background: 'rgba(0,0,0,0.5)',
                color: 'var(--text-secondary)',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '0.75rem',
                backdropFilter: 'blur(6px)'
              }}>
                {project.branch_name}
              </span>
            )}

            {project.batch && (
              <span style={{
                background: 'rgba(0,0,0,0.5)',
                color: 'var(--text-secondary)',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '0.75rem',
                backdropFilter: 'blur(6px)'
              }}>
                Batch {project.batch}
              </span>
            )}
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{
          padding: '24px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          {/* Title & Reaction Header */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap'
          }}>
            <h1 style={{
              fontSize: '1.4rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              margin: 0,
              lineHeight: 1.3,
              flex: 1
            }}>
              {project.title}
            </h1>

            {/* Like & Dislike Reaction Buttons */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-glass)',
              borderRadius: '12px',
              padding: '4px 8px'
            }}>
              <button
                onClick={() => handleReactionClick('like')}
                disabled={voting || !onVote}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: userReaction === 'like' ? 'rgba(99, 102, 241, 0.2)' : 'none',
                  border: userReaction === 'like' ? '1px solid rgba(99, 102, 241, 0.4)' : 'none',
                  color: userReaction === 'like' ? 'var(--primary, #6366f1)' : 'var(--text-secondary)',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  cursor: onVote ? 'pointer' : 'default',
                  transition: 'all 0.15s ease',
                  fontSize: '0.84rem',
                  fontWeight: 600
                }}
                title="Like this project"
              >
                <ThumbsUp size={15} />
                <span>{currentLikes}</span>
              </button>

              <div style={{ width: '1px', height: '18px', background: 'var(--border-glass)' }} />

              <button
                onClick={() => handleReactionClick('dislike')}
                disabled={voting || !onVote}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: userReaction === 'dislike' ? 'rgba(239, 68, 68, 0.15)' : 'none',
                  border: userReaction === 'dislike' ? '1px solid rgba(239, 68, 68, 0.3)' : 'none',
                  color: userReaction === 'dislike' ? '#f87171' : 'var(--text-muted)',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  cursor: onVote ? 'pointer' : 'default',
                  transition: 'all 0.15s ease',
                  fontSize: '0.84rem',
                  fontWeight: 600
                }}
                title="Dislike"
              >
                <ThumbsDown size={15} />
                <span>{currentDislikes}</span>
              </button>
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 style={{
              fontSize: '0.88rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-muted)',
              marginBottom: '8px'
            }}>
              Project Overview
            </h3>
            <p style={{
              fontSize: '0.94rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.65,
              margin: 0,
              whiteSpace: 'pre-line'
            }}>
              {project.short_description || project.description || 'No description provided for this project.'}
            </p>
          </div>

          {/* Team Members */}
          {teamMembers.length > 0 && (
            <div>
              <h3 style={{
                fontSize: '0.88rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
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
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '12px'
              }}>
                {teamMembers.map((member, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-glass, rgba(255,255,255,0.08))',
                      borderRadius: '14px',
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '10px',
                      transition: 'border-color 0.2s ease, transform 0.2s ease'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(168, 85, 247, 0.3))',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          color: 'var(--primary, #6366f1)'
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

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                        {member.branch && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <Building2 size={11} style={{ color: 'var(--text-muted)' }} />
                            {member.branch}
                          </span>
                        )}
                        {member.passout_year && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <GraduationCap size={11} style={{ color: 'var(--text-muted)' }} />
                            {member.passout_year}
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
                          background: 'rgba(10, 102, 194, 0.12)',
                          border: '1px solid rgba(10, 102, 194, 0.3)',
                          color: '#38bdf8',
                          padding: '5px 10px',
                          borderRadius: '8px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          textDecoration: 'none',
                          marginTop: '4px'
                        }}
                      >
                        <Linkedin size={13} style={{ color: '#0a66c2' }} />
                        <span>LinkedIn Profile</span>
                        <ExternalLink size={11} style={{ marginLeft: 'auto' }} />
                      </a>
                    ) : (
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        No LinkedIn provided
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
            borderTop: '1px solid var(--border-glass, rgba(255,255,255,0.08))',
            marginTop: '8px'
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
                  padding: '10px 18px',
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  textDecoration: 'none'
                }}
              >
                <Globe size={16} />
                <span>Live Demo</span>
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
                  padding: '10px 18px',
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  textDecoration: 'none'
                }}
              >
                <Github size={16} />
                <span>GitHub Repository</span>
                <ExternalLink size={14} />
              </a>
            )}

            {project.google_form_url && (
              <a
                href={project.google_form_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{
                  padding: '10px 18px',
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  textDecoration: 'none'
                }}
              >
                <span>Submission Form</span>
                <ExternalLink size={14} />
              </a>
            )}

            {!project.live_url && !project.github_url && !project.google_form_url && (
              <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No external links attached to this project.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
