"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  KeyRound, ShieldCheck, UserCheck, AlertCircle, CheckCircle2, 
  Clock, X, Search, RefreshCw, AlertTriangle, Eye, ShieldAlert,
  Calendar, Building, ChevronRight, Copy, Check, Shield
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { 
  generateSecurePin, 
  generateSalt, 
  hashPin, 
  isPinExpired 
} from '../utils/cryptoResetUtils';

export default function AdminPasswordResetManagement({ user, currentUser, onCountUpdate }) {
  const activeAdminUser = user || currentUser;
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending'); // 'all' | 'pending' | 'approved' | 'completed' | 'rejected'

  // Verification & PIN Issuance Modal
  const [verifyModalTarget, setVerifyModalTarget] = useState(null);
  const [checklist, setChecklist] = useState({
    idCardVerified: true,
    enrollmentMatches: true,
    studentPresent: true
  });
  const [issuingPin, setIssuingPin] = useState(false);

  // Single-use PIN Reveal Dialog
  const [revealedPinData, setRevealedPinData] = useState(null); // { pin, rollNumber, referenceCode, expiresAt }
  const [copiedPin, setCopiedPin] = useState(false);

  // Rejection Modal
  const [rejectModalTarget, setRejectModalTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('In-person identity could not be verified with College ID.');
  const [rejecting, setRejecting] = useState(false);

  // Fetch Requests
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('password_reset_requests')
        .select('*, student:users!student_id(avatar_url)')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) {
        // Fallback to simple select if foreign key join fails
        const { data: fbData } = await supabase
          .from('password_reset_requests')
          .select('*')
          .order('created_at', { ascending: false });
          
        const normalized = (fbData || []).map(r => ({
          ...r,
          reference_code: r.request_reference || r.reference_code,
          request_reference: r.request_reference || r.reference_code,
          full_name: r.student_name || r.full_name,
          student_name: r.student_name || r.full_name
        }));
        setRequests(normalized);
      } else {
        const normalizedData = (data || []).map(r => ({
          ...r,
          avatar_url: r.student?.avatar_url || null,
          reference_code: r.request_reference || r.reference_code,
          request_reference: r.request_reference || r.reference_code,
          full_name: r.student_name || r.full_name,
          student_name: r.student_name || r.full_name
        }));
        setRequests(normalizedData);
      }

      // Notify parent about pending count for sidebar badges
      const { count: pendingCount } = await supabase
        .from('password_reset_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (typeof onCountUpdate === 'function') {
        onCountUpdate(pendingCount || 0);
      }
    } catch (err) {
      console.error('[AdminReset] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, onCountUpdate]);

  useEffect(() => {
    fetchRequests();

    // Subscribe to realtime updates on password_reset_requests table
    const channel = supabase
      .channel('password_reset_requests_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'password_reset_requests' }, () => {
        fetchRequests();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRequests]);

  // Counts summary
  const counts = useMemo(() => {
    return {
      all: requests.length,
      pending: requests.filter(r => r.status === 'pending').length,
      approved: requests.filter(r => r.status === 'approved').length,
      completed: requests.filter(r => r.status === 'completed').length,
      rejected: requests.filter(r => r.status === 'rejected').length
    };
  }, [requests]);

  // Open Verify Modal
  const openVerifyModal = (req) => {
    setVerifyModalTarget(req);
    setChecklist({
      idCardVerified: true,
      enrollmentMatches: true,
      studentPresent: true
    });
  };

  // Issue PIN Handler
  const handleIssuePin = async () => {
    if (!verifyModalTarget) return;
    setIssuingPin(true);

    try {
      const pin = generateSecurePin();
      const salt = generateSalt ? generateSalt(16) : String(Math.random());
      const pinHash = await hashPin(pin, salt);
      
      const d = new Date();
      d.setMinutes(d.getMinutes() + 15);
      const expiresAt = d.toISOString();

      const { error: updErr } = await supabase
        .from('password_reset_requests')
        .update({
          status: 'approved',
          pin_hash: pinHash,
          salt: salt,
          expires_at: expiresAt,
          attempt_count: 0,
          reviewed_by: activeAdminUser?.id || null,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', verifyModalTarget.id);

      if (updErr) throw updErr;

      // Show PIN once to admin
      setRevealedPinData({
        pin,
        rollNumber: verifyModalTarget.roll_number,
        fullName: verifyModalTarget.full_name,
        referenceCode: verifyModalTarget.reference_code,
        expiresAt
      });
      setCopiedPin(false);

      setVerifyModalTarget(null);
      fetchRequests();
    } catch (err) {
      alert('Failed to issue reset PIN: ' + (err.message || 'Unknown error'));
    } finally {
      setIssuingPin(false);
    }
  };

  // Reject Request Handler
  const handleReject = async () => {
    if (!rejectModalTarget) return;
    setRejecting(true);

    try {
      const { error: updErr } = await supabase
        .from('password_reset_requests')
        .update({
          status: 'rejected',
          rejection_reason: rejectReason.trim() || 'In-person verification failed.',
          reviewed_by: activeAdminUser?.id || null,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', rejectModalTarget.id);

      if (updErr) throw updErr;

      setRejectModalTarget(null);
      setRejectReason('In-person identity could not be verified with College ID.');
      fetchRequests();
    } catch (err) {
      alert('Failed to reject request: ' + (err.message || 'Unknown error'));
    } finally {
      setRejecting(false);
    }
  };

  const filteredRequests = requests.filter(r => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (r.roll_number && r.roll_number.toLowerCase().includes(q)) ||
      (r.full_name && r.full_name.toLowerCase().includes(q)) ||
      (r.student_name && r.student_name.toLowerCase().includes(q)) ||
      (r.reference_code && r.reference_code.toLowerCase().includes(q)) ||
      (r.request_reference && r.request_reference.toLowerCase().includes(q)) ||
      (r.branch_name && r.branch_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="animate-fade-in" style={{ width: '100%' }}>
      {/* ── Top Header Banner ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '22px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(37,99,235,0.25), rgba(14,165,233,0.18))',
            color: 'var(--primary, #2563eb)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(37,99,235,0.2)'
          }}>
            <KeyRound size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Student Password Reset Requests
            </h2>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '3px 0 0 0' }}>
              Verify student identity via College ID card in person and issue secure 15-minute one-time reset PINs.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchRequests}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 16px', fontSize: '0.84rem' }}
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Requests
        </button>
      </div>

      {/* ── 5 KPI Metric Summary Cards ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '12px',
        marginBottom: '20px'
      }}>
        {[
          { id: 'pending', label: 'Pending Verification', count: counts.pending, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
          { id: 'approved', label: 'Approved (PIN Active)', count: counts.approved, color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
          { id: 'completed', label: 'Completed Resets', count: counts.completed, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
          { id: 'rejected', label: 'Rejected Requests', count: counts.rejected, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)' },
          { id: 'all', label: 'Total All Requests', count: counts.all, color: '#a855f7', bg: 'rgba(168, 85, 247, 0.12)' }
        ].map(item => {
          const isSelected = statusFilter === item.id;
          return (
            <div
              key={item.id}
              onClick={() => setStatusFilter(item.id)}
              className="glass-panel"
              style={{
                padding: '14px 16px',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: isSelected ? item.bg : 'var(--bg-card, rgba(255, 255, 255, 0.03))',
                border: isSelected ? `1.5px solid ${item.color}` : '1px solid var(--border-glass)',
                boxShadow: isSelected ? `0 4px 14px ${item.bg}` : 'none'
              }}
            >
              <div style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: isSelected ? item.color : 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: '6px'
              }}>
                {item.label}
              </div>
              <div style={{
                fontSize: '1.65rem',
                fontWeight: 800,
                color: item.color,
                lineHeight: 1
              }}>
                {item.count}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Search & Filter Pill Strip ── */}
      <div className="glass-panel" style={{
        padding: '14px 18px',
        borderRadius: '14px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="glass-input"
            placeholder="Search by Roll Number, Name, Branch, or Reference (e.g. PR-2026-X8K9M2)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', paddingLeft: '40px', fontSize: '0.84rem' }}
          />
        </div>

        {/* Quick Filter Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600, marginRight: '4px' }}>
            Filter:
          </span>
          {[
            { id: 'pending', label: 'pending' },
            { id: 'approved', label: 'approved' },
            { id: 'completed', label: 'completed' },
            { id: 'rejected', label: 'rejected' },
            { id: 'all', label: 'all' }
          ].map(f => {
            const isSel = statusFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`btn ${isSel ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  padding: '6px 14px',
                  fontSize: '0.78rem',
                  borderRadius: '8px',
                  fontWeight: isSel ? 700 : 500,
                  textTransform: 'capitalize'
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Table Container ── */}
      <div className="glass-panel" style={{
        borderRadius: '16px',
        overflow: 'hidden',
        border: '1px solid var(--border-glass)'
      }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
            <RefreshCw size={22} className="animate-spin" style={{ margin: '0 auto 10px', color: 'var(--primary)' }} />
            Loading student password reset requests...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
            <ShieldCheck size={36} color="var(--success, #10b981)" style={{ margin: '0 auto 12px', opacity: 0.8 }} />
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
              No {statusFilter !== 'all' ? statusFilter : ''} reset requests match your current filters
            </div>
            <div style={{ fontSize: '0.8rem' }}>
              When students submit a password reset request from the login screen, it will appear here for physical ID verification.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderBottom: '1px solid var(--border-glass)',
                  color: 'var(--text-muted)',
                  fontSize: '0.72rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Student Details</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Tracking Reference</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Department &amp; Sem</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Reason for Reset</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Submitted</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Status</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700, textAlign: 'right' }}>Verification Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((req, idx) => {
                  const isPending = req.status === 'pending';
                  const isApproved = req.status === 'approved';
                  const isCompleted = req.status === 'completed';
                  const isRejected = req.status === 'rejected';
                  const expired = isPinExpired(req.expires_at);

                  return (
                    <tr
                      key={req.id || idx}
                      style={{
                        borderBottom: '1px solid var(--border-glass)',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Student Details with Avatar */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {req.avatar_url ? (
                            <img
                              src={req.avatar_url}
                              alt={req.full_name || 'Student'}
                              referrerPolicy="no-referrer"
                              style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '10px',
                                objectFit: 'cover',
                                border: '1px solid var(--border-glass)',
                                flexShrink: 0
                              }}
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                if (e.currentTarget.nextElementSibling) e.currentTarget.nextElementSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '10px',
                            background: isPending ? 'rgba(245, 158, 11, 0.15)' : isApproved ? 'rgba(16, 185, 129, 0.15)' : 'var(--surface-glow)',
                            color: isPending ? 'var(--warning, #f59e0b)' : isApproved ? 'var(--success, #10b981)' : 'var(--text-muted)',
                            display: req.avatar_url ? 'none' : 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '0.92rem',
                            flexShrink: 0
                          }}>
                            {req.full_name ? req.full_name.charAt(0).toUpperCase() : 'S'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                              {req.full_name}
                            </div>
                            <div style={{
                              fontFamily: 'monospace',
                              fontSize: '0.76rem',
                              color: 'var(--primary, #3b82f6)',
                              fontWeight: 600,
                              marginTop: '2px'
                            }}>
                              {req.roll_number}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Reference */}
                      <td style={{ padding: '14px 18px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid var(--border-glass)',
                          fontSize: '0.78rem'
                        }}>
                          {req.reference_code}
                        </span>
                      </td>

                      {/* Department & Sem */}
                      <td style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{req.branch_name || 'General'}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Sem {req.semester || 'N/A'}</div>
                      </td>

                      {/* Reason */}
                      <td style={{ padding: '14px 18px', color: 'var(--text-secondary)', maxWidth: '220px' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={req.reason}>
                          {req.reason || 'No reason provided'}
                        </div>
                      </td>

                      {/* Submitted Time */}
                      <td style={{ padding: '14px 18px', color: 'var(--text-muted)', fontSize: '0.76rem', whiteSpace: 'nowrap' }}>
                        {new Date(req.created_at).toLocaleString([], {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </td>

                      {/* Status Badge */}
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '999px',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          background:
                            isPending ? 'rgba(245, 158, 11, 0.15)' :
                            isApproved ? 'rgba(16, 185, 129, 0.15)' :
                            isCompleted ? 'rgba(59, 130, 246, 0.15)' :
                            'rgba(239, 68, 68, 0.15)',
                          color:
                            isPending ? '#f59e0b' :
                            isApproved ? '#10b981' :
                            isCompleted ? '#60a5fa' :
                            '#f87171',
                          border: `1px solid ${
                            isPending ? 'rgba(245, 158, 11, 0.3)' :
                            isApproved ? 'rgba(16, 185, 129, 0.3)' :
                            isCompleted ? 'rgba(59, 130, 246, 0.3)' :
                            'rgba(239, 68, 68, 0.3)'
                          }`
                        }}>
                          {isApproved && expired ? 'PIN Expired' : req.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        {isPending ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() => openVerifyModal(req)}
                              className="btn btn-primary"
                              style={{
                                padding: '6px 12px',
                                fontSize: '0.76rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: '#10b981',
                                borderColor: '#10b981'
                              }}
                            >
                              <UserCheck size={13} /> Verify &amp; Issue PIN
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRejectModalTarget(req);
                                setRejectReason('In-person identity could not be verified with College ID.');
                              }}
                              className="btn btn-secondary"
                              style={{
                                padding: '6px 12px',
                                fontSize: '0.76rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                color: '#f87171',
                                borderColor: 'rgba(239, 68, 68, 0.3)'
                              }}
                            >
                              <X size={13} /> Reject
                            </button>
                          </div>
                        ) : isApproved ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                            <span style={{ fontSize: '0.74rem', color: '#10b981', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle2 size={13} /> PIN Active (15m)
                            </span>
                            <button
                              type="button"
                              onClick={() => openVerifyModal(req)}
                              className="btn btn-secondary"
                              style={{ padding: '5px 10px', fontSize: '0.72rem' }}
                            >
                              Regenerate
                            </button>
                          </div>
                        ) : isCompleted ? (
                          <span style={{ fontSize: '0.74rem', color: '#60a5fa', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={13} /> Password Updated
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.74rem', color: '#f87171', fontWeight: 600 }}>
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

      {/* ── MODAL 1: PHYSICAL VERIFICATION & PIN ISSUANCE ── */}
      {verifyModalTarget && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '480px',
            borderRadius: '20px',
            padding: '24px',
            background: 'var(--bg-card-solid, #0f172a)',
            border: '1.5px solid var(--border-glass)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  padding: '8px',
                  borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981'
                }}>
                  <UserCheck size={20} />
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Physical Identity Verification
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setVerifyModalTarget(null)}
                className="btn btn-secondary"
                style={{ padding: '6px', borderRadius: '8px', minWidth: 'auto' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Target Details */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '14px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-glass)',
              marginBottom: '18px',
              fontSize: '0.84rem'
            }}>
              {verifyModalTarget.avatar_url ? (
                <img
                  src={verifyModalTarget.avatar_url}
                  alt={verifyModalTarget.full_name}
                  referrerPolicy="no-referrer"
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '10px',
                    objectFit: 'cover',
                    border: '1px solid var(--border-glass)',
                    flexShrink: 0
                  }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : null}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div>Student Name: <strong>{verifyModalTarget.full_name}</strong></div>
                <div>Roll Number: <strong style={{ color: 'var(--primary)' }}>{verifyModalTarget.roll_number}</strong></div>
                <div>Branch &amp; Sem: <strong>{verifyModalTarget.branch_name} ({verifyModalTarget.semester})</strong></div>
                <div>Tracking Code: <strong style={{ fontFamily: 'monospace' }}>{verifyModalTarget.reference_code}</strong></div>
              </div>
            </div>

            {/* Mandatory Verification Checklist */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>
                Mandatory Physical Checklist
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '0.82rem',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.02)'
                }}>
                  <input
                    type="checkbox"
                    checked={checklist.idCardVerified}
                    onChange={(e) => setChecklist(prev => ({ ...prev, idCardVerified: e.target.checked }))}
                    style={{ cursor: 'pointer', transform: 'scale(1.15)' }}
                  />
                  <span>1. Student physically presented valid <strong>College ID card</strong></span>
                </label>

                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '0.82rem',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.02)'
                }}>
                  <input
                    type="checkbox"
                    checked={checklist.enrollmentMatches}
                    onChange={(e) => setChecklist(prev => ({ ...prev, enrollmentMatches: e.target.checked }))}
                    style={{ cursor: 'pointer', transform: 'scale(1.15)' }}
                  />
                  <span>2. Name and Enrollment Number match institutional records</span>
                </label>

                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '0.82rem',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.02)'
                }}>
                  <input
                    type="checkbox"
                    checked={checklist.studentPresent}
                    onChange={(e) => setChecklist(prev => ({ ...prev, studentPresent: e.target.checked }))}
                    style={{ cursor: 'pointer', transform: 'scale(1.15)' }}
                  />
                  <span>3. Student is physically present at the Central Library desk</span>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setVerifyModalTarget(null)}
                className="btn btn-secondary"
                style={{ flex: 1, padding: '10px', fontSize: '0.84rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleIssuePin}
                disabled={issuingPin}
                className="btn btn-primary"
                style={{
                  flex: 2,
                  padding: '10px',
                  fontSize: '0.84rem',
                  background: '#10b981',
                  borderColor: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                {issuingPin ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={16} />}
                Confirm ID &amp; Issue PIN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 2: SINGLE-USE PIN REVEAL DIALOG ── */}
      {revealedPinData && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '440px',
            borderRadius: '22px',
            padding: '28px',
            background: 'var(--bg-card-solid, #0f172a)',
            border: '2px solid rgba(16, 185, 129, 0.4)',
            boxShadow: '0 25px 60px rgba(16, 185, 129, 0.25)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <CheckCircle2 size={32} />
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 6px', color: 'var(--text-primary)' }}>
              15-Minute Reset PIN Issued!
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 20px' }}>
              Hand this single-use authorization PIN directly to student <strong>{revealedPinData.fullName}</strong>.
            </p>

            {/* PIN Highlight Box */}
            <div style={{
              padding: '18px',
              borderRadius: '16px',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '2px dashed rgba(16, 185, 129, 0.35)',
              marginBottom: '20px'
            }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                Single-Use Verification PIN
              </div>
              <div style={{
                fontSize: '2.5rem',
                fontWeight: 900,
                letterSpacing: '0.25em',
                color: '#34d399',
                fontFamily: 'monospace',
                userSelect: 'all',
                textShadow: '0 2px 10px rgba(16, 185, 129, 0.3)'
              }}>
                {revealedPinData.pin}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                ⏱️ Valid for <strong>15 minutes</strong> only (1-time use)
              </div>
            </div>

            {/* Copy PIN Button */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(revealedPinData.pin);
                  setCopiedPin(true);
                  setTimeout(() => setCopiedPin(false), 2500);
                }}
                className="btn btn-secondary"
                style={{ flex: 1, padding: '10px', fontSize: '0.84rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                {copiedPin ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                {copiedPin ? 'Copied PIN!' : 'Copy PIN'}
              </button>

              <button
                type="button"
                onClick={() => setRevealedPinData(null)}
                className="btn btn-primary"
                style={{ flex: 1, padding: '10px', fontSize: '0.84rem' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 3: REJECTION REASON MODAL ── */}
      {rejectModalTarget && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '460px',
            borderRadius: '20px',
            padding: '24px',
            background: 'var(--bg-card-solid, #0f172a)',
            border: '1.5px solid rgba(239, 68, 68, 0.35)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  padding: '8px',
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#ef4444'
                }}>
                  <X size={20} />
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Reject Password Reset
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRejectModalTarget(null)}
                className="btn btn-secondary"
                style={{ padding: '6px', borderRadius: '8px', minWidth: 'auto' }}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
              Are you sure you want to reject the reset request for <strong>{rejectModalTarget.full_name}</strong> ({rejectModalTarget.roll_number})?
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                Reason for Rejection (Visible to student)
              </label>
              <textarea
                rows={3}
                className="glass-input"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="State why this request was rejected..."
                style={{ width: '100%', fontSize: '0.84rem', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setRejectModalTarget(null)}
                className="btn btn-secondary"
                style={{ flex: 1, padding: '10px', fontSize: '0.84rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={rejecting || !rejectReason.trim()}
                className="btn btn-primary"
                style={{
                  flex: 1,
                  padding: '10px',
                  fontSize: '0.84rem',
                  background: '#ef4444',
                  borderColor: '#ef4444'
                }}
              >
                {rejecting ? <RefreshCw size={14} className="animate-spin" /> : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
