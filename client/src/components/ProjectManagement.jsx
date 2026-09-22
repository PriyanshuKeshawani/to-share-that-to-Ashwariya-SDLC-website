"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Rocket, Plus, Search, Edit, Trash2, Eye, EyeOff, X, 
  AlertTriangle, RefreshCw, Sparkles, FileText, Globe, Github,
  Heart, Users, Check, ExternalLink, Copy, CheckCheck, Upload
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import ProjectFormModal, { PROJECT_TYPES } from './ProjectFormModal';
import ProjectDetailsModal from './ProjectDetailsModal';
import GoogleFormTemplateModal from './GoogleFormTemplateModal';
import ProjectImportWizard from './ProjectImportWizard';
import EmptyState from './EmptyState';

export default function ProjectManagement({
  branches = [],
  showFeedback
}) {
  const { apiCall } = useAuth();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all'); // 'all' | 'published' | 'draft'

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [viewingProject, setViewingProject] = useState(null);
  const [isFormTemplateOpen, setIsFormTemplateOpen] = useState(false);
  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState(false);

  // Deletion Confirmation
  const [deleteConfirmProject, setDeleteConfirmProject] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [statusLoadingId, setStatusLoadingId] = useState(null);

  const fetchProjects = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const data = await apiCall('/projects');
      setProjects(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
      if (showFeedback) {
        showFeedback(err.message || 'Failed to load projects', 'error');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiCall, showFeedback]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const fetchProjectsRef = useRef(fetchProjects);
  useEffect(() => {
    fetchProjectsRef.current = fetchProjects;
  }, [fetchProjects]);

  // Realtime Supabase Channel
  useEffect(() => {
    let channel = null;
    try {
      channel = supabase
        .channel('admin-projects-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
          fetchProjectsRef.current?.(true);
        })
        .subscribe();
    } catch (e) {
      console.warn('Realtime projects subscribe note:', e.message);
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // Stats
  const stats = useMemo(() => {
    const total = projects.length;
    const published = projects.filter(p => p.is_published).length;
    const drafts = total - published;
    const majorCount = projects.filter(p => (p.project_type || '').toLowerCase().includes('major')).length;
    const minorCount = projects.filter(p => (p.project_type || '').toLowerCase().includes('minor')).length;
    return { total, published, drafts, majorCount, minorCount };
  }, [projects]);

  // Available branches
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

  // Filtered list
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
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

      if (selectedType !== 'all') {
        if ((p.project_type || '').toLowerCase() !== selectedType.toLowerCase()) return false;
      }

      if (selectedBranch !== 'all') {
        const matchesBranch = (p.branch_name || '').toLowerCase() === selectedBranch.toLowerCase();
        const memberMatchesBranch = Array.isArray(p.team_members) && p.team_members.some(m =>
          (m.branch || '').toLowerCase() === selectedBranch.toLowerCase()
        );
        if (!matchesBranch && !memberMatchesBranch) return false;
      }

      if (selectedStatus === 'published' && !p.is_published) return false;
      if (selectedStatus === 'draft' && p.is_published) return false;

      return true;
    });
  }, [projects, searchTerm, selectedType, selectedBranch, selectedStatus]);

  // Actions
  const handleSaveProject = async (payload) => {
    if (editingProject && editingProject.id) {
      await apiCall(`/projects/${editingProject.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      if (showFeedback) showFeedback('Project updated successfully!', 'success');
    } else {
      await apiCall('/projects', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (showFeedback) showFeedback('Project created and published successfully!', 'success');
    }
    fetchProjects(true);
  };

  const handleTogglePublish = async (project) => {
    const nextPublished = !project.is_published;
    setStatusLoadingId(project.id);
    try {
      await apiCall(`/projects/${project.id}/${nextPublished ? 'publish' : 'unpublish'}`, {
        method: 'POST'
      });
      setProjects(prev => prev.map(p => p.id === project.id ? { ...p, is_published: nextPublished } : p));
      if (showFeedback) {
        showFeedback(`Project ${nextPublished ? 'published' : 'hidden from student view'}.`, 'success');
      }
    } catch (err) {
      console.error('Failed to toggle publication status:', err);
      if (showFeedback) showFeedback(err.message || 'Status update failed', 'error');
    } finally {
      setStatusLoadingId(null);
    }
  };

  const handleDeleteProject = async () => {
    if (!deleteConfirmProject) return;
    setDeleteLoading(true);
    try {
      await apiCall(`/projects/${deleteConfirmProject.id}`, { method: 'DELETE' });
      setProjects(prev => prev.filter(p => p.id !== deleteConfirmProject.id));
      if (showFeedback) showFeedback('Project deleted successfully.', 'success');
      setDeleteConfirmProject(null);
    } catch (err) {
      console.error('Delete error:', err);
      if (showFeedback) showFeedback(err.message || 'Failed to delete project', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const copyFormQuestions = () => {
    const text = `SISTEC PROJECT SUBMISSION GOOGLE FORM QUESTIONS:
1. Project Title (Short Answer - Required)
2. Project Type (Dropdown - Required)
   - Academic Project
   - Major Project
   - Minor Project
   - Research Project
   - Internship Project
   - Hackathon / Competition
   - Faculty Project
   - Industry Project
   - Open Source / Innovation
   - Other
3. Project Cover Image / Screenshot URL (Short Answer - Optional)
4. Short Description / Overview (Paragraph - Required)
5. Team Members (Paragraph - Required)
   Format: Name, Branch, Passout Year, LinkedIn URL
6. Live Deployment Link (Short Answer - Optional)
7. GitHub Repository Link (Short Answer - Optional)`;

    navigator.clipboard.writeText(text);
    setCopiedTemplate(true);
    setTimeout(() => setCopiedTemplate(false), 2500);
  };

  return (
    <div className="admin-proj-container">
      {/* Top Header */}
      <div className="admin-proj-header">
        <div className="admin-proj-title-block">
          <h2 className="admin-proj-main-title">
            <Rocket size={24} style={{ color: 'var(--primary, #6366f1)', flexShrink: 0 }} />
            <span>Projects & Innovations Directory</span>
          </h2>
          <p className="admin-proj-subtitle">
            Manage student Major & Minor projects, hackathon innovations, and academic showcase.
          </p>
        </div>

        {/* Action Controls */}
        <div className="admin-proj-actions-container">
          {/* Primary Action Row: Refresh + Add Project */}
          <div className="admin-proj-primary-row">
            <button
              onClick={() => fetchProjects(true)}
              disabled={refreshing}
              className="btn btn-secondary admin-proj-btn admin-proj-refresh-btn"
              title="Refresh list"
              aria-label="Refresh project list"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
              <span className="admin-proj-refresh-text">Refresh</span>
            </button>

            <button
              onClick={() => { setEditingProject(null); setIsFormOpen(true); }}
              className="btn btn-primary btn-shine admin-proj-btn admin-proj-add-btn"
              title="Add New Project"
            >
              <Plus size={16} />
              <span>Add Project</span>
            </button>
          </div>

          {/* Secondary Utility Actions */}
          <div className="admin-proj-utility-row">
            <button
              onClick={() => setIsFormTemplateOpen(true)}
              className="btn btn-secondary admin-proj-util-btn"
              title="Create & configure Google Form for student submissions"
            >
              <FileText size={14} style={{ color: 'var(--primary, #6366f1)' }} />
              <span>Google Form Setup</span>
            </button>

            <button
              onClick={() => setIsImportWizardOpen(true)}
              className="btn btn-secondary admin-proj-util-btn"
              title="Import projects from Google Sheet responses, CSV, or Excel"
            >
              <Upload size={14} style={{ color: '#10b981' }} />
              <span>Import from Form</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Counter Bar */}
      <div className="admin-proj-stats-grid">
        <div className="glass-panel admin-proj-stat-card">
          <span className="admin-proj-stat-label">Total Projects</span>
          <div className="admin-proj-stat-val" style={{ color: 'var(--text-primary)' }}>{stats.total}</div>
        </div>
        <div className="glass-panel admin-proj-stat-card">
          <span className="admin-proj-stat-label">Major Projects</span>
          <div className="admin-proj-stat-val" style={{ color: '#818cf8' }}>{stats.majorCount}</div>
        </div>
        <div className="glass-panel admin-proj-stat-card">
          <span className="admin-proj-stat-label">Minor Projects</span>
          <div className="admin-proj-stat-val" style={{ color: '#c084fc' }}>{stats.minorCount}</div>
        </div>
        <div className="glass-panel admin-proj-stat-card">
          <span className="admin-proj-stat-label">Published</span>
          <div className="admin-proj-stat-val" style={{ color: '#34d399' }}>{stats.published}</div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="glass-panel admin-proj-filters-panel">
        <div className="admin-proj-filters-grid">
          <div className="admin-proj-search-wrapper">
            <Search size={16} className="admin-proj-search-icon" />
            <input
              type="text"
              className="glass-input admin-proj-search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search projects, students, branch..."
            />
          </div>

          <div className="admin-proj-filter-select-group">
            <select
              className="glass-input admin-proj-select"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              aria-label="Filter by project type"
            >
              <option value="all">All Project Types</option>
              {PROJECT_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            <select
              className="glass-input admin-proj-select"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              aria-label="Filter by branch"
            >
              <option value="all">All Branches</option>
              {availableBranches.map(br => (
                <option key={br} value={br}>{br}</option>
              ))}
            </select>

            <select
              className="glass-input admin-proj-select"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="all">All Statuses</option>
              <option value="published">Published Only</option>
              <option value="draft">Drafts Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Projects Table & Mobile Cards */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="glass-panel animate-pulse" style={{ height: '70px', borderRadius: '12px' }} />
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          icon={Rocket}
          title="No projects found"
          message="No projects matched your criteria. Add a new project or adjust filters."
          action={{ label: "Add New Project", onClick: () => { setEditingProject(null); setIsFormOpen(true); } }}
        />
      ) : (
        <>
          {/* DESKTOP TABLE VIEW (Visible on tablet/desktop >= 860px) */}
          <div className="admin-projects-desktop-table glass-panel" style={{ borderRadius: '20px', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--border-glass)' }}>
                    <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 600 }}>Project</th>
                    <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 600 }}>Category</th>
                    <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 600 }}>Team Members</th>
                    <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 600 }}>Branch / Batch</th>
                    <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 600 }}>Likes</th>
                    <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 600 }}>Status</th>
                    <th style={{ padding: '14px 18px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((project) => {
                    const members = Array.isArray(project.team_members) ? project.team_members : [];
                    const likes = typeof project.likes_count === 'number' ? project.likes_count : 0;

                    return (
                      <tr 
                        key={`table-${project.id}`}
                        style={{ 
                          borderBottom: '1px solid var(--border-glass, rgba(255,255,255,0.05))',
                          transition: 'background 0.15s ease'
                        }}
                        className="table-row-hover"
                      >
                        {/* Project title and image */}
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: '10px',
                              overflow: 'hidden',
                              flexShrink: 0,
                              background: 'rgba(255,255,255,0.05)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '1px solid var(--border-glass)'
                            }}>
                              {project.image_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={project.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <Rocket size={18} style={{ color: 'var(--text-muted)' }} />
                              )}
                            </div>
                            <div>
                              <span 
                                style={{ fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer', display: 'block' }}
                                onClick={() => setViewingProject(project)}
                              >
                                {project.title}
                              </span>
                              <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                                {project.live_url && (
                                  <a href={project.live_url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontSize: '0.74rem' }}>
                                    Live Demo
                                  </a>
                                )}
                                {project.github_url && (
                                  <a href={project.github_url} target="_blank" rel="noreferrer" style={{ color: 'var(--text-secondary)', fontSize: '0.74rem' }}>
                                    GitHub
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Category */}
                        <td style={{ padding: '14px 18px' }}>
                          <span className={`admin-project-type-badge ${(project.project_type || '').toLowerCase().replace(/\s+/g, '-')}`}>
                            {project.project_type || 'Academic Project'}
                          </span>
                        </td>

                        {/* Team */}
                        <td style={{ padding: '14px 18px' }}>
                          {members.length > 0 ? (
                            <div style={{ fontSize: '0.82rem' }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{members[0]?.name || 'Student'}</span>
                              {members.length > 1 && (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem', display: 'block' }}>
                                  +{members.length - 1} other member{members.length > 2 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.78rem' }}>None listed</span>
                          )}
                        </td>

                        {/* Branch / Batch */}
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                            <div>{project.branch_name || members[0]?.branch || '—'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {project.batch ? `Batch ${project.batch}` : members[0]?.passout_year ? `Batch ${members[0]?.passout_year}` : ''}
                            </div>
                          </div>
                        </td>

                        {/* Likes */}
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem', color: '#f43f5e', fontWeight: 700 }}>
                            <Heart size={14} fill="#f43f5e" />
                            <span>{likes}</span>
                          </div>
                        </td>

                        {/* Status */}
                        <td style={{ padding: '14px 18px' }}>
                          <button
                            onClick={() => handleTogglePublish(project)}
                            disabled={statusLoadingId === project.id}
                            className={`admin-project-status-btn ${project.is_published ? 'published' : 'draft'}`}
                            title="Click to toggle publish/unpublish"
                          >
                            {project.is_published ? <Eye size={12} /> : <EyeOff size={12} />}
                            <span>{project.is_published ? 'Published' : 'Draft'}</span>
                          </button>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              onClick={() => setViewingProject(project)}
                              className="admin-card-action-btn view"
                              title="View Card Preview"
                              aria-label="View Project"
                            >
                              <Eye size={14} />
                            </button>

                            <button
                              onClick={() => { setEditingProject(project); setIsFormOpen(true); }}
                              className="admin-card-action-btn edit"
                              title="Edit Project"
                              aria-label="Edit Project"
                            >
                              <Edit size={14} />
                            </button>

                            <button
                              onClick={() => setDeleteConfirmProject(project)}
                              className="admin-card-action-btn delete"
                              title="Delete Project"
                              aria-label="Delete Project"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* MOBILE CARDS VIEW (Visible on mobile/small-tablet < 860px) */}
          <div className="admin-projects-mobile-cards">
            {filteredProjects.map((project) => {
              const members = Array.isArray(project.team_members) ? project.team_members : [];
              const likes = typeof project.likes_count === 'number' ? project.likes_count : 0;
              const leadName = members[0]?.name || project.created_by_name || 'Student';
              const branchName = project.branch_name || members[0]?.branch || '—';
              const batchYear = project.batch ? `Batch ${project.batch}` : members[0]?.passout_year ? `Batch ${members[0]?.passout_year}` : '';

              return (
                <div key={`card-${project.id}`} className="admin-project-card">
                  {/* Primary Row: Thumbnail + Title + Category + Links */}
                  <div className="admin-project-card-header">
                    <div className="admin-project-card-thumb">
                      {project.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={project.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Rocket size={20} style={{ color: 'var(--text-muted)' }} />
                      )}
                    </div>
                    <div className="admin-project-card-title-col">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <span className={`admin-project-type-badge ${(project.project_type || '').toLowerCase().replace(/\s+/g, '-')}`}>
                          {project.project_type || 'Academic Project'}
                        </span>
                        <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                          {project.live_url && (
                            <a href={project.live_url} target="_blank" rel="noreferrer" className="admin-proj-link-item live">
                              Demo ↗
                            </a>
                          )}
                          {project.github_url && (
                            <a href={project.github_url} target="_blank" rel="noreferrer" className="admin-proj-link-item code">
                              Code ↗
                            </a>
                          )}
                        </div>
                      </div>
                      <h3 
                        className="admin-project-card-title"
                        onClick={() => setViewingProject(project)}
                        title="Click to view details preview"
                      >
                        {project.title}
                      </h3>
                    </div>
                  </div>

                  {/* Secondary Details: Team, Branch, Batch */}
                  <div className="admin-project-card-meta">
                    <div className="admin-project-meta-row">
                      <span className="admin-project-meta-label">Team:</span>
                      <span className="admin-project-meta-value">
                        {leadName}
                        {members.length > 1 && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', marginLeft: '4px' }}>
                            (+{members.length - 1} more)
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="admin-project-meta-grid">
                      <div className="admin-project-meta-cell">
                        <span className="admin-project-meta-label">Branch:</span>
                        <span className="admin-project-meta-value">{branchName}</span>
                      </div>
                      {batchYear && (
                        <div className="admin-project-meta-cell">
                          <span className="admin-project-meta-label">Batch:</span>
                          <span className="admin-project-meta-value">{batchYear}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer: Likes + Status Badge Button + Actions */}
                  <div className="admin-project-card-footer">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {/* Real Supabase Like Counter */}
                      <div className="admin-project-likes-badge" title={`${likes} Likes`}>
                        <Heart size={13} fill="#f43f5e" color="#f43f5e" />
                        <span>{likes}</span>
                      </div>

                      {/* Clickable Status Badge Button */}
                      <button
                        onClick={() => handleTogglePublish(project)}
                        disabled={statusLoadingId === project.id}
                        className={`admin-project-status-btn ${project.is_published ? 'published' : 'draft'}`}
                        title="Click to toggle publish/unpublish"
                      >
                        {project.is_published ? <Eye size={11} /> : <EyeOff size={11} />}
                        <span>{project.is_published ? 'Published' : 'Draft'}</span>
                      </button>
                    </div>

                    {/* Action Buttons: View, Edit, Delete */}
                    <div className="admin-project-card-actions">
                      <button
                        onClick={() => setViewingProject(project)}
                        className="admin-card-action-btn view"
                        title="View Card Preview"
                        aria-label="View Project"
                      >
                        <Eye size={15} />
                      </button>

                      <button
                        onClick={() => { setEditingProject(project); setIsFormOpen(true); }}
                        className="admin-card-action-btn edit"
                        title="Edit Project"
                        aria-label="Edit Project"
                      >
                        <Edit size={15} />
                      </button>

                      <button
                        onClick={() => setDeleteConfirmProject(project)}
                        className="admin-card-action-btn delete"
                        title="Delete Project"
                        aria-label="Delete Project"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmProject && (
        <div 
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div className="glass-panel" style={{ maxWidth: '440px', width: '100%', borderRadius: '20px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(239,68,68,0.15)', color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Delete Project?</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>This action cannot be undone.</span>
              </div>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 20px 0' }}>
              Are you sure you want to permanently delete <strong style={{ color: 'var(--text-primary)' }}>"{deleteConfirmProject.title}"</strong>?
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                onClick={() => setDeleteConfirmProject(null)} 
                className="btn btn-secondary"
                disabled={deleteLoading}
                style={{ padding: '8px 16px' }}
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteProject} 
                className="btn btn-danger"
                disabled={deleteLoading}
                style={{ padding: '8px 18px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {deleteLoading ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google Form Setup & Question Structure Modal */}
      <GoogleFormTemplateModal
        isOpen={isFormTemplateOpen}
        onClose={() => setIsFormTemplateOpen(false)}
      />

      {/* Intelligent Google Form / Sheets Project Import Wizard */}
      <ProjectImportWizard
        isOpen={isImportWizardOpen}
        onClose={() => setIsImportWizardOpen(false)}
        existingProjects={projects}
        onImportComplete={() => fetchProjects(true)}
      />

      {/* Add / Edit Project Modal */}
      {isFormOpen && (
        <ProjectFormModal
          isOpen={isFormOpen}
          onClose={() => { setIsFormOpen(false); setEditingProject(null); }}
          project={editingProject}
          branches={branches}
          onSave={handleSaveProject}
        />
      )}

      {/* Details Preview Modal */}
      {viewingProject && (
        <ProjectDetailsModal
          project={viewingProject}
          onClose={() => setViewingProject(null)}
        />
      )}
    </div>
  );
}
