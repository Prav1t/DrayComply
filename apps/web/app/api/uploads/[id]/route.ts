import { getUploadContent } from '../../../../server/datasets';
import { download, memberRoute, uuidParam } from '../../../../server/http';

// The original file, byte for byte as it was received.
export const GET = memberRoute('GET /api/uploads/[id]', 'viewer', async ({ ctx, params }) => {
  const f = await getUploadContent(ctx, uuidParam(params, 'id'));
  return download(f.bytes, f.format === 'csv' ? 'text/csv; charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', f.name);
});
