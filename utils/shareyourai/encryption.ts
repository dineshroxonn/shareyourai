import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';

function getMasterKey(): Uint8Array {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  const decoded = decodeBase64(key);
  if (decoded.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (base64 encoded)');
  }
  return decoded;
}

export interface EncryptedData {
  encrypted: string;
  nonce: string;
}

/**
 * Encrypt a plaintext string using NaCl secretbox
 */
export function encryptToken(plaintext: string): EncryptedData {
  const masterKey = getMasterKey();
  const nonce = nacl.randomBytes(24);
  const messageBytes = new TextEncoder().encode(plaintext);
  const encrypted = nacl.secretbox(messageBytes, nonce, masterKey);

  return {
    encrypted: encodeBase64(encrypted),
    nonce: encodeBase64(nonce),
  };
}

/**
 * Decrypt an encrypted string using NaCl secretbox
 */
export function decryptToken(encrypted: string, nonce: string): string {
  const masterKey = getMasterKey();
  const decrypted = nacl.secretbox.open(
    decodeBase64(encrypted),
    decodeBase64(nonce),
    masterKey
  );

  if (!decrypted) {
    throw new Error('Decryption failed - invalid key or corrupted data');
  }

  return new TextDecoder().decode(decrypted);
}

/**
 * Generate a new encryption key (for setup)
 */
export function generateEncryptionKey(): string {
  const key = nacl.randomBytes(32);
  return encodeBase64(key);
}
