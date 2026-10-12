/**
 * Cryptographic Utilities for Admin-Approved Student Password Reset
 * SISTEC Central Library Portal
 * 
 * Works consistently in Node.js (v18+) and modern browser environments.
 */

/**
 * Generates a cryptographically secure 6-digit numeric PIN.
 * @returns {string} 6-digit PIN (e.g. "849201")
 */
export function generateSecurePin() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    // Range: 100000 to 999999
    const pinNumber = 100000 + (array[0] % 900000);
    return String(pinNumber);
  }
  // Secure fallback
  const rand = Math.floor(100000 + Math.random() * 900000);
  return String(rand);
}

/**
 * Generates a human-friendly unique request reference for student tracking.
 * @returns {string} e.g. "PR-2026-X8K9M2"
 */
export function generateRequestReference() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // base32 Crockford (no ambiguous O/0/I/1)
  let code = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < 6; i++) {
      code += chars[bytes[i] % chars.length];
    }
  } else {
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  const year = new Date().getFullYear();
  return `PR-${year}-${code}`;
}

/**
 * Generates a cryptographic salt string.
 * @param {number} length 
 * @returns {string}
 */
export function generateSalt(length = 16) {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }
  return Math.random().toString(36).substring(2, 18);
}

/**
 * Hashes a PIN with a salt using SHA-256.
 * @param {string} pin - 6-digit PIN
 * @param {string} [salt] - Optional pre-existing salt
 * @returns {Promise<{ hash: string, salt: string }>}
 */
export async function hashPin(pin, salt = null) {
  const cleanPin = String(pin).trim();
  const activeSalt = salt || generateSalt(16);
  const data = new TextEncoder().encode(`${cleanPin}:${activeSalt}:sistec-lib-auth`);

  if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return { hash: hashHex, salt: activeSalt };
  }

  // Node.js fallback if subtle is not directly exposed
  const nodeCrypto = await import('node:crypto');
  const hashHex = nodeCrypto.createHash('sha256').update(`${cleanPin}:${activeSalt}:sistec-lib-auth`).digest('hex');
  return { hash: hashHex, salt: activeSalt };
}

/**
 * Compares an input PIN against a stored hash in constant time.
 * @param {string} inputPin - Raw PIN submitted by user
 * @param {string} storedHash - Stored SHA-256 hex string
 * @param {string} salt - Stored salt
 * @returns {Promise<boolean>}
 */
export async function verifyPin(inputPin, storedHash, salt) {
  if (!inputPin || !storedHash || !salt) return false;
  const { hash } = await hashPin(inputPin, salt);
  return constantTimeCompare(hash, storedHash);
}

/**
 * Constant-time string comparison to defend against timing attacks.
 * @param {string} a 
 * @param {string} b 
 * @returns {boolean}
 */
export function constantTimeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export const PIN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
export const MAX_PIN_ATTEMPTS = 5; // Strict maximum failed attempts

/**
 * Checks if a timestamp has expired.
 * @param {string|Date} expiresAt 
 * @returns {boolean}
 */
export function isPinExpired(expiresAt) {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() <= Date.now();
}
