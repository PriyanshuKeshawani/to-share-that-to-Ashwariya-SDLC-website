"use client";

import { useState } from 'react';
import { 
  X, ExternalLink, Clock, Building2, 
  User, Mail, Layers, FileText, Users, Sparkles, Rocket
} from 'lucide-react';

export default function ProjectDetailsModal({
  project,
  onClose
}) {
  const [currentTime] = useState(() => Date.now());

  if (!project) return null;

  // Deadline formatting & urgency
  let deadlineText = null;
  let isDeadlinePassed = false;
  if (project.application_deadline) {
    try {
      const d = new Date(project.application_deadline);
      deadlineText = d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      isDeadlinePassed = d.getTime() < currentTime;
    } catch {
      deadlineText = project.application_deadline;
    }
  }

  // Parse skill tags
  const skillTags = project.required_skills 
    ? project.required_skills.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(5, 7, 12, 0.88)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '16px'
    }}>
      <div 
        className="glass-panel animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '18px',
          border: '1px solid var(--border-glass)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 30px var(--primary-glow)',
          overflow: 'hidden',
          background: 'var(--bg-card)'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '22px 24px',
          borderBottom: '1px solid var(--border-glass)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '12px',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <span className="badge badge-primary" style={{ padding: '4px 10px', fontSize: '0.74rem', fontWeight: 700 }}>
                {project.project_type || 'Academic Project'}
              </span>

              {project.branch_name && (
                <span className="badge badge-secondary" style={{ padding: '4px 10px', fontSize: '0.74rem' }}>
                  {project.branch_name}
                </span>
              )}

              {project.batch && (
                <span className="badge badge-gold" style={{ padding: '4px 10px', fontSize: '0.74rem' }}>
                  Batch {project.batch}
                </span>
              )}
            </div>

            <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.3 }}>
              {project.title}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '8px', borderRadius: '10px', flexShrink: 0 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ padding: '22px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Deadline / Mode Banner */}
          {(deadlineText || project.application_mode) && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '12px',
              background: isDeadlinePassed ? 'rgba(239, 68, 68, 0.08)' : 'rgba(37, 99, 235, 0.08)',
              border: isDeadlinePassed ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(37, 99, 235, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              {deadlineText && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem' }}>
                  <Clock size={16} color={isDeadlinePassed ? '#ef4444' : '#60a5fa'} />
                  <span>
                    Deadline: <strong style={{ color: isDeadlinePassed ? '#ef4444' : 'var(--text-primary)' }}>{deadlineText}</strong>
                    {isDeadlinePassed && <span style={{ marginLeft: '6px', color: '#ef4444' }}>(Closed)</span>}
                  </span>
                </div>
              )}

              {project.team_size && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  <Users size={14} /> Team Size: <strong style={{ color: 'var(--text-primary)' }}>{project.team_size}</strong>
                </div>
              )}
            </div>
          )}

          {/* Description Section */}
          <div>
            <h4 style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
              Project Overview & Details
            </h4>
            <p style={{ fontSize: '0.92rem', color: 'var(--text-primary)', lineHeight: 1.65, margin: 0, whiteSpace: 'pre-wrap' }}>
              {project.description || project.short_description || 'No detailed description provided for this project.'}
            </p>
          </div>

          {/* Required Skills Section */}
          {skillTags.length > 0 && (
            <div>
              <h4 style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                Required Skills & Tech Stack
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {skillTags.map((skill, i) => (
                  <span
                    key={i}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-glass)',
                      color: '#38bdf8'
                    }}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Specialization Recommendation Fit */}
          {(project.major || project.minor) && (
            <div style={{
              padding: '14px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-glass)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px'
            }}>
              {project.major && (
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                    <Sparkles size={11} color="var(--primary)" /> Recommended Major
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#60a5fa' }}>
                    {project.major}
                  </div>
                </div>
              )}

              {project.minor && (
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                    <Layers size={11} color="#38bdf8" /> Recommended Minor
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#38bdf8' }}>
                    {project.minor}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Eligibility Criteria */}
          {project.eligibility && (
            <div>
              <h4 style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                Eligibility Criteria
              </h4>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                {project.eligibility}
              </p>
            </div>
          )}

          {/* Mentor & Organization & Contact */}
          {(project.mentor_name || project.organization || project.contact_name || project.contact_email) && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              padding: '14px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-glass)'
            }}>
              {project.mentor_name && (
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <User size={11} /> Faculty Lead / Mentor
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                    {project.mentor_name}
                  </div>
                </div>
              )}

              {project.organization && (
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Building2 size={11} /> Organization / Lab
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                    {project.organization}
                  </div>
                </div>
              )}

              {project.contact_email && (
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Mail size={11} /> Contact Email
                  </div>
                  <a
                    href={`mailto:${project.contact_email}`}
                    style={{ fontWeight: 600, fontSize: '0.84rem', color: 'var(--primary)', textDecoration: 'none' }}
                  >
                    {project.contact_email}
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer with Actions */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border-glass)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.02)',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '9px 18px', borderRadius: '10px' }}
          >
            Close
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {project.resource_url && (
              <a
                href={project.resource_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{ padding: '9px 16px', borderRadius: '10px', fontSize: '0.82rem', gap: '6px' }}
              >
                <FileText size={14} /> Proposal / Docs <ExternalLink size={12} />
              </a>
            )}

            {project.application_url && (
              <a
                href={project.application_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{ padding: '9px 16px', borderRadius: '10px', fontSize: '0.82rem', gap: '6px' }}
              >
                Portal Link <ExternalLink size={12} />
              </a>
            )}

            {project.google_form_url && (
              <a
                href={project.google_form_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-shine"
                style={{ padding: '9px 22px', borderRadius: '10px', fontWeight: 700, gap: '6px' }}
              >
                <Rocket size={14} /> Apply via Google Form <ExternalLink size={12} />
              </a>
            )}

            {!project.google_form_url && !project.application_url && project.contact_email && (
              <a
                href={`mailto:${project.contact_email}?subject=Application for ${encodeURIComponent(project.title)}`}
                className="btn btn-primary btn-shine"
                style={{ padding: '9px 22px', borderRadius: '10px', fontWeight: 700, gap: '6px' }}
              >
                <Mail size={14} /> Email Application
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
