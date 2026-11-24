import axios, { AxiosError } from 'axios';
import type {
  User,
  EmailJob,
  PaginatedResponse,
  EmailStats,
  CampaignRequest,
  CampaignResponse,
  SlackStatus,
} from '../types';

const BACKEND_URL = import.meta.env['VITE_BACKEND_URL'] ?? 'http://localhost:4000';

export const apiClient = axios.create({
  baseURL: BACKEND_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Global 401 handler: redirect to login if not already on /login and not a session check
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      const isAuthCheck = error.config?.url?.includes('/auth/me');
      if (window.location.pathname !== '/login' && !isAuthCheck) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// --- Auth ---
export const authApi = {
  me: () => apiClient.get<User>('/auth/me').then((r) => r.data),
  logout: () => apiClient.post('/auth/logout').then((r) => r.data),
  googleLoginUrl: () => `${BACKEND_URL}/auth/google`,
};

// --- Emails ---
export const emailsApi = {
  list: (params: { status: 'scheduled' | 'sent'; page?: number; pageSize?: number }) =>
    apiClient
      .get<PaginatedResponse<EmailJob>>('/api/emails', { params })
      .then((r) => r.data),

  search: (params: { q?: string; status?: string; page?: number; pageSize?: number }) =>
    apiClient
      .get<{ items: EmailJob[]; total: number }>('/api/emails/search', { params })
      .then((r) => r.data),

  stats: () => apiClient.get<EmailStats>('/api/emails/stats').then((r) => r.data),
};

// --- Campaigns ---
export const campaignsApi = {
  create: (data: CampaignRequest) =>
    apiClient.post<CampaignResponse>('/api/campaigns', data).then((r) => r.data),
};

// --- Slack ---
export const slackApi = {
  status: () => apiClient.get<SlackStatus>('/api/slack/status').then((r) => r.data),
  connectUrl: () => `${BACKEND_URL}/auth/slack`,
  disconnect: () => apiClient.delete('/api/slack').then((r) => r.data),
};

// --- Error helper ---
export function getApiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: { message?: string } } | undefined;
    return data?.error?.message ?? err.message;
  }
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred';
}
