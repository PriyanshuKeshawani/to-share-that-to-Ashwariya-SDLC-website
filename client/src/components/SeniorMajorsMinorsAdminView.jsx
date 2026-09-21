"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  GraduationCap, Plus, Search, Edit, Trash2, 
  Eye, EyeOff, X, AlertTriangle, RefreshCw, 
  UserCheck, Layers, Sparkles 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import SeniorMajorsMinorsModal from './SeniorMajorsMinorsModal';
import EmptyState from './EmptyState';

export default function SeniorMajorsMinorsAdminView({
  branches = [],
  students = [],
  showFeedback
}) {
  const { apiCall } = useAuth();

  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedBatch, setSelectedBatch] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all'); // 'all' | 'published' | 'draft'

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);
  const [deleteConfirmProfile, setDeleteConfirmProfile] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [statusLoadingId, setStatusLoadingId] = useState(null);

  const fetchProfiles = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const data = await apiCall('/academic/majors-minors');
      setProfiles(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch senior profiles:', err);
      if (showFeedback) {
        showFeedback(err.message || 'Failed to load senior academic profiles', 'error');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiCall, showFeedback]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // Supabase Realtime Subscription for instant synchronization
  useEffect(() => {
    let channel = null;
    try {
      channel = supabase
        .channel(`admin-senior-profiles-sync-${Date.now()}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'senior_academic_profiles' },
          () => {
            fetchProfiles(true);
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('Realtime senior profiles subscribe notice:', e.message);
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [fetchProfiles]);

  // Collect unique batches for filtering
  const availableBatches = useMemo(() => {
    const set = new Set();
    profiles.forEach(p => {
      if (p.batch && p.batch.trim()) set.add(p.batch.trim());
    });
    return Array.from(set).sort().reverse();
  }, [profiles]);

  // Collect unique branches from records and branches prop
  const availableBranches = useMemo(() => {
    const map = new Map();
    branches.forEach(b => {
      if (b && b.name) map.set(b.name, b.name);
    });
    profiles.forEach(p => {
      if (p.branch_name && p.branch_name.trim()) {
        map.set(p.branch_name.trim(), p.branch_name.trim());
      }
    });
    return Array.from(map.values()).sort();
  }, [branches, profiles]);

  // Filter and search
  const filteredProfiles = useMemo(() => {
    return profiles.filter(item => {
      // Branch filter
      if (selectedBranch !== 'all' && item.branch_name !== selectedBranch) {
        return false;
      }

      // Batch filter
      if (selectedBatch !== 'all' && item.batch !== selectedBatch) {
        return false;
      }

      // Status filter
      if (selectedStatus === 'published' && !item.is_published) {
        return false;
      }
      if (selectedStatus === 'draft' && item.is_published) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const name = (item.full_name || '').toLowerCase();
        const roll = (item.roll_number || '').toLowerCase();
        const major = (item.major || '').toLowerCase();
        const minor = (item.minor || '').toLowerCase();
        const branch = (item.branch_name || '').toLowerCase();
        const batch = (item.batch || '').toLowerCase();

        return (
          name.includes(q) ||
          roll.includes(q) ||
          major.includes(q) ||
          minor.includes(q) ||
          branch.includes(q) ||
          batch.includes(q)
        );
      }

      return true;
    });
  }, [profiles, selectedBranch, selectedBatch, selectedStatus, searchTerm]);

  // Handlers
  const handleOpenAdd = () => {
    setEditingProfile(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (prof) => {
    setEditingProfile(prof);
    setIsModalOpen(true);
  };

  const handleTogglePublish = async (prof) => {
    if (statusLoadingId) return;
    try {
      setStatusLoadingId(prof.id);
      const action = prof.is_published ? 'unpublish' : 'publish';
      await apiCall(`/academic/majors-minors/${prof.id}/${action}`, { method: 'POST' });
      
      setProfiles(prev => prev.map(p => 
        p.id === prof.id ? { ...p, is_published: !prof.is_published } : p
      ));

      if (showFeedback) {
        showFeedback(`Profile ${!prof.is_published ? 'published' : 'unpublished'} successfully`, 'success');
      }
    } catch (err) {
      console.error('Failed to toggle publish status:', err);
      if (showFeedback) {
        showFeedback(err.message || 'Failed to update publish status', 'error');
      }
    } finally {
      setStatusLoadingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmProfile) return;
    try {
      setDeleteLoading(true);
      await apiCall(`/academic/majors-minors/${deleteConfirmProfile.id}`, { method: 'DELETE' });
      
      setProfiles(prev => prev.filter(p => p.id !== deleteConfirmProfile.id));
      if (showFeedback) {
        showFeedback('Senior profile deleted successfully', 'success');
      }
      setDeleteConfirmProfile(null);
    } catch (err) {
      console.error('Failed to delete profile:', err);
      if (showFeedback) {
        showFeedback(err.message || 'Failed to delete profile', 'error');
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSaveSuccess = (savedItem) => {
    setProfiles(prev => {
      const idx = prev.findIndex(p => p.id === savedItem.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = savedItem;
        return next;
      }
      return [savedItem, ...prev];
    });
    setIsModalOpen(false);
    setEditingProfile(null);
    if (showFeedback) {
      showFeedback(
        editingProfile ? 'Senior record updated successfully' : 'New senior specialization profile created',
        'success'
      );
    }
  };

  return (
    <div className="animate-section-enter">
      {/* Header Section */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 50%, #93c5fd 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Majors & Minors Directory
            </h2>
            <span className="badge badge-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
              <GraduationCap size={14} /> {profiles.length} Senior Records
            </span>
          </div>
          <p style={{ marginTop: '6px', color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '780px', lineHeight: 1.5 }}>
            Maintain senior students' academic Major & Minor specializations to empower junior students with guidance, peer networking, and specialization clarity.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => fetchProfiles(true)}
            className="btn btn-secondary"
            disabled={refreshing || loading}
            title="Refresh Directory"
            style={{ padding: '10px 14px', borderRadius: '10px' }}
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            <span className="hide-on-mobile">Sync</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="btn btn-primary btn-shine"
            style={{ padding: '10px 20px', borderRadius: '10px', fontWeight: 700, gap: '8px' }}
          >
            <Plus size={16} /> Add Senior Record
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="glass-panel" style={{ padding: '18px 20px', marginBottom: '24px', borderRadius: '14px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px',
          alignItems: 'center'
        }}>
          {/* Search Box */}
          <div style={{ position: 'relative', gridColumn: '1 / -1' }} className="majors-search-col">
            <div style={{ position: 'relative' }}>
              <Search 
                size={16} 
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                  zIndex: 2
                }} 
              />
              <input
                type="text"
                className="glass-input has-search-icon"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by student name, roll number, major, or minor..."
                style={{ paddingLeft: '42px', paddingRight: searchTerm ? '38px' : '14px', width: '100%', height: '42px', fontSize: '0.88rem' }}
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
                    padding: '4px',
                    zIndex: 2
                  }}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Branch Filter */}
          <div>
            <select
              className="glass-input glass-select"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              style={{ width: '100%', height: '42px', fontSize: '0.86rem' }}
            >
              <option value="all">All Departments / Branches</option>
              {availableBranches.map(br => (
                <option key={br} value={br}>{br}</option>
              ))}
            </select>
          </div>

          {/* Batch Filter */}
          <div>
            <select
              className="glass-input glass-select"
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              style={{ width: '100%', height: '42px', fontSize: '0.86rem' }}
            >
              <option value="all">All Batches / Years</option>
              {availableBatches.map(b => (
                <option key={b} value={b}>Batch {b}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              className="glass-input glass-select"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{ width: '100%', height: '42px', fontSize: '0.86rem' }}
            >
              <option value="all">All Status ({profiles.length})</option>
              <option value="published">Published Only ({profiles.filter(p => p.is_published).length})</option>
              <option value="draft">Drafts Only ({profiles.filter(p => !p.is_published).length})</option>
            </select>
          </div>
        </div>

        {/* Filter Summary Bar */}
        {(searchTerm || selectedBranch !== 'all' || selectedBatch !== 'all' || selectedStatus !== 'all') && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '14px',
            paddingTop: '12px',
            borderTop: '1px solid var(--border-glass)',
            fontSize: '0.82rem',
            color: 'var(--text-secondary)',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span>Filtering results:</span>
              {searchTerm && <span className="badge badge-secondary">Keyword: "{searchTerm}"</span>}
              {selectedBranch !== 'all' && <span className="badge badge-primary">Branch: {selectedBranch}</span>}
              {selectedBatch !== 'all' && <span className="badge badge-gold">Batch: {selectedBatch}</span>}
              {selectedStatus !== 'all' && (
                <span className={`badge ${selectedStatus === 'published' ? 'badge-success' : 'badge-warning'}`}>
                  Status: {selectedStatus === 'published' ? 'Published' : 'Drafts'}
                </span>
              )}
            </div>

            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedBranch('all');
                setSelectedBatch('all');
                setSelectedStatus('all');
              }}
              className="btn btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.76rem' }}
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
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading senior academic directory...</p>
        </div>
      ) : filteredProfiles.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title={profiles.length === 0 ? "No Senior Profiles Added Yet" : "No Matching Records Found"}
          description={
            profiles.length === 0
              ? "Start by adding the first senior student and their Major / Minor specializations to guide your college students."
              : "Try adjusting your search keywords, branch selection, or status filters."
          }
          actionLabel={profiles.length === 0 ? "Add First Senior Record" : "Clear All Filters"}
          onAction={profiles.length === 0 ? handleOpenAdd : () => {
            setSearchTerm('');
            setSelectedBranch('all');
            setSelectedBatch('all');
            setSelectedStatus('all');
          }}
        />
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="desktop-table-view" style={{ marginBottom: '24px' }}>
            <div className="table-responsive-wrapper">
              <table className="custom-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', minWidth: '180px' }}>Senior Student</th>
                    <th style={{ textAlign: 'left', minWidth: '120px' }}>Roll / BT No.</th>
                    <th style={{ textAlign: 'left', minWidth: '140px' }}>Branch & Batch</th>
                    <th style={{ textAlign: 'left', minWidth: '160px' }}>Major Specialization</th>
                    <th style={{ textAlign: 'left', minWidth: '160px' }}>Minor Specialization</th>
                    <th style={{ textAlign: 'center', minWidth: '100px' }}>Status</th>
                    <th style={{ textAlign: 'right', minWidth: '130px' }} className="sticky-action-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProfiles.map((item) => (
                    <tr key={item.id} style={{ transition: 'background 0.2s' }}>
                      {/* Student Name */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '36px', height: '36px', borderRadius: '10px',
                            background: 'linear-gradient(135deg, rgba(37,99,235,0.2), rgba(14,165,233,0.15))',
                            border: '1px solid rgba(37,99,235,0.3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#60a5fa', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0
                          }}>
                            {item.full_name ? item.full_name.charAt(0).toUpperCase() : 'S'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                              {item.full_name}
                            </div>
                            {item.student_user_id ? (
                              <span style={{ fontSize: '0.72rem', color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <UserCheck size={11} /> Linked User
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                Manual Entry
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Roll Number */}
                      <td>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                          {item.roll_number || '—'}
                        </div>
                      </td>

                      {/* Branch & Batch */}
                      <td>
                        <div>
                          <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {item.branch_name || 'General'}
                          </div>
                          {item.batch && (
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                              Batch {item.batch}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Major Specialization */}
                      <td>
                        <span className="badge badge-primary" style={{ padding: '4px 10px', fontSize: '0.78rem', fontWeight: 700 }}>
                          <Sparkles size={12} /> {item.major}
                        </span>
                      </td>

                      {/* Minor Specialization */}
                      <td>
                        <span className="badge badge-secondary" style={{ padding: '4px 10px', fontSize: '0.78rem', fontWeight: 700 }}>
                          <Layers size={12} /> {item.minor}
                        </span>
                      </td>

                      {/* Published Status */}
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => handleTogglePublish(item)}
                          disabled={statusLoadingId === item.id}
                          className={`badge ${item.is_published ? 'badge-success' : 'badge-warning'}`}
                          style={{
                            cursor: 'pointer',
                            border: 'none',
                            padding: '5px 10px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            transition: 'transform 0.15s ease'
                          }}
                          title={item.is_published ? 'Click to unpublish (hide from students)' : 'Click to publish (make visible to students)'}
                        >
                          {statusLoadingId === item.id ? (
                            <RefreshCw size={12} className="animate-spin" />
                          ) : item.is_published ? (
                            <>
                              <Eye size={12} /> Published
                            </>
                          ) : (
                            <>
                              <EyeOff size={12} /> Draft
                            </>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }} className="sticky-action-col">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="btn btn-secondary"
                            style={{ padding: '6px 10px', borderRadius: '8px' }}
                            title="Edit Profile"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmProfile(item)}
                            className="btn btn-danger"
                            style={{ padding: '6px 10px', borderRadius: '8px' }}
                            title="Delete Record"
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

          {/* Mobile Cards View */}
          <div className="mobile-cards-view" style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
            {filteredProfiles.map((item) => (
              <div
                key={item.id}
                className="mobile-data-card"
                style={{
                  padding: '16px',
                  borderRadius: '14px',
                  border: '1px solid var(--border-glass)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                {/* Header: Name + Status */}
                <div className="mobile-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '10px',
                      background: 'linear-gradient(135deg, rgba(37,99,235,0.25), rgba(14,165,233,0.15))',
                      color: '#60a5fa', fontWeight: 700, fontSize: '0.9rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      {item.full_name ? item.full_name.charAt(0).toUpperCase() : 'S'}
                    </div>
                    <div>
                      <div className="mobile-card-title">
                        {item.full_name}
                      </div>
                      <div className="mobile-card-subtitle">
                        {item.branch_name || 'General Branch'} {item.batch ? `• Batch ${item.batch}` : ''}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleTogglePublish(item)}
                    disabled={statusLoadingId === item.id}
                    className={`badge ${item.is_published ? 'badge-success' : 'badge-warning'}`}
                    style={{ border: 'none', cursor: 'pointer', padding: '4px 8px', fontSize: '0.72rem' }}
                  >
                    {item.is_published ? <><Eye size={11} /> Published</> : <><EyeOff size={11} /> Draft</>}
                  </button>
                </div>

                {/* Roll & Linked Tag */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                  {item.roll_number && (
                    <span>Roll: <strong style={{ fontFamily: 'monospace' }}>{item.roll_number}</strong></span>
                  )}
                  {item.student_user_id && (
                    <span className="badge badge-success" style={{ padding: '2px 6px', fontSize: '0.68rem' }}>
                      <UserCheck size={10} /> Linked Student
                    </span>
                  )}
                </div>

                {/* Major & Minor Tags */}
                <div style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-glass)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>MAJOR:</span>
                    <span className="badge badge-primary" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                      {item.major}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>MINOR:</span>
                    <span className="badge badge-secondary" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                      {item.minor}
                    </span>
                  </div>
                </div>

                {/* Notes if present */}
                {item.description && (
                  <p style={{
                    fontSize: '0.78rem',
                    color: 'var(--text-secondary)',
                    margin: 0,
                    lineHeight: 1.4,
                    background: 'rgba(255,255,255,0.02)',
                    padding: '8px 10px',
                    borderRadius: '8px'
                  }}>
                    {item.description}
                  </p>
                )}

                {/* Action Buttons */}
                <div className="mobile-card-actions">
                  <button
                    onClick={() => handleOpenEdit(item)}
                    className="btn btn-secondary"
                    style={{ flex: 1, padding: '8px 12px', fontSize: '0.82rem', justifyContent: 'center' }}
                  >
                    <Edit size={14} /> Edit Record
                  </button>
                  <button
                    onClick={() => setDeleteConfirmProfile(item)}
                    className="btn btn-danger"
                    style={{ padding: '8px 12px', fontSize: '0.82rem' }}
                    title="Delete Record"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Add / Edit Senior Modal */}
      <SeniorMajorsMinorsModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingProfile(null);
        }}
        profile={editingProfile}
        branches={branches}
        students={students}
        existingProfiles={profiles}
        onSave={handleSaveSuccess}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirmProfile && (
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
              Delete Senior Profile?
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
              Are you sure you want to remove <strong>{deleteConfirmProfile.full_name}</strong> from the Senior Majors & Minors Directory? This action cannot be undone.
            </p>

            <div style={{
              padding: '12px',
              borderRadius: '10px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-glass)',
              marginBottom: '20px',
              textAlign: 'left',
              fontSize: '0.82rem'
            }}>
              <div><strong>Major:</strong> {deleteConfirmProfile.major}</div>
              <div><strong>Minor:</strong> {deleteConfirmProfile.minor}</div>
              <div><strong>Branch:</strong> {deleteConfirmProfile.branch_name || 'General'}</div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => setDeleteConfirmProfile(null)}
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
