import { addClassPeriod } from '../../../../../server/drivers';
import { isUuid, json, memberRoute, optionalStr, readJson, str, uuidParam } from '../../../../../server/http';
import { invalid } from '../../../../../server/errors';

export const POST = memberRoute('POST /api/drivers/[id]/class-periods', 'payroll', async ({ ctx, params, req }) => {
  const body = await readJson(req);
  const employer = optionalStr(body, 'employingIoDriverId');
  if (employer !== null && !isUuid(employer)) throw invalid('The employing operator is not one of your drivers.');
  return json(await addClassPeriod(ctx, uuidParam(params, 'id'), { class: str(body, 'class'), from: str(body, 'from'), to: optionalStr(body, 'to'), employingIoDriverId: employer }), 201);
});
