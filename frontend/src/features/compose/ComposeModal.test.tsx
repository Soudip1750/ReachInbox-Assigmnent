import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ComposeModal } from './ComposeModal';
import { authApi, campaignsApi } from '../../api/client';

vi.mock('../../api/client', () => ({
  authApi: {
    me: vi.fn(),
  },
  campaignsApi: {
    create: vi.fn(),
  },
  getApiErrorMessage: (err: unknown) =>
    err instanceof Error ? err.message : 'An unexpected error occurred',
}));

describe('ComposeModal schedule & attachments', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    vi.mocked(authApi.me).mockResolvedValue({
      id: 'user-1',
      name: 'Test User',
      email: 'user@example.com',
      avatarUrl: null,
      slackConnected: false,
      slackTeamName: null,
    });
    vi.mocked(campaignsApi.create).mockResolvedValue({
      campaignId: 'camp-1',
      total: 1,
      firstRunAt: '2026-11-25T11:00:00.000Z',
      enqueued: true,
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('removes the clock icon button, keeps Schedule Later functionality, and supports <=5MB attachments', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ComposeModal isOpen={true} onClose={vi.fn()} />
        </QueryClientProvider>
      );
    });

    // Clock icon button should be removed
    expect(container.querySelector('button[title="Schedule Time"]')).toBeNull();

    // Schedule Later button should open the Schedule Later popover
    const scheduleLaterBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Schedule Later')
    ) as HTMLButtonElement;
    expect(scheduleLaterBtn).toBeDefined();

    await act(async () => {
      scheduleLaterBtn.click();
    });
    expect(container.querySelector('input[type="datetime-local"]')).not.toBeNull();

    // Reject file > 5MB, accept file <= 5MB
    const fileInput = container.querySelector('button[aria-label="Attach file"]')?.previousElementSibling as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    const oversized = new File([new Uint8Array(10)], 'huge.pdf', { type: 'application/pdf' });
    Object.defineProperty(oversized, 'size', { value: 6 * 1024 * 1024 });

    const validFile = new File(['hello attachment'], 'brochure.txt', { type: 'text/plain' });

    await act(async () => {
      Object.defineProperty(fileInput, 'files', {
        value: [oversized, validFile],
        configurable: true,
      });
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(container.textContent).toContain('brochure.txt');
    expect(container.textContent).not.toContain('huge.pdf');
  });
});
