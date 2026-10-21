 'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

function getDisplayName(user) {
  if (!user) return '';

  const metadata = user.user_metadata || {};

  return (
    metadata.full_name ||
    metadata.name ||
    metadata.display_name ||
    user.email?.split('@')[0] ||
    'User'
  );
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadUser() {
      const { data, error } = await supabase.auth.getUser();

      if (!active) return;

      if (error) {
        setUser(null);
      } else {
        setUser(data.user);
      }

      setLoading(false);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    user,
    loading,
    displayName: getDisplayName(user),
  };
}
