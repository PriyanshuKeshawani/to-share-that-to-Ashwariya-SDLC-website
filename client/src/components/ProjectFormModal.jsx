"use client";

import { useState, useEffect, useMemo } from 'react';
import { 
  X, AlertCircle, AlertTriangle, Check, Rocket
} from 'lucide-react';

const COMMON_PROJECT_TYPES = [
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
  existingProjects = [],
  onSave
}) {
  const isEditing = Boolean(project && project.id);

  const [formData, setFormData] = useState({
    title: '',
    short_description: '',
    description: '',
    project_type: 'Academic Project',
    custom_type: '',
    department: '',
    branch_name: '',
    eligibility: '',
    required_skills: '',
    major: '',
    minor: '',
    batch: '',
    team_size: '',
    mentor_name: '',
    organization: '',
    application_mode: 'google_form',
    application_deadline: '',
    google_form_url: '',
    application_url: '',
    resource_url: '',
    contact_name: '',
    contact_email: '',
    is_published: false,
    is_active: true,
    sort_order: 0
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState('basic'); // 'basic' | 'requirements' | 'application' | 'settings'

  useEffect(() => {
    if (project && project.id) {
      const isCustomType = !COMMON_PROJECT_TYPES.includes(project.project_type);
      setFormData({
        title: project.title || '',
        short_description: project.short_description || '',
        description: project.description || '',
        project_type: isCustomType ? 'Other' : (project.project_type || 'Academic Project'),
        custom_type: isCustomType ? project.project_type : '',
        department: project.department || '',
        branch_name: project.branch_name || '',
        eligibility: project.eligibility || '',
        required_skills: project.required_skills || '',
        major: project.major || '',
        minor: project.minor || '',
        batch: project.batch || '',
        team_size: project.team_size || '',
        mentor_name: project.mentor_name || '',
        organization: project.organization || '',
        application_mode: project.application_mode || 'google_form',
        application_deadline: project.application_deadline ? new Date(project.application_deadline).toISOString().split('T')[0] : '',
        google_form_url: project.google_form_url || '',
        application_url: project.application_url || '',
        resource_url: project.resource_url || '',
        contact_name: project.contact_name || '',
        contact_email: project.contact_email || '',
        is_published: Boolean(project.is_published),
        is_active: project.is_active !== undefined ? Boolean(project.is_active) : true,
        sort_order: typeof project.sort_order === 'number' ? project.sort_order : 0
      });
    } else {
      setFormData({
        title: '',
        short_description: '',
        description: '',
        project_type: 'Academic Project',
        custom_type: '',
        department: '',
        branch_name: '',
        eligibility: '',
        required_skills: '',
        major: '',
        minor: '',
        batch: '',
        team_size: '',
        mentor_name: '',
        organization: '',
        application_mode: 'google_form',
        application_deadline: '',
        google_form_url: '',
        application_url: '',
        resource_url: '',
        contact_name: '',
        contact_email: '',
        is_published: false,
        is_active: true,
        sort_order: 0
      });
    }
    setError('');
    setDuplicateWarning(false);
    setActiveFormTab('basic');
  }, [project, isOpen]);

  // Duplicate detection by same title + branch + batch
  const duplicateMatch = useMemo(() => {
    const trimmedTitle = formData.title.trim().toLowerCase();
    const trimmedBranch = formData.branch_name.trim().toLowerCase();
    const trimmedBatch = formData.batch.trim().toLowerCase();

    if (!trimmedTitle) return null;

    return existingProjects.find(p => {
      if (isEditing && p.id === project.id) return false;
      const t = (p.title || '').trim().toLowerCase();
      const br = (p.branch_name || '').trim().toLowerCase();
      const ba = (p.batch || '').trim().toLowerCase();

      return t === trimmedTitle && br === trimmedBranch && ba === trimmedBatch;
    });
  }, [formData.title, formData.branch_name, formData.batch, existingProjects, isEditing, project]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const title = formData.title.trim();
    if (!title) {
      setError('Project title is required.');
      setActiveFormTab('basic');
      return;
    }

    if (duplicateMatch && !duplicateWarning) {
      setDuplicateWarning(true);
      return;
    }

    const resolvedType = formData.project_type === 'Other' && formData.custom_type.trim()
      ? formData.custom_type.trim()
      : formData.project_type;

    const payload = {
      title,
      short_description: formData.short_description.trim() || null,
      description: formData.description.trim() || null,
      project_type: resolvedType || 'Academic Project',
      department: formData.department.trim() || null,
      branch_name: formData.branch_name.trim() || null,
      eligibility: formData.eligibility.trim() || null,
      required_skills: formData.required_skills.trim() || null,
      major: formData.major.trim() || null,
      minor: formData.minor.trim() || null,
      batch: formData.batch.trim() || null,
      team_size: formData.team_size.trim() || null,
      mentor_name: formData.mentor_name.trim() || null,
      organization: formData.organization.trim() || null,
      application_mode: formData.application_mode.trim() || 'google_form',
      application_deadline: formData.application_deadline ? new Date(formData.application_deadline).toISOString() : null,
      google_form_url: formData.google_form_url.trim() || null,
      application_url: formData.application_url.trim() || null,
      resource_url: formData.resource_url.trim() || null,
      contact_name: formData.contact_name.trim() || null,
      contact_email: formData.contact_email.trim() || null,
      is_published: Boolean(formData.is_published),
      is_active: Boolean(formData.is_active),
      sort_order: Number(formData.sort_order) || 0
    };

    try {
      setSaving(true);
      await onSave(payload, project ? project.id : null);
    } catch (err) {
      console.error('Error saving project:', err);
      setError(err.message || 'Failed to save project. Please check the fields.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(5, 7, 12, 0.85)',
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
          maxWidth: '760px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '18px',
          border: '1px solid var(--border-glass)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 30px var(--primary-glow)',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-glass)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px', height: '42px', borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(37,99,235,0.2), rgba(14,165,233,0.15))',
              border: '1px solid rgba(37,99,235,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--primary)'
            }}>
              <Rocket size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {isEditing ? 'Edit Project / Opportunity' : 'Add New Project / Opportunity'}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Maintain project opportunities, research initiatives, and hackathons with application links.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '8px', borderRadius: '10px' }}
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Switcher for Clean Organization */}
        <div style={{
          display: 'flex',
          gap: '6px',
          padding: '10px 24px',
          borderBottom: '1px solid var(--border-glass)',
          background: 'rgba(255, 255, 255, 0.01)',
          overflowX: 'auto'
        }}>
          {[
            { id: 'basic', label: '1. Basic Info' },
            { id: 'requirements', label: '2. Skills & Criteria' },
            { id: 'application', label: '3. Application & Links' },
            { id: 'settings', label: '4. Status & Order' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFormTab(tab.id)}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: activeFormTab === tab.id ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
                color: activeFormTab === tab.id ? '#ffffff' : 'var(--text-secondary)',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
            
            {/* Error Message */}
            {error && (
              <div style={{
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '18px'
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Duplicate Warning */}
            {duplicateMatch && (
              <div style={{
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                color: '#f59e0b',
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                marginBottom: '18px'
              }}>
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Potential Duplicate Detected:</strong> A project with the same title ("{duplicateMatch.title}") already exists for this branch/batch. Click <strong>"Confirm & Save"</strong> below if you still wish to proceed.
                </div>
              </div>
            )}

            {/* TAB 1: BASIC INFO */}
            {activeFormTab === 'basic' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Title */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Project / Opportunity Title <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={250}
                    className="glass-input"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. AI-Powered Autonomous Campus Navigation Robot"
                    style={{ width: '100%', height: '42px', fontSize: '0.9rem' }}
                  />
                </div>

                {/* Project Type & Branch Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                  {/* Project Type */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Project Type
                    </label>
                    <select
                      className="glass-input"
                      value={formData.project_type}
                      onChange={(e) => setFormData({ ...formData, project_type: e.target.value })}
                      style={{ width: '100%', height: '42px', fontSize: '0.88rem' }}
                    >
                      {COMMON_PROJECT_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>

                    {formData.project_type === 'Other' && (
                      <input
                        type="text"
                        placeholder="Enter custom project type..."
                        className="glass-input"
                        value={formData.custom_type}
                        onChange={(e) => setFormData({ ...formData, custom_type: e.target.value })}
                        style={{ width: '100%', height: '38px', marginTop: '6px', fontSize: '0.84rem' }}
                      />
                    )}
                  </div>

                  {/* Branch / Department */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Branch / Department
                    </label>
                    <input
                      type="text"
                      list="project-branches-list"
                      className="glass-input"
                      value={formData.branch_name}
                      onChange={(e) => setFormData({ ...formData, branch_name: e.target.value })}
                      placeholder="e.g. Computer Science and Engineering"
                      style={{ width: '100%', height: '42px', fontSize: '0.88rem' }}
                    />
                    <datalist id="project-branches-list">
                      {branches.map(b => (
                        <option key={b.id || b.name} value={b.name} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {/* Batch & Team Size Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Batch / Academic Year
                    </label>
                    <input
                      type="text"
                      className="glass-input"
                      value={formData.batch}
                      onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                      placeholder="e.g. 2023-2027 or Final Year"
                      style={{ width: '100%', height: '42px', fontSize: '0.88rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Team Size
                    </label>
                    <input
                      type="text"
                      className="glass-input"
                      value={formData.team_size}
                      onChange={(e) => setFormData({ ...formData, team_size: e.target.value })}
                      placeholder="e.g. 2-4 Members, Individual"
                      style={{ width: '100%', height: '42px', fontSize: '0.88rem' }}
                    />
                  </div>
                </div>

                {/* Short Description */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Short Description (Card Summary)
                    </label>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{formData.short_description.length}/500</span>
                  </div>
                  <textarea
                    rows={2}
                    maxLength={500}
                    className="glass-input"
                    value={formData.short_description}
                    onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
                    placeholder="Brief 1-2 sentence overview visible on the project card..."
                    style={{ width: '100%', padding: '10px 14px', fontSize: '0.88rem', resize: 'vertical' }}
                  />
                </div>

                {/* Full Description */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Full Project Description & Scope
                    </label>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{formData.description.length}/5000</span>
                  </div>
                  <textarea
                    rows={4}
                    maxLength={5000}
                    className="glass-input"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Provide details on project deliverables, methodologies, hardware/software involved, and expected learning outcomes..."
                    style={{ width: '100%', padding: '10px 14px', fontSize: '0.88rem', resize: 'vertical' }}
                  />
                </div>
              </div>
            )}

            {/* TAB 2: SKILLS & CRITERIA */}
            {activeFormTab === 'requirements' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Required Skills */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Required Technical Skills / Tech Stack
                  </label>
                  <input
                    type="text"
                    maxLength={1000}
                    className="glass-input"
                    value={formData.required_skills}
                    onChange={(e) => setFormData({ ...formData, required_skills: e.target.value })}
                    placeholder="e.g. Python, ROS, Computer Vision, OpenCV, PyTorch"
                    style={{ width: '100%', height: '42px', fontSize: '0.9rem' }}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Comma-separated list of programming languages, libraries, tools, or concepts.
                  </span>
                </div>

                {/* Major & Minor Specialization Fit */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Recommended Major Specialization
                    </label>
                    <input
                      type="text"
                      className="glass-input"
                      value={formData.major}
                      onChange={(e) => setFormData({ ...formData, major: e.target.value })}
                      placeholder="e.g. Artificial Intelligence & DS"
                      style={{ width: '100%', height: '42px', fontSize: '0.88rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Recommended Minor Specialization
                    </label>
                    <input
                      type="text"
                      className="glass-input"
                      value={formData.minor}
                      onChange={(e) => setFormData({ ...formData, minor: e.target.value })}
                      placeholder="e.g. Robotics & Automation"
                      style={{ width: '100%', height: '42px', fontSize: '0.88rem' }}
                    />
                  </div>
                </div>

                {/* Eligibility Criteria */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Eligibility Criteria
                  </label>
                  <input
                    type="text"
                    maxLength={500}
                    className="glass-input"
                    value={formData.eligibility}
                    onChange={(e) => setFormData({ ...formData, eligibility: e.target.value })}
                    placeholder="e.g. Open to 3rd & 4th year CSE/IT students with min 6.5 CGPA"
                    style={{ width: '100%', height: '42px', fontSize: '0.88rem' }}
                  />
                </div>

                {/* Mentor & Organization */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Faculty Mentor / Lead
                    </label>
                    <input
                      type="text"
                      className="glass-input"
                      value={formData.mentor_name}
                      onChange={(e) => setFormData({ ...formData, mentor_name: e.target.value })}
                      placeholder="e.g. Dr. Rajesh Sharma"
                      style={{ width: '100%', height: '42px', fontSize: '0.88rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Organization / Lab / Partner
                    </label>
                    <input
                      type="text"
                      className="glass-input"
                      value={formData.organization}
                      onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                      placeholder="e.g. SISTec IoT & Robotics Lab or External Sponsor"
                      style={{ width: '100%', height: '42px', fontSize: '0.88rem' }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: APPLICATION & LINKS */}
            {activeFormTab === 'application' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Application Mode & Deadline */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Application Mode
                    </label>
                    <select
                      className="glass-input"
                      value={formData.application_mode}
                      onChange={(e) => setFormData({ ...formData, application_mode: e.target.value })}
                      style={{ width: '100%', height: '42px', fontSize: '0.88rem' }}
                    >
                      <option value="google_form">Google Form (Recommended)</option>
                      <option value="external_link">External Portal / Web Link</option>
                      <option value="direct_email">Direct Email Submission</option>
                      <option value="walk_in">In-Person / Lab Walk-In</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Application Deadline
                    </label>
                    <input
                      type="date"
                      className="glass-input"
                      value={formData.application_deadline}
                      onChange={(e) => setFormData({ ...formData, application_deadline: e.target.value })}
                      style={{ width: '100%', height: '42px', fontSize: '0.88rem' }}
                    />
                  </div>
                </div>

                {/* Google Form URL */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Google Form Submission URL
                  </label>
                  <input
                    type="url"
                    maxLength={1000}
                    className="glass-input"
                    value={formData.google_form_url}
                    onChange={(e) => setFormData({ ...formData, google_form_url: e.target.value })}
                    placeholder="https://forms.gle/..."
                    style={{ width: '100%', height: '42px', fontSize: '0.88rem' }}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Students clicking "Apply" will be directly routed to this Google Form.
                  </span>
                </div>

                {/* External Application URL */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Alternative Application URL / Registration Link
                  </label>
                  <input
                    type="url"
                    maxLength={1000}
                    className="glass-input"
                    value={formData.application_url}
                    onChange={(e) => setFormData({ ...formData, application_url: e.target.value })}
                    placeholder="https://..."
                    style={{ width: '100%', height: '42px', fontSize: '0.88rem' }}
                  />
                </div>

                {/* Resource / Drive URL */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Resource / Project Proposal Drive URL
                  </label>
                  <input
                    type="url"
                    maxLength={1000}
                    className="glass-input"
                    value={formData.resource_url}
                    onChange={(e) => setFormData({ ...formData, resource_url: e.target.value })}
                    placeholder="https://drive.google.com/..."
                    style={{ width: '100%', height: '42px', fontSize: '0.88rem' }}
                  />
                </div>

                {/* Contact Name & Email */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Contact Person
                    </label>
                    <input
                      type="text"
                      className="glass-input"
                      value={formData.contact_name}
                      onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                      placeholder="e.g. Prof. Neha Patel"
                      style={{ width: '100%', height: '42px', fontSize: '0.88rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Contact Email
                    </label>
                    <input
                      type="email"
                      className="glass-input"
                      value={formData.contact_email}
                      onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                      placeholder="e.g. projects.library@sistec.ac.in"
                      style={{ width: '100%', height: '42px', fontSize: '0.88rem' }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: STATUS & ORDER */}
            {activeFormTab === 'settings' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* Published & Active Switches */}
                <div style={{
                  padding: '16px 18px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-glass)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        Publish to Student Catalog
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                        When enabled and active, students can see this project in the student directory.
                      </div>
                    </div>
                    <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '46px', height: '24px' }}>
                      <input
                        type="checkbox"
                        checked={formData.is_published}
                        onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span style={{
                        position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: formData.is_published ? 'var(--primary)' : 'rgba(255, 255, 255, 0.15)',
                        borderRadius: '24px', transition: '0.3s'
                      }}>
                        <span style={{
                          position: 'absolute', height: '18px', width: '18px', left: formData.is_published ? '25px' : '3px',
                          bottom: '3px', backgroundColor: '#fff', borderRadius: '50%', transition: '0.3s'
                        }} />
                      </span>
                    </label>
                  </div>

                  <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        Active Status
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                        Deactivating a project archives it without deleting it. Inactive projects are hidden from students.
                      </div>
                    </div>
                    <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '46px', height: '24px' }}>
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span style={{
                        position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: formData.is_active ? '#10b981' : 'rgba(255, 255, 255, 0.15)',
                        borderRadius: '24px', transition: '0.3s'
                      }}>
                        <span style={{
                          position: 'absolute', height: '18px', width: '18px', left: formData.is_active ? '25px' : '3px',
                          bottom: '3px', backgroundColor: '#fff', borderRadius: '50%', transition: '0.3s'
                        }} />
                      </span>
                    </label>
                  </div>
                </div>

                {/* Display Sort Order */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Display Sort Order
                  </label>
                  <input
                    type="number"
                    className="glass-input"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value, 10) || 0 })}
                    style={{ width: '140px', height: '40px', fontSize: '0.88rem' }}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Lower numbers (e.g. 0, 1, 2) appear first in the catalog.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-glass)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)',
            gap: '12px'
          }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ padding: '9px 18px', borderRadius: '10px' }}
              disabled={saving}
            >
              Cancel
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {activeFormTab !== 'settings' && (
                <button
                  type="button"
                  onClick={() => {
                    const tabs = ['basic', 'requirements', 'application', 'settings'];
                    const idx = tabs.indexOf(activeFormTab);
                    if (idx < tabs.length - 1) setActiveFormTab(tabs[idx + 1]);
                  }}
                  className="btn btn-secondary"
                  style={{ padding: '9px 16px', borderRadius: '10px', fontSize: '0.84rem' }}
                >
                  Next Step &rarr;
                </button>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-shine"
                style={{
                  padding: '9px 24px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  gap: '8px',
                  background: duplicateWarning ? '#d97706' : undefined
                }}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    Saving...
                  </>
                ) : duplicateWarning ? (
                  <>
                    <AlertTriangle size={16} /> Confirm & Save
                  </>
                ) : (
                  <>
                    <Check size={16} /> {isEditing ? 'Update Project' : 'Save Project'}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
