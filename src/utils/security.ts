/**
 * Security utilities for tactical data protection.
 *
 * Provides encryption helpers and data sanitization.
 * In production, use react-native-mmkv's built-in AES-CFB encryption
 * and SQLCipher for database encryption.
 */

/**
 * Generate a unique detection ID with timestamp and random component.
 * Not cryptographically secure - for event correlation only.
 */
export function generateDetectionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `det_${timestamp}_${random}`;
}

/**
 * Generate a unique session ID.
 */
export function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `session_${timestamp}_${random}`;
}

/**
 * Sanitize text for safe display (prevent injection in logs).
 */
export function sanitizeLogText(text: string): string {
  return text.replace(/[<>&"']/g, (char) => {
    const entities: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[char] || char;
  });
}

/**
 * Wipe sensitive data from memory (best-effort in JS).
 * Note: JavaScript garbage collection makes true secure erase impossible.
 * For production, use native secure memory via Expo Modules API.
 */
export function secureWipe(arr: Float32Array | Uint8Array): void {
  arr.fill(0);
}
