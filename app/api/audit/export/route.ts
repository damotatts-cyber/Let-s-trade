import { NextResponse } from 'next/server';

import { resolveAdminRequestSession } from '@/lib/guardrail/auth';
import { getGuardrailRepository } from '@/lib/guardrail/repository';

function escapeCell(value: unknown) {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  const neutralized = /^[=+\-@]/.test(serialized) ? `'${serialized}` : serialized;
  return `"${neutralized.replaceAll('\"', '\"\"')}"`;
}

export async function GET(request: Request) {
  const session = await resolveAdminRequestSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const eventType = url.searchParams.get('eventType') ?? undefined;
  const repository = getGuardrailRepository();
  const events = await repository.listAudit(session.tenant.tenantId, eventType);

  const rows = [
    ['createdAt', 'eventType', 'entityType', 'entityId', 'actorEmail', 'payload'],
    ...events.map((event) => [event.createdAt, event.eventType, event.entityType, event.entityId, event.actorEmail ?? '', event.payload]),
  ];

  const csv = rows.map((row) => row.map(escapeCell).join(',')).join('\n');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="guardrail-audit.csv"',
    },
  });
}
