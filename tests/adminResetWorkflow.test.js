import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  generateSecurePin, 
  generateRequestReference, 
  hashPin, 
  verifyPin, 
  isPinExpired,
  PIN_EXPIRY_MS,
  MAX_PIN_ATTEMPTS
} from '../src/utils/cryptoResetUtils.js';

test('1. Secure PIN generation has cryptographic entropy and correct 6-digit format', () => {
  const pins = new Set();
  for (let i = 0; i < 50; i++) {
    const pin = generateSecurePin();
    assert.match(pin, /^\d{6}$/, 'PIN must be exactly 6 digits');
    pins.add(pin);
  }
  // All generated pins in a sample of 50 should be non-trivial and varied
  assert.ok(pins.size >= 45, 'Generated PINs must have high cryptographic entropy');
});

test('2. Human-friendly canonical request reference format', () => {
  const ref = generateRequestReference();
  assert.match(ref, /^PR-\d{4}-[A-Z0-9]{6}$/, 'Reference must match PR-YYYY-XXXXXX format');
  
  // Year should be current year
  const currentYear = new Date().getFullYear().toString();
  assert.ok(ref.includes(`PR-${currentYear}`), 'Reference must contain the current year');
});

test('3. PIN salt & SHA-256 hash generation and constant-time verification', async () => {
  const pin = '482915';
  const { salt, hash } = await hashPin(pin);

  assert.ok(salt && salt.length === 32, 'Salt must be a 16-byte hex string (32 characters)');
  assert.ok(hash && hash.length === 64, 'SHA-256 hash must be 64 characters');

  // Verify correct PIN matches
  const isMatch = await verifyPin(pin, hash, salt);
  assert.equal(isMatch, true, 'Correct PIN must verify successfully');

  // Verify wrong PIN fails
  const isWrong = await verifyPin('111111', hash, salt);
  assert.equal(isWrong, false, 'Wrong PIN must fail verification');

  // Verify slightly different PIN fails
  const isClose = await verifyPin('482914', hash, salt);
  assert.equal(isClose, false, 'Near-match PIN must fail verification');
});

test('4. PIN expiration lifecycle: 15-minute strict timeout', () => {
  const now = Date.now();
  
  // Expiring in 10 minutes (issued 5 min ago with 15m window): not expired
  const expiresFuture10 = new Date(now + 10 * 60 * 1000).toISOString();
  assert.equal(isPinExpired(expiresFuture10), false, 'PIN expiring in 10 min is valid');

  // Expiring in 1 minute: not expired
  const expiresFuture1 = new Date(now + 1 * 60 * 1000).toISOString();
  assert.equal(isPinExpired(expiresFuture1), false, 'PIN expiring in 1 min is valid');

  // Expired 1 minute ago (past expiration point): expired
  const expired1MinAgo = new Date(now - 1 * 60 * 1000).toISOString();
  assert.equal(isPinExpired(expired1MinAgo), true, 'PIN that passed expiration timestamp is expired');

  // Expired 16 minutes ago: expired
  const expired16MinAgo = new Date(now - 16 * 60 * 1000).toISOString();
  assert.equal(isPinExpired(expired16MinAgo), true, 'PIN expired 16 min ago is expired');

  // Null or missing timestamp: safely treated as expired
  assert.equal(isPinExpired(null), true, 'Null timestamp is treated as expired');
  assert.equal(isPinExpired(undefined), true, 'Undefined timestamp is treated as expired');
});

test('5. Attempt limits and constants', () => {
  assert.equal(PIN_EXPIRY_MS, 15 * 60 * 1000, 'Expiration is exactly 15 minutes in ms');
  assert.equal(MAX_PIN_ATTEMPTS, 5, 'Maximum PIN attempts before lockout is 5');
});

test('6. Constant-time comparison resilience against length differences or empty inputs', async () => {
  const { salt, hash } = await hashPin('123456');
  
  // Empty or malformed inputs must return false cleanly without crashing
  assert.equal(await verifyPin('', hash, salt), false);
  assert.equal(await verifyPin(null, hash, salt), false);
  assert.equal(await verifyPin(undefined, hash, salt), false);
  assert.equal(await verifyPin('123456', '', salt), false);
  assert.equal(await verifyPin('123456', hash, ''), false);
});
