import { useState, useRef, useEffect } from 'react';
import { useScheduledEmails, useSentEmails } from '../../api/hooks';
import { formatFigmaDateTime } from '../../lib/date';
import type { EmailJob } from '../../types';
import { EmailDetailModal } from './EmailDetailModal';

function formatRecipient(email: string): string {
  const namePart = (email || '').split('@')[0];
  const formatted = namePart
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return `To: ${formatted || email || 'Unknown'}`;
}

interface EmailsTableBaseProps {
  mode: 'scheduled' | 'sent';
}

function EmailsTableBase({ mode }: EmailsTableBaseProps) {
  const [page, setPage] = useState(1);
  const [inputValue, setInputValue] = useState('');
  const [search, setSearch] = useState('');
  const [selectedEmail, setSelectedEmail] = useState<EmailJob | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const useEmailsHook = mode === 'scheduled' ? useScheduledEmails : useSentEmails;
  const { data, isLoading, isError, refetch } = useEmailsHook(page, search.trim() || undefined);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleSearchChange = (value: string) => {
    setInputValue(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 300);
  };

  const handleClearSearch = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setInputValue('');
    setSearch('');
    setPage(1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (timerRef.current) clearTimeout(timerRef.current);
      setSearch(inputValue);
      setPage(1);
    }
  };

  const loadingText = mode === 'scheduled' ? 'Loading scheduled emails...' : 'Loading sent emails...';
  const emptyText = search.trim()
    ? mode === 'scheduled'
      ? `No emails matching "${search.trim()}"`
      : `No sent emails matching "${search.trim()}"`
    : mode === 'scheduled'
      ? 'No scheduled emails in queue.'
      : 'No sent emails yet.';

  return (
    <div className="w-full">
      {/* Top Search bar inside content area matching Figma */}
      <div className="px-6 py-4 flex items-center justify-between gap-4 border-b border-gray-100 bg-white sticky top-0 z-10">
        <div className="relative flex-1 max-w-2xl">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Search"
            value={inputValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full pl-10 pr-9 py-2 bg-[#f4f6f8] text-sm text-gray-800 placeholder-gray-400 rounded-full border border-transparent focus:border-gray-200 focus:bg-white focus:outline-none transition-all"
          />
          {inputValue && (
            <button
              type="button"
              onClick={handleClearSearch}
              aria-label="Clear search"
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Filter and Refresh icons from Figma */}
        <div className="flex items-center gap-3 text-gray-400">
          <button
            className="p-1.5 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            title="Filter"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </button>
          <button
            onClick={() => refetch()}
            className="p-1.5 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            title="Refresh"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Email List Rows */}
      <div className="divide-y divide-gray-50">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">{loadingText}</div>
        ) : isError ? (
          <div className="p-8 text-center text-sm text-red-500">Failed to load emails.</div>
        ) : data?.items.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-400">{emptyText}</div>
        ) : (
          data?.items.map((row) => (
            <div
              key={row.id}
              onClick={() => setSelectedEmail(row)}
              className="flex items-center justify-between px-6 py-4 hover:bg-[#f9fafb] cursor-pointer transition-colors group text-sm"
            >
              <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                {/* Recipient */}
                <div className="w-36 shrink-0 font-semibold text-gray-900 truncate">
                  {formatRecipient(row.recipientEmail)}
                </div>

                {/* Status / Scheduled Time Badge */}
                {mode === 'scheduled' ? (
                  <div className="shrink-0 flex items-center gap-1.5 bg-[#ffedd5] text-[#c2410c] px-3 py-1 rounded-full text-xs font-medium">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" strokeWidth="2" />
                      <polyline points="12 6 12 12 16 14" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <span>{formatFigmaDateTime(row.nextRunAt || row.scheduledAt)}</span>
                  </div>
                ) : (
                  <div className="shrink-0 bg-[#f1f5f9] text-[#64748b] px-3 py-1 rounded-full text-xs font-medium">
                    Sent
                  </div>
                )}

                {/* Subject & Preview */}
                <div className="truncate text-sm min-w-0">
                  <span className="font-semibold text-gray-900">{row.subject}</span>
                  <span className="text-gray-400 ml-2">
                    - {row.body ? row.body.replace(/<[^>]*>?/gm, '').trim().slice(0, 90) : 'Hi, just wanted to follow up on our meeting...'}
                  </span>
                </div>
              </div>

              {/* Star Icon */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                }}
                className="text-gray-300 hover:text-amber-400 transition-colors shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>

      <EmailDetailModal email={selectedEmail} onClose={() => setSelectedEmail(null)} />
    </div>
  );
}

export function ScheduledEmailsTable() {
  return <EmailsTableBase mode="scheduled" />;
}

export function SentEmailsTable() {
  return <EmailsTableBase mode="sent" />;
}
