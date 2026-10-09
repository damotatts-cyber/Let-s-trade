import { NextResponse } from 'next/server';
import { z } from 'zod';

import { establishAdminSession, SESSION_COOKIE_NAME } from '@/lib/guardrail/auth';
import { signSession } from '@/lib/guardrail/security';

const schema = z.object({
  tenantSlug: z.string().min(1).max(80),
  email: z.string().email().max(160),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const { actor, tenant } = await establishAdminSession(body.tenantSlug, body.email, 'ADMIN');
    const response = NextResponse.json({ ok: true, tenant });
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: signSession({ ...actor, tenantSlug: tenant.tenantSlug }),
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 12,
    });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Login failed' }, { status: 400 });
  }
}
