'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { leadsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

export default function LeadsPage() {
  const router = useRouter();
  const { isAuthenticated, user, hydrated, loadAuth } = useAuthStore();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAuth();
  }, [loadAuth]);

  useEffect(() => {
    if (!isAuthenticated && hydrated) {
      router.push('/login');
      return;
    }

    fetchLeads();
  }, [isAuthenticated, hydrated, router]);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const response = await leadsApi.getLeads();
      setLeads(response.data.leads || []);
    } catch (err: any) {
      setError('Failed to load leads');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    useAuthStore.getState().clearAuth();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading leads...</p>
        </div>
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
              <p className="text-sm text-gray-600">Welcome, {user?.name}</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/settings')}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
              >
                Settings
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

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Lead Feed</h2>
          <p className="text-gray-600">Properties ranked by investment signals</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {leads.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">No leads found. Run the ETL to import property data.</p>
            <p className="text-sm text-gray-500 mt-2">
              Backend command: <code className="bg-gray-100 px-2 py-1 rounded">npm run etl:run -- kern_county_assessor</code>
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {leads.map((lead) => (
              <div
                key={lead.id}
                className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6 cursor-pointer"
                onClick={() => router.push(`/leads/${lead.id}`)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {lead.property?.address || `Parcel ${lead.apn}`}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {lead.property?.city ? `${lead.property.city}${lead.property.zip ? ', ' + lead.property.zip : ''} • ` : ''}
                      {lead.property?.county} County
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {lead.property?.propertyType} • APN: {lead.apn}
                    </p>
                  </div>

                  <div className="ml-4 text-right">
                    <div className="text-3xl font-bold text-blue-600">
                      {lead.score?.total || 0}
                    </div>
                    <p className="text-xs text-gray-500">Score</p>
                  </div>
                </div>

                {(Array.isArray(lead.score?.topReasons)
                  ? lead.score.topReasons
                  : (lead.score?.topReasons || '').split(',').filter(Boolean)
                ).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(Array.isArray(lead.score.topReasons)
                      ? lead.score.topReasons
                      : lead.score.topReasons.split(',').filter(Boolean)
                    ).slice(0, 2).map((reason: string, idx: number) => (
                      <span
                        key={idx}
                        className="inline-block bg-blue-50 text-blue-700 text-xs px-3 py-1 rounded-full"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                )}

                {lead.owner && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Owner:</span> {lead.owner.name}
                    </p>
                    {lead.owner.mailingCity && (
                      <p className="text-sm text-gray-600">
                        {lead.owner.mailingCity}, {lead.owner.mailingState}
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <span className={`text-xs px-2 py-1 rounded ${
                    lead.status === 'NEW' ? 'bg-green-100 text-green-800' :
                    lead.status === 'CONTACTED' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {lead.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
