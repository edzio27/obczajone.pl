'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      const { error } = await supabase.auth.getSession();

      if (error) {
        console.error('Error during auth callback:', error);
        router.push('/?error=auth_failed');
        return;
      }

      router.push('/');
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Logowanie...</h2>
        <p className="text-gray-600">Proszę czekać</p>
      </div>
    </div>
  );
}
