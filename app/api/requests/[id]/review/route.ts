import { NextResponse } from 'next/server';
import { z } from 'zod';

import { resolveAdminRequestSession } from '@/lib/guardrail/auth';
import { getGuardrailRepository } from '@/lib/guardrail/repository';

const schema = z.object({
  reason: z.string().min(10).max(500),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await resolveAdminRequestSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = schema.parse(await request.json());
    const { id } = await params;
    const repository = getGuardrailRepository();
    const reviewed = await repository.reviewRequest(session.tenant.tenantId, id, body.reason, session.actor);
    if (!reviewed) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ request: reviewed });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to review request' }, { status: 400 });
  }
}
