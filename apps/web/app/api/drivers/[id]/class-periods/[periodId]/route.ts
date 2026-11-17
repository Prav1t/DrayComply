import { endClassPeriod, removeClassPeriod } from '../../../../../../server/drivers';
import { json, memberRoute, readJson, str, uuidParam } from '../../../../../../server/http';

export const PATCH = memberRoute('PATCH /api/drivers/[id]/class-periods/[periodId]', 'payroll', async ({ ctx, params, req }) => {
  await endClassPeriod(ctx, uuidParam(params, 'id'), uuidParam(params, 'periodId'), str(await readJson(req), 'to'));
  return json({ ok: true });
});
export const DELETE = memberRoute('DELETE /api/drivers/[id]/class-periods/[periodId]', 'payroll', async ({ ctx, params }) => {
  await removeClassPeriod(ctx, uuidParam(params, 'id'), uuidParam(params, 'periodId'));
  return json({ ok: true });
});
