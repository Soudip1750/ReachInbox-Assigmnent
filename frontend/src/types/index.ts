// API types matching the backend contract

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  slackConnected: boolean;
  slackTeamName: string | null;
}

export type EmailStatus = 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED';

export interface EmailJob {
  id: string;
  recipientEmail: string;
  subject: string;
  body?: string;
  status: EmailStatus;
  scheduledAt: string;
  nextRunAt: string;
  sentAt: string | null;
  previewUrl: string | null;
  errorMessage: string | null;
  senderEmail: string;
  campaignId: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface EmailStats {
  scheduled: number;
  sent: number;
  failed: number;
  total: number;
}

export interface CampaignRequest {
  subject: string;
  body: string;
  emails: string[];
  startTime: string;
  delayMs: number;
  hourlyLimit: number;
}

export interface CampaignResponse {
  campaignId: string;
  total: number;
  firstRunAt: string;
  enqueued: boolean;
}

export interface SlackStatus {
  connected: boolean;
  teamName: string | null;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
