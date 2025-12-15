import crypto from "crypto";

/**
 * Encryption utilities for sensitive data (API keys)
 * Uses AES-256-GCM for encryption
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // For GCM mode
const SALT_LENGTH = 64;
const KEY_LENGTH = 32; // 256 bits
const AUTH_TAG_LENGTH = 16; // 128 bits - explicit for security

/**
 * Get encryption keys from environment (supports key rotation)
 * Returns: { current: Buffer, previous?: Buffer }
 */
function getEncryptionKeys(): { current: Buffer; previous?: Buffer } {
  const currentKey = process.env.ENCRYPTION_KEY;
  const previousKey = process.env.ENCRYPTION_KEY_PREVIOUS;

  if (!currentKey) {
    throw new Error(
      "ENCRYPTION_KEY environment variable is required. Generate one with: openssl rand -hex 32"
    );
  }

  // Convert hex string to buffer
  const currentKeyBuffer = Buffer.from(currentKey, "hex");

  if (currentKeyBuffer.length !== KEY_LENGTH) {
    throw new Error(
      `ENCRYPTION_KEY must be ${KEY_LENGTH * 2} hex characters (${KEY_LENGTH} bytes). Current length: ${currentKeyBuffer.length * 2}`
    );
  }

  const keys: { current: Buffer; previous?: Buffer } = {
    current: currentKeyBuffer,
  };

  // Support previous key for rotation (allows decryption of old values)
  if (previousKey) {
    const previousKeyBuffer = Buffer.from(previousKey, "hex");
    if (previousKeyBuffer.length === KEY_LENGTH) {
      keys.previous = previousKeyBuffer;
    }
  }

  return keys;
}

/**
 * Get current encryption key (for encryption)
 */
function getCurrentEncryptionKey(): Buffer {
  return getEncryptionKeys().current;
}

/**
 * Encrypts a string value
 * @param plaintext - The string to encrypt
 * @returns Encrypted string in format: iv:salt:authTag:encrypted
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    return "";
  }

  try {
    const key = getCurrentEncryptionKey();

    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);

    // Generate random salt (for additional security)
    const salt = crypto.randomBytes(SALT_LENGTH);

    // Create cipher with explicit auth tag length
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    // Encrypt the plaintext
    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");

    // Get auth tag (will be AUTH_TAG_LENGTH bytes)
    const authTag = cipher.getAuthTag();

    // Return format: iv:salt:authTag:encrypted
    return `${iv.toString("hex")}:${salt.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
}

/**
 * Decrypts an encrypted string
 * @param encryptedData - The encrypted string in format: iv:salt:authTag:encrypted
 * @returns Decrypted plaintext string
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) {
    return "";
  }

  // Parse the encrypted data first
  const parts = encryptedData.split(":");
  if (parts.length !== 4) {
    throw new Error("Invalid encrypted data format");
  }

  // Format: iv:salt:authTag:encrypted (salt is not used in decryption)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [ivHex, _saltHex, authTagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const keys = getEncryptionKeys();

  // Try current key first
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, keys.current, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    // If current key fails and we have a previous key, try that (key rotation support)
    if (keys.previous) {
      try {
        const decipher = crypto.createDecipheriv(ALGORITHM, keys.previous, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encrypted, "hex", "utf8");
        decrypted += decipher.final("utf8");
        console.log("[ENCRYPTION] Successfully decrypted with previous key - consider re-encrypting");
        return decrypted;
      } catch {
        console.error("Decryption failed with both current and previous keys");
      }
    }
    // Log detailed error only in development
    if (process.env.NODE_ENV === "development") {
      console.error("[ENCRYPTION] Decryption failed:", error);
    }
    throw new Error("Failed to decrypt data");
  }
}

/**
 * Safely checks if a value is encrypted (has the expected format)
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false;
  const parts = value.split(":");
  return parts.length === 4 && parts.every(part => /^[0-9a-f]+$/i.test(part));
}
