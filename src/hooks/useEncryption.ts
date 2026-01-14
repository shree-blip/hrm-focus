import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  generateKeyPair,
  exportPublicKey,
  exportPrivateKey,
  importPrivateKey,
  importPublicKey,
  generateConversationKey,
  encryptKeyForUser,
  decryptKeyFromUser,
  encryptMessage,
  decryptMessage,
  storeKeyPair,
  getStoredKeyPair,
  deriveSharedKey,
} from '@/lib/encryption';

interface EncryptedKeyRecord {
  encrypted_key: string;
}

interface PublicKeyRecord {
  public_key: string;
}

interface ParticipantRecord {
  user_id: string;
}

export function useEncryption() {
  const { user } = useAuth();
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  const [publicKey, setPublicKey] = useState<CryptoKey | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [conversationKeys, setConversationKeys] = useState<Map<string, CryptoKey>>(new Map());

  // Sync public key to server
  const syncPublicKey = useCallback(async (publicKeyStr: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('user_encryption_keys' as any)
      .upsert(
        { user_id: user.id, public_key: publicKeyStr, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('Error syncing public key:', error);
    }
  }, [user]);

  // Initialize or load user's keypair
  const initializeKeys = useCallback(async () => {
    if (!user) return;

    try {
      // Check if we have keys in localStorage
      const stored = getStoredKeyPair();
      
      if (stored.privateKey && stored.publicKey) {
        // Import existing keys
        const privKey = await importPrivateKey(stored.privateKey);
        const pubKey = await importPublicKey(stored.publicKey);
        setPrivateKey(privKey);
        setPublicKey(pubKey);
        
        // Ensure public key is synced to server
        await syncPublicKey(stored.publicKey);
      } else {
        // Generate new keypair
        const keyPair = await generateKeyPair();
        const pubKeyStr = await exportPublicKey(keyPair.publicKey);
        const privKeyStr = await exportPrivateKey(keyPair.privateKey);
        
        // Store locally
        storeKeyPair(pubKeyStr, privKeyStr);
        
        // Store public key on server
        await syncPublicKey(pubKeyStr);
        
        setPrivateKey(keyPair.privateKey);
        setPublicKey(keyPair.publicKey);
      }
      
      setIsInitialized(true);
    } catch (error) {
      console.error('Error initializing encryption keys:', error);
    }
  }, [user, syncPublicKey]);

  // Get conversation key (fetch from server or create new)
  const getConversationKey = useCallback(async (conversationId: string): Promise<CryptoKey | null> => {
    if (!user || !privateKey) return null;

    // Check cache first
    const cached = conversationKeys.get(conversationId);
    if (cached) return cached;

    try {
      // Try to fetch existing key from server
      const { data: keyData, error } = await supabase
        .from('chat_conversation_keys' as any)
        .select('encrypted_key')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .single();

      const typedKeyData = keyData as unknown as EncryptedKeyRecord | null;

      if (typedKeyData && !error) {
        // We have a key, need to decrypt it
        // First, get another participant's public key to derive shared secret
        const { data: participants } = await supabase
          .from('chat_participants')
          .select('user_id')
          .eq('conversation_id', conversationId)
          .neq('user_id', user.id)
          .limit(1)
          .single();

        const typedParticipant = participants as unknown as ParticipantRecord | null;

        if (typedParticipant) {
          const { data: creatorKeyData } = await supabase
            .from('user_encryption_keys' as any)
            .select('public_key')
            .eq('user_id', typedParticipant.user_id)
            .single();

          const typedCreatorKey = creatorKeyData as unknown as PublicKeyRecord | null;

          if (typedCreatorKey) {
            const creatorPubKey = await importPublicKey(typedCreatorKey.public_key);
            const sharedKey = await deriveSharedKey(privateKey, creatorPubKey);
            
            // Parse the stored data (format: encryptedKey:nonce)
            const [encryptedKey, nonce] = typedKeyData.encrypted_key.split(':');
            const convKey = await decryptKeyFromUser(encryptedKey, nonce, sharedKey);
            
            // Cache it
            setConversationKeys(prev => new Map(prev).set(conversationId, convKey));
            return convKey;
          }
        }
      }
    } catch (error) {
      // Key doesn't exist yet, that's fine
      console.log('No existing conversation key found');
    }

    return null;
  }, [user, privateKey, conversationKeys]);

  // Create and distribute a new conversation key
  const createConversationKey = useCallback(async (
    conversationId: string,
    participantUserIds: string[]
  ): Promise<CryptoKey | null> => {
    if (!user || !privateKey || !publicKey) return null;

    try {
      // Generate new symmetric key for conversation
      const convKey = await generateConversationKey();

      // For each participant, encrypt the key with shared secret
      for (const participantId of participantUserIds) {
        // Get participant's public key
        const { data: pubKeyData } = await supabase
          .from('user_encryption_keys' as any)
          .select('public_key')
          .eq('user_id', participantId)
          .single();

        const typedPubKey = pubKeyData as unknown as PublicKeyRecord | null;

        if (typedPubKey) {
          const participantPubKey = await importPublicKey(typedPubKey.public_key);
          
          // Derive shared key from our private key and their public key
          const sharedKey = await deriveSharedKey(privateKey, participantPubKey);
          
          // Encrypt the conversation key
          const { encryptedKey, nonce } = await encryptKeyForUser(convKey, sharedKey);
          
          // Store encrypted key for this participant
          await supabase
            .from('chat_conversation_keys' as any)
            .upsert({
              conversation_id: conversationId,
              user_id: participantId,
              encrypted_key: `${encryptedKey}:${nonce}`,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'conversation_id,user_id' });
        }
      }

      // Cache the key
      setConversationKeys(prev => new Map(prev).set(conversationId, convKey));
      return convKey;
    } catch (error) {
      console.error('Error creating conversation key:', error);
      return null;
    }
  }, [user, privateKey, publicKey]);

  // Encrypt a message
  const encrypt = useCallback(async (
    plaintext: string,
    conversationId: string
  ): Promise<{ ciphertext: string; nonce: string } | null> => {
    const key = await getConversationKey(conversationId);
    if (!key) return null;

    return await encryptMessage(plaintext, key);
  }, [getConversationKey]);

  // Decrypt a message
  const decrypt = useCallback(async (
    ciphertext: string,
    nonce: string,
    conversationId: string
  ): Promise<string> => {
    const key = await getConversationKey(conversationId);
    if (!key) return '[Unable to decrypt - no key]';

    return await decryptMessage(ciphertext, nonce, key);
  }, [getConversationKey]);

  // Initialize on mount
  useEffect(() => {
    if (user) {
      initializeKeys();
    }
  }, [user, initializeKeys]);

  return {
    isInitialized,
    encrypt,
    decrypt,
    getConversationKey,
    createConversationKey,
    publicKey,
  };
}
