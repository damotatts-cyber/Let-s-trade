import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import LoginForm from '@/components/guardrail/LoginForm';

describe('login form', () => {
  it('renders the seeded tenant and email fields', () => {
    render(<LoginForm />);

    expect(screen.getByLabelText(/Tenant slug/i)).toBeTruthy();
    expect(screen.getByLabelText(/Email/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Open admin console/i })).toBeTruthy();
  });
});
