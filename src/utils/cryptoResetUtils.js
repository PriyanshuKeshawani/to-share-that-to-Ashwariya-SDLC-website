/**
 * Cryptographic Reset Utilities for In-Person Admin-Approved Password Recovery
 * Works in both browser environments and Node.js runtimes.
 */

export const MAX_RESET_ATTEMPTS = 5;
export const PIN_EXPIRY_MINUTES = 15;

/**
 * Generates a cryptographically secure 6-digit numeric PIN (100000 - 999999)
 */
export function generateSecurePin() {
  const min = 100000;
  const max = 999999;
  const range = max - min + 1;

  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const array = new Uint32Array(1);
    globalThis.crypto.getRandomValues(array);
    return String(min + (array[0] % range));
  }

  // Fallback for Node crypto if globalThis.crypto is unavailable
  try {
    const nodeCrypto = require('crypto');
    return String(nodeCrypto.randomInt(min, max + 1));
  } catch {
    // Edge fallback
    return String(Math.floor(min + Math.random() * range));
  }
}

/**
 * Generates an unambiguous tracking reference code: PR-YYYY-XXXXXX
 * Uses Crockford Base32 charset (excluding I, L, O, U) to avoid student transcription errors.
 */
export function generateRequestReference(year = new Date().getFullYear()) {
  const charset = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const len = 6;
  let code = '';

  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(len);
    globalThis.crypto.getRandomValues(bytes);
    for (let i = 0; i < len; i++) {
      code += charset[bytes[i] % charset.length];
    }
  } else {
    for (let i = 0; i < len; i++) {
      code += charset[Math.floor(Math.random() * charset.length)];
    }
  }

  return `PR-${year}-${code}`;
}

/**
 * Generates a random cryptographic salt (hex string)
 */
export function generateSalt(byteLength = 16) {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(byteLength);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return Math.random().toString(36).substring(2, 18);
}

/**
 * Computes a salted SHA-256 hash of a PIN.
 * Returns a hex string representation.
 */
export async function hashPin(pin, salt) {
  const message = `${String(salt).trim()}:${String(pin).trim()}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(message);

  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Node.js fallback
  try {
    const nodeCrypto = await import('crypto');
    return nodeCrypto.createHash('sha256').update(message).digest('hex');
  } catch {
    throw new Error('Cryptographic SHA-256 provider not available');
  }
}

/**
 * Performs constant-time comparison of two strings to prevent timing side-channel attacks.
 */
export function constantTimeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;

  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Verifies a candidate PIN against stored salted SHA-256 hash using constant-time comparison.
 */
export async function verifyPin(candidatePin, storedHash, salt) {
  if (!candidatePin || !storedHash || !salt) return false;
  const candidateHash = await hashPin(candidatePin, salt);
  return constantTimeCompare(candidateHash.toLowerCase(), storedHash.toLowerCase());
}

/**
 * Checks whether an ISO timestamp has passed the expiration limit.
 */
export function isPinExpired(expiresAt) {
  if (!expiresAt) return true;
  const expiryTime = new Date(expiresAt).getTime();
  if (isNaN(expiryTime)) return true;
  return Date.now() > expiryTime;
}

/**
 * Calculates a future ISO expiration timestamp from right now.
 */
export function calculateExpiration(minutes = PIN_EXPIRY_MINUTES) {
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}
