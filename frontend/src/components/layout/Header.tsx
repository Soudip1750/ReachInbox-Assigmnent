import toast from 'react-hot-toast';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { useAuth, useLogout } from '../../api/hooks';
import { SlackStatusChip } from '../../features/slack/SlackStatusChip';

export function Header() {
  const { data: user } = useAuth();
  const logout = useLogout();

  const handleLogout = async () => {
    try {
      await logout.mutateAsync();
    } catch {
      toast.error('Failed to log out');
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-brand-bg/80 backdrop-blur-md border-b border-brand-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-accent flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="font-semibold text-brand-text tracking-tight">ReachInbox</span>
          </div>

          {/* Right side */}
          {user && (
            <div className="flex items-center gap-4">
              {/* Slack status */}
              <SlackStatusChip />

              {/* Divider */}
              <div className="h-6 w-px bg-brand-border" />

              {/* User info */}
              <div className="flex items-center gap-3">
                <Avatar src={user.avatarUrl} name={user.name} size="sm" />
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-brand-text leading-tight truncate max-w-[140px]">
                    {user.name}
                  </p>
                  <p className="text-xs text-brand-text-muted truncate max-w-[140px]">
                    {user.email}
                  </p>
                </div>
              </div>

              {/* Logout */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                loading={logout.isPending}
                aria-label="Log out"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
