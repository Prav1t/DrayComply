import { download, memberRoute, uuidParam } from '../../../../server/http';
import { getReportContent } from '../../../../server/reports';

export const GET = memberRoute('GET /api/reports/[id]', 'viewer', async ({ ctx, params }) => {
  const r = await getReportContent(ctx, uuidParam(params, 'id'));
  return download(r.bytes, 'application/pdf', `draycomply-binder-${r.generatedAt.slice(0, 10)}.pdf`);
});
