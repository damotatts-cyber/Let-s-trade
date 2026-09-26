import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

import LoginForm from '@/components/guardrail/LoginForm';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('login form', () => {
  it('renders the seeded tenant and email fields', () => {
    render(<LoginForm />);

    expect(screen.getByLabelText(/Tenant slug/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open admin console/i })).toBeInTheDocument();
  });
});
