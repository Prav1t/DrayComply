import { importDrivers } from '../../../../server/drivers';
import { invalid } from '../../../../server/errors';
import { checkFile } from '../../../../server/files';
import { isUuid, json, memberRoute, readMultipart } from '../../../../server/http';
import { getTemplate, saveTemplate } from '../../../../server/templates';

// Takes the driver file and either a saved template id or a template built in the browser, which is saved for reuse.
export const POST = memberRoute('POST /api/drivers/import', 'payroll', async ({ ctx, req }) => {
  const form = await readMultipart(req);
  const files = form.files.map(f => checkFile(f.name, f.bytes));
  if (files.length === 0) throw invalid('Choose the driver file.');
  let template: unknown;
  const templateId = form.fields['templateId'];
  if (isUuid(templateId)) {
    const stored = await getTemplate(ctx, templateId);
    if (stored.purpose !== 'drivers') throw invalid('Choose a driver import template.');
    template = stored.template;
  } else {
    try { template = JSON.parse(form.fields['template'] ?? ''); } catch { throw invalid('Build or choose a template for the driver file.'); }
  }
  const result = await importDrivers(ctx, files, template);
  if (result.kind === 'imported' && !isUuid(templateId)) await saveTemplate(ctx, template, 'drivers');
  return json(result, result.kind === 'imported' ? 200 : 422);
});
