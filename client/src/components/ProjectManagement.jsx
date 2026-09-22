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
    <div style={{ paddingBottom: '40px' }}>
      {/* Top Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '20px'
      }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Rocket size={24} style={{ color: 'var(--primary, #6366f1)' }} />
            <span>Projects & Innovations Directory</span>
          </h2>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Manage student Major & Minor projects, hackathon innovations, and academic showcase.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setIsFormTemplateOpen(true)}
            className="btn btn-secondary"
            style={{ padding: '8px 14px', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Create & configure Google Form for student submissions"
          >
            <FileText size={15} style={{ color: 'var(--primary, #6366f1)' }} />
            <span>Google Form Setup</span>
          </button>

          <button
            onClick={() => setIsImportWizardOpen(true)}
            className="btn btn-secondary"
            style={{ padding: '8px 14px', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Import projects from Google Sheet responses, CSV, or Excel"
          >
            <Upload size={15} style={{ color: '#10b981' }} />
            <span>Import from Google Form</span>
          </button>

          <button
            onClick={() => fetchProjects(true)}
            disabled={refreshing}
            className="btn btn-secondary"
            style={{ padding: '8px 12px', fontSize: '0.84rem' }}
            title="Refresh list"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={() => { setEditingProject(null); setIsFormOpen(true); }}
            className="btn btn-primary btn-shine"
            style={{ padding: '8px 18px', fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} />
            <span>Add Project</span>
          </button>
        </div>
      </div>

      {/* Stats Counter Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '14px',
        marginBottom: '20px'
      }}>
        <div className="glass-panel" style={{ padding: '16px', borderRadius: '16px' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Projects</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>{stats.total}</div>
        </div>
        <div className="glass-panel" style={{ padding: '16px', borderRadius: '16px' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Major Projects</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#818cf8', marginTop: '4px' }}>{stats.majorCount}</div>
        </div>
        <div className="glass-panel" style={{ padding: '16px', borderRadius: '16px' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Minor Projects</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#c084fc', marginTop: '4px' }}>{stats.minorCount}</div>
        </div>
        <div className="glass-panel" style={{ padding: '16px', borderRadius: '16px' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Published</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#34d399', marginTop: '4px' }}>{stats.published}</div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="glass-panel" style={{ padding: '16px', borderRadius: '18px', marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <div style={{ position: 'relative', gridColumn: 'span 2 / span 2' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="glass-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by project title, student name, branch, batch..."
              style={{ paddingLeft: '38px', width: '100%', height: '40px', fontSize: '0.86rem' }}
            />
          </div>

          <div>
            <select
              className="glass-input"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              style={{ width: '100%', height: '40px', fontSize: '0.84rem' }}
            >
              <option value="all">All Project Types</option>
              {PROJECT_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              className="glass-input"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              style={{ width: '100%', height: '40px', fontSize: '0.84rem' }}
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
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{ width: '100%', height: '40px', fontSize: '0.84rem' }}
            >
              <option value="all">All Statuses</option>
              <option value="published">Published Only</option>
              <option value="draft">Drafts Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Projects Table / Cards */}
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
        <div className="glass-panel" style={{ borderRadius: '20px', overflow: 'hidden' }}>
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
                  const dislikes = typeof project.dislikes_count === 'number' ? project.dislikes_count : 0;

                  return (
                    <tr 
                      key={project.id}
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
                        <span className="badge badge-primary" style={{ fontSize: '0.74rem', padding: '3px 8px' }}>
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
                          className={`badge ${project.is_published ? 'badge-primary' : 'badge-secondary'}`}
                          style={{
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            border: 'none',
                            padding: '4px 10px',
                            fontSize: '0.74rem'
                          }}
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
                            style={{
                              background: 'rgba(255,255,255,0.05)',
                              border: 'none',
                              borderRadius: '8px',
                              width: '32px',
                              height: '32px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--text-secondary)',
                              cursor: 'pointer'
                            }}
                            title="View Card Preview"
                          >
                            <Eye size={14} />
                          </button>

                          <button
                            onClick={() => { setEditingProject(project); setIsFormOpen(true); }}
                            style={{
                              background: 'rgba(99, 102, 241, 0.1)',
                              border: 'none',
                              borderRadius: '8px',
                              width: '32px',
                              height: '32px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--primary)',
                              cursor: 'pointer'
                            }}
                            title="Edit Project"
                          >
                            <Edit size={14} />
                          </button>

                          <button
                            onClick={() => setDeleteConfirmProject(project)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: 'none',
                              borderRadius: '8px',
                              width: '32px',
                              height: '32px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#f87171',
                              cursor: 'pointer'
                            }}
                            title="Delete Project"
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
