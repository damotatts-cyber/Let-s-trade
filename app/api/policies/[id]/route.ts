import { NextResponse } from 'next/server';
import { z } from 'zod';

import { resolveAdminRequestSession } from '@/lib/guardrail/auth';
import { getGuardrailRepository } from '@/lib/guardrail/repository';

const updateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  thresholds: z.object({
    promptInjection: z.number().min(0).max(1),
    dataLeak: z.number().min(0).max(1),
    unsafeTool: z.number().min(0).max(1),
  }),
  actions: z.object({
    promptInjection: z.enum(['pass', 'redact', 'block']),
    dataLeak: z.enum(['pass', 'redact', 'block']),
    unsafeTool: z.enum(['pass', 'redact', 'block']),
    unknownTool: z.enum(['pass', 'redact', 'block']),
  }),
  rules: z.object({
    blockedPromptPatterns: z.array(z.string()),
    hardBlockPromptPatterns: z.array(z.string()),
    blockedToolPatterns: z.array(z.string()),
    allowedTools: z.array(z.string()),
    sensitiveFields: z.array(z.string()),
  }),
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await resolveAdminRequestSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const repository = getGuardrailRepository();
  const policy = await repository.getPolicy(session.tenant.tenantId, id);
  if (!policy) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ policy });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await resolveAdminRequestSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.actor.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = updateSchema.parse(await request.json());
    const { id } = await params;
    const repository = getGuardrailRepository();
    const policy = await repository.savePolicy(session.tenant.tenantId, id, { ...body, description: body.description ?? null }, session.actor);
    if (!policy) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ policy });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update policy' }, { status: 400 });
  }
}
