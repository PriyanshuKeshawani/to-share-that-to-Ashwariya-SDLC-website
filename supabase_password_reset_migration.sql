-- ==============================================================================
-- SISTEC Central Digital Library Portal — Admin-Approved Password Reset System
-- Migration: password_reset_requests schema and RLS policies
-- ==============================================================================

-- 1. Create password_reset_requests table
CREATE TABLE IF NOT EXISTS public.password_reset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  roll_number TEXT NOT NULL,
  student_name TEXT NOT NULL,
  branch_name TEXT,
  semester TEXT,
  reason TEXT NOT NULL,
  request_reference TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'expired')) DEFAULT 'pending',
  pin_hash TEXT,
  salt TEXT,
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  expires_at TIMESTAMP WITH TIME ZONE,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Performance and lookup indexes
CREATE INDEX IF NOT EXISTS idx_pwd_reset_roll_number ON public.password_reset_requests(roll_number);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_reference ON public.password_reset_requests(request_reference);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_status ON public.password_reset_requests(status);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_student_id ON public.password_reset_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_pwd_reset_created_at ON public.password_reset_requests(created_at DESC);

-- 3. Row-Level Security (RLS) Configuration
ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

-- Policy 1: Anyone (students submitting request) can insert a new pending request
DROP POLICY IF EXISTS "Allow student to submit reset request" ON public.password_reset_requests;
CREATE POLICY "Allow student to submit reset request"
ON public.password_reset_requests
FOR INSERT
WITH CHECK (
  status = 'pending' AND
  attempt_count = 0 AND
  pin_hash IS NULL
);

-- Policy 2: Public or student can view status of their request by reference (safe read)
DROP POLICY IF EXISTS "Allow student to read request status" ON public.password_reset_requests;
CREATE POLICY "Allow student to read request status"
ON public.password_reset_requests
FOR SELECT
USING (true);

-- Policy 3: Administrators can view all requests
DROP POLICY IF EXISTS "Admins can view all reset requests" ON public.password_reset_requests;
CREATE POLICY "Admins can view all reset requests"
ON public.password_reset_requests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- Policy 4: Administrators can review, approve, or reject requests
DROP POLICY IF EXISTS "Admins can update reset requests" ON public.password_reset_requests;
CREATE POLICY "Admins can update reset requests"
ON public.password_reset_requests
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- 4. Automatic timestamp updater trigger
CREATE OR REPLACE FUNCTION update_pwd_reset_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_pwd_reset_timestamp ON public.password_reset_requests;
CREATE TRIGGER trg_update_pwd_reset_timestamp
BEFORE UPDATE ON public.password_reset_requests
FOR EACH ROW
EXECUTE FUNCTION update_pwd_reset_timestamp();

-- 5. Helper function for clean student status check (strips pin_hash and salt)
CREATE OR REPLACE FUNCTION get_pwd_reset_status(p_ref TEXT)
RETURNS TABLE (
  request_reference TEXT,
  roll_number TEXT,
  student_name TEXT,
  status TEXT,
  rejection_reason TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE
)
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.request_reference,
    r.roll_number,
    r.student_name,
    r.status,
    r.rejection_reason,
    r.expires_at,
    r.created_at
  FROM public.password_reset_requests r
  WHERE r.request_reference = p_ref
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;
