import { addOtherHours } from '../../../../../server/drivers';
import { wholeNumber } from '../../../../../server/forms';
import { json, memberRoute, readJson, str, uuidParam } from '../../../../../server/http';

export const POST = memberRoute('POST /api/drivers/[id]/other-hours', 'payroll', async ({ ctx, params, req }) => {
  const body = await readJson(req);
  return json(await addOtherHours(ctx, uuidParam(params, 'id'), str(body, 'workDate'), wholeNumber(body, 'minutes') ?? -1), 201);
});
