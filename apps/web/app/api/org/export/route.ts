import { download, memberRoute } from '../../../../server/http';
import { exportOrganization } from '../../../../server/orgs';

export const GET = memberRoute('GET /api/org/export', 'owner', async ({ ctx, now }) =>
  download(await exportOrganization(ctx), 'application/zip', `draycomply-export-${now.toISOString().slice(0, 10)}.zip`));
