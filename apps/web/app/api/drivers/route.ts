import { createDriver, listDrivers } from '../../../server/drivers';
import { driverFields } from '../../../server/forms';
import { json, memberRoute, readJson } from '../../../server/http';

export const GET = memberRoute('GET /api/drivers', 'viewer', async ({ ctx }) => json({ drivers: await listDrivers(ctx) }));
export const POST = memberRoute('POST /api/drivers', 'payroll', async ({ ctx, req }) => json(await createDriver(ctx, driverFields(await readJson(req))), 201));
