/**
 * End-to-End Encryption Utilities for Chat
 * Uses Web Crypto API for secure encryption/decryption
 * - User keypairs: ECDH for key exchange
 * - Message encryption: AES-GCM with per-conversation symmetric keys
 */

// Convert ArrayBuffer to base64 string
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert base64 string to ArrayBuffer
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Generate a new ECDH keypair for key exchange
export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    ['deriveKey', 'deriveBits']
  );
}

// Export public key to base64 string for storage
export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('spki', publicKey);
  return arrayBufferToBase64(exported);
}

// Export private key to base64 string for local storage
export async function exportPrivateKey(privateKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('pkcs8', privateKey);
  return arrayBufferToBase64(exported);
}

// Import public key from base64 string
export async function importPublicKey(base64: string): Promise<CryptoKey> {
  const keyData = base64ToArrayBuffer(base64);
  return await crypto.subtle.importKey(
    'spki',
    keyData,
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    []
  );
}

// Import private key from base64 string
export async function importPrivateKey(base64: string): Promise<CryptoKey> {
  const keyData = base64ToArrayBuffer(base64);
  return await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    ['deriveKey', 'deriveBits']
  );
}

// Generate a random symmetric key for a conversation
export async function generateConversationKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

// Export symmetric key to base64
export async function exportSymmetricKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key);
  return arrayBufferToBase64(exported);
}

// Import symmetric key from base64
export async function importSymmetricKey(base64: string): Promise<CryptoKey> {
  const keyData = base64ToArrayBuffer(base64);
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

// Derive shared secret between our private key and their public key
export async function deriveSharedKey(
  privateKey: CryptoKey,
  publicKey: CryptoKey
): Promise<CryptoKey> {
  return await crypto.subtle.deriveKey(
    {
      name: 'ECDH',
      public: publicKey,
    },
    privateKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

// Encrypt a conversation key with a derived shared key (for key exchange)
export async function encryptKeyForUser(
  conversationKey: CryptoKey,
  sharedKey: CryptoKey
): Promise<{ encryptedKey: string; nonce: string }> {
  const rawKey = await crypto.subtle.exportKey('raw', conversationKey);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: nonce,
    },
    sharedKey,
    rawKey
  );
  
  return {
    encryptedKey: arrayBufferToBase64(encrypted),
    nonce: arrayBufferToBase64(nonce.buffer),
  };
}

// Decrypt a conversation key with a derived shared key
export async function decryptKeyFromUser(
  encryptedKey: string,
  nonce: string,
  sharedKey: CryptoKey
): Promise<CryptoKey> {
  const encryptedData = base64ToArrayBuffer(encryptedKey);
  const nonceData = new Uint8Array(base64ToArrayBuffer(nonce));
  
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: nonceData,
    },
    sharedKey,
    encryptedData
  );
  
  return await crypto.subtle.importKey(
    'raw',
    decrypted,
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

// Encrypt a message with a symmetric key
export async function encryptMessage(
  plaintext: string,
  key: CryptoKey
): Promise<{ ciphertext: string; nonce: string }> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: nonce,
    },
    key,
    data
  );
  
  return {
    ciphertext: arrayBufferToBase64(encrypted),
    nonce: arrayBufferToBase64(nonce.buffer),
  };
}

// Decrypt a message with a symmetric key
export async function decryptMessage(
  ciphertext: string,
  nonce: string,
  key: CryptoKey
): Promise<string> {
  try {
    const encryptedData = base64ToArrayBuffer(ciphertext);
    const nonceData = new Uint8Array(base64ToArrayBuffer(nonce));
    
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: nonceData,
      },
      key,
      encryptedData
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    return '[Unable to decrypt message]';
  }
}

// Local storage keys
const PRIVATE_KEY_STORAGE = 'chat_private_key';
const PUBLIC_KEY_STORAGE = 'chat_public_key';

// Store keypair in localStorage
export function storeKeyPair(publicKey: string, privateKey: string): void {
  localStorage.setItem(PUBLIC_KEY_STORAGE, publicKey);
  localStorage.setItem(PRIVATE_KEY_STORAGE, privateKey);
}

// Get stored keypair from localStorage
export function getStoredKeyPair(): { publicKey: string | null; privateKey: string | null } {
  return {
    publicKey: localStorage.getItem(PUBLIC_KEY_STORAGE),
    privateKey: localStorage.getItem(PRIVATE_KEY_STORAGE),
  };
}

// Clear stored keypair
export function clearStoredKeyPair(): void {
  localStorage.removeItem(PUBLIC_KEY_STORAGE);
  localStorage.removeItem(PRIVATE_KEY_STORAGE);
}
