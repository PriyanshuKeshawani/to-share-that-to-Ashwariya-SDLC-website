/**
 * Enterprise Password Security Policy and Strength Estimator
 * SISTEC Central Library Portal - Academic & Institutional Edition
 * 
 * Complies with NIST SP 800-63B guidelines and modern platform standards (e.g. Supabase Auth).
 */

export const PASSWORD_POLICY = {
  MIN_LENGTH: 12,
  MAX_LENGTH: 128,
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_NUMBER: true,
  REQUIRE_SPECIAL: true,
  DISALLOW_COMMON_PASSWORDS: true,
  DISALLOW_USER_ATTRIBUTES: true,
};

export const MIN_PASSWORD_LENGTH = PASSWORD_POLICY.MIN_LENGTH;
export const MAX_PASSWORD_LENGTH = PASSWORD_POLICY.MAX_LENGTH;

// Common predictable or leaked passwords (normalized lowercase)
const COMMON_PASSWORDS = new Set([
  'password1234',
  'password12345',
  'admin1234567',
  'administrator',
  'sistec123456',
  'sistech12345',
  'library12345',
  'welcome12345',
  'changeme1234',
  'iloveyou1234',
  'qwerty123456',
  '123456789012',
  '1234567890123',
  'computer1234',
  'engineering1',
  'passcode1234',
  'student12345',
  'academic1234',
  'secret123456',
  'testing12345'
]);

/**
 * Evaluates password strength and requirement compliance in real time.
 * @param {string} password - Raw password input
 * @param {object} [context] - Optional user context (username, email, rollNumber) to prevent identity embedding
 * @returns {object} Detailed evaluation result
 */
export function evaluatePasswordStrength(password, context = {}) {
  const pwd = typeof password === 'string' ? password : '';
  const length = pwd.length;

  // 1. Requirement checks
  const hasMinLength = length >= PASSWORD_POLICY.MIN_LENGTH;
  const withinMaxLength = length <= PASSWORD_POLICY.MAX_LENGTH;
  const hasUppercase = /[A-Z]/.test(pwd);
  const hasLowercase = /[a-z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const hasSpecial = /[^A-Za-z0-9]/.test(pwd);

  // 2. Unpredictability & Common pattern check
  const pwdLower = pwd.toLowerCase();
  let isNotCommon = true;
  let commonReason = null;

  const isCommonDict = COMMON_PASSWORDS.has(pwdLower) || 
    COMMON_PASSWORDS.has(pwdLower.replace(/[!@#$%^&*()_+=\-[\]{};':"\\|,.<>/?]/g, '')) ||
    /^(?:password|admin|welcome|qwerty|p@ssw0rd|sistec|sistech)[0-9!@#$%^&*_-]*$/i.test(pwd);

  if (isCommonDict) {
    isNotCommon = false;
    commonReason = 'Password is too common and easily guessable.';
  }

  // Check repetition (e.g. 'aaaa', '1111')
  if (/(.)\1{3,}/.test(pwd)) {
    isNotCommon = false;
    commonReason = 'Avoid repetitive character sequences (e.g. "aaaa" or "1111").';
  }

  // Check simple digit sequences (e.g. '12345', '98765')
  if (/(?:01234|12345|23456|34567|45678|56789|98765|87654|76543|65432|54321)/.test(pwd)) {
    isNotCommon = false;
    commonReason = 'Avoid simple sequential numbers (e.g. "12345").';
  }

  // Check context matching (username, roll number, email prefix)
  if (context && typeof context === 'object') {
    const identifiers = [
      context.username,
      context.rollNumber,
      context.btNumber,
      context.email ? context.email.split('@')[0] : null
    ].filter(id => typeof id === 'string' && id.trim().length >= 3);

    for (const id of identifiers) {
      const cleanId = id.trim().toLowerCase();
      if (cleanId && pwdLower.includes(cleanId)) {
        isNotCommon = false;
        commonReason = 'Password must not contain your username, roll number, or email.';
        break;
      }
    }
  }

  // 3. Structured rules checklist for UI display
  const rules = [
    {
      id: 'length',
      label: `At least ${PASSWORD_POLICY.MIN_LENGTH} characters`,
      hint: length > 0 ? `${length}/${PASSWORD_POLICY.MIN_LENGTH}` : null,
      met: hasMinLength && withinMaxLength,
      critical: true
    },
    {
      id: 'uppercase',
      label: 'At least one uppercase letter (A-Z)',
      met: hasUppercase,
      critical: true
    },
    {
      id: 'lowercase',
      label: 'At least one lowercase letter (a-z)',
      met: hasLowercase,
      critical: true
    },
    {
      id: 'number',
      label: 'At least one numeric digit (0-9)',
      met: hasNumber,
      critical: true
    },
    {
      id: 'special',
      label: 'At least one special symbol (!@#$%^&*...)',
      met: hasSpecial,
      critical: true
    },
    {
      id: 'unpredictable',
      label: 'Not easily guessable (no usernames or simple patterns)',
      met: isNotCommon,
      hint: commonReason,
      critical: true
    }
  ];

  // Named accessors for convenience and tests
  rules.minLength = rules[0];
  rules.hasUpper = rules[1];
  rules.hasLower = rules[2];
  rules.hasNumber = rules[3];
  rules.hasSpecial = rules[4];
  rules.notCommon = rules[5];

  // 4. Entropy / Multi-factor Strength Scoring (0 to 4)
  let score = 0;
  if (length === 0) {
    score = 0;
  } else {
    // Base points for length
    if (length >= 8) score += 1;
    if (length >= PASSWORD_POLICY.MIN_LENGTH) score += 1;
    if (length >= 16) score += 1;

    // Points for character diversity
    const charClassesCount = [hasUppercase, hasLowercase, hasNumber, hasSpecial].filter(Boolean).length;
    if (charClassesCount >= 3) score += 1;
    if (charClassesCount === 4) score += 1;

    // Penalty for failing unpredictability or length
    if (!isNotCommon) score = Math.min(score, 2);
    if (!hasMinLength) score = Math.min(score, 1);

    // Normalize to 0-4 range
    score = Math.max(0, Math.min(4, Math.floor(score * (4 / 5))));
  }

  // Mandatory policy compliance
  const allMandatoryMet = hasMinLength && withinMaxLength && hasUppercase && hasLowercase && hasNumber && hasSpecial && isNotCommon;
  const isValid = allMandatoryMet && score >= 2;

  // Visual & accessibility mappings
  const strengthMeta = [
    { label: 'Very Weak', color: '#ef4444', percent: 15, level: 'very-weak' },
    { label: 'Weak', color: '#f97316', percent: 35, level: 'weak' },
    { label: 'Fair', color: '#f59e0b', percent: 60, level: 'fair' },
    { label: 'Good', color: '#3b82f6', percent: 85, level: 'good' },
    { label: 'Strong', color: '#10b981', percent: 100, level: 'strong' }
  ];

  const currentMeta = length === 0
    ? { label: 'Empty', color: 'rgba(255, 255, 255, 0.2)', percent: 0, level: 'empty' }
    : strengthMeta[score];

  const errors = [];
  if (!hasMinLength && length > 0) errors.push(`Password must be at least ${PASSWORD_POLICY.MIN_LENGTH} characters long.`);
  if (!withinMaxLength) errors.push(`Password cannot exceed ${PASSWORD_POLICY.MAX_LENGTH} characters.`);
  if (!hasUppercase && length > 0) errors.push('Include at least one uppercase letter (A-Z).');
  if (!hasLowercase && length > 0) errors.push('Include at least one lowercase letter (a-z).');
  if (!hasNumber && length > 0) errors.push('Include at least one number (0-9).');
  if (!hasSpecial && length > 0) errors.push('Include at least one special character.');
  if (!isNotCommon && length > 0 && commonReason) errors.push(commonReason);

  return {
    score,
    percent: currentMeta.percent,
    label: currentMeta.label,
    color: currentMeta.color,
    level: currentMeta.level,
    rules,
    isValid,
    valid: isValid,
    errors,
    feedback: commonReason || ''
  };
}

/**
 * Validates newly created or updated passwords.
 * Used for registration, password reset, and change-password flows.
 * @param {string} password - Raw password
 * @param {object} [context] - Optional user context
 * @param {string} [confirmPassword] - Optional confirmation password
 * @returns {{ isValid: boolean, valid: boolean, error?: string }}
 */
export function validateNewPassword(password, context = {}, confirmPassword = undefined) {
  if (typeof password !== 'string' || password.length === 0) {
    return {
      isValid: false,
      valid: false,
      error: 'Password is required.'
    };
  }

  if (confirmPassword !== undefined && password !== confirmPassword) {
    return {
      isValid: false,
      valid: false,
      error: 'Passwords do not match.'
    };
  }

  const result = evaluatePasswordStrength(password, context);
  if (!result.isValid) {
    return {
      isValid: false,
      valid: false,
      error: result.errors[0] || 'Password does not satisfy the institutional security policy.'
    };
  }

  return { isValid: true, valid: true };
}

/**
 * Validates login password for existing accounts.
 * CRITICAL FOR BACKWARD COMPATIBILITY:
 * Never enforces new strength rules onto existing accounts logging in.
 * @param {string} password - Raw password from login form
 * @returns {{ isValid: boolean, valid: boolean, error?: string }}
 */
export function validateLoginPassword(password) {
  if (typeof password !== 'string' || password.trim().length === 0) {
    return {
      isValid: false,
      valid: false,
      error: 'Please enter your password.'
    };
  }
  return { isValid: true, valid: true };
}
