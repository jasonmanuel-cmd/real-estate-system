'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { leadsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

export default function LeadDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { isAuthenticated, hydrated } = useAuthStore();
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated && hydrated) {
      router.push('/login');
      return;
    }

    fetchLead();
  }, [isAuthenticated, hydrated]);

  const fetchLead = async () => {
    try {
      setLoading(true);
      const response = await leadsApi.getLead(params.id as string);
      setLead(response.data);
    } catch (err) {
      console.error('Failed to load lead:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Lead not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => router.push('/leads')}
            className="text-blue-600 hover:text-blue-800 mb-2"
          >
            ← Back to Leads
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            {lead.property?.address}
          </h1>
          <p className="text-gray-600">
            {lead.property?.city}, {lead.property?.zip} • APN: {lead.apn}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Score Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Investment Score</h2>
            <div className="text-5xl font-bold text-blue-600 mb-4">
              {lead.score?.total || 0}
            </div>
            <div className="space-y-2">
              {(Array.isArray(lead.score?.topReasons)
                ? lead.score.topReasons
                : (lead.score?.topReasons || '').split(',').filter(Boolean)
              ).map((reason: string, idx: number) => (
                <div key={idx} className="text-sm text-gray-700">
                  • {reason}
                </div>
              ))}
            </div>
          </div>

          {/* Property Info */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Property Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Type</p>
                <p className="font-medium">{lead.property?.propertyType}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Year Built</p>
                <p className="font-medium">{lead.property?.yearBuilt || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Building Sqft</p>
                <p className="font-medium">{lead.property?.buildingSqft?.toLocaleString() || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Lot Size</p>
                <p className="font-medium">{lead.property?.lotSize || 'N/A'} acres</p>
              </div>
            </div>

            {lead.owner && (
              <div className="mt-6 pt-6 border-t">
                <h3 className="font-semibold mb-3">Owner Information</h3>
                <p className="text-sm"><span className="font-medium">Name:</span> {lead.owner.name}</p>
                <p className="text-sm"><span className="font-medium">Mailing Address:</span> {lead.owner.mailingAddress}</p>
                <p className="text-sm">
                  {lead.owner.mailingCity}, {lead.owner.mailingState} {lead.owner.mailingZip}
                </p>
              </div>
            )}
          </div>

          {/* Signals */}
          {lead.allSignals && lead.allSignals.length > 0 && (
            <div className="lg:col-span-3 bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Investment Signals</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {lead.allSignals.map((signal: any) => (
                  <div key={signal.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium text-sm">{(signal.type || signal.signalType || '').replace(/_/g, ' ')}</h3>
                      <span className={`text-xs px-2 py-1 rounded ${
                        signal.severity >= 4 ? 'bg-red-100 text-red-800' :
                        signal.severity >= 3 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        Severity: {signal.severity}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">
                      {new Date(signal.date || signal.signalDate).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
