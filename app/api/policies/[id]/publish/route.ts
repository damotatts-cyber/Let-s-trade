import { NextResponse } from 'next/server';

import { resolveAdminRequestSession } from '@/lib/guardrail/auth';
import { getGuardrailRepository } from '@/lib/guardrail/repository';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await resolveAdminRequestSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.actor.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const repository = getGuardrailRepository();
  const policy = await repository.publishPolicy(session.tenant.tenantId, id, session.actor);
  if (!policy) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ policy });
}
