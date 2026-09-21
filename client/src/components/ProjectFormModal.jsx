"use client";

import { useState, useEffect } from 'react';
import { 
  X, Upload, Image as ImageIcon, Plus, Trash2, Globe, Github, 
  Linkedin, Users, AlertCircle, Check, Loader2, Sparkles
} from 'lucide-react';
import { supabase } from '../supabaseClient';

export const PROJECT_TYPES = [
  'Academic Project',
  'Major Project',
  'Minor Project',
  'Research Project',
  'Internship Project',
  'Hackathon / Competition',
  'Faculty Project',
  'Industry Project',
  'Open Source / Innovation',
  'Other'
];

export default function ProjectFormModal({
  isOpen,
  onClose,
  project = null,
  branches = [],
  onSave
}) {
  const isEditing = Boolean(project && project.id);

  const [title, setTitle] = useState('');
  const [projectType, setProjectType] = useState('Major Project');
  const [imageUrl, setImageUrl] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [isPublished, setIsPublished] = useState(true);

  // Dynamic team members
  const [teamMembers, setTeamMembers] = useState([
    { name: '', linkedin_url: '', branch: '', passout_year: '' }
  ]);

  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    if (project && project.id) {
      setTitle(project.title || '');
      setProjectType(project.project_type || 'Major Project');
      setImageUrl(project.image_url || '');
      setShortDescription(project.short_description || project.description || '');
      setLiveUrl(project.live_url || project.application_url || '');
      setGithubUrl(project.github_url || project.resource_url || '');
      setIsPublished(project.is_published !== undefined ? Boolean(project.is_published) : true);

      // Handle team members
      if (Array.isArray(project.team_members) && project.team_members.length > 0) {
        setTeamMembers(project.team_members.map(m => ({
          name: m.name || '',
          linkedin_url: m.linkedin_url || '',
          branch: m.branch || project.branch_name || '',
          passout_year: m.passout_year || project.batch || ''
        })));
      } else if (project.branch_name || project.batch) {
        setTeamMembers([{
          name: '',
          linkedin_url: '',
          branch: project.branch_name || '',
          passout_year: project.batch || ''
        }]);
      } else {
        setTeamMembers([{ name: '', linkedin_url: '', branch: '', passout_year: '' }]);
      }
    } else {
      setTitle('');
      setProjectType('Major Project');
      setImageUrl('');
      setShortDescription('');
      setLiveUrl('');
      setGithubUrl('');
      setIsPublished(true);
      setTeamMembers([{ name: '', linkedin_url: '', branch: '', passout_year: '' }]);
    }
    setError('');
  }, [isOpen, project]);

  if (!isOpen) return null;

  // Handle image upload to Supabase Storage
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, WebP, etc.).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image file size should be less than 5MB.');
      return;
    }

    setUploadingImage(true);
    setError('');

    try {
      const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `project_covers/${Date.now()}_${cleanName}`;

      // Try uploading to 'pdfs' or storage bucket
      let uploadBucket = 'pdfs';
      let { error: upErr } = await supabase.storage
        .from(uploadBucket)
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type
        });

      if (upErr) {
        // Fallback to direct root path
        const fallbackPath = `${Date.now()}_${cleanName}`;
        const { error: fbErr } = await supabase.storage
          .from('pdfs')
          .upload(fallbackPath, file, {
            cacheControl: '3600',
            upsert: true,
            contentType: file.type
          });
        if (fbErr) throw fbErr;
        const { data: fbUrl } = supabase.storage.from('pdfs').getPublicUrl(fallbackPath);
        if (fbUrl?.publicUrl) {
          setImageUrl(fbUrl.publicUrl);
          return;
        }
      }

      const { data: publicUrlData } = supabase.storage.from(uploadBucket).getPublicUrl(storagePath);
      if (publicUrlData?.publicUrl) {
        setImageUrl(publicUrlData.publicUrl);
      }
    } catch (err) {
      console.error('Image upload failed:', err);
      setError(`Image upload error: ${err.message || 'Storage error'}. You can paste an image URL directly.`);
    } finally {
      setUploadingImage(false);
    }
  };

  // Team member controls
  const handleMemberChange = (index, field, value) => {
    setTeamMembers(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddMember = () => {
    setTeamMembers(prev => [
      ...prev,
      { name: '', linkedin_url: '', branch: '', passout_year: '' }
    ]);
  };

  const handleRemoveMember = (index) => {
    if (teamMembers.length <= 1) return;
    setTeamMembers(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('Please enter the project title.');
      return;
    }

    // Filter out completely blank team members
    const validMembers = teamMembers
      .map(m => ({
        name: (m.name || '').trim(),
        linkedin_url: (m.linkedin_url || '').trim(),
        branch: (m.branch || '').trim(),
        passout_year: (m.passout_year || '').trim()
      }))
      .filter(m => m.name || m.branch || m.passout_year || m.linkedin_url);

    const primaryMember = validMembers[0] || {};

    const payload = {
      title: cleanTitle,
      project_type: projectType,
      image_url: imageUrl.trim() || null,
      short_description: shortDescription.trim() || null,
      description: shortDescription.trim() || null,
      team_members: validMembers,
      branch_name: primaryMember.branch || null,
      batch: primaryMember.passout_year || null,
      live_url: liveUrl.trim() || null,
      github_url: githubUrl.trim() || null,
      is_published: isPublished
    };

    setSaving(true);
    try {
      await onSave(payload);
      onClose();
    } catch (err) {
      console.error('Failed to save project:', err);
      setError(err.message || 'Failed to save project. Please check your connection.');
    } finally {
      setSaving(false);
    }
  };

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
          maxWidth: '720px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '20px',
          background: 'var(--bg-card, #121622)',
          border: '1px solid var(--border-glass, rgba(255,255,255,0.1))',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-glass, rgba(255,255,255,0.08))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2))',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary, #6366f1)'
            }}>
              <Sparkles size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                {isEditing ? 'Edit Project' : 'Add New Project'}
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                Showcase academic, minor, major & innovation projects with your team
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: 'none',
              borderRadius: '10px',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {error && (
              <div style={{
                padding: '12px 16px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Title & Category Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Project Title <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. AI-Powered Smart Library Portal"
                  className="glass-input"
                  style={{ width: '100%', height: '44px', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Project Type / Category <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={projectType}
                  onChange={(e) => setProjectType(e.target.value)}
                  className="glass-input"
                  style={{ width: '100%', height: '44px', fontSize: '0.9rem' }}
                >
                  {PROJECT_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Project Cover Image */}
            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Project Cover Image / Screenshot
              </label>
              
              <div className="project-cover-grid">
                {imageUrl && (
                  <div style={{
                    position: 'relative',
                    width: '160px',
                    height: '100px',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '1px solid var(--border-glass)',
                    background: 'rgba(0,0,0,0.3)'
                  }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt="Project Cover Preview"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      style={{
                        position: 'absolute',
                        top: '6px',
                        right: '6px',
                        background: 'rgba(0,0,0,0.7)',
                        border: 'none',
                        color: 'white',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                      title="Remove image"
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <input
                        type="url"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        placeholder="Paste image URL (https://...)"
                        className="glass-input"
                        style={{ width: '100%', height: '42px', fontSize: '0.85rem' }}
                      />
                    </div>

                    <label
                      className="btn btn-secondary"
                      style={{
                        padding: '0 16px',
                        height: '42px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: uploadingImage ? 'not-allowed' : 'pointer',
                        whiteSpace: 'nowrap',
                        fontSize: '0.84rem'
                      }}
                    >
                      {uploadingImage ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                      <span>{uploadingImage ? 'Uploading...' : 'Upload File'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        disabled={uploadingImage}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Upload banner (PNG/JPG up to 5MB) or provide a Cloudflare/Supabase public link.
                  </span>
                </div>
              </div>
            </div>

            {/* Short Description */}
            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Short Description
              </label>
              <textarea
                rows={3}
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="Brief summary of what the project does, key innovations, and technologies used..."
                className="glass-input"
                style={{ width: '100%', padding: '12px', fontSize: '0.88rem', resize: 'vertical' }}
              />
            </div>

            {/* Team Members Section */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={16} style={{ color: 'var(--primary, #6366f1)' }} />
                  <span>Team Members (Students & Profiles)</span>
                </label>
                <button
                  type="button"
                  onClick={handleAddMember}
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Plus size={14} /> Add Member
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {teamMembers.map((member, index) => (
                  <div
                    key={index}
                    className="project-member-input-row"
                  >
                    <div className="project-member-name-col">
                      <input
                        type="text"
                        value={member.name}
                        onChange={(e) => handleMemberChange(index, 'name', e.target.value)}
                        placeholder="Student Name *"
                        className="glass-input"
                        style={{ width: '100%', height: '36px', fontSize: '0.82rem' }}
                      />
                    </div>

                    <div>
                      <input
                        type="text"
                        value={member.branch}
                        onChange={(e) => handleMemberChange(index, 'branch', e.target.value)}
                        placeholder="Branch (e.g. CSE)"
                        list={`branches-list-${index}`}
                        className="glass-input"
                        style={{ width: '100%', height: '36px', fontSize: '0.82rem' }}
                      />
                      <datalist id={`branches-list-${index}`}>
                        {branches.map((b, bi) => (
                          <option key={bi} value={b.name || b.code || b} />
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <input
                        type="text"
                        value={member.passout_year}
                        onChange={(e) => handleMemberChange(index, 'passout_year', e.target.value)}
                        placeholder="Batch / Year"
                        className="glass-input"
                        style={{ width: '100%', height: '36px', fontSize: '0.82rem' }}
                      />
                    </div>

                    <div className="project-member-linkedin-col" style={{ position: 'relative' }}>
                      <Linkedin size={13} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#0a66c2' }} />
                      <input
                        type="url"
                        value={member.linkedin_url}
                        onChange={(e) => handleMemberChange(index, 'linkedin_url', e.target.value)}
                        placeholder="LinkedIn Profile URL"
                        className="glass-input"
                        style={{ width: '100%', height: '36px', fontSize: '0.82rem', paddingLeft: '26px' }}
                      />
                    </div>

                    <div className="project-member-del-btn">
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(index)}
                        disabled={teamMembers.length <= 1}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: teamMembers.length <= 1 ? 'rgba(255,255,255,0.1)' : '#f87171',
                          cursor: teamMembers.length <= 1 ? 'not-allowed' : 'pointer',
                          padding: '6px'
                        }}
                        title="Remove member"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Links Row (Live Demo & GitHub) */}
            <div className="project-links-grid">
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  <Globe size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle', color: 'var(--primary, #6366f1)' }} />
                  Live Deployment / Demo Link
                </label>
                <input
                  type="url"
                  value={liveUrl}
                  onChange={(e) => setLiveUrl(e.target.value)}
                  placeholder="https://myproject.vercel.app"
                  className="glass-input"
                  style={{ width: '100%', height: '42px', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  <Github size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                  GitHub Repository Link
                </label>
                <input
                  type="url"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/user/repository"
                  className="glass-input"
                  style={{ width: '100%', height: '42px', fontSize: '0.88rem' }}
                />
              </div>
            </div>

            {/* Published Toggle */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-glass)'
            }}>
              <div>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Publish to Student Gallery
                </span>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                  When enabled, this project will appear in the public & student project showcase.
                </p>
              </div>

              <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: isPublished ? 'var(--primary, #6366f1)' : 'rgba(255,255,255,0.2)',
                  borderRadius: '24px',
                  transition: '0.3s'
                }}>
                  <span style={{
                    position: 'absolute',
                    content: '""',
                    height: '18px',
                    width: '18px',
                    left: isPublished ? '22px' : '3px',
                    bottom: '3px',
                    backgroundColor: 'white',
                    borderRadius: '50%',
                    transition: '0.3s'
                  }} />
                </span>
              </label>
            </div>
          </div>

          {/* Modal Footer */}
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-glass, rgba(255,255,255,0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
            background: 'rgba(255, 255, 255, 0.02)'
          }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={saving}
              style={{ padding: '8px 20px', fontSize: '0.88rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || uploadingImage}
              style={{ padding: '8px 24px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              <span>{saving ? 'Saving...' : isEditing ? 'Update Project' : 'Publish Project'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
