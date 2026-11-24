import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { useSlackStatus, useSlackDisconnect } from '../../api/hooks';
import { slackApi } from '../../api/client';

export function SlackStatusChip() {
  const { data: slack, isLoading } = useSlackStatus();
  const disconnect = useSlackDisconnect();

  // Handle OAuth callback params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('slack_connected') === 'true') {
      toast.success('✅ Slack connected successfully!');
      window.history.replaceState({}, '', window.location.pathname);
    }
    const slackError = params.get('slack_error');
    if (slackError) {
      toast.error(`Slack connection failed: ${slackError}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Slack? Rate limit notifications will stop.')) return;
    try {
      await disconnect.mutateAsync();
      toast.success('Slack disconnected');
    } catch {
      toast.error('Failed to disconnect Slack');
    }
  };

  if (isLoading) {
    return <div className="w-20 h-7 bg-brand-surface rounded-full animate-pulse" />;
  }

  if (slack?.connected) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
          </svg>
          {slack.teamName ?? 'Connected'}
        </div>
        <button
          onClick={handleDisconnect}
          className="text-xs text-brand-text-muted hover:text-red-400 transition-colors"
          title="Disconnect Slack"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <a
      href={slackApi.connectUrl()}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-surface border border-brand-border text-xs font-medium text-brand-text-secondary hover:border-brand-accent/50 hover:text-brand-text transition-all"
    >
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52z" opacity=".5"/>
        <path d="M8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"/>
      </svg>
      Connect Slack
    </a>
  );
}
