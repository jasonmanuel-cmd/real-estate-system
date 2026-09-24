'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // MFA second step
  const [pendingMfa, setPendingMfa] = useState<string | null>(null); // tempToken
  const [mfaToken, setMfaToken] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authApi.login(email, password);

      if (response.data.requiresMfa) {
        // Show the MFA code entry step
        setPendingMfa(response.data.tempToken);
      } else {
        // Save token and user
        setAuth(response.data.user, response.data.token);
        router.push('/leads');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authApi.verifyMfa(pendingMfa!, mfaToken);
      setAuth(response.data.user, response.data.token);
      router.push('/leads');
    } catch (err: any) {
      setError(err.response?.data?.error || 'MFA verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setPendingMfa(null);
    setMfaToken('');
    setError('');
  };

  // ============ MFA SECOND STEP ============
  if (pendingMfa) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
        <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">CA Deal Engine</h1>
            <p className="text-gray-600 mt-2">Enter your authenticator code</p>
          </div>

          <form onSubmit={handleMfaVerify} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="mfaToken" className="block text-sm font-medium text-gray-700 mb-2">
                6-digit code
              </label>
              <input
                id="mfaToken"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={mfaToken}
                onChange={(e) => setMfaToken(e.target.value.replace(/\D/g, ''))}
                required
                autoFocus
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-[0.5em] font-mono"
                placeholder="••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading || mfaToken.length !== 6}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Verifying…' : 'Verify'}
            </button>

            <button
              type="button"
              onClick={handleBackToLogin}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              ← Back to login
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ============ STANDARD LOGIN ============
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">CA Deal Engine</h1>
          <p className="text-gray-600 mt-2">Off-Market Property Finder</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="demo@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600 font-medium mb-2">Demo Credentials:</p>
          <p className="text-sm text-gray-700">Email: <span className="font-mono">demo@example.com</span></p>
          <p className="text-sm text-gray-700">Password: <span className="font-mono">Demo123!</span></p>
        </div>
      </div>
    </div>
  );
}
