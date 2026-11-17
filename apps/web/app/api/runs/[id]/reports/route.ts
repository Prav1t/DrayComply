import { json, memberRoute, uuidParam } from '../../../../../server/http';
import { generateReport, listReports } from '../../../../../server/reports';
import { getRun } from '../../../../../server/assess';

export const GET = memberRoute('GET /api/runs/[id]/reports', 'viewer', async ({ ctx, params }) => {
  const run = await getRun(ctx, uuidParam(params, 'id'));
  return json({ reports: await listReports(ctx, run.id) });
});
export const POST = memberRoute('POST /api/runs/[id]/reports', 'payroll', async ({ ctx, params }) => json(await generateReport(ctx, uuidParam(params, 'id')), 201));
