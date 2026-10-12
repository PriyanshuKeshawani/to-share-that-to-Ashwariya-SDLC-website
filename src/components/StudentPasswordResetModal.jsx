"use client";

import { useState, useMemo } from 'react';
import { 
  X, KeyRound, Shield, CheckCircle2, AlertCircle, Loader2, 
  ArrowRight, Clock, HelpCircle, Copy, Check, Lock, RefreshCw, Send
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import PasswordInput from './PasswordInput';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';
import { evaluatePasswordStrength, validateNewPassword } from '../utils/passwordPolicy';
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
  const [reqSuccessData, setReqSuccessData] = useState(null); // { reference, rollNumber }

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
        throw new Error(insertErr.message || 'Failed to submit reset request.');
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

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-modal-title"
    >
      <div 
        className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{
          background: 'var(--bg-card, #121826)',
          border: '1.5px solid var(--border-glass, rgba(255, 255, 255, 0.12))',
          color: 'var(--text-primary, #ffffff)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <KeyRound size={20} />
            </div>
            <div>
              <h2 id="reset-modal-title" className="text-base font-bold m-0 leading-tight">
                Student Password Recovery
              </h2>
              <p className="text-xs text-white/50 m-0 mt-0.5">
                Admin-Verified In-Person Reset Workflow
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-white/10 bg-black/20 px-4 pt-2 gap-2 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('request')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'request'
                ? 'border-blue-500 text-blue-400 font-bold'
                : 'border-transparent text-white/50 hover:text-white/80'
            }`}
          >
            <Send size={13} /> 1. Request Reset
          </button>
          <button
            onClick={() => setActiveTab('track')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'track'
                ? 'border-blue-500 text-blue-400 font-bold'
                : 'border-transparent text-white/50 hover:text-white/80'
            }`}
          >
            <Clock size={13} /> 2. Track Status
          </button>
          <button
            onClick={() => setActiveTab('verify')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'verify'
                ? 'border-blue-500 text-blue-400 font-bold'
                : 'border-transparent text-white/50 hover:text-white/80'
            }`}
          >
            <Lock size={13} /> 3. Enter PIN & Reset
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          
          {/* ═════════ TAB 1: REQUEST RESET ═════════ */}
          {activeTab === 'request' && (
            <div>
              {reqSuccessData ? (
                <div className="space-y-4 text-center py-2">
                  <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-emerald-400 m-0">
                      {reqSuccessData.isExisting ? 'Active Request Found' : 'Reset Request Submitted!'}
                    </h3>
                    <p className="text-xs text-white/60 mt-1 max-w-sm mx-auto">
                      Your password reset reference has been registered with the Central Library Admin desk.
                    </p>
                  </div>

                  {/* Reference Display Card */}
                  <div className="p-4 rounded-xl bg-white/[0.04] border border-white/10 text-left space-y-2">
                    <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider block">
                      Tracking Reference Code
                    </span>
                    <div className="flex items-center justify-between gap-2 bg-black/40 px-3 py-2 rounded-lg border border-white/10 font-mono text-sm font-bold text-blue-400">
                      <span>{reqSuccessData.reference}</span>
                      <button
                        onClick={() => copyToClipboard(reqSuccessData.reference)}
                        className="text-white/60 hover:text-white p-1 rounded hover:bg-white/10 flex items-center gap-1 text-xs"
                      >
                        {copiedRef ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        {copiedRef ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <div className="text-xs text-white/70 space-y-1 pt-1">
                      <div><strong>Roll Number:</strong> {reqSuccessData.rollNumber}</div>
                      <div><strong>Status:</strong> <span className="capitalize text-amber-400 font-semibold">{reqSuccessData.status}</span></div>
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-left text-xs text-blue-200 flex gap-2.5 items-start">
                    <HelpCircle size={16} className="text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-blue-300 mb-0.5">Physical Verification Required</strong>
                      Please visit the Central Library Administrator Desk with your <strong>College ID Card</strong>. Once the librarian verifies your identity, they will issue your single-use 6-digit Reset PIN.
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => {
                        setVerifyRoll(reqSuccessData.rollNumber);
                        setVerifyRef(reqSuccessData.reference);
                        setActiveTab('verify');
                      }}
                      className="btn btn-primary w-full py-2.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-2"
                    >
                      Already Got PIN? Set New Password <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmitRequest} className="space-y-3.5 text-xs">
                  {reqError && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 flex items-start gap-2">
                      <AlertCircle size={15} className="shrink-0 mt-0.5" />
                      <span>{reqError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block font-semibold mb-1 text-white/70">
                      Enrollment / Roll Number <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={reqRollNumber}
                      onChange={(e) => setReqRollNumber(e.target.value.toUpperCase())}
                      placeholder="e.g. 0187CS211045"
                      required
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1 text-white/70">
                      Full Name (As per College ID) <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={reqFullName}
                      onChange={(e) => setReqFullName(e.target.value)}
                      placeholder="e.g. Rohan Sharma"
                      required
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold mb-1 text-white/70">
                        Department / Branch
                      </label>
                      <select
                        value={reqBranch}
                        onChange={(e) => setReqBranch(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500 text-xs"
                      >
                        {BRANCH_OPTIONS.map(b => (
                          <option key={b} value={b} className="bg-slate-900 text-white">{b}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold mb-1 text-white/70">
                        Semester
                      </label>
                      <select
                        value={reqSemester}
                        onChange={(e) => setReqSemester(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500 text-xs"
                      >
                        {SEMESTER_OPTIONS.map(s => (
                          <option key={s} value={s} className="bg-slate-900 text-white">{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1 text-white/70">
                      Reason for Reset Request <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={reqReason}
                      onChange={(e) => setReqReason(e.target.value)}
                      placeholder="e.g. Forgot password, lost device access"
                      required
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={reqLoading}
                    className="btn btn-primary w-full py-2.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 mt-2"
                  >
                    {reqLoading ? (
                      <>
                        <Loader2 size={15} className="animate-spin" /> Submitting Request...
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
            <div className="space-y-4 text-xs">
              <form onSubmit={handleTrackRequest} className="space-y-3">
                {trackError && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 flex items-start gap-2">
                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                    <span>{trackError}</span>
                  </div>
                )}

                <div>
                  <label className="block font-semibold mb-1 text-white/70">
                    Request Reference or Roll Number
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={trackInput}
                      onChange={(e) => setTrackInput(e.target.value)}
                      placeholder="e.g. PR-2026-X8K9M2 or 0187CS211045"
                      required
                      className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500 font-mono text-xs"
                    />
                    <button
                      type="submit"
                      disabled={trackLoading}
                      className="btn btn-primary px-4 py-2 rounded-lg font-semibold flex items-center gap-1.5 shrink-0"
                    >
                      {trackLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                      Track
                    </button>
                  </div>
                </div>
              </form>

              {trackResult && (
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <div>
                      <span className="font-mono text-xs font-bold text-blue-400 block">
                        {trackResult.request_reference}
                      </span>
                      <span className="text-[11px] text-white/50">
                        Submitted: {new Date(trackResult.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                      trackResult.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                      trackResult.status === 'pending' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                      trackResult.status === 'completed' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                      'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}>
                      {trackResult.status}
                    </span>
                  </div>

                  <div className="space-y-1 text-white/70">
                    <div><strong>Student:</strong> {trackResult.student_name} ({trackResult.roll_number})</div>
                    <div><strong>Branch:</strong> {trackResult.branch_name || 'N/A'}</div>
                  </div>

                  {trackResult.status === 'pending' && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200">
                      <strong>⏳ Pending Verification</strong>: Please visit the Central Library Admin Desk with your College ID card.
                    </div>
                  )}

                  {trackResult.status === 'approved' && (
                    <div className="space-y-2">
                      <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-200">
                        <strong>✅ Request Approved!</strong> The administrator has generated your 6-digit Reset PIN.
                      </div>
                      <button
                        onClick={() => {
                          setVerifyRoll(trackResult.roll_number);
                          setVerifyRef(trackResult.request_reference);
                          setActiveTab('verify');
                        }}
                        className="btn btn-primary w-full py-2 rounded-lg font-semibold flex items-center justify-center gap-1.5"
                      >
                        Proceed to Enter PIN & Reset Password <ArrowRight size={14} />
                      </button>
                    </div>
                  )}

                  {trackResult.status === 'rejected' && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200">
                      <strong>❌ Request Rejected</strong>: {trackResult.rejection_reason || 'Student identity could not be verified.'}
                    </div>
                  )}

                  {trackResult.status === 'completed' && (
                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-200">
                      <strong>🎉 Reset Completed</strong>: This password reset was successfully finalized.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═════════ TAB 3: COMPLETE RESET WITH PIN ═════════ */}
          {activeTab === 'verify' && (
            <div className="space-y-3.5 text-xs">
              {verifySuccess ? (
                <div className="p-5 text-center space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                    <CheckCircle2 size={24} />
                  </div>
                  <h3 className="text-base font-bold text-emerald-400 m-0">Password Reset Complete!</h3>
                  <p className="text-xs text-white/70">{verifySuccess}</p>
                  <button
                    onClick={onClose}
                    className="btn btn-primary px-6 py-2 rounded-lg font-semibold inline-flex items-center gap-2 mt-2"
                  >
                    Back to Sign In <ArrowRight size={14} />
                  </button>
                </div>
              ) : (
                <form onSubmit={handleVerifyAndReset} className="space-y-3">
                  {verifyError && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 flex items-start gap-2">
                      <AlertCircle size={15} className="shrink-0 mt-0.5" />
                      <span>{verifyError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold mb-1 text-white/70">
                        Enrollment / Roll Number <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={verifyRoll}
                        onChange={(e) => setVerifyRoll(e.target.value.toUpperCase())}
                        placeholder="e.g. 0187CS211045"
                        required
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold mb-1 text-white/70">
                        Request Reference <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={verifyRef}
                        onChange={(e) => setVerifyRef(e.target.value.toUpperCase())}
                        placeholder="e.g. PR-2026-X8K9M2"
                        required
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1 text-white/70">
                      6-Digit Reset PIN (From Administrator) <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={verifyPin}
                      onChange={(e) => setVerifyPin(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="e.g. 849201"
                      required
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500 font-mono text-center tracking-[0.3em] text-base font-bold"
                    />
                    <span className="text-[11px] text-white/40 block mt-1">
                      Enter the single-use 15-minute PIN provided by the library admin.
                    </span>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1 text-white/70">
                      New Password (Min 12 Characters) <span className="text-red-400">*</span>
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
                    <label className="block font-semibold mb-1 text-white/70">
                      Confirm New Password <span className="text-red-400">*</span>
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
                      <div className={`mt-1 text-[11px] font-semibold flex items-center gap-1 ${
                        passwordsMatch ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {passwordsMatch ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                        {passwordsMatch ? 'Passwords match' : 'Passwords do not match yet'}
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={verifyLoading || !pwdStrength.isValid || !passwordsMatch || verifyPin.length !== 6}
                    className="btn btn-primary w-full py-2.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 mt-2"
                  >
                    {verifyLoading ? (
                      <>
                        <Loader2 size={15} className="animate-spin" /> Verifying & Updating Password...
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
