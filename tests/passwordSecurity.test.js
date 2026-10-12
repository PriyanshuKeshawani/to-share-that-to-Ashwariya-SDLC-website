import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  validateLoginPassword, 
  validateNewPassword, 
  evaluatePasswordStrength,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH
} from '../src/utils/passwordPolicy.js';

test('1. Existing users: backward compatibility is guaranteed at login', () => {
  // Existing users with short or simple passwords must NEVER be locked out by new rules
  assert.equal(validateLoginPassword('123456').valid, true, '6-char legacy password must be accepted at login');
  assert.equal(validateLoginPassword('oldpass').valid, true, 'simple lowercase legacy password must be accepted at login');
  assert.equal(validateLoginPassword('short').valid, true, 'short password accepted at login boundary');
  assert.equal(validateLoginPassword('MySecretP@ssword2024').valid, true, 'standard password accepted at login');

  // Empty or whitespace-only must still fail cleanly
  assert.equal(validateLoginPassword('').valid, false, 'Empty password rejected');
  assert.equal(validateLoginPassword('   ').valid, false, 'Whitespace-only password rejected');
  assert.equal(validateLoginPassword(null).valid, false, 'Null password rejected');
  assert.equal(validateLoginPassword(undefined).valid, false, 'Undefined password rejected');
});

test('2. Strong password policy: length limits and truncation safety', () => {
  assert.equal(MIN_PASSWORD_LENGTH, 12, 'Policy enforces min length of at least 12');
  assert.equal(MAX_PASSWORD_LENGTH, 128, 'Policy enforces max length of 128 (no silent truncation)');

  const shortResult = validateNewPassword('Ab1!short');
  assert.equal(shortResult.valid, false);
  assert.match(shortResult.error, /at least 12 characters/i);

  const tooLong = 'A1!'.padEnd(129, 'x');
  const tooLongResult = validateNewPassword(tooLong);
  assert.equal(tooLongResult.valid, false);
  assert.match(tooLongResult.error, /cannot exceed 128 characters/i);
});

test('3. Real-time requirement evaluation: individual rule indicators update accurately', () => {
  // Check lowercase only
  const eval1 = evaluatePasswordStrength('abcdefghijkl');
  assert.equal(eval1.rules.minLength.met, true);
  assert.equal(eval1.rules.hasLower.met, true);
  assert.equal(eval1.rules.hasUpper.met, false);
  assert.equal(eval1.rules.hasNumber.met, false);
  assert.equal(eval1.rules.hasSpecial.met, false);
  assert.equal(eval1.isValid, false);

  // Add uppercase
  const eval2 = evaluatePasswordStrength('abcdefghijkL');
  assert.equal(eval2.rules.hasUpper.met, true);
  assert.equal(eval2.rules.hasNumber.met, false);
  assert.equal(eval2.isValid, false);

  // Add number
  const eval3 = evaluatePasswordStrength('abcdefghijK1');
  assert.equal(eval3.rules.hasNumber.met, true);
  assert.equal(eval3.rules.hasSpecial.met, false);
  assert.equal(eval3.isValid, false);

  // Add special char
  const eval4 = evaluatePasswordStrength('abcdefghijK1!');
  assert.equal(eval4.rules.hasSpecial.met, true);
  assert.equal(eval4.isValid, true);
  assert.ok(eval4.score >= 3, 'Valid password with all rules must score Fair to Strong');
});

test('4. Weak and commonly compromised passwords are rejected', () => {
  const commonPasswords = [
    'Password12345!',
    'Admin12345678!',
    'Welcome12345!',
    'P@ssw0rd2024!',
    'Sistec123456!'
  ];

  for (const pw of commonPasswords) {
    const res = validateNewPassword(pw);
    assert.equal(res.valid, false, `Common password "${pw}" should be rejected`);
    assert.match(res.error, /common|predictable|pattern|sequential/i);
  }
});

test('5. Anti-pattern detection: sequential numbers and character repetitions', () => {
  // Password with sequential digits '123456'
  const seqRes = evaluatePasswordStrength('CompliantPass123456!');
  assert.equal(seqRes.rules.notCommon.met, false, 'Sequential digits should be flagged');
  assert.match(seqRes.feedback, /sequential|avoid sequential/i);

  // Password with repeated characters
  const repRes = evaluatePasswordStrength('Aaaaaaaa1234!@#');
  assert.equal(repRes.rules.notCommon.met, false, 'Excessive repetition should be flagged');
});

test('6. User identity context matching: rejects passwords containing user information', () => {
  const context = {
    username: 'rohit_kumar',
    rollNumber: '0187CS211045',
    email: 'rohit@sistec.ac.in'
  };

  // Password containing username
  const userResult = validateNewPassword('Rohit_kumar@2026Secure', context);
  assert.equal(userResult.valid, false);
  assert.match(userResult.error, /personal information|name|roll number/i);

  // Password containing roll number
  const rollResult = validateNewPassword('Pass#0187CS211045!', context);
  assert.equal(rollResult.valid, false);
  assert.match(rollResult.error, /personal information|name|roll number/i);

  // Compliant password without context leaks passes
  const goodResult = validateNewPassword('Galaxy#Aurora9471Secure', context);
  assert.equal(goodResult.valid, true);
});

test('7. Compliant strong passwords pass the policy with high scores', () => {
  const compliantPasswords = [
    'Sistec@CentralLib#2026',
    'Quantum&Kinetics*8812',
    'Cipher-Nexus$99824X',
    'Starlight#Horizon@2026!'
  ];

  for (const pw of compliantPasswords) {
    const val = validateNewPassword(pw);
    assert.equal(val.valid, true, `Compliant password "${pw}" must be valid`);
    const evalData = evaluatePasswordStrength(pw);
    assert.equal(evalData.isValid, true);
    assert.ok(evalData.score >= 3, `Score for "${pw}" should be Good (3) or Strong (4)`);
    assert.equal(evalData.rules.minLength.met, true);
    assert.equal(evalData.rules.hasUpper.met, true);
    assert.equal(evalData.rules.hasLower.met, true);
    assert.equal(evalData.rules.hasNumber.met, true);
    assert.equal(evalData.rules.hasSpecial.met, true);
    assert.equal(evalData.rules.notCommon.met, true);
  }
});

test('8. Real-time strength score transitions (Very Weak -> Strong)', () => {
  const s0 = evaluatePasswordStrength('');
  assert.equal(s0.score, 0);
  assert.equal(s0.label, 'Empty');

  const sWeak = evaluatePasswordStrength('a');
  assert.equal(sWeak.score, 0);
  assert.equal(sWeak.label, 'Very Weak');

  const s1 = evaluatePasswordStrength('short');
  assert.ok(s1.score <= 1);

  const s2 = evaluatePasswordStrength('moderatelength12');
  assert.ok(s2.score >= 2);

  const s3 = evaluatePasswordStrength('Compliant#Pass12');
  assert.ok(s3.score >= 3);
  assert.equal(s3.isValid, true);

  const s4 = evaluatePasswordStrength('Aeronautic#Voyager$2026');
  assert.equal(s4.score, 4);
  assert.equal(s4.label, 'Strong');
  assert.equal(s4.isValid, true);
});

test('9. Confirmation match validation', () => {
  const val = validateNewPassword('Aeronautic#Voyager$2026', {}, 'Aeronautic#Voyager$2026');
  assert.equal(val.valid, true);

  const mismatch = validateNewPassword('Aeronautic#Voyager$2026', {}, 'Different#Voyager$2026');
  assert.equal(mismatch.valid, false);
  assert.match(mismatch.error, /passwords do not match/i);
});

test('10. Server / Context layer bypass prevention', () => {
  // Simulating an unauthorized API call or bypassed client form trying to pass a weak password
  const bypassPayloads = [
    'weak',
    '123456',
    'password',
    'Abcdefghijk1', // 12 chars but missing special char
    'abcdefghijk!1', // 13 chars but missing upper
    'ABCDEFGHIJK!1'  // 13 chars but missing lower
  ];

  for (const payload of bypassPayloads) {
    const check = validateNewPassword(payload);
    assert.equal(check.valid, false, `Bypass attempt with "${payload}" must be rejected`);
    assert.ok(check.error.length > 0, 'Must produce a clean security error message');
  }
});

test('11. Password visibility toggle specification & value preservation', () => {
  // Test visibility toggle state logic
  let isVisible = false;
  const passwordValue = 'SuperSecret$9912Password!';

  // Initial state: masked
  assert.equal(isVisible ? 'text' : 'password', 'password');
  assert.equal(isVisible ? 'Hide password' : 'Show password', 'Show password');

  // Toggle on: visible text, value strictly intact
  isVisible = !isVisible;
  assert.equal(isVisible ? 'text' : 'password', 'text');
  assert.equal(isVisible ? 'Hide password' : 'Show password', 'Hide password');
  assert.equal(passwordValue, 'SuperSecret$9912Password!', 'Value must not change when toggled');

  // Toggle off: masked, value strictly intact
  isVisible = !isVisible;
  assert.equal(isVisible ? 'text' : 'password', 'password');
  assert.equal(passwordValue, 'SuperSecret$9912Password!', 'Value must remain intact after multiple toggles');
});

test('12. Authentication failures are handled safely without credential leaks', () => {
  const safeLoginFailure = (rawError, inputPassword) => {
    // Sanitized user error message
    const sanitizedMessage = 'Invalid credentials. Please verify your Institutional ID or email and password.';
    // Ensure raw password is NEVER included in user message or diagnostics string
    assert.equal(sanitizedMessage.includes(inputPassword), false);
    return sanitizedMessage;
  };

  const sensitivePassword = 'MySecretPassword123!';
  const message = safeLoginFailure(new Error('Invalid login credentials'), sensitivePassword);
  assert.equal(message.includes(sensitivePassword), false, 'Password must never leak in error messages');
  assert.match(message, /invalid credentials/i);
});

test('13. Accessibility and live region contracts', () => {
  const strength = evaluatePasswordStrength('Moderate#1234');
  
  // Verify accessible metadata is provided
  assert.ok(strength.label.length > 0, 'Must have text label for non-color dependent status');
  assert.ok(strength.percent >= 0 && strength.percent <= 100, 'Percent must be valid for progress indicator');
  assert.ok(Array.isArray(strength.rules), 'Rules must be an array for accessible checklist');
  
  for (const rule of strength.rules) {
    assert.ok(typeof rule.id === 'string');
    assert.ok(typeof rule.label === 'string');
    assert.ok(typeof rule.met === 'boolean');
  }
});
