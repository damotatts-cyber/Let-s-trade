import { timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { DEMO_ADMIN_EMAIL, DEMO_TENANT_SLUG, SESSION_COOKIE_NAME } from '@/lib/guardrail/defaults';
import { getGuardrailRepository } from '@/lib/guardrail/repository';
import { hashValue, readSessionCookie } from '@/lib/guardrail/security';
import type { ActorContext, TenantContext } from '@/lib/guardrail/types';

export async function resolveAdminSession(): Promise<{ actor: ActorContext; tenant: TenantContext } | null> {
  const cookieStore = await cookies();
  const session = readSessionCookie(
    cookieStore
      .getAll()
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join('; '),
  );

  if (!session) {
    return null;
  }

  const repository = getGuardrailRepository();
  const bootstrapped = await repository.bootstrap(session.tenantSlug, session.email, session.role);
  return {
    actor: {
      email: session.email,
      role: session.role,
      authMode: 'cookie',
      userId: 'id' in bootstrapped.user ? bootstrapped.user.id : undefined,
    },
    tenant: bootstrapped.tenant,
  };
}

export async function requireAdminSession() {
  const session = await resolveAdminSession();
  if (!session) {
    redirect('/login');
  }
  return session;
}


export async function resolveAdminRequestSession(request: Request): Promise<{ actor: ActorContext; tenant: TenantContext } | null> {
  const session = readSessionCookie(request.headers.get('cookie'));
  if (!session) {
    return null;
  }

  const repository = getGuardrailRepository();
  const bootstrapped = await repository.bootstrap(session.tenantSlug, session.email, session.role);
  return {
    actor: {
      email: session.email,
      role: session.role,
      authMode: 'cookie',
      userId: 'id' in bootstrapped.user ? bootstrapped.user.id : undefined,
    },
    tenant: bootstrapped.tenant,
  };
}


function assertMockLoginEnabled() {
  if (process.env.NODE_ENV !== 'production' && process.env.GUARDRAIL_ALLOW_INSECURE_DEV_SESSION === 'true') {
    return;
  }

  throw new Error('Mock admin bootstrap login is disabled. Configure real auth or explicitly set GUARDRAIL_ALLOW_INSECURE_DEV_SESSION=true in non-production mode.');
}

export async function establishAdminSession(tenantSlug: string, email: string, role: ActorContext['role'] = 'ADMIN') {
  assertMockLoginEnabled();
  const repository = getGuardrailRepository();
  const bootstrapped = await repository.bootstrap(tenantSlug || DEMO_TENANT_SLUG, email || DEMO_ADMIN_EMAIL, role);
  return {
    actor: {
      email: bootstrapped.user.email,
      role: bootstrapped.user.role,
      authMode: 'cookie' as const,
      userId: bootstrapped.user.id,
    },
    tenant: bootstrapped.tenant,
  };
}

export async function resolveGatewaySession(request: Request): Promise<{ actor: ActorContext; tenant: TenantContext }> {
  const repository = getGuardrailRepository();
  const tenantSlug = request.headers.get('x-tenant-slug') || DEMO_TENANT_SLUG;
  const email = request.headers.get('x-actor-email') || DEMO_ADMIN_EMAIL;
  const authorization = request.headers.get('authorization');
  const configuredSharedToken = process.env.GUARDRAIL_SHARED_TOKEN;

  if (configuredSharedToken) {
    const provided = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : '';
    const providedDigest = Buffer.from(hashValue(provided), 'hex');
    const expectedDigest = Buffer.from(hashValue(configuredSharedToken), 'hex');
    if (providedDigest.length !== expectedDigest.length || !timingSafeEqual(providedDigest, expectedDigest)) {
      throw new Error('Unauthorized: missing or invalid bearer token');
    }
  }

  const bootstrapped = await repository.bootstrap(tenantSlug, email, 'ADMIN');
  return {
    actor: {
      email: bootstrapped.user.email,
      role: bootstrapped.user.role,
      authMode: configuredSharedToken ? 'header' : 'mock',
      userId: bootstrapped.user.id,
    },
    tenant: bootstrapped.tenant,
  };
}

export { SESSION_COOKIE_NAME };
