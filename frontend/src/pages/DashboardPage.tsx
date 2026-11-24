import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth, useLogout, useEmailStats } from '../api/hooks';
import { ScheduledEmailsTable, SentEmailsTable } from '../features/emails/EmailsTable';
import { ComposeModal } from '../features/compose/ComposeModal';
import { SlackStatusChip } from '../features/slack/SlackStatusChip';

export function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [composeOpen, setComposeOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const { data: user } = useAuth();
  const { data: stats } = useEmailStats();
  const logout = useLogout();

  const activeTab = searchParams.get('tab') === 'sent' ? 'sent' : 'scheduled';

  const setTab = (tab: 'scheduled' | 'sent') => {
    setSearchParams({ tab }, { replace: true });
  };

  const scheduledCount = stats?.scheduled ?? 0;
  const sentCount = stats?.sent ?? 0;

  return (
    <div className="w-full h-screen bg-white flex overflow-hidden">
      {/* Left Sidebar */}
      <aside className="w-64 h-full shrink-0 border-r border-gray-100 p-6 flex flex-col justify-between bg-white">
          <div>
            {/* Logo: ON6 / ONG */}
            <div className="flex items-center gap-1.5 mb-6">
              <span className="logo-font text-2xl font-black tracking-tighter text-black select-none">
                ON8
              </span>
            </div>

            {/* User Profile Card */}
            <div className="relative mb-5">
              <div
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="bg-[#f4f6f8] hover:bg-[#eaecee] transition-colors rounded-2xl p-2.5 flex items-center justify-between cursor-pointer select-none"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      className="w-8 h-8 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center shrink-0">
                      {(user?.name || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900 leading-tight truncate">
                      {user?.name || 'Oliver Brown'}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">
                      {user?.email || 'oliver.brown@domain.io'}
                    </p>
                  </div>
                </div>

                <span className="text-gray-400 text-xs px-1">⌵</span>
              </div>

              {/* User Dropdown */}
              {userDropdownOpen && (
                <div className="absolute left-0 right-0 top-14 bg-white rounded-xl shadow-xl border border-gray-100 p-2 z-30 animate-slide-up space-y-1">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="text-xs font-semibold text-gray-800 truncate">{user?.name}</p>
                    <p className="text-[10px] text-gray-400 truncate">{user?.email}</p>
                  </div>

                  <div className="px-3 py-2">
                    <SlackStatusChip />
                  </div>

                  <button
                    onClick={() => logout.mutate()}
                    className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>

            {/* Compose Button per Figma */}
            <button
              onClick={() => setComposeOpen(true)}
              className="w-full bg-white hover:bg-[#e8f5e9] text-[#00a859] border-2 border-[#00a859] font-semibold text-sm py-2.5 rounded-full transition-all flex items-center justify-center shadow-sm"
            >
              Compose
            </button>

            {/* Navigation CORE section */}
            <div className="mt-8">
              <div className="text-[11px] font-bold tracking-wider text-gray-400 uppercase mb-2 px-1">
                CORE
              </div>

              <nav className="space-y-1.5">
                {/* Scheduled Tab item */}
                <button
                  onClick={() => setTab('scheduled')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition-all ${
                    activeTab === 'scheduled'
                      ? 'bg-[#e8f5e9] text-[#00a859] font-semibold'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <svg
                      className={`w-4 h-4 ${
                        activeTab === 'scheduled' ? 'text-[#00a859]' : 'text-gray-400'
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <circle cx="12" cy="12" r="10" strokeWidth="2" />
                      <polyline points="12 6 12 12 16 14" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <span>Scheduled</span>
                  </div>

                  <span
                    className={`text-xs ${
                      activeTab === 'scheduled'
                        ? 'text-[#00a859] font-bold'
                        : 'text-gray-400'
                    }`}
                  >
                    {scheduledCount}
                  </span>
                </button>

                {/* Sent Tab item */}
                <button
                  onClick={() => setTab('sent')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition-all ${
                    activeTab === 'sent'
                      ? 'bg-[#e8f5e9] text-[#00a859] font-semibold'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <svg
                      className={`w-4 h-4 ${
                        activeTab === 'sent' ? 'text-[#00a859]' : 'text-gray-400'
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                      />
                    </svg>
                    <span>Sent</span>
                  </div>

                  <span
                    className={`text-xs ${
                      activeTab === 'sent' ? 'text-[#00a859] font-bold' : 'text-gray-400'
                    }`}
                  >
                    {sentCount}
                  </span>
                </button>
              </nav>
            </div>
          </div>

          {/* Quick link to BullMQ Admin Dashboard */}
          <div className="pt-4 border-t border-gray-100">
            <a
              href={`${import.meta.env['VITE_BACKEND_URL'] ?? 'http://localhost:4000'}/admin/queues`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between text-xs text-gray-500 hover:text-emerald-700 py-1 transition-colors"
            >
              <span>BullMQ Queue Status</span>
              <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-mono">
                :4000 ↗
              </span>
            </a>
          </div>
        </aside>

        {/* Right Main Content Area */}
        <main className="flex-1 h-full bg-white overflow-y-auto">
          {activeTab === 'scheduled' ? <ScheduledEmailsTable /> : <SentEmailsTable />}
        </main>

        {/* Compose View (Figma Screen 5/6/7) */}
        <ComposeModal isOpen={composeOpen} onClose={() => setComposeOpen(false)} />
      </div>
  );
}
