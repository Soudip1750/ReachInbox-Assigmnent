import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from './LoginPage';
import { adminApi, authApi } from '../api/client';

vi.mock('../api/client', () => ({
  authApi: {
    me: vi.fn(),
    logout: vi.fn(),
    googleLoginUrl: () => 'http://localhost:4000/auth/google',
  },
  adminApi: {
    login: vi.fn(),
    queuesUrl: () => 'http://localhost:4000/admin/queues',
  },
  getApiErrorMessage: (err: unknown) =>
    err instanceof Error ? err.message : 'An unexpected error occurred',
}));

describe('LoginPage admin queue access', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    vi.mocked(authApi.me).mockRejectedValue(new Error('Unauthorized'));
    vi.mocked(adminApi.login).mockResolvedValue({
      ok: true,
      redirectUrl: '/admin/queues',
    });
    vi.spyOn(window, 'open').mockImplementation(() => ({} as Window));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('opens admin modal from top-right button and submits admin credentials', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <LoginPage />
          </MemoryRouter>
        </QueryClientProvider>
      );
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('BullMQ Queue Status');
    });

    const trigger = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('BullMQ Queue Status')
    ) as HTMLButtonElement;
    expect(trigger).toBeDefined();

    await act(async () => {
      trigger.click();
    });

    expect(container.textContent).toContain('Admin Queue Access');

    const emailInput = container.querySelector('input[placeholder="admin@gmail.com"]') as HTMLInputElement;
    const passwordInput = container.querySelector('input[placeholder="Enter admin password"]') as HTMLInputElement;
    const form = emailInput.closest('form') as HTMLFormElement;

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(emailInput, 'admin@gmail.com');
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      setter.call(passwordInput, 'admin123');
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    await vi.waitFor(() => {
      expect(adminApi.login).toHaveBeenCalledWith({
        email: 'admin@gmail.com',
        password: 'admin123',
      });
      expect(window.open).toHaveBeenCalledWith(
        'http://localhost:4000/admin/queues',
        '_blank',
        'noopener,noreferrer'
      );
    });
  });
});
