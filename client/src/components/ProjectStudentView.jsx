"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Rocket, Search, X, Calendar, MapPin, Building2, 
  ExternalLink, User, Clock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import EmptyState from './EmptyState';
import ProjectDetailsModal from './ProjectDetailsModal';

export default function ProjectStudentView({
  branches = []
}) {
  const { apiCall } = useAuth();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedBatch, setSelectedBatch] = useState('all');
  const [selectedMajor, setSelectedMajor] = useState('all');
  const [selectedMinor, setSelectedMinor] = useState('all');
  const [viewingProject, setViewingProject] = useState(null);

  const fetchProjects = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const data = await apiCall('/projects');
      setProjects(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load published projects:', err);
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Realtime updates: if admin publishes or modifies projects, student sees it immediately
  useEffect(() => {
    let channel = null;
    try {
      channel = supabase
        .channel(`student-projects-sync-${Date.now()}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'projects' },
          () => {
            fetchProjects(true);
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('Realtime student projects subscribe note:', e.message);
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [fetchProjects]);

  // Unique options for filters
  const availableTypes = useMemo(() => {
    const set = new Set();
    projects.forEach(p => {
      if (p.project_type && p.project_type.trim()) set.add(p.project_type.trim());
    });
    return Array.from(set).sort();
  }, [projects]);

  const availableBatches = useMemo(() => {
    const set = new Set();
    projects.forEach(p => {
      if (p.batch && p.batch.trim()) set.add(p.batch.trim());
    });
    return Array.from(set).sort().reverse();
  }, [projects]);

  const availableBranches = useMemo(() => {
    const map = new Map();
    branches.forEach(b => {
      if (b && b.name) map.set(b.name, b.name);
    });
    projects.forEach(p => {
      if (p.branch_name && p.branch_name.trim()) {
        map.set(p.branch_name.trim(), p.branch_name.trim());
      }
    });
    return Array.from(map.values()).sort();
  }, [branches, projects]);

  const availableMajors = useMemo(() => {
    const set = new Set();
    projects.forEach(p => {
      if (p.major && p.major.trim()) set.add(p.major.trim());
    });
    return Array.from(set).sort();
  }, [projects]);

  const availableMinors = useMemo(() => {
    const set = new Set();
    projects.forEach(p => {
      if (p.minor && p.minor.trim()) set.add(p.minor.trim());
    });
    return Array.from(set).sort();
  }, [projects]);

  // Filter and search
  const filteredProjects = useMemo(() => {
    return projects.filter(item => {
      if (selectedType !== 'all' && item.project_type !== selectedType) {
        return false;
      }
      if (selectedBranch !== 'all' && item.branch_name !== selectedBranch) {
        return false;
      }
      if (selectedBatch !== 'all' && item.batch !== selectedBatch) {
        return false;
      }
      if (selectedMajor !== 'all' && item.major !== selectedMajor) {
        return false;
      }
      if (selectedMinor !== 'all' && item.minor !== selectedMinor) {
        return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const title = (item.title || '').toLowerCase();
        const desc = (item.description || '').toLowerCase();
        const shortDesc = (item.short_description || '').toLowerCase();
        const skills = (item.required_skills || '').toLowerCase();
        const major = (item.major || '').toLowerCase();
        const minor = (item.minor || '').toLowerCase();
        const branch = (item.branch_name || '').toLowerCase();
        const dept = (item.department || '').toLowerCase();
        const org = (item.organization || '').toLowerCase();
        const mentor = (item.mentor_name || '').toLowerCase();

        return (
          title.includes(q) ||
          desc.includes(q) ||
          shortDesc.includes(q) ||
          skills.includes(q) ||
          major.includes(q) ||
          minor.includes(q) ||
          branch.includes(q) ||
          dept.includes(q) ||
          org.includes(q) ||
          mentor.includes(q)
        );
      }
      return true;
    });
  }, [projects, selectedType, selectedBranch, selectedBatch, selectedMajor, selectedMinor, searchTerm]);

  const hasActiveFilters = searchTerm || selectedType !== 'all' || selectedBranch !== 'all' || selectedBatch !== 'all' || selectedMajor !== 'all' || selectedMinor !== 'all';

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedType('all');
    setSelectedBranch('all');
    setSelectedBatch('all');
    setSelectedMajor('all');
    setSelectedMinor('all');
  };

  const formatDeadline = (dl) => {
    if (!dl) return null;
    try {
      const d = new Date(dl);
      if (isNaN(d.getTime())) return null;
      const now = new Date();
      const diffDays = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
      const formatted = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      return { formatted, diffDays, isPast: diffDays < 0 };
    } catch {
      return null;
    }
  };

  const getApplyUrl = (project) => {
    if (project.google_form_url && project.google_form_url.trim()) return project.google_form_url.trim();
    if (project.application_url && project.application_url.trim()) return project.application_url.trim();
    if (project.contact_email && project.contact_email.trim()) {
      return `mailto:${project.contact_email.trim()}?subject=Application for ${encodeURIComponent(project.title)}`;
    }
    return null;
  };

  return (
    <div className="animate-section-enter">
      {/* Header Banner */}
      <div className="glass-panel" style={{
        padding: '24px 28px',
        marginBottom: '24px',
        borderRadius: '16px',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(168,85,247,0.04) 100%), var(--modal-card-bg, var(--bg-card))',
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
          <Rocket size={160} />
        </div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span className="badge badge-primary" style={{ padding: '4px 10px', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <Rocket size={12} /> Opportunities & Project Portal
            </span>
            <span className="badge badge-secondary" style={{ padding: '4px 10px', fontSize: '0.74rem' }}>
              {projects.length} Active {projects.length === 1 ? 'Opportunity' : 'Opportunities'}
            </span>
          </div>

          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px 0', letterSpacing: '-0.01em' }}>
            Projects & Opportunities Directory
          </h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '720px', lineHeight: 1.55 }}>
            Explore verified academic projects, research openings, internships, hackathons, and industry collaborations curated for SISTEC students. Apply directly or review prerequisites.
          </p>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '24px', borderRadius: '14px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          alignItems: 'center'
        }}>
          {/* Search Box */}
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
              placeholder="Search by title, skills, mentor, branch, or keywords..."
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

          {/* Type Filter */}
          <div>
            <select
              className="glass-input"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              style={{ width: '100%', height: '42px', fontSize: '0.86rem' }}
            >
              <option value="all">All Project Types</option>
              {availableTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Branch Filter */}
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

          {/* Batch Filter */}
          <div>
            <select
              className="glass-input"
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              style={{ width: '100%', height: '42px', fontSize: '0.86rem' }}
            >
              <option value="all">All Batches</option>
              {availableBatches.map(b => (
                <option key={b} value={b}>Batch {b}</option>
              ))}
            </select>
          </div>

          {/* Major Filter */}
          {availableMajors.length > 0 && (
            <div>
              <select
                className="glass-input"
                value={selectedMajor}
                onChange={(e) => setSelectedMajor(e.target.value)}
                style={{ width: '100%', height: '42px', fontSize: '0.86rem' }}
              >
                <option value="all">All Majors</option>
                {availableMajors.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}

          {/* Minor Filter */}
          {availableMinors.length > 0 && (
            <div>
              <select
                className="glass-input"
                value={selectedMinor}
                onChange={(e) => setSelectedMinor(e.target.value)}
                style={{ width: '100%', height: '42px', fontSize: '0.86rem' }}
              >
                <option value="all">All Minors</option>
                {availableMinors.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Active Filter Badges */}
        {hasActiveFilters && (
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
              {selectedType !== 'all' && <span className="badge badge-primary">Type: {selectedType}</span>}
              {selectedBranch !== 'all' && <span className="badge badge-primary">Branch: {selectedBranch}</span>}
              {selectedBatch !== 'all' && <span className="badge badge-gold">Batch: {selectedBatch}</span>}
              {selectedMajor !== 'all' && <span className="badge badge-secondary">Major: {selectedMajor}</span>}
              {selectedMinor !== 'all' && <span className="badge badge-secondary">Minor: {selectedMinor}</span>}
            </div>

            <button
              onClick={resetFilters}
              className="btn btn-secondary"
              style={{ padding: '3px 10px', fontSize: '0.76rem' }}
            >
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
            <div key={i} className="glass-panel animate-pulse" style={{ height: '240px', borderRadius: '14px', padding: '20px' }}>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: '18px', width: '70%', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', marginBottom: '8px' }} />
                  <div style={{ height: '12px', width: '40%', background: 'rgba(255,255,255,0.04)', borderRadius: '4px' }} />
                </div>
              </div>
              <div style={{ height: '40px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', marginBottom: '14px' }} />
              <div style={{ height: '32px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }} />
            </div>
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          icon={Rocket}
          title={hasActiveFilters ? "No matching projects found" : "No published projects available"}
          message={hasActiveFilters ? "Try broadening your search or resetting filters." : "New project opportunities will appear here once published."}
          action={hasActiveFilters ? { label: "Clear Filters", onClick: resetFilters } : null}
        />
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '20px'
        }}>
          {filteredProjects.map((project) => {
            const dl = formatDeadline(project.application_deadline);
            const applyUrl = getApplyUrl(project);
            const skills = (project.required_skills || '')
              .split(',')
              .map(s => s.trim())
              .filter(Boolean);

            return (
              <div
                key={project.id}
                className="glass-panel hover-card"
                style={{
                  borderRadius: '16px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  position: 'relative',
                  border: '1px solid var(--border-glass)',
                  transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease'
                }}
              >
                {/* Top info */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '10px' }}>
                    <span className="badge badge-primary" style={{ fontSize: '0.72rem', padding: '3px 8px', fontWeight: 600 }}>
                      {project.project_type || 'Opportunity'}
                    </span>
                    {dl && (
                      <span 
                        className={`badge ${dl.isPast ? 'badge-danger' : dl.diffDays <= 3 ? 'badge-warning' : 'badge-secondary'}`}
                        style={{ fontSize: '0.72rem', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Clock size={11} />
                        {dl.isPast ? 'Closed' : `${dl.diffDays}d left`}
                      </span>
                    )}
                  </div>

                  <h3 
                    style={{ 
                      fontSize: '1.12rem', 
                      fontWeight: 700, 
                      color: 'var(--text-primary)', 
                      margin: '0 0 6px 0',
                      lineHeight: 1.35,
                      cursor: 'pointer'
                    }}
                    onClick={() => setViewingProject(project)}
                    title="Click to view full details"
                  >
                    {project.title}
                  </h3>

                  {/* Branch & Batch / Org */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {project.branch_name && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Building2 size={12} style={{ color: 'var(--text-muted)' }} />
                        {project.branch_name}
                      </span>
                    )}
                    {project.batch && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={12} style={{ color: 'var(--text-muted)' }} />
                        Batch {project.batch}
                      </span>
                    )}
                    {project.organization && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={12} style={{ color: 'var(--text-muted)' }} />
                        {project.organization}
                      </span>
                    )}
                  </div>

                  {/* Short Description */}
                  <p style={{
                    fontSize: '0.84rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                    margin: '0 0 14px 0',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {project.short_description || project.description || 'No description provided.'}
                  </p>

                  {/* Skills Chips */}
                  {skills.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                      {skills.slice(0, 4).map((skill, idx) => (
                        <span 
                          key={idx} 
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            color: 'var(--text-secondary)',
                            border: '1px solid rgba(255, 255, 255, 0.08)'
                          }}
                        >
                          {skill}
                        </span>
                      ))}
                      {skills.length > 4 && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                          +{skills.length - 4} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Mentor info */}
                  {project.mentor_name && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
                      <User size={12} />
                      <span>Mentor: <strong style={{ color: 'var(--text-secondary)' }}>{project.mentor_name}</strong></span>
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  paddingTop: '14px',
                  borderTop: '1px solid var(--border-glass)',
                  marginTop: '6px'
                }}>
                  <button
                    onClick={() => setViewingProject(project)}
                    className="btn btn-secondary"
                    style={{ flex: 1, padding: '8px 12px', fontSize: '0.82rem', justifyContent: 'center' }}
                  >
                    View Details
                  </button>

                  {applyUrl && (
                    <a
                      href={applyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary"
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        fontSize: '0.82rem',
                        justifyContent: 'center',
                        textDecoration: 'none',
                        gap: '6px'
                      }}
                    >
                      <span>Apply</span>
                      <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Details Modal */}
      {viewingProject && (
        <ProjectDetailsModal
          project={viewingProject}
          onClose={() => setViewingProject(null)}
        />
      )}
    </div>
  );
}
