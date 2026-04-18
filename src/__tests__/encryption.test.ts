import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getEncryptionKey,
  regenerateEncryptionKey,
  hasEncryptionKey,
  encryptField,
  decryptField,
  canDecrypt,
  encryptFields,
  decryptFields,
  SENSITIVE_FIELDS,
  isSensitiveField,
} from '@/utils/encryption';

// ---------------------------------------------------------------------------
// Mock localStorage
// ---------------------------------------------------------------------------

const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
};

vi.stubGlobal('localStorage', mockLocalStorage);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('encryption utils', () => {
  beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k]);
    vi.clearAllMocks();
  });

  // ── Key management ──────────────────────────────────────────────────────

  describe('getEncryptionKey', () => {
    it('generates a key when none exists', () => {
      const key = getEncryptionKey();
      expect(key).toBeTruthy();
      expect(key.length).toBeGreaterThan(0);
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('returns existing key without regenerating', () => {
      store['cc_web_encryption_key'] = 'existing-key';
      const key = getEncryptionKey();
      expect(key).toBe('existing-key');
      // setItem should NOT be called when key already exists
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('regenerateEncryptionKey', () => {
    it('always generates a new key', () => {
      store['cc_web_encryption_key'] = 'old-key';
      const newKey = regenerateEncryptionKey();
      expect(newKey).not.toBe('old-key');
      expect(store['cc_web_encryption_key']).toBe(newKey);
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('hasEncryptionKey', () => {
    it('returns true when key exists', () => {
      store['cc_web_encryption_key'] = 'some-key';
      expect(hasEncryptionKey()).toBe(true);
    });

    it('returns false when no key', () => {
      expect(hasEncryptionKey()).toBe(false);
    });
  });

  // ── Single field encrypt / decrypt ─────────────────────────────────────

  describe('encryptField / decryptField', () => {
    it('encrypts and decrypts a string round-trip', () => {
      const plaintext = 'Hello, world!';
      const key = 'test-key-12345';
      const encrypted = encryptField(plaintext, key);
      expect(encrypted).not.toBe(plaintext);

      const decrypted = decryptField(encrypted, key);
      expect(decrypted).toBe(plaintext);
    });

    it('encryptField uses stored key when no key provided', () => {
      store['cc_web_encryption_key'] = 'my-stored-key';
      const encrypted = encryptField('secret text');
      const decrypted = decryptField(encrypted);
      expect(decrypted).toBe('secret text');
    });

    it('decryptField returns empty string for empty input', () => {
      expect(decryptField('')).toBe('');
    });

    it('decryptField returns empty string when wrong key', () => {
      const encrypted = encryptField('secret', 'correct-key');
      const decrypted = decryptField(encrypted, 'wrong-key');
      expect(decrypted).toBe('');
    });
  });

  describe('canDecrypt', () => {
    it('returns true for correctly encrypted content', () => {
      const encrypted = encryptField('test', 'key');
      expect(canDecrypt(encrypted, 'key')).toBe(true);
    });

    it('returns false for mismatched key', () => {
      const encrypted = encryptField('test', 'correct-key');
      expect(canDecrypt(encrypted, 'wrong-key')).toBe(false);
    });
  });

  // ── Batch encrypt / decrypt ────────────────────────────────────────────

  describe('encryptFields / decryptFields', () => {
    it('encrypts all fields', () => {
      const fields = { query: 'hello', answer: 'world' };
      const encrypted = encryptFields(fields, 'batch-key');
      expect(encrypted.query).not.toBe(fields.query);
      expect(encrypted.answer).not.toBe(fields.answer);
    });

    it('decrypts all fields correctly', () => {
      const fields = { query: 'hello', answer: 'world' };
      const encrypted = encryptFields(fields, 'batch-key');
      const decrypted = decryptFields(encrypted, 'batch-key');
      expect(decrypted.query).toBe('hello');
      expect(decrypted.answer).toBe('world');
    });
  });

  // ── Sensitive field helpers ─────────────────────────────────────────────

  describe('SENSITIVE_FIELDS', () => {
    it('contains expected fields', () => {
      expect(SENSITIVE_FIELDS).toContain('query');
      expect(SENSITIVE_FIELDS).toContain('summary');
      expect(SENSITIVE_FIELDS).toContain('analysis');
      expect(SENSITIVE_FIELDS).toContain('metadata');
    });
  });

  describe('isSensitiveField', () => {
    it('returns true for sensitive fields', () => {
      expect(isSensitiveField('query')).toBe(true);
      expect(isSensitiveField('summary')).toBe(true);
    });

    it('returns false for non-sensitive fields', () => {
      expect(isSensitiveField('title')).toBe(false);
      expect(isSensitiveField('createdAt')).toBe(false);
    });
  });
});
