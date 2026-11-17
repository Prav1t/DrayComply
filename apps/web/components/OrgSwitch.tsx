'use client';

import { useRouter } from 'next/navigation';

export function OrgSwitch({ current, organizations }: { current: string; organizations: readonly { id: string; name: string }[] }) {
  const router = useRouter();
  const change = async (organizationId: string): Promise<void> => {
    await fetch('/api/session/organization', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ organizationId }) });
    router.push('/app');
    router.refresh();
  };
  return (
    <label>Organization
      <select value={current} onChange={e => { void change(e.target.value); }}>
        {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </label>
  );
}
