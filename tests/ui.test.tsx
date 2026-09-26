import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}));

import LoginForm from '@/components/guardrail/LoginForm';

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
});

describe('login form', () => {
  it('renders the seeded tenant and email fields', () => {
    render(<LoginForm />);

    expect(screen.getByLabelText(/Tenant slug/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open admin console/i })).toBeInTheDocument();
  });

  it('submits and redirects on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    render(<LoginForm />);

    fireEvent.submit(screen.getByRole('button', { name: /Open admin console/i }).closest('form')!);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));
    expect(refresh).toHaveBeenCalled();
  });

  it('shows an error when login fails', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response(JSON.stringify({ error: 'Login failed' }), { status: 401 }));
    render(<LoginForm />);

    fireEvent.submit(screen.getByRole('button', { name: /Open admin console/i }).closest('form')!);

    expect(await screen.findByText('Login failed')).toBeInTheDocument();
  });
});
