import { randomUUID } from 'node:crypto';

import { createDefaultPolicyConfig, DEMO_ADMIN_EMAIL, DEMO_TENANT_NAME, DEMO_TENANT_SLUG } from '@/lib/guardrail/defaults';
import { hashValue } from '@/lib/guardrail/security';
import type { ActorContext, DashboardSummary, DecisionOutcome, GatewayEvaluationResult, PolicyConfig, ReviewState, TenantContext } from '@/lib/guardrail/types';
import { getPrismaClient } from '@/lib/prisma';

export interface PolicyRecord {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  status: 'draft' | 'published' | 'archived';
  version: number;
  thresholds: PolicyConfig['thresholds'];
  rules: PolicyConfig['rules'];
  actions: PolicyConfig['actions'];
  lastTestResult?: unknown;
  publishedAt: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface RequestRecord {
  id: string;
  requestId: string;
  tenantId: string;
  actorEmail: string;
  policyId: string | null;
  requestType: 'prompt' | 'tool_call';
  toolName: string | null;
  source: string | null;
  inputHash: string;
  inputPreview: string;
  sanitizedPayload: unknown;
  decision: DecisionOutcome;
  riskScore: number;
  riskBreakdown: unknown;
  matchedRules: unknown;
  detectorResults: unknown;
  hardBlock: boolean;
  reviewStatus: ReviewState;
  reviewReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  redactions: Array<{
    id: string;
    jsonPath: string;
    replacement: string;
    reason: string;
  }>;
}

export interface AuditRecord {
  id: string;
  tenantId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  payload: unknown;
  createdAt: string;
  requestId: string | null;
  policyId: string | null;
  actorEmail: string | null;
}

interface SeedState {
  tenants: Array<{ id: string; slug: string; name: string; sharedSecretHash: string | null; createdAt: string; updatedAt: string }>;
  users: Array<{ id: string; tenantId: string; email: string; name: string | null; role: 'ADMIN' | 'REVIEWER' | 'ANALYST'; createdAt: string; updatedAt: string }>;
  policies: PolicyRecord[];
  requests: RequestRecord[];
  auditEvents: AuditRecord[];
}

function nowIso() {
  return new Date().toISOString();
}

function toTenantContext(record: SeedState['tenants'][number]): TenantContext {
  return {
    tenantId: record.id,
    tenantSlug: record.slug,
    tenantName: record.name,
  };
}

function createSeedState(): SeedState {
  const now = nowIso();
  const tenantId = 'tenant_demo';
  const userId = 'user_demo';
  const policyConfig = createDefaultPolicyConfig();
  const policyId = 'policy_default';

  return {
    tenants: [
      {
        id: tenantId,
        slug: DEMO_TENANT_SLUG,
        name: DEMO_TENANT_NAME,
        sharedSecretHash: process.env.GUARDRAIL_SHARED_TOKEN ? hashValue(process.env.GUARDRAIL_SHARED_TOKEN) : null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    users: [
      {
        id: userId,
        tenantId,
        email: DEMO_ADMIN_EMAIL,
        name: 'Demo Admin',
        role: 'ADMIN',
        createdAt: now,
        updatedAt: now,
      },
    ],
    policies: [
      {
        id: policyId,
        tenantId,
        name: 'Default enterprise guardrail',
        description: 'Blocks high-confidence prompt injection and unsafe tools while redacting sensitive fields.',
        status: 'published',
        version: 1,
        thresholds: policyConfig.thresholds,
        rules: policyConfig.rules,
        actions: policyConfig.actions,
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ],
    requests: [],
    auditEvents: [],
  };
}

declare global {
  var __guardrailMemoryStore: SeedState | undefined;
}

function memoryStore(): SeedState {
  if (!global.__guardrailMemoryStore) {
    global.__guardrailMemoryStore = createSeedState();
  }

  return global.__guardrailMemoryStore;
}

function normalizePolicy(policy: PolicyRecord): PolicyRecord {
  return { ...policy };
}

class MemoryRepository {
  private readonly state = memoryStore();

  async bootstrap(tenantSlug = DEMO_TENANT_SLUG, email = DEMO_ADMIN_EMAIL, role: ActorContext['role'] = 'ADMIN') {
    let tenant = this.state.tenants.find((entry) => entry.slug === tenantSlug);
    if (!tenant) {
      const now = nowIso();
      tenant = { id: `tenant_${randomUUID()}`, slug: tenantSlug, name: tenantSlug, sharedSecretHash: null, createdAt: now, updatedAt: now };
      this.state.tenants.push(tenant);
      const config = createDefaultPolicyConfig();
      this.state.policies.push({
        id: `policy_${randomUUID()}`,
        tenantId: tenant.id,
        name: `${tenantSlug} default policy`,
        description: 'Auto-seeded tenant policy',
        status: 'published',
        version: 1,
        thresholds: config.thresholds,
        rules: config.rules,
        actions: config.actions,
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    let user = this.state.users.find((entry) => entry.tenantId === tenant.id && entry.email === email);
    if (!user) {
      user = { id: `user_${randomUUID()}`, tenantId: tenant.id, email, name: email, role, createdAt: nowIso(), updatedAt: nowIso() };
      this.state.users.push(user);
    }

    let policy = this.state.policies.find((entry) => entry.tenantId === tenant.id && entry.status === 'published');
    if (!policy) {
      policy = this.state.policies.find((entry) => entry.tenantId === tenant.id);
    }

    if (!policy) {
      const config = createDefaultPolicyConfig();
      policy = {
        id: `policy_${randomUUID()}`,
        tenantId: tenant.id,
        name: `${tenantSlug} default policy`,
        description: 'Auto-seeded tenant policy',
        status: 'published',
        version: 1,
        thresholds: config.thresholds,
        rules: config.rules,
        actions: config.actions,
        publishedAt: nowIso(),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      this.state.policies.push(policy);
    }

    return { tenant: toTenantContext(tenant), user, policy: normalizePolicy(policy) };
  }

  async getTenantBySlug(tenantSlug: string) {
    const tenant = this.state.tenants.find((entry) => entry.slug === tenantSlug);
    return tenant ? toTenantContext(tenant) : null;
  }

  async getUserByEmail(tenantId: string, email: string) {
    return this.state.users.find((entry) => entry.tenantId === tenantId && entry.email === email) ?? null;
  }

  async listPolicies(tenantId: string) {
    return this.state.policies.filter((entry) => entry.tenantId === tenantId).map(normalizePolicy).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async getPolicy(tenantId: string, policyId: string) {
    const policy = this.state.policies.find((entry) => entry.tenantId === tenantId && entry.id === policyId);
    return policy ? normalizePolicy(policy) : null;
  }

  async getPublishedPolicy(tenantId: string, requestedPolicyId?: string) {
    const selected = requestedPolicyId
      ? this.state.policies.find((entry) => entry.tenantId === tenantId && entry.id === requestedPolicyId && entry.status === 'published')
      : this.state.policies.find((entry) => entry.tenantId === tenantId && entry.status === 'published');
    return selected ? normalizePolicy(selected) : null;
  }

  async savePolicy(tenantId: string, policyId: string | null, payload: Omit<PolicyRecord, 'id' | 'tenantId' | 'version' | 'status' | 'createdAt' | 'updatedAt' | 'publishedAt'> & { status?: PolicyRecord['status'] }, actor: ActorContext) {
    const now = nowIso();
    if (!policyId) {
      const record: PolicyRecord = {
        id: `policy_${randomUUID()}`,
        tenantId,
        name: payload.name,
        description: payload.description,
        status: payload.status ?? 'draft',
        version: 1,
        thresholds: payload.thresholds,
        rules: payload.rules,
        actions: payload.actions,
        publishedAt: payload.status === 'published' ? now : null,
        createdAt: now,
        updatedAt: now,
      };
      this.state.policies.push(record);
      await this.addAuditEvent(tenantId, actor.email, 'POLICY_CREATED', 'policy', record.id, { name: record.name, status: record.status }, null, record.id);
      return normalizePolicy(record);
    }

    const existing = this.state.policies.find((entry) => entry.tenantId === tenantId && entry.id === policyId);
    if (!existing) {
      return null;
    }

    existing.name = payload.name;
    existing.description = payload.description;
    existing.thresholds = payload.thresholds;
    existing.rules = payload.rules;
    existing.actions = payload.actions;
    existing.status = payload.status ?? existing.status;
    existing.version += 1;
    existing.updatedAt = now;
    await this.addAuditEvent(tenantId, actor.email, 'POLICY_UPDATED', 'policy', existing.id, { version: existing.version, status: existing.status }, null, existing.id);
    return normalizePolicy(existing);
  }

  async publishPolicy(tenantId: string, policyId: string, actor: ActorContext) {
    const policy = this.state.policies.find((entry) => entry.tenantId === tenantId && entry.id === policyId);
    if (!policy) {
      return null;
    }

    for (const otherPolicy of this.state.policies) {
      if (otherPolicy.tenantId === tenantId && otherPolicy.id !== policyId && otherPolicy.status === 'published') {
        otherPolicy.status = 'archived';
        otherPolicy.updatedAt = nowIso();
      }
    }

    policy.status = 'published';
    policy.publishedAt = nowIso();
    policy.updatedAt = nowIso();
    await this.addAuditEvent(tenantId, actor.email, 'POLICY_PUBLISHED', 'policy', policy.id, { version: policy.version }, null, policy.id);
    return normalizePolicy(policy);
  }

  async recordDecision(tenantId: string, actor: ActorContext, policyId: string | null, requestType: RequestRecord['requestType'], source: string | null, toolName: string | null, evaluation: GatewayEvaluationResult) {
    const record: RequestRecord = {
      id: `request_${randomUUID()}`,
      requestId: evaluation.requestId,
      tenantId,
      actorEmail: actor.email,
      policyId,
      requestType,
      toolName,
      source,
      inputHash: evaluation.inputHash,
      inputPreview: evaluation.inputPreview,
      sanitizedPayload: evaluation.sanitizedPayload,
      decision: evaluation.decision,
      riskScore: evaluation.riskScore,
      riskBreakdown: evaluation.riskBreakdown,
      matchedRules: evaluation.matchedRules,
      detectorResults: evaluation.detectorResults,
      hardBlock: evaluation.hardBlock,
      reviewStatus: 'pending',
      reviewReason: null,
      reviewedAt: null,
      createdAt: nowIso(),
      redactions: evaluation.redactions.map((redaction) => ({
        id: `redaction_${randomUUID()}`,
        jsonPath: redaction.jsonPath,
        replacement: redaction.replacement,
        reason: redaction.reason,
      })),
    };
    this.state.requests.unshift(record);
    await this.addAuditEvent(tenantId, actor.email, 'REQUEST_DECISION', 'request', record.id, { requestId: record.requestId, decision: record.decision, riskScore: record.riskScore }, record.id, policyId);
    for (const rule of evaluation.matchedRules) {
      await this.addAuditEvent(tenantId, actor.email, 'RULE_MATCH', 'request', record.id, rule, record.id, policyId);
    }
    return record;
  }

  async listRecentRequests(tenantId: string, limit = 10) {
    return this.state.requests.filter((entry) => entry.tenantId === tenantId).slice(0, limit);
  }

  async getRequest(tenantId: string, requestId: string) {
    return this.state.requests.find((entry) => entry.tenantId === tenantId && entry.id === requestId) ?? null;
  }

  async reviewRequest(tenantId: string, requestId: string, reason: string, actor: ActorContext) {
    const request = this.state.requests.find((entry) => entry.tenantId === tenantId && entry.id === requestId);
    if (!request) {
      return null;
    }

    request.reviewStatus = 'reviewed';
    request.reviewReason = reason;
    request.reviewedAt = nowIso();
    await this.addAuditEvent(tenantId, actor.email, 'REQUEST_REVIEWED', 'request', request.id, { preservedDecision: request.decision, reason }, request.id, request.policyId);
    return request;
  }

  async listAudit(tenantId: string, eventType?: string) {
    return this.state.auditEvents
      .filter((entry) => entry.tenantId === tenantId && (!eventType || entry.eventType === eventType))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async getDashboardSummary(tenantId: string): Promise<DashboardSummary> {
    const tenant = this.state.tenants.find((entry) => entry.id === tenantId);
    if (!tenant) {
      throw new Error('Tenant not found');
    }
    const requests = this.state.requests.filter((entry) => entry.tenantId === tenantId);
    const policies = this.state.policies.filter((entry) => entry.tenantId === tenantId);
    return {
      tenant: toTenantContext(tenant),
      policies: policies.map((entry) => ({ id: entry.id, name: entry.name, status: entry.status, version: entry.version, updatedAt: entry.updatedAt })),
      recentRequests: requests.slice(0, 5).map((entry) => ({ id: entry.id, requestId: entry.requestId, decision: entry.decision, riskScore: entry.riskScore, inputPreview: entry.inputPreview, createdAt: entry.createdAt })),
      blockedCount: requests.filter((entry) => entry.decision === 'block').length,
      redactedCount: requests.filter((entry) => entry.decision === 'redact').length,
      pendingReviews: requests.filter((entry) => entry.reviewStatus === 'pending' && entry.decision !== 'pass').length,
    };
  }

  private async addAuditEvent(tenantId: string, actorEmail: string | null, eventType: string, entityType: string, entityId: string, payload: unknown, requestId: string | null, policyId: string | null) {
    this.state.auditEvents.unshift({
      id: `audit_${randomUUID()}`,
      tenantId,
      eventType,
      entityType,
      entityId,
      payload,
      createdAt: nowIso(),
      requestId,
      policyId,
      actorEmail,
    });
  }
}

class PrismaRepository {
  private readonly prisma = getPrismaClient();

  constructor() {
    if (!this.prisma) {
      throw new Error('DATABASE_URL is not configured');
    }
  }

  async bootstrap(tenantSlug = DEMO_TENANT_SLUG, email = DEMO_ADMIN_EMAIL, role: ActorContext['role'] = 'ADMIN') {
    const config = createDefaultPolicyConfig();
    const tenant = await this.prisma!.tenant.upsert({
      where: { slug: tenantSlug },
      update: {},
      create: {
        slug: tenantSlug,
        name: tenantSlug === DEMO_TENANT_SLUG ? DEMO_TENANT_NAME : tenantSlug,
        sharedSecretHash: process.env.GUARDRAIL_SHARED_TOKEN ? hashValue(process.env.GUARDRAIL_SHARED_TOKEN) : null,
      },
    });

    const user = await this.prisma!.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email } },
      update: { role },
      create: { tenantId: tenant.id, email, role, name: email },
    });

    let policy = await this.prisma!.policy.findFirst({ where: { tenantId: tenant.id, status: 'PUBLISHED' } });
    if (!policy) {
      policy = await this.prisma!.policy.create({
        data: {
          tenantId: tenant.id,
          name: 'Default enterprise guardrail',
          description: 'Blocks high-confidence prompt injection and unsafe tools while redacting sensitive fields.',
          status: 'PUBLISHED',
          version: 1,
          thresholds: config.thresholds as never,
          rules: config.rules as never,
          actions: config.actions as never,
          publishedAt: new Date(),
          createdByUserId: user.id,
        },
      });
    }

    return {
      tenant: { tenantId: tenant.id, tenantSlug: tenant.slug, tenantName: tenant.name },
      user,
      policy: this.mapPolicy(policy),
    };
  }

  async getTenantBySlug(tenantSlug: string) {
    const tenant = await this.prisma!.tenant.findUnique({ where: { slug: tenantSlug } });
    return tenant ? { tenantId: tenant.id, tenantSlug: tenant.slug, tenantName: tenant.name } : null;
  }

  async getUserByEmail(tenantId: string, email: string) {
    return this.prisma!.user.findUnique({ where: { tenantId_email: { tenantId, email } } });
  }

  async listPolicies(tenantId: string) {
    const policies = await this.prisma!.policy.findMany({ where: { tenantId }, orderBy: { updatedAt: 'desc' } });
    return policies.map((policy) => this.mapPolicy(policy));
  }

  async getPolicy(tenantId: string, policyId: string) {
    const policy = await this.prisma!.policy.findFirst({ where: { tenantId, id: policyId } });
    return policy ? this.mapPolicy(policy) : null;
  }

  async getPublishedPolicy(tenantId: string, requestedPolicyId?: string) {
    if (requestedPolicyId) {
      const explicitPolicy = await this.prisma!.policy.findFirst({ where: { tenantId, id: requestedPolicyId, status: 'PUBLISHED' } });
      return explicitPolicy ? this.mapPolicy(explicitPolicy) : null;
    }

    const publishedPolicy = await this.prisma!.policy.findFirst({ where: { tenantId, status: 'PUBLISHED' }, orderBy: { updatedAt: 'desc' } });
    return publishedPolicy ? this.mapPolicy(publishedPolicy) : null;
  }

  async savePolicy(tenantId: string, policyId: string | null, payload: Omit<PolicyRecord, 'id' | 'tenantId' | 'version' | 'status' | 'createdAt' | 'updatedAt' | 'publishedAt'> & { status?: PolicyRecord['status'] }, actor: ActorContext) {
    const actorUser = await this.getUserByEmail(tenantId, actor.email);
    const data = {
      name: payload.name,
      description: payload.description,
      thresholds: payload.thresholds as never,
      rules: payload.rules as never,
      actions: payload.actions as never,
      createdByUserId: actorUser?.id,
    };

    const existingPolicy = policyId ? await this.prisma!.policy.findFirst({ where: { id: policyId, tenantId } }) : null;
    if (policyId && !existingPolicy) {
      return null;
    }

    const policy = policyId
      ? await this.prisma!.policy.update({
          where: { id: existingPolicy!.id },
          data: {
            ...data,
            version: { increment: 1 },
            status: payload.status ? payload.status.toUpperCase() as never : undefined,
          },
        })
      : await this.prisma!.policy.create({
          data: {
            tenantId,
            ...data,
            status: (payload.status ?? 'draft').toUpperCase() as never,
            version: 1,
            publishedAt: payload.status === 'published' ? new Date() : null,
          },
        });

    await this.prisma!.auditEvent.create({
      data: {
        tenantId,
        actorUserId: actorUser?.id,
        actorEmail: actor.email,
        policyId: policy.id,
        eventType: policyId ? 'POLICY_UPDATED' : 'POLICY_CREATED',
        entityType: 'policy',
        entityId: policy.id,
        payload: { version: policy.version } as never,
      },
    });

    return this.mapPolicy(policy);
  }

  async publishPolicy(tenantId: string, policyId: string, actor: ActorContext) {
    const actorUser = await this.getUserByEmail(tenantId, actor.email);
    const existingPolicy = await this.prisma!.policy.findFirst({ where: { id: policyId, tenantId } });
    if (!existingPolicy) {
      return null;
    }
    await this.prisma!.policy.updateMany({ where: { tenantId, status: 'PUBLISHED', NOT: { id: existingPolicy.id } }, data: { status: 'ARCHIVED' } });
    const policy = await this.prisma!.policy.update({ where: { id: existingPolicy.id }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
    await this.prisma!.auditEvent.create({
      data: {
        tenantId,
        actorUserId: actorUser?.id,
        actorEmail: actor.email,
        policyId,
        eventType: 'POLICY_PUBLISHED',
        entityType: 'policy',
        entityId: policyId,
        payload: { version: policy.version } as never,
      },
    });
    return this.mapPolicy(policy);
  }

  async recordDecision(tenantId: string, actor: ActorContext, policyId: string | null, requestType: RequestRecord['requestType'], source: string | null, toolName: string | null, evaluation: GatewayEvaluationResult) {
    const actorUser = await this.getUserByEmail(tenantId, actor.email);
    const request = await this.prisma!.guardrailRequest.create({
      data: {
        requestId: evaluation.requestId,
        tenantId,
        actorUserId: actorUser?.id,
        actorEmail: actor.email,
        policyId,
        requestType: requestType === 'prompt' ? 'PROMPT' : 'TOOL_CALL',
        source,
        toolName,
        inputHash: evaluation.inputHash,
        inputPreview: evaluation.inputPreview,
        sanitizedPayload: evaluation.sanitizedPayload as never,
        decision: evaluation.decision.toUpperCase() as never,
        riskScore: evaluation.riskScore,
        riskBreakdown: evaluation.riskBreakdown as never,
        matchedRules: evaluation.matchedRules as never,
        detectorResults: evaluation.detectorResults as never,
        hardBlock: evaluation.hardBlock,
        redactions: {
          create: evaluation.redactions.map((redaction) => ({
            jsonPath: redaction.jsonPath,
            originalHash: redaction.originalHash,
            replacement: redaction.replacement,
            reason: redaction.reason,
          })),
        },
      },
      include: { redactions: true, actorUser: true },
    });

    await this.prisma!.auditEvent.create({
      data: {
        tenantId,
        actorUserId: actorUser?.id,
        requestId: request.id,
        policyId,
        eventType: 'REQUEST_DECISION',
        entityType: 'request',
        entityId: request.id,
        payload: { requestId: request.requestId, decision: request.decision } as never,
      },
    });

    for (const rule of evaluation.matchedRules) {
      await this.prisma!.auditEvent.create({
        data: {
          tenantId,
          actorUserId: actorUser?.id,
          requestId: request.id,
          policyId,
          eventType: 'RULE_MATCH',
          entityType: 'request',
          entityId: request.id,
          payload: rule as never,
        },
      });
    }

    return this.mapRequest(request);
  }

  async listRecentRequests(tenantId: string, limit = 10) {
    const requests = await this.prisma!.guardrailRequest.findMany({ where: { tenantId }, include: { redactions: true, actorUser: true }, orderBy: { createdAt: 'desc' }, take: limit });
    return requests.map((request) => this.mapRequest(request));
  }

  async getRequest(tenantId: string, requestId: string) {
    const request = await this.prisma!.guardrailRequest.findFirst({ where: { tenantId, id: requestId }, include: { redactions: true, actorUser: true } });
    return request ? this.mapRequest(request) : null;
  }

  async reviewRequest(tenantId: string, requestId: string, reason: string, actor: ActorContext) {
    const actorUser = await this.getUserByEmail(tenantId, actor.email);
    const existingRequest = await this.prisma!.guardrailRequest.findFirst({ where: { id: requestId, tenantId } });
    if (!existingRequest) {
      return null;
    }
    const request = await this.prisma!.guardrailRequest.update({ where: { id: existingRequest.id }, data: { reviewStatus: 'REVIEWED', reviewReason: reason, reviewedAt: new Date() }, include: { redactions: true, actorUser: true } });
    await this.prisma!.auditEvent.create({
      data: {
        tenantId,
        actorUserId: actorUser?.id,
        requestId,
        policyId: request.policyId,
        eventType: 'REQUEST_REVIEWED',
        entityType: 'request',
        entityId: requestId,
        payload: { preservedDecision: request.decision, reason } as never,
      },
    });
    return this.mapRequest(request);
  }

  async listAudit(tenantId: string, eventType?: string) {
    const events = await this.prisma!.auditEvent.findMany({
      where: { tenantId, ...(eventType ? { eventType: eventType as never } : {}) },
      include: { actorUser: true },
      orderBy: { createdAt: 'desc' },
    });
    return events.map((event) => ({
      id: event.id,
      tenantId: event.tenantId,
      eventType: event.eventType,
      entityType: event.entityType,
      entityId: event.entityId,
      payload: event.payload,
      createdAt: event.createdAt.toISOString(),
      requestId: event.requestId,
      policyId: event.policyId,
      actorEmail: event.actorUser?.email ?? null,
    }));
  }

  async getDashboardSummary(tenantId: string): Promise<DashboardSummary> {
    const [tenant, policies, recentRequests, blockedCount, redactedCount, pendingReviews] = await Promise.all([
      this.prisma!.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
      this.listPolicies(tenantId),
      this.listRecentRequests(tenantId, 5),
      this.prisma!.guardrailRequest.count({ where: { tenantId, decision: 'BLOCK' } }),
      this.prisma!.guardrailRequest.count({ where: { tenantId, decision: 'REDACT' } }),
      this.prisma!.guardrailRequest.count({ where: { tenantId, reviewStatus: 'PENDING', decision: { not: 'PASS' } } }),
    ]);

    return {
      tenant: { tenantId: tenant.id, tenantSlug: tenant.slug, tenantName: tenant.name },
      policies: policies.map((entry) => ({ id: entry.id, name: entry.name, status: entry.status, version: entry.version, updatedAt: entry.updatedAt })),
      recentRequests: recentRequests.map((entry) => ({ id: entry.id, requestId: entry.requestId, decision: entry.decision, riskScore: entry.riskScore, inputPreview: entry.inputPreview, createdAt: entry.createdAt })),
      blockedCount,
      redactedCount,
      pendingReviews,
    };
  }

  private mapPolicy(policy: {
    id: string;
    tenantId: string;
    name: string;
    description: string | null;
    status: string;
    version: number;
    thresholds: unknown;
    rules: unknown;
    actions: unknown;
    lastTestResult?: unknown;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): PolicyRecord {
    return {
      id: policy.id,
      tenantId: policy.tenantId,
      name: policy.name,
      description: policy.description,
      status: policy.status.toLowerCase() as PolicyRecord['status'],
      version: policy.version,
      thresholds: policy.thresholds as PolicyConfig['thresholds'],
      rules: policy.rules as PolicyConfig['rules'],
      actions: policy.actions as PolicyConfig['actions'],
      lastTestResult: policy.lastTestResult,
      publishedAt: policy.publishedAt?.toISOString() ?? null,
      createdAt: policy.createdAt.toISOString(),
      updatedAt: policy.updatedAt.toISOString(),
    };
  }

  private mapRequest(request: {
    id: string;
    requestId: string;
    tenantId: string;
    actorUser?: { email: string } | null;
    actorEmail: string;
    policyId: string | null;
    requestType: string;
    toolName: string | null;
    source: string | null;
    inputHash: string;
    inputPreview: string;
    sanitizedPayload: unknown;
    decision: string;
    riskScore: number;
    riskBreakdown: unknown;
    matchedRules: unknown;
    detectorResults: unknown;
    hardBlock: boolean;
    reviewStatus: string;
    reviewReason: string | null;
    reviewedAt: Date | null;
    createdAt: Date;
    redactions: Array<{ id: string; jsonPath: string; replacement: string; reason: string }>;
  }): RequestRecord {
    return {
      id: request.id,
      requestId: request.requestId,
      tenantId: request.tenantId,
      actorEmail: request.actorEmail,
      policyId: request.policyId,
      requestType: request.requestType === 'PROMPT' ? 'prompt' : 'tool_call',
      toolName: request.toolName,
      source: request.source,
      inputHash: request.inputHash,
      inputPreview: request.inputPreview,
      sanitizedPayload: request.sanitizedPayload,
      decision: request.decision.toLowerCase() as DecisionOutcome,
      riskScore: request.riskScore,
      riskBreakdown: request.riskBreakdown,
      matchedRules: request.matchedRules,
      detectorResults: request.detectorResults,
      hardBlock: request.hardBlock,
      reviewStatus: request.reviewStatus.toLowerCase() as ReviewState,
      reviewReason: request.reviewReason,
      reviewedAt: request.reviewedAt?.toISOString() ?? null,
      createdAt: request.createdAt.toISOString(),
      redactions: request.redactions.map((redaction) => ({ id: redaction.id, jsonPath: redaction.jsonPath, replacement: redaction.replacement, reason: redaction.reason })),
    };
  }
}

export function getGuardrailRepository() {
  return process.env.DATABASE_URL ? new PrismaRepository() : new MemoryRepository();
}
