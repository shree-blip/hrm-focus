import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to get a signed URL for an avatar stored in the private avatars bucket.
 * Returns the signed URL which expires after 1 hour.
 */
export function useAvatarUrl(avatarPath: string | null | undefined) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!avatarPath) {
      setSignedUrl(null);
      return;
    }

    // Extract the file path from a full URL or use as-is if it's just a path
    let filePath = avatarPath;
    if (avatarPath.includes('/avatars/')) {
      filePath = avatarPath.split('/avatars/').pop() || avatarPath;
    }

    const fetchSignedUrl = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.storage
          .from('avatars')
          .createSignedUrl(filePath, 3600); // 1 hour expiry

        if (error) {
          console.error('Error creating signed URL:', error);
          setSignedUrl(null);
        } else {
          setSignedUrl(data.signedUrl);
        }
      } catch (err) {
        console.error('Error fetching signed URL:', err);
        setSignedUrl(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSignedUrl();
  }, [avatarPath]);

  return { signedUrl, loading };
}

/**
 * Utility function to get a signed URL for an avatar (one-time use).
 */
export async function getAvatarSignedUrl(avatarPath: string | null | undefined): Promise<string | null> {
  if (!avatarPath) return null;

  // Extract the file path from a full URL or use as-is if it's just a path
  let filePath = avatarPath;
  if (avatarPath.includes('/avatars/')) {
    filePath = avatarPath.split('/avatars/').pop() || avatarPath;
  }

  try {
    const { data, error } = await supabase.storage
      .from('avatars')
      .createSignedUrl(filePath, 3600);

    if (error) {
      console.error('Error creating signed URL:', error);
      return null;
    }
    return data.signedUrl;
  } catch (err) {
    console.error('Error fetching signed URL:', err);
    return null;
  }
}
