'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, adminApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

export default function SettingsPage() {
  const router = useRouter();
  const { isAuthenticated, hydrated, user, loadAuth } = useAuthStore();

  // MFA state
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null);
  const [setupData, setSetupData] = useState<{ secret: string; qrCode: string } | null>(null);
  const [totpToken, setTotpToken] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Signal weights state
  const [weights, setWeights] = useState<any[]>([]);
  const [savingWeight, setSavingWeight] = useState<string | null>(null);

  useEffect(() => {
    loadAuth();
  }, [loadAuth]);

  useEffect(() => {
    if (!isAuthenticated && hydrated) {
      router.push('/login');
      return;
    }
    if (isAuthenticated) {
      checkMfaStatus();
      fetchWeights();
    }
  }, [isAuthenticated, hydrated, router]);

  const checkMfaStatus = async () => {
    try {
      const res = await authApi.getCurrentUser();
      setMfaEnabled(res.data.user?.mfaEnabled ?? false);
    } catch {
      setMfaEnabled(false);
    }
  };

  const fetchWeights = async () => {
    try {
      const res = await adminApi.getWeights();
      setWeights(res.data.weights || []);
    } catch {
      // Non-admin users may not have access; ignore
    }
  };

  const handleStartMfa = async () => {
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      const res = await authApi.setupMfa();
      setSetupData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to start MFA setup');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      await authApi.verifyAndEnableMfa(totpToken);
      setMfaEnabled(true);
      setSetupData(null);
      setTotpToken('');
      setSuccess('MFA enabled successfully.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid MFA token');
    } finally {
      setBusy(false);
    }
  };

  const handleDisableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      await authApi.disableMfa(disablePassword);
      setMfaEnabled(false);
      setDisablePassword('');
      setSuccess('MFA disabled.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to disable MFA');
    } finally {
      setBusy(false);
    }
  };

  const handleWeightChange = async (signalType: string, weight: number) => {
    setSavingWeight(signalType);
    try {
      await adminApi.updateWeight(signalType, weight);
      setWeights((w) =>
        w.map((x) => (x.signalType === signalType ? { ...x, weight } : x))
      );
    } catch {
      // revert silently
    } finally {
      setSavingWeight(null);
    }
  };

  const handleLogout = () => {
    useAuthStore.getState().clearAuth();
    router.push('/login');
  };

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">CA Deal Engine</h1>
              <p className="text-sm text-gray-600">Settings</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/leads')}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
              >
                Leads
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-6">
            {success}
          </div>
        )}

        {/* Security / MFA */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-1">Security — Two-Factor Authentication</h2>
          <p className="text-sm text-gray-600 mb-4">
            Add a second factor using an authenticator app (Google Authenticator, Authy, 1Password).
          </p>

          {mfaEnabled === null && <p className="text-gray-500">Loading…</p>}

          {mfaEnabled === false && !setupData && (
            <button
              onClick={handleStartMfa}
              disabled={busy}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-300"
            >
              {busy ? 'Starting…' : 'Enable MFA'}
            </button>
          )}

          {setupData && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-6 items-start">
                {/* QR is a data URL from the backend */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={setupData.qrCode}
                  alt="MFA QR code"
                  width={180}
                  height={180}
                  className="border rounded"
                />
                <div className="flex-1">
                  <p className="text-sm text-gray-700 mb-2">
                    Scan this QR code with your authenticator app, then enter the 6-digit code below.
                  </p>
                  <p className="text-xs text-gray-500 mb-1">
                    Can&apos;t scan? Enter this secret manually:
                  </p>
                  <code className="block bg-gray-100 px-3 py-2 rounded text-sm break-all">
                    {setupData.secret}
                  </code>
                </div>
              </div>
              <form onSubmit={handleVerifyMfa} className="flex gap-3 items-center">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={totpToken}
                  onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  required
                  className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={busy || totpToken.length !== 6}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-300"
                >
                  {busy ? 'Verifying…' : 'Verify & Enable'}
                </button>
                <button
                  type="button"
                  onClick={() => setSetupData(null)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </form>
            </div>
          )}

          {mfaEnabled === true && (
            <form onSubmit={handleDisableMfa} className="space-y-3">
              <p className="text-sm text-green-700 font-medium">
                ✓ Two-factor authentication is enabled
              </p>
              <p className="text-sm text-gray-600">To disable MFA, confirm your password:</p>
              <div className="flex gap-3">
                <input
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  placeholder="Current password"
                  required
                  className="flex-1 max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={busy || !disablePassword}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 disabled:bg-red-300"
                >
                  {busy ? 'Disabling…' : 'Disable MFA'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Signal Weights (admin) */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-1">Scoring — Signal Weights</h2>
          <p className="text-sm text-gray-600 mb-4">
            Adjust how much each investment signal contributes to a property&apos;s score.
          </p>
          {weights.length === 0 ? (
            <p className="text-gray-500 text-sm">No weights available.</p>
          ) : (
            <div className="space-y-3">
              {weights.map((w) => (
                <div key={w.signalType} className="flex items-center gap-4">
                  <span className="text-sm font-medium w-56">
                    {w.signalType.replace(/_/g, ' ')}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    value={w.weight}
                    onChange={(e) =>
                      setWeights((ws) =>
                        ws.map((x) =>
                          x.signalType === w.signalType
                            ? { ...x, weight: Number(e.target.value) }
                            : x
                        )
                      )
                    }
                    onMouseUp={() => handleWeightChange(w.signalType, w.weight)}
                    onTouchEnd={() => handleWeightChange(w.signalType, w.weight)}
                    disabled={savingWeight === w.signalType}
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-600 w-10 text-right">
                    {savingWeight === w.signalType ? '…' : w.weight}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
