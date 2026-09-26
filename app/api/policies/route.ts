import { NextResponse } from 'next/server';
import { z } from 'zod';

import { resolveAdminRequestSession } from '@/lib/guardrail/auth';
import { createDefaultPolicyConfig } from '@/lib/guardrail/defaults';
import { getGuardrailRepository } from '@/lib/guardrail/repository';

const createSchema = z.object({
  name: z.string().min(1).max(120),
});

export async function GET(request: Request) {
  const session = await resolveAdminRequestSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const repository = getGuardrailRepository();
  const policies = await repository.listPolicies(session.tenant.tenantId);
  return NextResponse.json({ policies });
}

export async function POST(request: Request) {
  const session = await resolveAdminRequestSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = createSchema.parse(await request.json());
    const defaults = createDefaultPolicyConfig();
    const repository = getGuardrailRepository();
    const policy = await repository.savePolicy(
      session.tenant.tenantId,
      null,
      {
        name: body.name,
        description: 'New draft policy',
        thresholds: defaults.thresholds,
        actions: defaults.actions,
        rules: defaults.rules,
      },
      session.actor,
    );
    if (!policy) {
      return NextResponse.json({ error: 'Unable to create policy' }, { status: 500 });
    }
    return NextResponse.json({ id: policy.id, policy }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create policy' }, { status: 400 });
  }
}
