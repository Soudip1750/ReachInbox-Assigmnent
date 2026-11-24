import type { EmailStatus } from '../../types';

interface BadgeProps {
  status: EmailStatus;
  className?: string;
}

const badgeConfig: Record<
  EmailStatus,
  { label: string; className: string; dot: string }
> = {
  SCHEDULED: {
    label: 'Scheduled',
    className: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    dot: 'bg-blue-400',
  },
  PROCESSING: {
    label: 'Processing',
    className: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
    dot: 'bg-yellow-400 animate-pulse-soft',
  },
  SENT: {
    label: 'Sent',
    className: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    dot: 'bg-emerald-400',
  },
  FAILED: {
    label: 'Failed',
    className: 'bg-red-500/10 text-red-400 border border-red-500/20',
    dot: 'bg-red-400',
  },
};

export function Badge({ status, className = '' }: BadgeProps) {
  const config = badgeConfig[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.className} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
