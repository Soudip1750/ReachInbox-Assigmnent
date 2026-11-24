import { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { useCreateCampaign, useAuth } from '../../api/hooks';
import { getApiErrorMessage } from '../../api/client';
import { parseEmailFile } from '../../lib/csv';
import { toLocalISOString } from '../../lib/date';

interface ComposeViewProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ComposeModal({ isOpen, onClose }: ComposeViewProps) {
  const { data: user } = useAuth();
  const createCampaign = useCreateCampaign();

  const [toInput, setToInput] = useState('');
  const [emailsList, setEmailsList] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [delaySec, setDelaySec] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(50);
  const [scheduledTime, setScheduledTime] = useState(
    toLocalISOString(new Date(Date.now() + 60_000))
  );

  const [isSendLaterOpen, setIsSendLaterOpen] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (file: File) => {
    setIsParsing(true);
    const result = await parseEmailFile(file);
    setIsParsing(false);

    if (result.emails.length === 0) {
      toast.error('No valid emails found in file.');
      return;
    }

    setEmailsList((prev) => [...new Set([...prev, ...result.emails])]);
    toast.success(`${result.emails.length} email addresses added from ${file.name}`);
  };

  const handleManualAddEmail = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const trimmed = toInput.trim().toLowerCase();
      if (trimmed && trimmed.includes('@')) {
        setEmailsList((prev) => [...new Set([...prev, trimmed])]);
        setToInput('');
      }
    }
  };

  const handleScheduleSubmit = async () => {
    const allEmails = [...emailsList];
    if (toInput.trim() && toInput.includes('@')) {
      allEmails.push(toInput.trim().toLowerCase());
    }

    if (allEmails.length === 0) {
      toast.error('Please specify at least one recipient email.');
      return;
    }

    if (!subject.trim()) {
      toast.error('Please enter a subject.');
      return;
    }

    const start = new Date(scheduledTime);
    const startTimeISO = start < new Date()
      ? new Date(Date.now() + 1000).toISOString()
      : start.toISOString();

    try {
      const res = await createCampaign.mutateAsync({
        subject,
        body: body.trim() || 'Hello, this is a message from ReachInbox.',
        emails: allEmails,
        startTime: startTimeISO,
        delayMs: delaySec * 1000,
        hourlyLimit,
      });

      toast.success(`✅ Campaign scheduled! ${res.total} emails queued.`);
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const handlePresetSelect = (hoursAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // Tomorrow
    d.setHours(hoursAhead, 0, 0, 0);
    setScheduledTime(toLocalISOString(d));
  };

  const displayedPills = emailsList.slice(0, 3);
  const extraCount = emailsList.length - 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto">
      {/* Container exactly matching Figma Compose New Email Screen */}
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col min-h-[620px] relative">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-gray-500 hover:text-gray-900 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h2 className="text-lg font-semibold text-gray-900">Compose New Email</h2>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-4 relative">
            <button
              type="button"
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full transition-colors relative"
              title="Attachments"
            >
              <svg className="w-5 h-5 text-[#00a859]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => setIsSendLaterOpen(!isSendLaterOpen)}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full transition-colors"
              title="Schedule Time"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth="1.8" />
                <polyline points="12 6 12 12 16 14" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>

            {/* Send Later pill button */}
            <button
              type="button"
              onClick={() => setIsSendLaterOpen(!isSendLaterOpen)}
              className="px-5 py-1.5 rounded-full border border-[#00a859] text-[#00a859] hover:bg-[#e8f5e9] text-sm font-medium transition-all"
            >
              Send Later
            </button>

            {/* Figma Send Later Popover (Screen 5) */}
            {isSendLaterOpen && (
              <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 p-5 z-50 animate-slide-up">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Send Later</h3>

                <div className="mb-4">
                  <label className="block text-xs text-gray-500 mb-1">Pick date & time</label>
                  <input
                    type="datetime-local"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-[#f4f6f8] border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:border-[#00a859]"
                  />
                </div>

                <div className="space-y-1.5 border-t border-gray-100 pt-3 mb-4">
                  <button
                    type="button"
                    onClick={() => handlePresetSelect(9)}
                    className="w-full text-left px-2 py-1.5 text-xs text-gray-600 hover:bg-[#f4f6f8] rounded-md transition-colors"
                  >
                    Tomorrow
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetSelect(10)}
                    className="w-full text-left px-2 py-1.5 text-xs text-gray-600 hover:bg-[#f4f6f8] rounded-md transition-colors"
                  >
                    Tomorrow, 10:00 AM
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetSelect(11)}
                    className="w-full text-left px-2 py-1.5 text-xs text-gray-600 hover:bg-[#f4f6f8] rounded-md transition-colors"
                  >
                    Tomorrow, 11:00 AM
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetSelect(15)}
                    className="w-full text-left px-2 py-1.5 text-xs text-gray-600 hover:bg-[#f4f6f8] rounded-md transition-colors"
                  >
                    Tomorrow, 3:00 PM
                  </button>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsSendLaterOpen(false)}
                    className="px-3 py-1 text-xs text-gray-500 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSendLaterOpen(false);
                      handleScheduleSubmit();
                    }}
                    className="px-4 py-1 text-xs font-semibold rounded-full border border-[#00a859] text-[#00a859] hover:bg-[#e8f5e9]"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Form Body */}
        <div className="p-8 space-y-5 flex-1 flex flex-col">
          {/* From row */}
          <div className="flex items-center gap-6">
            <span className="w-16 text-xs text-gray-400 font-medium">From</span>
            <div className="inline-flex items-center gap-2 bg-[#f4f6f8] text-gray-700 text-xs px-3 py-1.5 rounded-full">
              <span>{user?.email || 'oliver.brown@domain.io'}</span>
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* To row with Upload List */}
          <div className="flex items-center gap-6 border-b border-gray-100 pb-3">
            <span className="w-16 text-xs text-gray-400 font-medium">To</span>
            <div className="flex-1 flex flex-wrap items-center gap-2">
              {/* Displayed Email Pills per Figma page_7.jpg */}
              {displayedPills.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center gap-1.5 bg-white border border-[#00a859] text-gray-800 text-xs px-3 py-1 rounded-full shadow-sm"
                >
                  {email}
                  <button
                    type="button"
                    onClick={() => setEmailsList((prev) => prev.filter((e) => e !== email))}
                    className="text-gray-400 hover:text-red-500"
                  >
                    ×
                  </button>
                </span>
              ))}

              {extraCount > 0 && (
                <span className="inline-flex items-center bg-white border border-[#00a859] text-[#00a859] text-xs font-semibold px-2.5 py-1 rounded-full">
                  +{extraCount}
                </span>
              )}

              <input
                type="text"
                placeholder={emailsList.length === 0 ? 'recipient@example.com' : 'Add another recipient...'}
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                onKeyDown={handleManualAddEmail}
                className="flex-1 min-w-[200px] text-sm text-gray-800 placeholder-gray-300 focus:outline-none bg-transparent"
              />
            </div>

            {/* Upload List Trigger */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileUpload(f);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isParsing}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#00a859] hover:text-[#00924d] transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span>{isParsing ? 'Parsing...' : 'Upload List'}</span>
              </button>
            </div>
          </div>

          {/* Subject row */}
          <div className="flex items-center gap-6 border-b border-gray-100 pb-3">
            <span className="w-16 text-xs text-gray-400 font-medium">Subject</span>
            <input
              type="text"
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="flex-1 text-sm text-gray-800 placeholder-gray-300 focus:outline-none bg-transparent font-medium"
            />
          </div>

          {/* Delay and Hourly Limit parameters */}
          <div className="flex flex-wrap items-center gap-8 text-xs text-gray-500 py-1">
            <div className="flex items-center gap-3">
              <span>Delay between 2 emails</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  value={delaySec}
                  onChange={(e) => setDelaySec(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-16 bg-[#f4f6f8] text-center text-gray-800 font-semibold py-1 px-2 rounded-lg border border-transparent focus:border-gray-300 focus:outline-none"
                />
                <span className="text-gray-400">sec</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span>Hourly Limit</span>
              <input
                type="number"
                min={1}
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 bg-[#f4f6f8] text-center text-gray-800 font-semibold py-1 px-2 rounded-lg border border-transparent focus:border-gray-300 focus:outline-none"
              />
            </div>
          </div>

          {/* Formatting Toolbar per Figma */}
          <div className="bg-[#f9fafb] rounded-xl border border-gray-100 px-4 py-2 flex items-center gap-4 text-gray-400 text-xs">
            <button type="button" className="hover:text-gray-700">↶</button>
            <button type="button" className="hover:text-gray-700">↷</button>
            <span className="text-gray-200">|</span>
            <button type="button" className="hover:text-gray-700 font-serif">Tt</button>
            <button type="button" className="hover:text-gray-700 font-bold">B</button>
            <button type="button" className="hover:text-gray-700 italic">I</button>
            <button type="button" className="hover:text-gray-700 underline">U</button>
            <span className="text-gray-200">|</span>
            <button type="button" className="hover:text-gray-700">≡</button>
            <button type="button" className="hover:text-gray-700">⬍</button>
            <button type="button" className="hover:text-gray-700">1. :≡</button>
            <button type="button" className="hover:text-gray-700">"</button>
            <button type="button" className="hover:text-gray-700"><s>S</s></button>
          </div>

          {/* Body Area */}
          <textarea
            placeholder="Type Your Reply..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="flex-1 w-full resize-none p-4 text-sm text-gray-800 placeholder-gray-300 focus:outline-none bg-transparent"
          />

          {/* Bottom Send / Schedule Bar */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <div className="text-xs text-gray-400">
              {emailsList.length} recipient{emailsList.length !== 1 ? 's' : ''} ready
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 text-sm text-gray-500 hover:text-gray-800"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleScheduleSubmit}
                disabled={createCampaign.isPending}
                className="px-6 py-2 rounded-full bg-[#00a859] hover:bg-[#00924d] text-white text-sm font-semibold shadow-sm transition-all"
              >
                {createCampaign.isPending ? 'Scheduling...' : 'Send Campaign'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
