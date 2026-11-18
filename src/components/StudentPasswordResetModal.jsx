"use client";

import { useState, useMemo } from 'react';
import { 
  X, KeyRound, Shield, CheckCircle2, AlertCircle, Loader2, 
  ArrowRight, Clock, HelpCircle, Copy, Check, Lock, RefreshCw, Send
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import PasswordInput from './PasswordInput';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';
import { evaluatePasswordStrength } from '../utils/passwordPolicy';
import { generateRequestReference } from '../utils/cryptoResetUtils';

const BRANCH_OPTIONS = [
  'CSE (Computer Science & Engineering)',
  'CSE (Artificial Intelligence & Data Science)',
  'IT (Information Technology)',
  'ECE (Electronics & Communication Engineering)',
  'Cyber Security',
  'Civil Engineering',
  'Mechanical Engineering (ME)',
  'Electrical Engineering (EX/EE)',
  'B.Pharm',
  'M.Pharm (Pharmaceutical Chemistry)',
  'M.Pharm (Pharmaceutics)',
  'BBA',
  'MBA',
  'M.Tech CSE'
];

const SEMESTER_OPTIONS = [
  '1st Semester', '2nd Semester', '3rd Semester', '4th Semester',
  '5th Semester', '6th Semester', '7th Semester', '8th Semester'
];

export default function StudentPasswordResetModal({ isOpen, onClose, initialRollNumber = '' }) {
  const [activeTab, setActiveTab] = useState('request'); // 'request' | 'track' | 'verify'

  // Tab 1: Request Form State
  const [reqRollNumber, setReqRollNumber] = useState(initialRollNumber);
  const [reqFullName, setReqFullName] = useState('');
  const [reqBranch, setReqBranch] = useState(BRANCH_OPTIONS[0]);
  const [reqSemester, setReqSemester] = useState(SEMESTER_OPTIONS[0]);
  const [reqReason, setReqReason] = useState('Forgotten password');
  const [reqLoading, setReqLoading] = useState(false);
  const [reqError, setReqError] = useState('');
  const [reqSuccessData, setReqSuccessData] = useState(null); // { reference, rollNumber, isExisting, status }

  // Tab 2: Track Status State
  const [trackInput, setTrackInput] = useState('');
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackResult, setTrackResult] = useState(null);
  const [trackError, setTrackError] = useState('');

  // Tab 3: Complete Reset State
  const [verifyRoll, setVerifyRoll] = useState('');
  const [verifyRef, setVerifyRef] = useState('');
  const [verifyPin, setVerifyPin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [verifySuccess, setVerifySuccess] = useState('');

  const [copiedRef, setCopiedRef] = useState(false);

  const pwdStrength = useMemo(() => {
    return evaluatePasswordStrength(newPassword, {
      rollNumber: verifyRoll
    });
  }, [newPassword, verifyRoll]);

  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;

  if (!isOpen) return null;

  // ── Handler 1: Submit Reset Request ──
  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    setReqError('');
    setReqSuccessData(null);

    const cleanRoll = reqRollNumber.trim().toUpperCase();
    const cleanName = reqFullName.trim();
    const cleanReason = reqReason.trim();

    if (!cleanRoll || !cleanName || !cleanReason) {
      setReqError('Please complete all fields (Roll Number, Name, Branch, Semester, and Reason).');
      return;
    }

    setReqLoading(true);
    try {
      // 1. Verify student exists in institutional database
      const { data: students, error: studentErr } = await supabase
        .from('users')
        .select('id, full_name, roll_number, branch_name, semester')
        .ilike('roll_number', cleanRoll)
        .limit(1);

      if (studentErr || !students || students.length === 0) {
        setReqError('No student record found matching this Enrollment / Roll Number. Please check your roll number or contact the Central Library desk.');
        setReqLoading(false);
        return;
      }

      const canonicalStudent = students[0];

      // 2. Check for duplicate pending or approved requests
      const { data: existingActive, error: activeErr } = await supabase
        .from('password_reset_requests')
        .select('request_reference, status, created_at')
        .eq('student_id', canonicalStudent.id)
        .in('status', ['pending', 'approved'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (!activeErr && existingActive && existingActive.length > 0) {
        const active = existingActive[0];
        setReqSuccessData({
          reference: active.request_reference,
          rollNumber: cleanRoll,
          isExisting: true,
          status: active.status
        });
        setReqLoading(false);
        return;
      }

      // 3. Generate Request Reference and insert
      const referenceCode = generateRequestReference();

      const { error: insertErr } = await supabase
        .from('password_reset_requests')
        .insert([{
          student_id: canonicalStudent.id,
          roll_number: cleanRoll,
          student_name: cleanName,
          branch_name: reqBranch,
          semester: reqSemester,
          reason: cleanReason,
          request_reference: referenceCode,
          status: 'pending',
          attempt_count: 0,
          max_attempts: 5
        }]);

      if (insertErr) {
        const errorMsg = insertErr.code === 'PGRST205'
          ? 'Database migration pending: password_reset_requests table not found in Supabase. Please run supabase_password_reset_migration.sql in Supabase SQL Editor.'
          : (insertErr.message || insertErr.details || 'Failed to submit reset request.');
        throw new Error(errorMsg);
      }

      // Activity log
      try {
        await supabase.from('activity_logs').insert([{
          user_id: canonicalStudent.id,
          action_type: 'password_reset_request',
          details: `Password reset requested by ${cleanName} (${cleanRoll}) - Ref: ${referenceCode}`
        }]);
      } catch {}

      setReqSuccessData({
        reference: referenceCode,
        rollNumber: cleanRoll,
        isExisting: false,
        status: 'pending'
      });

    } catch (err) {
      setReqError(err.message || 'Failed to submit request. Please try again.');
    } finally {
      setReqLoading(false);
    }
  };

  // ── Handler 2: Track Request Status ──
  const handleTrackRequest = async (e) => {
    e.preventDefault();
    setTrackError('');
    setTrackResult(null);

    const query = trackInput.trim().toUpperCase();
    if (!query) {
      setTrackError('Please enter your Request Reference code (e.g. PR-2026-XXXX) or Enrollment Number.');
      return;
    }

    setTrackLoading(true);
    try {
      const isRef = query.startsWith('PR-');
      let reqQuery = supabase
        .from('password_reset_requests')
        .select('id, request_reference, roll_number, student_name, branch_name, status, rejection_reason, expires_at, created_at')
        .order('created_at', { ascending: false })
        .limit(1);

      if (isRef) {
        reqQuery = reqQuery.eq('request_reference', query);
      } else {
        reqQuery = reqQuery.ilike('roll_number', query);
      }

      const { data, error } = await reqQuery;
      if (error || !data || data.length === 0) {
        setTrackError('No active or recent reset request found for this reference or roll number.');
      } else {
        setTrackResult(data[0]);
      }
    } catch (err) {
      setTrackError(err.message || 'Failed to check request status.');
    } finally {
      setTrackLoading(false);
    }
  };

  // ── Handler 3: Complete Reset with PIN ──
  const handleVerifyAndReset = async (e) => {
    e.preventDefault();
    setVerifyError('');
    setVerifySuccess('');

    if (!verifyRoll.trim() || !verifyRef.trim() || !verifyPin.trim()) {
      setVerifyError('Please enter Roll Number, Request Reference, and 6-digit PIN.');
      return;
    }

    if (!pwdStrength.isValid) {
      setVerifyError(pwdStrength.errors[0] || 'Password does not meet institutional security requirements.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setVerifyError('Passwords do not match. Please re-enter your new password.');
      return;
    }

    setVerifyLoading(true);
    try {
      const res = await fetch('/api/auth/complete-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rollNumber: verifyRoll.trim().toUpperCase(),
          requestReference: verifyRef.trim().toUpperCase(),
          pin: verifyPin.trim(),
          newPassword,
          confirmPassword
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to reset password. Please verify your PIN.');
      }

      setVerifySuccess(json.message || 'Password successfully reset! You can now log in.');
      setVerifyPin('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setVerifyError(err.message || 'Verification failed. Please check your credentials.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard?.writeText(text);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const inputStyle = {
    width: '100%',
    padding: '9px 12px',
    borderRadius: '8px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid var(--border-glass, rgba(255, 255, 255, 0.12))',
    color: '#ffffff',
    fontSize: '0.82rem',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s ease'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.75)',
    marginBottom: '5px'
  };

  return (
    <div 
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 8, 16, 0.82)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out'
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-modal-title"
    >
      <div 
        className="glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          borderRadius: '16px',
          border: '1.5px solid var(--border-glass, rgba(255, 255, 255, 0.12))',
          background: 'var(--bg-card, #121826)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
          color: 'var(--text-primary, #ffffff)',
          animation: 'scaleIn 0.2s ease-out'
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-glass, rgba(255, 255, 255, 0.1))',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#60a5fa'
            }}>
              <KeyRound size={20} />
            </div>
            <div>
              <h2 id="reset-modal-title" style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#ffffff', lineHeight: 1.2 }}>
                Student Password Recovery
              </h2>
              <p style={{ fontSize: '0.74rem', color: 'rgba(255, 255, 255, 0.55)', margin: '3px 0 0 0' }}>
                Admin-Verified In-Person Reset Workflow
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.6)',
              padding: '6px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; e.currentTarget.style.color = '#ffffff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)'; }}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-glass, rgba(255, 255, 255, 0.1))',
          background: 'rgba(0, 0, 0, 0.25)',
          padding: '6px 16px 0 16px',
          gap: '6px',
          overflowX: 'auto'
        }}>
          {[
            { id: 'request', label: '1. Request Reset', icon: Send },
            { id: 'track', label: '2. Track Status', icon: Clock },
            { id: 'verify', label: '3. Enter PIN & Reset', icon: Lock }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '9px 12px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid var(--primary, #3b82f6)' : '2px solid transparent',
                  color: isActive ? '#60a5fa' : 'rgba(255, 255, 255, 0.55)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.78rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                <Icon size={13} /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div style={{
          padding: '20px',
          overflowY: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          
          {/* ═════════ TAB 1: REQUEST RESET ═════════ */}
          {activeTab === 'request' && (
            <div>
              {reqSuccessData ? (
                <div style={{ textAlign: 'center', padding: '10px 0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    margin: '0 auto',
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.12)',
                    color: '#34d399',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(16, 185, 129, 0.25)'
                  }}>
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#34d399', margin: 0 }}>
                      {reqSuccessData.isExisting ? 'Active Request Found' : 'Reset Request Submitted!'}
                    </h3>
                    <p style={{ fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.65)', marginTop: '4px' }}>
                      Your password reset reference has been registered with the Central Library Admin desk.
                    </p>
                  </div>

                  {/* Reference Display Card */}
                  <div style={{
                    padding: '14px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255, 255, 255, 0.45)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Tracking Reference Code
                    </span>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(0, 0, 0, 0.4)',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      fontFamily: 'monospace',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      color: '#60a5fa'
                    }}>
                      <span>{reqSuccessData.reference}</span>
                      <button
                        onClick={() => copyToClipboard(reqSuccessData.reference)}
                        type="button"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'rgba(255, 255, 255, 0.7)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.75rem',
                          padding: '4px 8px',
                          borderRadius: '4px'
                        }}
                      >
                        {copiedRef ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
                        <span>{copiedRef ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.75)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div><strong>Roll Number:</strong> {reqSuccessData.rollNumber}</div>
                      <div><strong>Status:</strong> <span style={{ textTransform: 'capitalize', color: '#fbbf24', fontWeight: 600 }}>{reqSuccessData.status}</span></div>
                    </div>
                  </div>

                  {/* Instructions */}
                  <div style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    textAlign: 'left',
                    fontSize: '0.78rem',
                    color: '#bfdbfe',
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'flex-start',
                    lineHeight: 1.5
                  }}>
                    <HelpCircle size={16} color="#60a5fa" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong style={{ display: 'block', color: '#93c5fd', marginBottom: '2px' }}>Physical Verification Required</strong>
                      Please visit the Central Library Administrator Desk with your <strong>College ID Card</strong>. Once the librarian verifies your identity, they will issue your single-use 6-digit Reset PIN.
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setVerifyRoll(reqSuccessData.rollNumber);
                      setVerifyRef(reqSuccessData.reference);
                      setActiveTab('verify');
                    }}
                    type="button"
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      padding: '11px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    Already Got PIN? Set New Password <ArrowRight size={14} />
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmitRequest} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {reqError && (
                    <div style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      color: '#f87171',
                      fontSize: '0.78rem',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      lineHeight: 1.5
                    }}>
                      <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>{reqError}</span>
                    </div>
                  )}

                  <div>
                    <label style={labelStyle}>
                      Enrollment / Roll Number <span style={{ color: '#f87171' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={reqRollNumber}
                      onChange={(e) => setReqRollNumber(e.target.value.toUpperCase())}
                      placeholder="e.g. 0187CS211045"
                      required
                      style={{ ...inputStyle, fontFamily: 'monospace' }}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>
                      Full Name (As per College ID) <span style={{ color: '#f87171' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={reqFullName}
                      onChange={(e) => setReqFullName(e.target.value)}
                      placeholder="e.g. Rohan Sharma"
                      required
                      style={inputStyle}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={labelStyle}>Department / Branch</label>
                      <select
                        value={reqBranch}
                        onChange={(e) => setReqBranch(e.target.value)}
                        style={{ ...inputStyle, cursor: 'pointer' }}
                      >
                        {BRANCH_OPTIONS.map(b => (
                          <option key={b} value={b} style={{ background: '#0f172a', color: '#ffffff' }}>{b}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={labelStyle}>Semester</label>
                      <select
                        value={reqSemester}
                        onChange={(e) => setReqSemester(e.target.value)}
                        style={{ ...inputStyle, cursor: 'pointer' }}
                      >
                        {SEMESTER_OPTIONS.map(s => (
                          <option key={s} value={s} style={{ background: '#0f172a', color: '#ffffff' }}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>
                      Reason for Reset Request <span style={{ color: '#f87171' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={reqReason}
                      onChange={(e) => setReqReason(e.target.value)}
                      placeholder="e.g. Forgot password, lost device access"
                      required
                      style={inputStyle}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={reqLoading}
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      padding: '11px',
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      marginTop: '4px'
                    }}
                  >
                    {reqLoading ? (
                      <>
                        <Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> Submitting Request...
                      </>
                    ) : (
                      <>
                        <Send size={15} /> Submit Request for Admin Verification
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ═════════ TAB 2: TRACK STATUS ═════════ */}
          {activeTab === 'track' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <form onSubmit={handleTrackRequest} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {trackError && (
                  <div style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    color: '#f87171',
                    fontSize: '0.78rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    lineHeight: 1.5
                  }}>
                    <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{trackError}</span>
                  </div>
                )}

                <div>
                  <label style={labelStyle}>
                    Request Reference or Roll Number
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={trackInput}
                      onChange={(e) => setTrackInput(e.target.value)}
                      placeholder="e.g. PR-2026-X8K9M2 or 0187CS211045"
                      required
                      style={{ ...inputStyle, flex: 1, fontFamily: 'monospace' }}
                    />
                    <button
                      type="submit"
                      disabled={trackLoading}
                      className="btn btn-primary"
                      style={{
                        padding: '0 16px',
                        borderRadius: '8px',
                        fontWeight: 600,
                        fontSize: '0.82rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        flexShrink: 0
                      }}
                    >
                      {trackLoading ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <RefreshCw size={14} />}
                      Track
                    </button>
                  </div>
                </div>
              </form>

              {trackResult && (
                <div style={{
                  padding: '14px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: '10px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
                  }}>
                    <div>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 700, color: '#60a5fa', display: 'block' }}>
                        {trackResult.request_reference}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                        Submitted: {new Date(trackResult.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '999px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      background: trackResult.status === 'approved' ? 'rgba(16, 185, 129, 0.2)' :
                                  trackResult.status === 'pending' ? 'rgba(245, 158, 11, 0.2)' :
                                  trackResult.status === 'completed' ? 'rgba(59, 130, 246, 0.2)' :
                                  'rgba(239, 68, 68, 0.2)',
                      color: trackResult.status === 'approved' ? '#34d399' :
                             trackResult.status === 'pending' ? '#fbbf24' :
                             trackResult.status === 'completed' ? '#60a5fa' :
                             '#f87171',
                      border: `1px solid ${
                        trackResult.status === 'approved' ? 'rgba(16, 185, 129, 0.35)' :
                        trackResult.status === 'pending' ? 'rgba(245, 158, 11, 0.35)' :
                        trackResult.status === 'completed' ? 'rgba(59, 130, 246, 0.35)' :
                        'rgba(239, 68, 68, 0.35)'
                      }`
                    }}>
                      {trackResult.status}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.75)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div><strong>Student:</strong> {trackResult.student_name} ({trackResult.roll_number})</div>
                    <div><strong>Branch:</strong> {trackResult.branch_name || 'N/A'}</div>
                  </div>

                  {trackResult.status === 'pending' && (
                    <div style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                      color: '#fef3c7',
                      fontSize: '0.78rem',
                      lineHeight: 1.5
                    }}>
                      <strong>⏳ Pending Verification</strong>: Please visit the Central Library Admin Desk with your College ID card.
                    </div>
                  )}

                  {trackResult.status === 'approved' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        color: '#d1fae5',
                        fontSize: '0.78rem',
                        lineHeight: 1.5
                      }}>
                        <strong>✅ Request Approved!</strong> The administrator has generated your 6-digit Reset PIN.
                      </div>
                      <button
                        onClick={() => {
                          setVerifyRoll(trackResult.roll_number);
                          setVerifyRef(trackResult.request_reference);
                          setActiveTab('verify');
                        }}
                        type="button"
                        className="btn btn-primary"
                        style={{
                          width: '100%',
                          padding: '10px',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        Proceed to Enter PIN & Reset Password <ArrowRight size={14} />
                      </button>
                    </div>
                  )}

                  {trackResult.status === 'rejected' && (
                    <div style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      color: '#fee2e2',
                      fontSize: '0.78rem',
                      lineHeight: 1.5
                    }}>
                      <strong>❌ Request Rejected</strong>: {trackResult.rejection_reason || 'Student identity could not be verified.'}
                    </div>
                  )}

                  {trackResult.status === 'completed' && (
                    <div style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'rgba(59, 130, 246, 0.1)',
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                      color: '#dbeafe',
                      fontSize: '0.78rem',
                      lineHeight: 1.5
                    }}>
                      <strong>🎉 Reset Completed</strong>: This password reset was successfully finalized.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═════════ TAB 3: COMPLETE RESET WITH PIN ═════════ */}
          {activeTab === 'verify' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {verifySuccess ? (
                <div style={{ textAlign: 'center', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    margin: '0 auto',
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.12)',
                    color: '#34d399',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(16, 185, 129, 0.25)'
                  }}>
                    <CheckCircle2 size={24} />
                  </div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#34d399', margin: 0 }}>Password Reset Complete!</h3>
                  <p style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.75)', margin: 0 }}>{verifySuccess}</p>
                  <button
                    onClick={onClose}
                    type="button"
                    className="btn btn-primary"
                    style={{
                      padding: '10px 20px',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      marginTop: '6px'
                    }}
                  >
                    Back to Sign In <ArrowRight size={14} />
                  </button>
                </div>
              ) : (
                <form onSubmit={handleVerifyAndReset} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {verifyError && (
                    <div style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      color: '#f87171',
                      fontSize: '0.78rem',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      lineHeight: 1.5
                    }}>
                      <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>{verifyError}</span>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={labelStyle}>
                        Enrollment / Roll Number <span style={{ color: '#f87171' }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={verifyRoll}
                        onChange={(e) => setVerifyRoll(e.target.value.toUpperCase())}
                        placeholder="e.g. 0187CS211045"
                        required
                        style={{ ...inputStyle, fontFamily: 'monospace' }}
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>
                        Request Reference <span style={{ color: '#f87171' }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={verifyRef}
                        onChange={(e) => setVerifyRef(e.target.value.toUpperCase())}
                        placeholder="e.g. PR-2026-X8K9M2"
                        required
                        style={{ ...inputStyle, fontFamily: 'monospace' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>
                      6-Digit Reset PIN (From Administrator) <span style={{ color: '#f87171' }}>*</span>
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={verifyPin}
                      onChange={(e) => setVerifyPin(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="e.g. 849201"
                      required
                      style={{
                        ...inputStyle,
                        fontFamily: 'monospace',
                        textAlign: 'center',
                        letterSpacing: '0.3em',
                        fontSize: '1.05rem',
                        fontWeight: 700
                      }}
                    />
                    <span style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.45)', display: 'block', marginTop: '4px' }}>
                      Enter the single-use 15-minute PIN provided by the library admin.
                    </span>
                  </div>

                  <div>
                    <label style={labelStyle}>
                      New Password (Min 12 Characters) <span style={{ color: '#f87171' }}>*</span>
                    </label>
                    <PasswordInput
                      id="reset-new-password"
                      name="newPassword"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter compliant new password"
                      autoComplete="new-password"
                      disabled={verifyLoading}
                    />
                    <PasswordStrengthIndicator strength={pwdStrength} />
                  </div>

                  <div>
                    <label style={labelStyle}>
                      Confirm New Password <span style={{ color: '#f87171' }}>*</span>
                    </label>
                    <PasswordInput
                      id="reset-confirm-password"
                      name="confirmPassword"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your new password"
                      autoComplete="new-password"
                      disabled={verifyLoading}
                    />
                    {confirmPassword.length > 0 && (
                      <div style={{
                        marginTop: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: passwordsMatch ? '#34d399' : '#f87171'
                      }}>
                        {passwordsMatch ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                        {passwordsMatch ? 'Passwords match' : 'Passwords do not match yet'}
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={verifyLoading || !pwdStrength.isValid || !passwordsMatch || verifyPin.length !== 6}
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      padding: '11px',
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      marginTop: '4px'
                    }}
                  >
                    {verifyLoading ? (
                      <>
                        <Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> Verifying & Updating Password...
                      </>
                    ) : (
                      <>
                        <Shield size={15} /> Finalize Password Reset
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
