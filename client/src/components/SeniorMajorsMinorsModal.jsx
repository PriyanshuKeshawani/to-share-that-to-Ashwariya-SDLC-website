"use client";

import { useState, useEffect, useMemo } from 'react';
import { X, GraduationCap, AlertCircle, AlertTriangle, Check, UserCheck } from 'lucide-react';

const COMMON_MAJORS = [
  'Artificial Intelligence & Data Science',
  'Data Science',
  'Cyber Security',
  'Full Stack Development',
  'Cloud Architecture',
  'Machine Learning & Deep Learning',
  'VLSI & Embedded Systems',
  'Internet of Things (IoT)',
  'Pharmaceutical Chemistry',
  'Pharmaceutics',
  'Financial Management',
  'Structural Engineering',
  'Thermal Engineering'
];

const COMMON_MINORS = [
  'Cloud Computing',
  'Web Development',
  'Data Analytics & BI',
  'Cyber Security Essentials',
  'Artificial Intelligence & ML',
  'Blockchain & Distributed Systems',
  'Robotics & Automation',
  'Mobile App Development',
  'Digital Marketing & Analytics',
  'Operations Management',
  'Bioinformatics'
];

export default function SeniorMajorsMinorsModal({
  isOpen,
  onClose,
  profile = null,
  branches = [],
  students = [],
  onSave,
  existingProfiles = []
}) {
  const isEditing = Boolean(profile && profile.id);

  const [formData, setFormData] = useState({
    full_name: '',
    roll_number: '',
    branch_name: '',
    batch: '',
    major: '',
    minor: '',
    description: '',
    is_published: true,
    student_user_id: ''
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);

  // Initialize or reset form when modal opens / profile changes
  useEffect(() => {
    if (!isOpen) {
      setError('');
      setDuplicateWarning(false);
      setStudentSearch('');
      setShowStudentDropdown(false);
      return;
    }

    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        roll_number: profile.roll_number || '',
        branch_name: profile.branch_name || '',
        batch: profile.batch || '',
        major: profile.major || '',
        minor: profile.minor || '',
        description: profile.description || '',
        is_published: profile.is_published !== false,
        student_user_id: profile.student_user_id || ''
      });
      if (profile.student_user) {
        setStudentSearch(`${profile.student_user.full_name} (${profile.student_user.roll_number || 'N/A'})`);
      } else {
        setStudentSearch('');
      }
    } else {
      setFormData({
        full_name: '',
        roll_number: '',
        branch_name: branches[0]?.name || '',
        batch: `${new Date().getFullYear() - 1} - ${new Date().getFullYear() + 3}`,
        major: '',
        minor: '',
        description: '',
        is_published: true,
        student_user_id: ''
      });
      setStudentSearch('');
    }
    setError('');
    setDuplicateWarning(false);
  }, [isOpen, profile, branches]);

  // Filter approved students for linking
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students.slice(0, 15);
    const q = studentSearch.toLowerCase();
    return students.filter(s =>
      s.full_name?.toLowerCase().includes(q) ||
      s.roll_number?.toLowerCase().includes(q) ||
      s.username?.toLowerCase().includes(q)
    ).slice(0, 15);
  }, [students, studentSearch]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
    setDuplicateWarning(false);
  };

  const handleSelectStudent = (student) => {
    if (!student) {
      setFormData(prev => ({
        ...prev,
        student_user_id: '',
      }));
      setStudentSearch('');
      setShowStudentDropdown(false);
      return;
    }

    setFormData(prev => ({
      ...prev,
      student_user_id: student.id,
      full_name: student.full_name || prev.full_name,
      roll_number: student.roll_number || prev.roll_number,
      branch_name: student.branch_name || prev.branch_name
    }));
    setStudentSearch(`${student.full_name} (${student.roll_number || 'No Roll'})`);
    setShowStudentDropdown(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedName = formData.full_name.trim();
    const trimmedMajor = formData.major.trim();
    const trimmedMinor = formData.minor.trim();

    if (!trimmedName) {
      setError('Please provide the senior student\'s full name.');
      return;
    }
    if (!trimmedMajor) {
      setError('Major specialization is required (e.g. Data Science, Cyber Security).');
      return;
    }
    if (!trimmedMinor) {
      setError('Minor specialization is required (e.g. Cloud Computing, Web Dev).');
      return;
    }

    // Check duplicate: same senior + same major + same minor + same batch
    const isDuplicate = existingProfiles.some(p => {
      if (isEditing && p.id === profile.id) return false;
      const sameName = (p.full_name || '').trim().toLowerCase() === trimmedName.toLowerCase();
      const sameMajor = (p.major || '').trim().toLowerCase() === trimmedMajor.toLowerCase();
      const sameMinor = (p.minor || '').trim().toLowerCase() === trimmedMinor.toLowerCase();
      const sameBatch = (p.batch || '').trim().toLowerCase() === (formData.batch || '').trim().toLowerCase();
      return sameName && sameMajor && sameMinor && sameBatch;
    });

    if (isDuplicate && !duplicateWarning) {
      setDuplicateWarning(true);
      setError('Notice: A profile with the same name, major, minor, and batch already exists. Click "Confirm & Save" if you want to proceed anyway.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        ...formData,
        full_name: trimmedName,
        major: trimmedMajor,
        minor: trimmedMinor,
        roll_number: formData.roll_number.trim(),
        branch_name: formData.branch_name.trim(),
        batch: formData.batch.trim(),
        description: formData.description.trim()
      });
      onClose();
    } catch (err) {
      console.error('Error saving senior profile:', err);
      setError(err.message || 'Failed to save senior academic profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
        overflowY: 'auto'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        className="glass-panel animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '20px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.5), 0 0 0 1px var(--border-glass)',
          overflow: 'hidden',
          background: 'var(--bg-glass)',
          border: '1px solid var(--border-glass)'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-glass)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(180deg, rgba(37, 99, 235, 0.08) 0%, transparent 100%)',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px var(--primary-glow)'
              }}
            >
              <GraduationCap size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {isEditing ? 'Edit Senior Academic Profile' : 'Add Senior Major & Minor Record'}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Maintain senior student specialization records for peer and academic guidance
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="btn btn-secondary"
            style={{
              width: '36px',
              height: '36px',
              padding: 0,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden', padding: '0', gap: '0' }}>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {error && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '12px',
                background: duplicateWarning ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: duplicateWarning ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
                color: duplicateWarning ? '#fbbf24' : '#f87171',
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              {duplicateWarning ? <AlertTriangle size={18} /> : <AlertCircle size={18} />}
              <span>{error}</span>
            </div>
          )}

          {/* Optional: Link Existing Approved Student */}
          <div style={{ position: 'relative' }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <UserCheck size={15} color="var(--primary)" /> Link Existing Student Account (Optional)
              </span>
              {formData.student_user_id && (
                <button
                  type="button"
                  onClick={() => handleSelectStudent(null)}
                  style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '0.74rem', cursor: 'pointer', padding: 0 }}
                >
                  Clear Link
                </button>
              )}
            </label>
            <input
              type="text"
              className="glass-input"
              placeholder="Search approved student by name, roll no, or username..."
              value={studentSearch}
              onChange={(e) => {
                setStudentSearch(e.target.value);
                setShowStudentDropdown(true);
              }}
              onFocus={() => setShowStudentDropdown(true)}
              style={{ width: '100%', fontSize: '0.85rem' }}
            />
            {showStudentDropdown && filteredStudents.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  maxHeight: '180px',
                  overflowY: 'auto',
                  background: 'var(--bg-glass-strong)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '12px',
                  boxShadow: '0 12px 28px rgba(0,0,0,0.5)',
                  zIndex: 10,
                  marginTop: '4px'
                }}
              >
                {filteredStudents.map(st => (
                  <div
                    key={st.id}
                    onClick={() => handleSelectStudent(st)}
                    style={{
                      padding: '10px 14px',
                      cursor: 'pointer',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.82rem',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{st.full_name}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        Roll: {st.roll_number || 'N/A'} • {st.branch_name || 'General'}
                      </div>
                    </div>
                    <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>Select</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Row 1: Student Name & Roll Number */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Senior / Student Full Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                className="glass-input"
                placeholder="e.g. Priya Sharma"
                value={formData.full_name}
                onChange={(e) => handleChange('full_name', e.target.value)}
                maxLength={150}
                required
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Roll Number / Enrollment No.
              </label>
              <input
                type="text"
                className="glass-input"
                placeholder="e.g. 0187CS211045"
                value={formData.roll_number}
                onChange={(e) => handleChange('roll_number', e.target.value)}
                maxLength={50}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Row 2: Branch & Batch */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Branch / Department
              </label>
              <select
                className="glass-input glass-select"
                value={formData.branch_name}
                onChange={(e) => handleChange('branch_name', e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="">Select Branch / Department</option>
                {branches.map(b => (
                  <option key={b.id || b.name} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Batch / Graduation Year
              </label>
              <input
                type="text"
                className="glass-input"
                placeholder="e.g. 2021 - 2025"
                value={formData.batch}
                onChange={(e) => handleChange('batch', e.target.value)}
                maxLength={50}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Row 3: Major Specialization */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Major Specialization <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              className="glass-input"
              placeholder="e.g. Data Science, Artificial Intelligence, Cyber Security..."
              value={formData.major}
              onChange={(e) => handleChange('major', e.target.value)}
              maxLength={150}
              required
              style={{ width: '100%' }}
            />
            {/* Quick chips for Majors */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Suggestions:</span>
              {COMMON_MAJORS.slice(0, 5).map(m => (
                <button
                  type="button"
                  key={m}
                  onClick={() => handleChange('major', m)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '0.7rem',
                    background: formData.major === m ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                    color: formData.major === m ? '#ffffff' : 'var(--text-secondary)',
                    border: '1px solid var(--border-glass)',
                    cursor: 'pointer'
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Row 4: Minor Specialization */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Minor Specialization <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              className="glass-input"
              placeholder="e.g. Cloud Computing, Web Development, Data Analytics..."
              value={formData.minor}
              onChange={(e) => handleChange('minor', e.target.value)}
              maxLength={150}
              required
              style={{ width: '100%' }}
            />
            {/* Quick chips for Minors */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Suggestions:</span>
              {COMMON_MINORS.slice(0, 5).map(m => (
                <button
                  type="button"
                  key={m}
                  onClick={() => handleChange('minor', m)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '0.7rem',
                    background: formData.minor === m ? 'var(--secondary)' : 'rgba(255,255,255,0.06)',
                    color: formData.minor === m ? '#ffffff' : 'var(--text-secondary)',
                    border: '1px solid var(--border-glass)',
                    cursor: 'pointer'
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Row 5: Description / Guidance Notes */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Description & Guidance Notes (Optional)
            </label>
            <textarea
              className="glass-input"
              placeholder="Add recommended electives, certifications, advice for juniors selecting this specialization..."
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              maxLength={1000}
              rows={3}
              style={{ width: '100%', resize: 'vertical' }}
            />
            <div style={{ textAlign: 'right', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {formData.description.length}/1000 characters
            </div>
          </div>

          {/* Row 6: Published Switch */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-glass)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Publish in Student Directory
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                When published, this record is instantly visible to all students browsing for academic guidance.
              </div>
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
              <input
                type="checkbox"
                checked={formData.is_published}
                onChange={(e) => handleChange('is_published', e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: formData.is_published ? '#10b981' : '#f59e0b' }}>
                {formData.is_published ? 'Published' : 'Draft'}
              </span>
            </label>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            borderTop: '1px solid var(--border-glass)',
            padding: '14px 24px',
            background: 'rgba(255, 255, 255, 0.02)',
            flexShrink: 0
          }}
        >
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="btn btn-secondary"
              style={{ padding: '10px 20px', fontSize: '0.84rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary btn-shine"
              style={{ padding: '10px 24px', fontSize: '0.84rem', gap: '8px', minWidth: '140px' }}
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
                  <Check size={16} /> {isEditing ? 'Update Profile' : 'Add Profile'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
