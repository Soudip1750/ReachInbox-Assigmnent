import type { EmailJob } from '../../types';
import { formatDateTime } from '../../lib/date';

interface EmailDetailModalProps {
  email: EmailJob | null;
  onClose: () => void;
}

export function EmailDetailModal({ email, onClose }: EmailDetailModalProps) {
  if (!email) return null;

  const senderInitial = (email.senderEmail || 'S')[0].toUpperCase();
  const recipientName = email.recipientEmail.split('@')[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              title="Back"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h2 className="text-base font-bold text-gray-900 truncate max-w-md sm:max-w-xl">
              {email.subject}
            </h2>
          </div>

          <div className="flex items-center gap-3 text-gray-400">
            <button className="hover:text-amber-500 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </button>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
              ✕
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-8 overflow-y-auto space-y-6">
          {/* Sender & Recipient Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-semibold flex items-center justify-center text-sm shadow-sm">
                {senderInitial}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 text-sm">ReachInbox Sender</span>
                  <span className="text-xs text-gray-500">&lt;{email.senderEmail}&gt;</span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  to {recipientName} &lt;{email.recipientEmail}&gt; ⌵
                </div>
              </div>
            </div>

            <div className="text-xs text-gray-400">
              {formatDateTime(email.sentAt || email.scheduledAt)}
            </div>
          </div>

          {/* Email Body */}
          <div className="pt-4 text-sm text-gray-800 leading-relaxed space-y-4">
            <p>Hey {recipientName},</p>
            <div className="whitespace-pre-wrap">{email.subject}</div>

            {/* Figma style highlight block */}
            <div className="bg-[#fffbeb] border-l-4 border-amber-400 p-4 rounded-r-lg text-amber-900 text-sm shadow-sm">
              <p className="font-medium">Campaign Schedule Details</p>
              <p className="text-xs text-amber-700 mt-1">
                Status: <span className="font-semibold uppercase">{email.status}</span> • Scheduled Time: {formatDateTime(email.scheduledAt)}
              </p>
            </div>
          </div>

          {/* Ethereal Preview Link */}
          {email.previewUrl && (
            <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500">Ethereal Sandbox Mailbox:</span>
              <a
                href={email.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00a859] hover:underline"
              >
                <span>View Full Ethereal Preview</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
