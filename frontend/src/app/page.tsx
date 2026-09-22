'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, hydrated, loadAuth } = useAuthStore();

  useEffect(() => {
    loadAuth();
  }, [loadAuth]);

  useEffect(() => {
    if (!hydrated) return;
    if (isAuthenticated) {
      router.push('/leads');
    } else {
      router.push('/login');
    }
  }, [isAuthenticated, hydrated, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">CA Deal Engine</h1>
        <p className="mt-2 text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
