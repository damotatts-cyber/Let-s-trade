-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sharedSecretHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "thresholds" JSON NOT NULL,
    "rules" JSON NOT NULL,
    "actions" JSON NOT NULL,
    "lastTestResult" JSON,
    "createdByUserId" TEXT,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Policy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Policy_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GuardrailRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "policyId" TEXT,
    "requestType" TEXT NOT NULL,
    "modelProvider" TEXT,
    "toolName" TEXT,
    "source" TEXT,
    "inputHash" TEXT NOT NULL,
    "inputPreview" TEXT NOT NULL,
    "sanitizedPayload" JSON NOT NULL,
    "decision" TEXT NOT NULL,
    "riskScore" REAL NOT NULL,
    "riskBreakdown" JSON NOT NULL,
    "matchedRules" JSON NOT NULL,
    "detectorResults" JSON NOT NULL,
    "hardBlock" BOOLEAN NOT NULL DEFAULT false,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewReason" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GuardrailRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GuardrailRequest_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GuardrailRequest_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RequestRedaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "jsonPath" TEXT NOT NULL,
    "originalHash" TEXT NOT NULL,
    "replacement" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RequestRedaction_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "GuardrailRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "requestId" TEXT,
    "policyId" TEXT,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSON NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "GuardrailRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditEvent_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");
CREATE INDEX "User_tenantId_role_idx" ON "User"("tenantId", "role");
CREATE INDEX "Policy_tenantId_status_idx" ON "Policy"("tenantId", "status");
CREATE INDEX "Policy_tenantId_updatedAt_idx" ON "Policy"("tenantId", "updatedAt");
CREATE UNIQUE INDEX "GuardrailRequest_tenantId_requestId_key" ON "GuardrailRequest"("tenantId", "requestId");
CREATE INDEX "GuardrailRequest_tenantId_createdAt_idx" ON "GuardrailRequest"("tenantId", "createdAt");
CREATE INDEX "GuardrailRequest_tenantId_decision_createdAt_idx" ON "GuardrailRequest"("tenantId", "decision", "createdAt");
CREATE INDEX "GuardrailRequest_tenantId_requestType_createdAt_idx" ON "GuardrailRequest"("tenantId", "requestType", "createdAt");
CREATE INDEX "RequestRedaction_requestId_createdAt_idx" ON "RequestRedaction"("requestId", "createdAt");
CREATE INDEX "AuditEvent_tenantId_createdAt_idx" ON "AuditEvent"("tenantId", "createdAt");
CREATE INDEX "AuditEvent_requestId_createdAt_idx" ON "AuditEvent"("requestId", "createdAt");
CREATE INDEX "AuditEvent_policyId_createdAt_idx" ON "AuditEvent"("policyId", "createdAt");
