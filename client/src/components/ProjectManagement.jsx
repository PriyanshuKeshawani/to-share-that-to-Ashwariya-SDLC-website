"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Rocket, Plus, Upload, FileSpreadsheet, Search, 
  Edit, Trash2, Copy, Eye, EyeOff, X, AlertTriangle, 
  RefreshCw 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import ProjectFormModal from './ProjectFormModal';
import GoogleFormTemplateModal from './GoogleFormTemplateModal';
import ProjectImportWizard from './ProjectImportWizard';
import ProjectDetailsModal from './ProjectDetailsModal';
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
  const [selectedBatch, setSelectedBatch] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all'); // 'all' | 'published' | 'draft'
  const [selectedActive, setSelectedActive] = useState('all'); // 'all' | 'active' | 'inactive'

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [viewingProject, setViewingProject] = useState(null);

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

  // Realtime Supabase Channel (subscribed once on mount)
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

  // Extract unique batches and types for dropdowns
  const availableBatches = useMemo(() => {
    const set = new Set();
    projects.forEach(p => {
      if (p.batch && p.batch.trim()) set.add(p.batch.trim());
    });
    return Array.from(set).sort().reverse();
  }, [projects]);

  const availableTypes = useMemo(() => {
    const set = new Set();
    projects.forEach(p => {
      if (p.project_type && p.project_type.trim()) set.add(p.project_type.trim());
    });
    return Array.from(set).sort();
  }, [projects]);

  const availableBranches = useMemo(() => {
    const map = new Map();
    branches.forEach(b => {
      if (b && b.name) map.set(b.name, b.name);
    });
    projects.forEach(p => {
      if (p.branch_name && p.branch_name.trim()) map.set(p.branch_name.trim(), p.branch_name.trim());
    });
    return Array.from(map.values()).sort();
  }, [branches, projects]);

  // Filtered List
  const filteredProjects = useMemo(() => {
    return projects.filter(item => {
      if (selectedType !== 'all' && item.project_type !== selectedType) return false;
      if (selectedBranch !== 'all' && item.branch_name !== selectedBranch) return false;
      if (selectedBatch !== 'all' && item.batch !== selectedBatch) return false;
      if (selectedStatus === 'published' && !item.is_published) return false;
      if (selectedStatus === 'draft' && item.is_published) return false;
      if (selectedActive === 'active' && !item.is_active) return false;
      if (selectedActive === 'inactive' && item.is_active) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const t = (item.title || '').toLowerCase();
        const d = (item.description || '').toLowerCase();
        const sd = (item.short_description || '').toLowerCase();
        const br = (item.branch_name || '').toLowerCase();
        const ba = (item.batch || '').toLowerCase();
        const sk = (item.required_skills || '').toLowerCase();
        const m = (item.mentor_name || '').toLowerCase();
        const org = (item.organization || '').toLowerCase();
        const pt = (item.project_type || '').toLowerCase();

        return (
          t.includes(q) ||
          d.includes(q) ||
          sd.includes(q) ||
          br.includes(q) ||
          ba.includes(q) ||
          sk.includes(q) ||
          m.includes(q) ||
          org.includes(q) ||
          pt.includes(q)
        );
      }

      return true;
    });
  }, [projects, selectedType, selectedBranch, selectedBatch, selectedStatus, selectedActive, searchTerm]);

  // Handlers
  const handleTogglePublish = async (proj) => {
    if (statusLoadingId) return;
    try {
      setStatusLoadingId(proj.id);
      const action = proj.is_published ? 'unpublish' : 'publish';
      await apiCall(`/projects/${proj.id}/${action}`, { method: 'POST' });
      setProjects(prev => prev.map(p => p.id === proj.id ? { ...p, is_published: !proj.is_published } : p));
      if (showFeedback) {
        showFeedback(`Project ${!proj.is_published ? 'published' : 'unpublished'} successfully`, 'success');
      }
    } catch (err) {
      console.error('Failed to toggle publish:', err);
      if (showFeedback) showFeedback(err.message || 'Error updating publish status', 'error');
    } finally {
      setStatusLoadingId(null);
    }
  };

  const handleToggleActive = async (proj) => {
    if (statusLoadingId) return;
    try {
      setStatusLoadingId(proj.id);
      await apiCall(`/projects/${proj.id}/toggle-active`, {
        method: 'POST',
        body: { is_active: !proj.is_active }
      });
      setProjects(prev => prev.map(p => p.id === proj.id ? { ...p, is_active: !proj.is_active } : p));
      if (showFeedback) {
        showFeedback(`Project marked ${!proj.is_active ? 'active' : 'inactive'}`, 'success');
      }
    } catch (err) {
      console.error('Failed to toggle active:', err);
      if (showFeedback) showFeedback(err.message || 'Error updating active status', 'error');
    } finally {
      setStatusLoadingId(null);
    }
  };

  const handleDuplicate = async (proj) => {
    try {
      const res = await apiCall(`/projects/${proj.id}/duplicate`, { method: 'POST' });
      if (res.data) {
        setProjects(prev => [res.data, ...prev]);
      }
      if (showFeedback) showFeedback('Project duplicated as draft', 'success');
    } catch (err) {
      console.error('Duplicate failed:', err);
      if (showFeedback) showFeedback(err.message || 'Failed to duplicate project', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmProject) return;
    try {
      setDeleteLoading(true);
      await apiCall(`/projects/${deleteConfirmProject.id}`, { method: 'DELETE' });
      setProjects(prev => prev.filter(p => p.id !== deleteConfirmProject.id));
      if (showFeedback) showFeedback('Project permanently deleted', 'success');
      setDeleteConfirmProject(null);
    } catch (err) {
      console.error('Failed to delete:', err);
      if (showFeedback) showFeedback(err.message || 'Failed to delete project', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSaveSuccess = async (savedPayload, existingId) => {
    if (existingId) {
      const res = await apiCall(`/projects/${existingId}`, { method: 'PUT', body: savedPayload });
      setProjects(prev => prev.map(p => p.id === existingId ? res.data : p));
      if (showFeedback) showFeedback('Project updated successfully', 'success');
    } else {
      const res = await apiCall('/projects', { method: 'POST', body: savedPayload });
      setProjects(prev => [res, ...prev]);
      if (showFeedback) showFeedback('New project opportunity created', 'success');
    }
    setIsFormOpen(false);
    setEditingProject(null);
  };

  return (
    <div className="animate-section-enter">
      {/* Top Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Projects & Opportunities
            </h2>
            <span className="badge badge-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
              <Rocket size={14} /> {projects.length} Total Projects
            </span>
          </div>
          <p style={{ marginTop: '6px', color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '780px', lineHeight: 1.5 }}>
            Manage academic projects, research topics, hackathons, and internships. Collect submissions via Google Forms or import directly from Excel/CSV/Google Sheets.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => fetchProjects(true)}
            className="btn btn-secondary"
            disabled={refreshing || loading}
            title="Sync Projects"
            style={{ padding: '10px 14px', borderRadius: '10px' }}
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            <span className="hide-on-mobile">Sync</span>
          </button>

          <button
            onClick={() => setIsTemplateOpen(true)}
            className="btn btn-secondary"
            style={{ padding: '10px 16px', borderRadius: '10px', gap: '8px', fontWeight: 600 }}
            title="Generate Google Form questions template"
          >
            <FileSpreadsheet size={16} color="#10b981" /> Create Google Form
          </button>

          <button
            onClick={() => setIsImportOpen(true)}
            className="btn btn-secondary"
            style={{ padding: '10px 16px', borderRadius: '10px', gap: '8px', fontWeight: 600 }}
            title="Import from Excel, CSV, or Google Sheet"
          >
            <Upload size={16} color="#0ea5e9" /> Import Projects
          </button>

          <button
            onClick={() => {
              setEditingProject(null);
              setIsFormOpen(true);
            }}
            className="btn btn-primary btn-shine"
            style={{ padding: '10px 20px', borderRadius: '10px', fontWeight: 700, gap: '8px' }}
          >
            <Plus size={16} /> Add Project
          </button>
        </div>
      </div>

      {/* Stats Counter Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '12px',
        marginBottom: '20px'
      }}>
        <div className="glass-panel" style={{ padding: '14px 18px', borderRadius: '12px' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>{projects.length}</div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Total Entries</div>
        </div>

        <div className="glass-panel" style={{ padding: '14px 18px', borderRadius: '12px' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>
            {projects.filter(p => p.is_published && p.is_active).length}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Live to Students</div>
        </div>

        <div className="glass-panel" style={{ padding: '14px 18px', borderRadius: '12px' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f59e0b' }}>
            {projects.filter(p => !p.is_published).length}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Drafts / Unpublished</div>
        </div>

        <div className="glass-panel" style={{ padding: '14px 18px', borderRadius: '12px' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ef4444' }}>
            {projects.filter(p => !p.is_active).length}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Archived / Inactive</div>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '24px', borderRadius: '14px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
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
              placeholder="Search by title, skills, mentor, or organization..."
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
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Project Type Filter */}
          <div>
            <select
              className="glass-input"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              style={{ width: '100%', height: '42px', fontSize: '0.84rem' }}
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
              style={{ width: '100%', height: '42px', fontSize: '0.84rem' }}
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
              style={{ width: '100%', height: '42px', fontSize: '0.84rem' }}
            >
              <option value="all">All Batches</option>
              {availableBatches.map(b => (
                <option key={b} value={b}>Batch {b}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              className="glass-input"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{ width: '100%', height: '42px', fontSize: '0.84rem' }}
            >
              <option value="all">All Status</option>
              <option value="published">Published Only</option>
              <option value="draft">Drafts Only</option>
            </select>
          </div>
        </div>

        {/* Filter Summary */}
        {(searchTerm || selectedType !== 'all' || selectedBranch !== 'all' || selectedBatch !== 'all' || selectedStatus !== 'all') && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '12px',
            paddingTop: '10px',
            borderTop: '1px solid var(--border-glass)',
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span>Filtering {filteredProjects.length} of {projects.length} records:</span>
              {searchTerm && <span className="badge badge-secondary">Keyword: "{searchTerm}"</span>}
              {selectedType !== 'all' && <span className="badge badge-primary">{selectedType}</span>}
              {selectedBranch !== 'all' && <span className="badge badge-secondary">{selectedBranch}</span>}
              {selectedBatch !== 'all' && <span className="badge badge-gold">Batch {selectedBatch}</span>}
              {selectedStatus !== 'all' && (
                <span className={`badge ${selectedStatus === 'published' ? 'badge-success' : 'badge-warning'}`}>
                  {selectedStatus === 'published' ? 'Published' : 'Drafts'}
                </span>
              )}
            </div>

            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedType('all');
                setSelectedBranch('all');
                setSelectedBatch('all');
                setSelectedStatus('all');
                setSelectedActive('all');
              }}
              className="btn btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.74rem' }}
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--primary)', margin: '0 auto 14px' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading projects directory...</p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          icon={Rocket}
          title={projects.length === 0 ? "No Projects or Opportunities Created Yet" : "No Matching Projects Found"}
          description={
            projects.length === 0
              ? "Start adding projects manually, or import from Google Sheets/Excel to offer students research, hackathon, and internship opportunities."
              : "Try adjusting your search query, department, or project type filters."
          }
          actionLabel={projects.length === 0 ? "Create First Project" : "Clear All Filters"}
          onAction={projects.length === 0 ? () => setIsFormOpen(true) : () => {
            setSearchTerm('');
            setSelectedType('all');
            setSelectedBranch('all');
            setSelectedBatch('all');
            setSelectedStatus('all');
            setSelectedActive('all');
          }}
        />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="desktop-table-view" style={{ marginBottom: '24px' }}>
            <div className="table-responsive-wrapper">
              <table className="custom-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', minWidth: '220px' }}>Project Opportunity</th>
                    <th style={{ textAlign: 'left', minWidth: '130px' }}>Type</th>
                    <th style={{ textAlign: 'left', minWidth: '140px' }}>Branch & Batch</th>
                    <th style={{ textAlign: 'left', minWidth: '140px' }}>Mentor / Org</th>
                    <th style={{ textAlign: 'center', minWidth: '90px' }}>Published</th>
                    <th style={{ textAlign: 'center', minWidth: '90px' }}>Active</th>
                    <th style={{ textAlign: 'right', minWidth: '160px' }} className="sticky-action-col">Actions</th>
                  </tr>
                </thead>
              <tbody>
                {filteredProjects.map((item) => (
                  <tr key={item.id}>
                    {/* Title */}
                    <td>
                      <div>
                        <div 
                          onClick={() => setViewingProject(item)}
                          style={{
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            fontSize: '0.92rem',
                            cursor: 'pointer',
                            transition: 'color 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                        >
                          {item.title}
                        </div>
                        {item.short_description && (
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '3px', maxHeight: '34px', overflow: 'hidden' }}>
                            {item.short_description}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Type */}
                    <td>
                      <span className="badge badge-primary" style={{ padding: '4px 10px', fontSize: '0.74rem', fontWeight: 600 }}>
                        {item.project_type || 'Academic Project'}
                      </span>
                    </td>

                    {/* Branch & Batch */}
                    <td>
                      <div style={{ fontSize: '0.84rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                        {item.branch_name || 'General'}
                      </div>
                      {item.batch && (
                        <span className="badge badge-gold" style={{ padding: '1px 6px', fontSize: '0.68rem', marginTop: '3px' }}>
                          Batch {item.batch}
                        </span>
                      )}
                    </td>

                    {/* Mentor / Org */}
                    <td>
                      <div style={{ fontSize: '0.84rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                        {item.mentor_name || item.organization || '—'}
                      </div>
                      {item.mentor_name && item.organization && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {item.organization}
                        </div>
                      )}
                    </td>

                    {/* Published Toggle */}
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => handleTogglePublish(item)}
                        disabled={statusLoadingId === item.id}
                        className={`badge ${item.is_published ? 'badge-success' : 'badge-warning'}`}
                        style={{ border: 'none', cursor: 'pointer', padding: '5px 10px' }}
                        title={item.is_published ? 'Click to unpublish' : 'Click to publish'}
                      >
                        {statusLoadingId === item.id ? (
                          <RefreshCw size={12} className="animate-spin" />
                        ) : item.is_published ? (
                          <><Eye size={12} /> Published</>
                        ) : (
                          <><EyeOff size={12} /> Draft</>
                        )}
                      </button>
                    </td>

                    {/* Active Toggle */}
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => handleToggleActive(item)}
                        disabled={statusLoadingId === item.id}
                        className={`badge ${item.is_active ? 'badge-primary' : 'badge-danger'}`}
                        style={{ border: 'none', cursor: 'pointer', padding: '5px 10px' }}
                        title={item.is_active ? 'Click to deactivate' : 'Click to activate'}
                      >
                        {item.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>

                    {/* Action Buttons */}
                    <td style={{ textAlign: 'right' }} className="sticky-action-col">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                        <button
                          onClick={() => setViewingProject(item)}
                          className="btn btn-secondary"
                          style={{ padding: '6px 9px', borderRadius: '8px' }}
                          title="View Details"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => {
                            setEditingProject(item);
                            setIsFormOpen(true);
                          }}
                          className="btn btn-secondary"
                          style={{ padding: '6px 9px', borderRadius: '8px' }}
                          title="Edit Project"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDuplicate(item)}
                          className="btn btn-secondary"
                          style={{ padding: '6px 9px', borderRadius: '8px' }}
                          title="Duplicate Project"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmProject(item)}
                          className="btn btn-danger"
                          style={{ padding: '6px 9px', borderRadius: '8px' }}
                          title="Delete Project"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          {/* Mobile Card List */}
          <div className="mobile-cards-view" style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
            {filteredProjects.map((item) => (
              <div
                key={item.id}
                className="mobile-data-card"
                style={{ padding: '16px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <div>
                    <span className="badge badge-primary" style={{ fontSize: '0.7rem', marginBottom: '6px' }}>
                      {item.project_type || 'Academic Project'}
                    </span>
                    <div style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--text-primary)' }}>
                      {item.title}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    <button
                      onClick={() => handleTogglePublish(item)}
                      className={`badge ${item.is_published ? 'badge-success' : 'badge-warning'}`}
                      style={{ border: 'none', cursor: 'pointer', padding: '3px 8px', fontSize: '0.7rem' }}
                    >
                      {item.is_published ? 'Published' : 'Draft'}
                    </button>
                  </div>
                </div>

                {item.short_description && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                    {item.short_description}
                  </p>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  {item.branch_name && <span>{item.branch_name}</span>}
                  {item.batch && <span className="badge badge-gold" style={{ fontSize: '0.68rem' }}>Batch {item.batch}</span>}
                  {item.mentor_name && <span>Mentor: {item.mentor_name}</span>}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid var(--border-glass)', paddingTop: '10px' }}>
                  <button
                    onClick={() => setViewingProject(item)}
                    className="btn btn-secondary"
                    style={{ flex: 1, padding: '7px 10px', fontSize: '0.78rem', justifyContent: 'center' }}
                  >
                    <Eye size={13} /> View
                  </button>
                  <button
                    onClick={() => {
                      setEditingProject(item);
                      setIsFormOpen(true);
                    }}
                    className="btn btn-secondary"
                    style={{ flex: 1, padding: '7px 10px', fontSize: '0.78rem', justifyContent: 'center' }}
                  >
                    <Edit size={13} /> Edit
                  </button>
                  <button
                    onClick={() => handleDuplicate(item)}
                    className="btn btn-secondary"
                    style={{ padding: '7px 10px', fontSize: '0.78rem' }}
                    title="Duplicate"
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirmProject(item)}
                    className="btn btn-danger"
                    style={{ padding: '7px 10px', fontSize: '0.78rem' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modals */}
      <ProjectFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingProject(null);
        }}
        project={editingProject}
        branches={branches}
        existingProjects={projects}
        onSave={handleSaveSuccess}
      />

      <GoogleFormTemplateModal
        isOpen={isTemplateOpen}
        onClose={() => setIsTemplateOpen(false)}
      />

      <ProjectImportWizard
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        existingProjects={projects}
        onImportComplete={() => fetchProjects(true)}
      />

      <ProjectDetailsModal
        isOpen={Boolean(viewingProject)}
        onClose={() => setViewingProject(null)}
        project={viewingProject}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirmProject && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(5, 7, 12, 0.85)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '20px'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            width: '100%',
            maxWidth: '440px',
            padding: '30px',
            textAlign: 'center',
            border: '1px solid rgba(239,68,68,0.3)',
            boxShadow: '0 0 40px rgba(239,68,68,0.15)'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              margin: '0 auto 16px',
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--danger)'
            }}>
              <AlertTriangle size={26} />
            </div>

            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '8px', color: 'var(--text-primary)' }}>
              Delete Project Opportunity?
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
              Are you sure you want to permanently delete <strong>"{deleteConfirmProject.title}"</strong>? Students will no longer be able to view or apply for this project.
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => setDeleteConfirmProject(null)}
                className="btn btn-secondary"
                style={{ padding: '10px 20px', flex: 1 }}
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="btn btn-danger"
                style={{ padding: '10px 20px', flex: 1 }}
                disabled={deleteLoading}
              >
                {deleteLoading ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
