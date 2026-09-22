import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Don't hard-redirect on failed login/MFA attempts - let the form show the error
    const isAuthRequest = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isAuthRequest) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  verifyMfa: (tempToken: string, mfaToken: string) =>
    api.post('/auth/mfa/login', { tempToken, mfaToken }),

  getCurrentUser: () => api.get('/auth/me'),

  setupMfa: () => api.post('/auth/mfa/setup'),

  // Second step of MFA setup: verify TOTP token to enable MFA
  // (distinct from verifyMfa above, which completes an MFA login)
  verifyAndEnableMfa: (token: string) =>
    api.post('/auth/mfa/verify', { token }),
};

// Leads API
export const leadsApi = {
  getLeads: (params?: any) => api.get('/leads', { params }),

  getLead: (id: string) => api.get(`/leads/${id}`),

  createLead: (apn: string) => api.post('/leads', { apn }),

  updateLead: (id: string, data: any) =>
    api.patch(`/leads/${id}`, data),

  logOutreach: (id: string, data: any) =>
    api.post(`/leads/${id}/outreach`, data),
};

// Parcels API
export const parcelsApi = {
  search: (q: string, params?: any) =>
    api.get('/parcels/search', { params: { q, ...params } }),

  getParcel: (apn: string) => api.get(`/parcels/${apn}`),
};

// Calculator API
export const calculatorApi = {
  calculateAll: (propertyType: string, inputs: any) =>
    api.post('/calculator/all', { propertyType, inputs }),

  calculateWholesale: (inputs: any) =>
    api.post('/calculator/wholesale', inputs),

  calculateBrrrr: (inputs: any) =>
    api.post('/calculator/brrrr', inputs),

  calculateRental: (inputs: any) =>
    api.post('/calculator/rental', inputs),

  calculateMultifamily: (inputs: any) =>
    api.post('/calculator/multifamily', inputs),

  calculateCommercial: (inputs: any) =>
    api.post('/calculator/commercial', inputs),

  calculateLand: (inputs: any) =>
    api.post('/calculator/land', inputs),
};

// Export API
export const exportApi = {
  mailingList: (leadIds?: string[], filters?: any) =>
    api.post('/export/mailing-list', { leadIds, filters }, { responseType: 'blob' }),

  callSheet: (leadIds: string[]) =>
    api.post('/export/call-sheet', { leadIds }, { responseType: 'blob' }),

  propertyData: (leadIds: string[]) =>
    api.post('/export/property-data', { leadIds }, { responseType: 'blob' }),
};

// Admin API
export const adminApi = {
  getStats: () => api.get('/admin/stats'),

  generateSignals: (countyName?: string, limit?: number) =>
    api.post('/admin/signals/generate', { countyName, limit }),

  calculateScores: (countyName?: string, limit?: number) =>
    api.post('/admin/scores/calculate', { countyName, limit }),

  getWeights: () => api.get('/admin/weights'),

  updateWeight: (signalType: string, weight: number, description?: string) =>
    api.put(`/admin/weights/${signalType}`, { weight, description }),
};
