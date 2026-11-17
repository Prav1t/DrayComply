import { createRun, listRuns } from '../../../server/assess';
import { runRequest } from '../../../server/forms';
import { json, memberRoute, readJson } from '../../../server/http';

export const GET = memberRoute('GET /api/runs', 'viewer', async ({ ctx }) => json({ runs: await listRuns(ctx) }));
export const POST = memberRoute('POST /api/runs', 'payroll', async ({ ctx, req }) => json(await createRun(ctx, runRequest(await readJson(req))), 201));
