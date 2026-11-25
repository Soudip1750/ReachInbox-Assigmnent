import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ScheduledEmailsTable } from './EmailsTable';
import { emailsApi } from '../../api/client';

vi.mock('../../api/client', () => ({
  emailsApi: {
    list: vi.fn(),
    search: vi.fn(),
    stats: vi.fn(),
  },
}));

describe('ScheduledEmailsTable search', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    vi.mocked(emailsApi.list).mockResolvedValue({
      items: [
        {
          id: '1',
          recipientEmail: 'alice.smith@example.com',
          subject: 'Welcome aboard',
          body: 'Hello Alice',
          status: 'SCHEDULED',
          scheduledAt: '2026-11-25T10:00:00.000Z',
          nextRunAt: '2026-11-25T10:00:00.000Z',
          sentAt: null,
          previewUrl: null,
          errorMessage: null,
          senderEmail: 'sender@example.com',
          campaignId: 'camp-1',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    vi.mocked(emailsApi.search).mockResolvedValue({
      items: [
        {
          id: '2',
          recipientEmail: 'bob.jones@acme.io',
          subject: 'Product demo',
          body: 'Hi Bob',
          status: 'SCHEDULED',
          scheduledAt: '2026-11-25T11:00:00.000Z',
          nextRunAt: '2026-11-25T11:00:00.000Z',
          sentAt: null,
          previewUrl: null,
          errorMessage: null,
          senderEmail: 'sender@example.com',
          campaignId: 'camp-1',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('calls emailsApi.search on Enter, renders results, and clears back to list', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ScheduledEmailsTable />
        </QueryClientProvider>
      );
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('To: Alice Smith');
    });

    const input = container.querySelector('input[placeholder="Search"]') as HTMLInputElement;
    expect(input).not.toBeNull();

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, 'bob');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    await vi.waitFor(() => {
      expect(emailsApi.search).toHaveBeenCalledWith({
        q: 'bob',
        status: 'scheduled',
        page: 1,
      });
      expect(container.textContent).toContain('To: Bob Jones');
      expect(container.textContent).toContain('Product demo');
    });

    const clearBtn = container.querySelector('button[aria-label="Clear search"]') as HTMLButtonElement;
    expect(clearBtn).not.toBeNull();

    await act(async () => {
      clearBtn.click();
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('To: Alice Smith');
    });
  });
});
