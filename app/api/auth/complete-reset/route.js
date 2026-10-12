import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyPin, isPinExpired } from '@/utils/cryptoResetUtils';
import { validateNewPassword } from '@/utils/passwordPolicy';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

// Server-side Supabase client (elevated service role if available, fallback to anon)
const getAdminSupabase = () => {
  const key = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  return createClient(SUPABASE_URL, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      rollNumber,
      requestReference,
      pin,
      newPassword,
      confirmPassword
    } = body;

    // 1. Input sanitization and presence validation
    const cleanRoll = (rollNumber || '').trim();
    const cleanRef = (requestReference || '').trim().toUpperCase();
    const cleanPin = (pin || '').trim();

    if (!cleanRoll || !cleanRef || !cleanPin || !newPassword) {
      return NextResponse.json({
        success: false,
        error: 'Please fill in all fields (Roll Number, Request Reference, 6-digit PIN, and New Password).'
      }, { status: 400 });
    }

    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return NextResponse.json({
        success: false,
        error: 'Passwords do not match. Please re-enter your password.'
      }, { status: 400 });
    }

    // 2. Strong Password Policy Enforcement
    const policyResult = validateNewPassword(newPassword, { rollNumber: cleanRoll });
    if (!policyResult.isValid) {
      return NextResponse.json({
        success: false,
        error: policyResult.error || 'Password does not meet institutional security requirements.'
      }, { status: 400 });
    }

    const supabase = getAdminSupabase();

    // 3. Find the reset request
    const { data: requests, error: fetchErr } = await supabase
      .from('password_reset_requests')
      .select('*')
      .eq('request_reference', cleanRef)
      .limit(1);

    if (fetchErr || !requests || requests.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Password reset request not found. Please verify your reference number and roll number.'
      }, { status: 404 });
    }

    const resetReq = requests[0];

    // Verify student roll number matches
    if (resetReq.roll_number.toLowerCase() !== cleanRoll.toLowerCase()) {
      return NextResponse.json({
        success: false,
        error: 'Enrollment / Roll Number does not match this reset request reference.'
      }, { status: 400 });
    }

    // 4. Validate Request Status
    if (resetReq.status === 'pending') {
      return NextResponse.json({
        success: false,
        error: 'Your request is still pending administrator approval. Please visit the library desk with your College ID card.'
      }, { status: 400 });
    }

    if (resetReq.status === 'completed') {
      return NextResponse.json({
        success: false,
        error: 'This reset PIN has already been used. Please submit a new request if you need another reset.'
      }, { status: 400 });
    }

    if (resetReq.status === 'rejected') {
      return NextResponse.json({
        success: false,
        error: `Your request was rejected: ${resetReq.rejection_reason || 'Unverified student identity.'}`
      }, { status: 400 });
    }

    if (resetReq.status === 'expired') {
      return NextResponse.json({
        success: false,
        error: 'This reset credential has expired. Please contact the administrator for a new PIN.'
      }, { status: 400 });
    }

    // 5. Expiration check (15 minutes limit)
    if (isPinExpired(resetReq.expires_at)) {
      await supabase
        .from('password_reset_requests')
        .update({ status: 'expired' })
        .eq('id', resetReq.id);

      return NextResponse.json({
        success: false,
        error: 'The 15-minute validity period for this PIN has expired. Please request a new PIN from the administrator.'
      }, { status: 400 });
    }

    // 6. Max attempts rate-limiting check
    if (resetReq.attempt_count >= resetReq.max_attempts) {
      await supabase
        .from('password_reset_requests')
        .update({ status: 'expired' })
        .eq('id', resetReq.id);

      return NextResponse.json({
        success: false,
        error: 'Maximum verification attempts exceeded. For security, this PIN is now permanently locked.'
      }, { status: 400 });
    }

    // 7. Constant-Time PIN Verification
    const isMatch = await verifyPin(cleanPin, resetReq.pin_hash, resetReq.salt);

    if (!isMatch) {
      const nextAttemptCount = (resetReq.attempt_count || 0) + 1;
      const willLock = nextAttemptCount >= resetReq.max_attempts;

      await supabase
        .from('password_reset_requests')
        .update({
          attempt_count: nextAttemptCount,
          status: willLock ? 'expired' : 'approved'
        })
        .eq('id', resetReq.id);

      const attemptsRemaining = resetReq.max_attempts - nextAttemptCount;
      return NextResponse.json({
        success: false,
        error: willLock
          ? 'Incorrect PIN. Maximum attempts exceeded; this request has been locked.'
          : `Incorrect Reset PIN. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} remaining.`
      }, { status: 401 });
    }

    // 8. Execute Secure Password Update in Supabase Auth
    // Use Supabase Admin API to update the student's password
    const studentId = resetReq.student_id;
    let authUpdated = false;

    if (SUPABASE_SERVICE_ROLE_KEY) {
      const { error: adminUpdateErr } = await supabase.auth.admin.updateUserById(studentId, {
        password: newPassword
      });

      if (adminUpdateErr) {
        console.error('[ResetAuth] Admin updateUserById error:', adminUpdateErr);
        return NextResponse.json({
          success: false,
          error: 'Authentication provider failed to update password: ' + adminUpdateErr.message
        }, { status: 500 });
      }
      authUpdated = true;
    } else {
      // Fallback: If service role key is not configured yet in environment, log warning and fail safely
      console.warn('[ResetAuth] Notice: SUPABASE_SERVICE_ROLE_KEY not found in server environment.');
      return NextResponse.json({
        success: false,
        error: 'Server configuration pending: SUPABASE_SERVICE_ROLE_KEY required for administrative password updates.'
      }, { status: 500 });
    }

    // 9. Consume the Credential Atomically
    const nowIso = new Date().toISOString();
    await supabase
      .from('password_reset_requests')
      .update({
        status: 'completed',
        completed_at: nowIso,
        pin_hash: null, // wipe hash after single use
        salt: null
      })
      .eq('id', resetReq.id);

    // 10. Audit Logging
    try {
      await supabase.from('activity_logs').insert([{
        user_id: studentId,
        action_type: 'password_reset_completed',
        details: `Student password successfully reset via Admin PIN verification for Roll: ${cleanRoll} (Reference: ${cleanRef})`
      }]);
    } catch (logErr) {
      console.warn('[ResetAuth] Audit log notice:', logErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Your password has been successfully reset! You can now log in with your new credentials.'
    });

  } catch (err) {
    console.error('[ResetAuth] Unexpected error:', err);
    return NextResponse.json({
      success: false,
      error: 'An internal error occurred during password reset. Please try again or visit the admin desk.'
    }, { status: 500 });
  }
}
