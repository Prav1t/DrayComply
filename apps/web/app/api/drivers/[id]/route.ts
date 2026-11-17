import { getDriver, updateDriver } from '../../../../server/drivers';
import { driverFields } from '../../../../server/forms';
import { json, memberRoute, readJson, uuidParam } from '../../../../server/http';

export const GET = memberRoute('GET /api/drivers/[id]', 'viewer', async ({ ctx, params }) => json({ driver: await getDriver(ctx, uuidParam(params, 'id')) }));
export const PUT = memberRoute('PUT /api/drivers/[id]', 'payroll', async ({ ctx, params, req }) => {
  await updateDriver(ctx, uuidParam(params, 'id'), driverFields(await readJson(req)));
  return json({ ok: true });
});
