import { beforeEach, describe, expect, it } from 'vitest';

import { getGuardrailRepository } from '@/lib/guardrail/repository';

beforeEach(() => {
  global.__guardrailMemoryStore = undefined;
  delete process.env.DATABASE_URL;
});

describe('guardrail repository tenant isolation', () => {
  it('keeps tenant policies isolated', async () => {
    const repository = getGuardrailRepository();
    const first = await repository.bootstrap('tenant-one', 'one@example.com', 'ADMIN');
    const second = await repository.bootstrap('tenant-two', 'two@example.com', 'ADMIN');

    const firstPolicy = await repository.getPublishedPolicy(first.tenant.tenantId);
    const secondPolicy = await repository.getPublishedPolicy(second.tenant.tenantId);
    const crossLookup = await repository.getPolicy(first.tenant.tenantId, secondPolicy?.id ?? 'missing');

    expect(firstPolicy?.tenantId).toBe(first.tenant.tenantId);
    expect(secondPolicy?.tenantId).toBe(second.tenant.tenantId);
    expect(crossLookup).toBeNull();
  });
});
