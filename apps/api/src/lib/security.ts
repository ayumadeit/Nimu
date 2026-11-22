import argon2 from 'argon2';
import crypto from 'crypto';
import * as jose from 'jose';
import { env } from '../config/env.js';

// Common passwords list
const COMMON_PASSWORDS = new Set([
  'password',
  'password123',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty123',
  'iloveyou',
  'admin123',
  'welcome1',
]);

export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password.toLowerCase());
}

/**
 * Hash password using Argon2id with recommended parameters
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 1,
  });
}

/**
 * Verify password against Argon2id hash
 */
export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

/**
 * Hash a token (e.g. refresh token or reset token) using SHA-256
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate cryptographically secure random token string
 */
export function generateRandomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

// Convert JWT secrets to Uint8Array for jose
const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

export interface JwtPayload {
  sub: string; // userId
  email: string;
  sessionId?: string;
  [key: string]: unknown;
}

/**
 * Sign a short-lived access token
 */
export async function signAccessToken(payload: JwtPayload): Promise<string> {
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_EXPIRES_IN)
    .sign(accessSecret);
}

/**
 * Verify access token
 */
export async function verifyAccessToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, accessSecret);
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}
