"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  KeyRound, Search, Check, X, Shield, AlertCircle, CheckCircle2, 
  Clock, RefreshCw, Filter, UserCheck, AlertTriangle, Copy, Loader2,
  Calendar, FileText, ChevronRight, Lock
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { generateSecurePin, hashPin } from '../utils/cryptoResetUtils';

export default function AdminPasswordResetManagement({ currentUser }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('pending'); // 'all' | 'pending' | 'approved' | 'completed' | 'rejected'
  const [searchQuery, setSearchQuery] = useState('');

  // Approval Modal State
  const [selectedApproveReq, setSelectedApproveReq] = useState(null);
  const [generatedPinData, setGeneratedPinData] = useState(null); // { pin, expiresAt, ref }
  const [actionLoading, setActionLoading] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);

  // Rejection Modal State
  const [selectedRejectReq, setSelectedRejectReq] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('In-person identity could not be verified with College ID.');

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('password_reset_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchErr) {
        // Graceful handle if table doesn't exist yet
        if (fetchErr.code === '42P01' || fetchErr.message?.includes('does not exist')) {
          setError('Database table "password_reset_requests" not found. Please execute the migration SQL in Supabase.');
          setRequests([]);
          return;
        }
        throw fetchErr;
      }
      setRequests(data || []);
    } catch (err) {
      console.error('[AdminResets] Fetch error:', err);
      setError(err.message || 'Failed to load password reset requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();

    // Subscribe to realtime changes on password_reset_requests
    const channel = supabase
      .channel('schema-db-changes-pwd-resets')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'password_reset_requests' },
        () => {
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRequests]);

  // Counts
  const counts = useMemo(() => {
    return {
      all: requests.length,
      pending: requests.filter(r => r.status === 'pending').length,
      approved: requests.filter(r => r.status === 'approved').length,
      completed: requests.filter(r => r.status === 'completed').length,
      rejected: requests.filter(r => r.status === 'rejected').length
    };
  }, [requests]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      const matchStatus = statusFilter === 'all' || req.status === statusFilter;
      const cleanSearch = searchQuery.toLowerCase().trim();
      const matchSearch = !cleanSearch ||
        req.roll_number?.toLowerCase().includes(cleanSearch) ||
        req.student_name?.toLowerCase().includes(cleanSearch) ||
        req.request_reference?.toLowerCase().includes(cleanSearch) ||
        req.branch_name?.toLowerCase().includes(cleanSearch);

      return matchStatus && matchSearch;
    });
  }, [requests, statusFilter, searchQuery]);

  // ── Action: Approve Request and Issue 15-Minute PIN ──
  const handleApprove = async () => {
    if (!selectedApproveReq) return;
    setActionLoading(true);
    try {
      const plainPin = generateSecurePin();
      const { hash, salt } = await hashPin(plainPin);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins

      const { error: updateErr } = await supabase
        .from('password_reset_requests')
        .update({
          status: 'approved',
          pin_hash: hash,
          salt: salt,
          expires_at: expiresAt,
          attempt_count: 0,
          reviewed_by: currentUser?.id || null,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', selectedApproveReq.id);

      if (updateErr) throw updateErr;

      // Log in audit trail
      try {
        await supabase.from('activity_logs').insert([{
          user_id: currentUser?.id,
          action_type: 'password_reset_approved',
          details: `Admin ${currentUser?.username || 'admin'} approved reset PIN for Roll: ${selectedApproveReq.roll_number} (Ref: ${selectedApproveReq.request_reference})`
        }]);
      } catch {}

      setGeneratedPinData({
        pin: plainPin,
        expiresAt,
        ref: selectedApproveReq.request_reference,
        rollNumber: selectedApproveReq.roll_number,
        studentName: selectedApproveReq.student_name
      });
      fetchRequests();
    } catch (err) {
      alert('Failed to approve request: ' + (err.message || err));
    } finally {
      setActionLoading(false);
    }
  };

  // ── Action: Reject Request ──
  const handleReject = async () => {
    if (!selectedRejectReq) return;
    setActionLoading(true);
    try {
      const { error: updateErr } = await supabase
        .from('password_reset_requests')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason.trim(),
          reviewed_by: currentUser?.id || null,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', selectedRejectReq.id);

      if (updateErr) throw updateErr;

      // Log in audit trail
      try {
        await supabase.from('activity_logs').insert([{
          user_id: currentUser?.id,
          action_type: 'password_reset_rejected',
          details: `Admin ${currentUser?.username || 'admin'} rejected reset request for Roll: ${selectedRejectReq.roll_number}. Reason: ${rejectionReason}`
        }]);
      } catch {}

      setSelectedRejectReq(null);
      fetchRequests();
    } catch (err) {
      alert('Failed to reject request: ' + (err.message || err));
    } finally {
      setActionLoading(false);
    }
  };

  const copyPin = (text) => {
    navigator.clipboard?.writeText(text);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div 
        className="glass-panel p-6 rounded-2xl flex flex-wrap items-center justify-between gap-4"
        style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(147, 51, 234, 0.05) 100%)',
          border: '1.5px solid var(--border-glass, rgba(255, 255, 255, 0.12))'
        }}
      >
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/20">
            <KeyRound size={26} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white m-0">
              Student Password Reset Requests
            </h2>
            <p className="text-xs text-white/60 m-0 mt-1">
              Verify student identity via College ID card in person and issue secure 15-minute one-time reset PINs.
            </p>
          </div>
        </div>

        <button
          onClick={fetchRequests}
          disabled={loading}
          className="btn btn-secondary px-3.5 py-2 text-xs font-semibold rounded-xl flex items-center gap-2"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh Requests
        </button>
      </div>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { id: 'pending', label: 'Pending Verification', count: counts.pending, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
          { id: 'approved', label: 'Approved (PIN Active)', count: counts.approved, color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
          { id: 'completed', label: 'Completed Resets', count: counts.completed, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
          { id: 'rejected', label: 'Rejected Requests', count: counts.rejected, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
          { id: 'all', label: 'Total All Requests', count: counts.all, color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)' }
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setStatusFilter(item.id)}
            className={`p-4 rounded-xl text-left border transition-all ${
              statusFilter === item.id 
                ? 'ring-2 ring-blue-500/50 shadow-lg' 
                : 'hover:border-white/20'
            }`}
            style={{
              background: 'var(--bg-card, #121826)',
              borderColor: statusFilter === item.id ? item.color : 'var(--border-glass, rgba(255, 255, 255, 0.08))'
            }}
          >
            <span className="text-[11px] font-semibold text-white/50 block uppercase tracking-wider">
              {item.label}
            </span>
            <div className="text-2xl font-extrabold mt-1" style={{ color: item.color }}>
              {item.count}
            </div>
          </button>
        ))}
      </div>

      {/* Search and Filters Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/[0.02] p-3 rounded-xl border border-white/10">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Roll Number, Name, Branch, or Reference (e.g. PR-2026-X8K9M2)..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-black/30 border border-white/10 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <Filter size={13} className="text-white/40 ml-2" />
          <span className="text-white/50 font-semibold mr-1">Filter:</span>
          {['pending', 'approved', 'completed', 'rejected', 'all'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg font-semibold capitalize transition-all ${
                statusFilter === status
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div>
            <strong>Notice:</strong> {error}
          </div>
        </div>
      )}

      {/* Requests Table / Cards */}
      <div 
        className="glass-panel rounded-2xl overflow-hidden border"
        style={{
          background: 'var(--bg-card, #121826)',
          borderColor: 'var(--border-glass, rgba(255, 255, 255, 0.1))'
        }}
      >
        {loading && requests.length === 0 ? (
          <div className="p-12 text-center text-white/50 text-xs flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin text-blue-400" />
            Loading student password reset requests...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center text-white/40 text-xs">
            <KeyRound size={32} className="mx-auto mb-2 text-white/20" />
            No {statusFilter !== 'all' ? statusFilter : ''} reset requests match your current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.03] border-b border-white/10 text-white/50 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Student Details</th>
                  <th className="py-3 px-4">Tracking Reference</th>
                  <th className="py-3 px-4">Department & Sem</th>
                  <th className="py-3 px-4">Reason for Reset</th>
                  <th className="py-3 px-4">Submitted</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Verification Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredRequests.map(req => {
                  const isPending = req.status === 'pending';
                  const isApproved = req.status === 'approved';
                  const isExpired = req.expires_at && new Date(req.expires_at).getTime() < Date.now();

                  return (
                    <tr key={req.id} className="hover:bg-white/[0.02] transition-colors">
                      {/* Student Details */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white text-xs">
                          {req.student_name}
                        </div>
                        <div className="font-mono text-[11px] text-blue-400 font-semibold mt-0.5">
                          {req.roll_number}
                        </div>
                      </td>

                      {/* Reference */}
                      <td className="py-3.5 px-4 font-mono font-semibold text-white/80">
                        {req.request_reference}
                      </td>

                      {/* Department */}
                      <td className="py-3.5 px-4 text-white/70">
                        <div>{req.branch_name || 'N/A'}</div>
                        <div className="text-[10px] text-white/40">{req.semester || 'N/A'}</div>
                      </td>

                      {/* Reason */}
                      <td className="py-3.5 px-4 text-white/70 max-w-[200px] truncate" title={req.reason}>
                        {req.reason}
                      </td>

                      {/* Submitted Time */}
                      <td className="py-3.5 px-4 text-white/50 text-[11px]">
                        {new Date(req.created_at).toLocaleString([], {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                          req.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          req.status === 'pending' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                          req.status === 'completed' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                          'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                          {req.status === 'approved' && isExpired ? 'Expired' : req.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        {isPending ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedApproveReq(req)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                            >
                              <UserCheck size={13} />
                              Verify & Issue PIN
                            </button>
                            <button
                              onClick={() => {
                                setSelectedRejectReq(req);
                                setRejectionReason('In-person identity could not be verified with College ID.');
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white font-semibold flex items-center gap-1 border border-red-500/30 transition-all"
                            >
                              <X size={13} />
                              Reject
                            </button>
                          </div>
                        ) : isApproved ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                              <CheckCircle2 size={13} /> PIN Issued (15m)
                            </span>
                            <button
                              onClick={() => setSelectedApproveReq(req)}
                              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 font-semibold text-[11px] border border-white/10"
                            >
                              Regenerate
                            </button>
                          </div>
                        ) : req.status === 'completed' ? (
                          <span className="text-[11px] text-blue-400 font-semibold flex items-center justify-end gap-1">
                            <Check size={13} /> Password Updated
                          </span>
                        ) : (
                          <span className="text-[11px] text-red-400 font-semibold">
                            {req.rejection_reason || 'Rejected'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═════════ MODAL 1: VERIFY & APPROVE (ISSUE PIN) ═════════ */}
      {selectedApproveReq && !generatedPinData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div 
            className="w-full max-w-md rounded-2xl p-6 space-y-4 border shadow-2xl"
            style={{
              background: 'var(--bg-card, #121826)',
              borderColor: 'var(--border-glass, rgba(255, 255, 255, 0.15))',
              color: 'var(--text-primary, #ffffff)'
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <UserCheck size={18} />
                </div>
                <h3 className="font-bold text-sm m-0">In-Person Identity Verification</h3>
              </div>
              <button 
                onClick={() => setSelectedApproveReq(null)}
                className="text-white/50 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5">
                <div><strong>Student:</strong> {selectedApproveReq.student_name}</div>
                <div><strong>Roll Number:</strong> <span className="font-mono text-blue-400 font-bold">{selectedApproveReq.roll_number}</span></div>
                <div><strong>Branch / Sem:</strong> {selectedApproveReq.branch_name} ({selectedApproveReq.semester})</div>
                <div><strong>Reference:</strong> <span className="font-mono text-white/70">{selectedApproveReq.request_reference}</span></div>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 space-y-1">
                <strong className="block text-amber-300">⚠️ Physical Verification Checklist</strong>
                <div>1. Inspect the student's physical <strong>College Identity Card</strong>.</div>
                <div>2. Cross-check the name and enrollment number with the records above.</div>
                <div>3. Approving will generate a <strong>single-use 6-digit PIN</strong> valid for 15 minutes.</div>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setSelectedApproveReq(null)}
                className="btn btn-secondary flex-1 py-2 text-xs font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="btn btn-primary flex-1 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center gap-1.5"
              >
                {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
                Confirm ID & Issue PIN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════ MODAL 2: DISPLAY GENERATED PIN TO ADMIN ═════════ */}
      {generatedPinData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div 
            className="w-full max-w-md rounded-2xl p-6 space-y-4 border shadow-2xl text-center"
            style={{
              background: 'var(--bg-card, #121826)',
              borderColor: 'rgba(16, 185, 129, 0.4)',
              color: 'var(--text-primary, #ffffff)'
            }}
          >
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <CheckCircle2 size={24} />
            </div>

            <div>
              <h3 className="text-base font-bold text-emerald-400 m-0">Reset PIN Generated Successfully!</h3>
              <p className="text-xs text-white/60 mt-1">
                Tell this PIN to the verified student right now.
              </p>
            </div>

            {/* Big PIN Display */}
            <div className="p-5 rounded-2xl bg-black/50 border border-emerald-500/30 space-y-2">
              <span className="text-[11px] font-semibold text-white/50 block uppercase tracking-wider">
                Single-Use Reset PIN (Valid 15 Mins)
              </span>
              <div className="font-mono text-3xl font-extrabold tracking-[0.35em] text-emerald-400 select-all py-1">
                {generatedPinData.pin}
              </div>
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  onClick={() => copyPin(generatedPinData.pin)}
                  className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                >
                  {copiedPin ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  {copiedPin ? 'Copied' : 'Copy PIN'}
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 text-left text-xs space-y-1 text-white/80">
              <div><strong>Student:</strong> {generatedPinData.studentName} ({generatedPinData.rollNumber})</div>
              <div><strong>Reference:</strong> <span className="font-mono text-blue-400">{generatedPinData.ref}</span></div>
              <div className="text-[11px] text-amber-400 pt-1">
                ⏱️ <strong>Note:</strong> This PIN expires in 15 minutes. Student must enter this on the login page via "Forgot Password &gt; Enter PIN &amp; Reset".
              </div>
            </div>

            <button
              onClick={() => {
                setGeneratedPinData(null);
                setSelectedApproveReq(null);
              }}
              className="btn btn-primary w-full py-2.5 text-xs font-semibold rounded-lg"
            >
              Done & Close
            </button>
          </div>
        </div>
      )}

      {/* ═════════ MODAL 3: REJECT REQUEST ═════════ */}
      {selectedRejectReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div 
            className="w-full max-w-md rounded-2xl p-6 space-y-4 border shadow-2xl"
            style={{
              background: 'var(--bg-card, #121826)',
              borderColor: 'var(--border-glass, rgba(255, 255, 255, 0.15))',
              color: 'var(--text-primary, #ffffff)'
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-red-500/20 text-red-400">
                  <X size={18} />
                </div>
                <h3 className="font-bold text-sm m-0">Reject Reset Request</h3>
              </div>
              <button 
                onClick={() => setSelectedRejectReq(null)}
                className="text-white/50 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
                <div><strong>Student:</strong> {selectedRejectReq.student_name}</div>
                <div><strong>Roll Number:</strong> <span className="font-mono text-blue-400">{selectedRejectReq.roll_number}</span></div>
                <div><strong>Reference:</strong> {selectedRejectReq.request_reference}</div>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-white/70">
                  Rejection Reason (Visible to Student on Track Status)
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="State reason for rejecting request..."
                  required
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-red-500 text-xs"
                />
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setSelectedRejectReq(null)}
                className="btn btn-secondary flex-1 py-2 text-xs font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading || !rejectionReason.trim()}
                className="btn btn-primary flex-1 py-2 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-500 flex items-center justify-center gap-1.5"
              >
                {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
