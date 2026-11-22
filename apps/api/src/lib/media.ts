import net from 'net';
import crypto from 'crypto';
import { env } from '../config/env.js';

/**
 * Checks if a hostname or IP is a private/internal network (SSRF defense)
 */
export function isPrivateAddress(hostnameOrIp: string): boolean {
  const host = hostnameOrIp.toLowerCase().trim();

  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') {
    return true;
  }

  if (net.isIP(host) === 4) {
    const parts = host.split('.').map(Number);
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    // 127.0.0.0/8
    if (parts[0] === 127) return true;
    // 172.16.0.0/12 (172.16.0.0 to 172.31.255.255)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 169.254.0.0/16 (link local / AWS metadata service)
    if (parts[0] === 169 && parts[1] === 254) return true;
  }

  if (net.isIP(host) === 6) {
    // IPv6 loopback / unique local / link local
    if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) {
      return true;
    }
  }

  return false;
}

/**
 * Validates external media/GIF URL against SSRF
 */
export function validateMediaUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP/HTTPS URLs are allowed');
  }

  if (isPrivateAddress(parsed.hostname)) {
    throw new Error('SSRF protection: Private and loopback addresses are blocked');
  }

  return parsed;
}

/**
 * Generate a random storage key for an asset
 */
export function generateAssetStorageKey(userId: string, extension: string): string {
  const hash = crypto.randomBytes(16).toString('hex');
  const date = new Date().toISOString().slice(0, 7); // YYYY-MM
  return `users/${userId}/${date}/${hash}.${extension.replace(/^\./, '')}`;
}
