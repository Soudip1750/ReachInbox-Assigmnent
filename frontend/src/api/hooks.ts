import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi, emailsApi, campaignsApi, slackApi } from './client';
import type { CampaignRequest } from '../types';

// --- Auth hooks ---
export function useAuth() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.me,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      qc.clear();
      window.location.href = '/login';
    },
  });
}

// --- Email hooks ---
export function useScheduledEmails(page = 1, search?: string) {
  return useQuery({
    queryKey: ['emails', 'scheduled', page, search],
    queryFn: () =>
      search
        ? emailsApi.search({ q: search, status: 'scheduled', page })
        : emailsApi.list({ status: 'scheduled', page }),
    refetchInterval: 10_000,
  });
}

export function useSentEmails(page = 1, search?: string) {
  return useQuery({
    queryKey: ['emails', 'sent', page, search],
    queryFn: () =>
      search
        ? emailsApi.search({ q: search, status: 'sent', page })
        : emailsApi.list({ status: 'sent', page }),
    refetchInterval: 10_000,
  });
}

export function useEmailStats() {
  return useQuery({
    queryKey: ['emails', 'stats'],
    queryFn: emailsApi.stats,
    refetchInterval: 10_000,
  });
}

// --- Campaign hooks ---
export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CampaignRequest) => campaignsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emails'] });
    },
  });
}

// --- Slack hooks ---
export function useSlackStatus() {
  return useQuery({
    queryKey: ['slack', 'status'],
    queryFn: slackApi.status,
    staleTime: 30_000,
  });
}

export function useSlackDisconnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: slackApi.disconnect,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['slack'] });
      qc.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}
