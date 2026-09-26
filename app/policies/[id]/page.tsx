import { notFound } from 'next/navigation';

import AdminShell from '@/components/guardrail/AdminShell';
import PolicyEditor from '@/components/guardrail/PolicyEditor';
import { requireAdminSession } from '@/lib/guardrail/auth';
import { getGuardrailRepository } from '@/lib/guardrail/repository';

export default async function PolicyPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenant } = await requireAdminSession();
  const { id } = await params;
  const repository = getGuardrailRepository();
  const policy = await repository.getPolicy(tenant.tenantId, id);

  if (!policy) {
    notFound();
  }

  return (
    <AdminShell title={policy.name} subtitle={`Status ${policy.status} · version ${policy.version} · update thresholds and test adversarial prompts inline.`}>
      <PolicyEditor policy={policy} simulatePath={`/api/policies/${policy.id}/simulate`} />
    </AdminShell>
  );
}
