import { formatDistanceToNow } from 'date-fns';

export function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

export function formatFigmaDateTime(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    const day = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(d);
    const time = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(d);
    return `${day} ${time}`;
  } catch {
    return isoString;
  }
}

export function formatRelative(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    return formatDistanceToNow(new Date(isoString), { addSuffix: true });
  } catch {
    return isoString;
  }
}

export function toLocalISOString(date: Date): string {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function isInPast(isoString: string): boolean {
  return new Date(isoString) < new Date();
}
