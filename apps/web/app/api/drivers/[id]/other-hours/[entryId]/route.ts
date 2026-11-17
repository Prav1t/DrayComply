import { removeOtherHours } from '../../../../../../server/drivers';
import { json, memberRoute, uuidParam } from '../../../../../../server/http';

export const DELETE = memberRoute('DELETE /api/drivers/[id]/other-hours/[entryId]', 'payroll', async ({ ctx, params }) => {
  await removeOtherHours(ctx, uuidParam(params, 'id'), uuidParam(params, 'entryId'));
  return json({ ok: true });
});
