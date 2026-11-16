// Binder to a flat list of blocks, in reading order. The PDF painter knows nothing about compliance.
import { formatCents, recordsText, verdictText, type AuditBinder } from './binder';

export type Block =
  | { readonly kind: 'title' | 'h1' | 'h2' | 'text' | 'small' | 'notice' | 'mono'; readonly text: string }
  | { readonly kind: 'pair'; readonly label: string; readonly value: string }
  | { readonly kind: 'rule' | 'page_break' };

const t = (kind: 'title' | 'h1' | 'h2' | 'text' | 'small' | 'notice' | 'mono', text: string): Block => ({ kind, text });
const pair = (label: string, value: string | number): Block => ({ kind: 'pair', label, value: String(value) });
const NONE = t('text', 'None.');

export function layout(b: AuditBinder): Block[] {
  const h = b.header;
  const s = b.summary;
  const blocks: Block[] = [
    t('title', h.title),
    t('text', `${h.licenseeName} (${h.licenseeId})`),
    // The unverified-rates notice sits directly under the title, before any figure.
    ...(h.unverifiedRatesNotice === null ? [] : [t('notice', h.unverifiedRatesNotice)]),
    t('notice', h.disclaimer),
    pair('Generated', h.generatedAt), pair('Prepared by', h.preparedBy), pair('Run date (as of)', h.asOf),
    pair('Engine version', h.engineVersion), pair('Rounding', h.rounding), pair('Deduction policy', h.deductionPolicyId),
    { kind: 'rule' },

    t('h1', '1. Summary'),
    pair('Drivers evaluated', s.driversEvaluated), pair('Drivers withheld (rejected rows)', s.driversWithheld),
    pair(verdictText('no_shortfall_detected'), s.byVerdict.no_shortfall_detected),
    pair(verdictText('shortfall_aggregate'), s.byVerdict.shortfall_aggregate),
    pair(verdictText('shortfall_segregated_only'), s.byVerdict.shortfall_segregated_only),
    pair(verdictText('insufficient_data'), s.byVerdict.insufficient_data),
    pair('Drivers with a records finding', s.byRecordsVerdict.records_finding),
    pair('Total shortfall, aggregate comparison', formatCents(s.aggregateShortfallCents)),
    pair('Total shortfall, segregated comparison', formatCents(s.segregatedShortfallCents)),
    t('small', 'The two comparisons are different readings of the same payments. Both are reported; neither is presented as the answer. Totals cover computable pay periods only.'),
    pair('Pay periods not computable', s.periodsNotComputable), pair('Findings', s.findingCount), pair('Gaps', s.gapCount),
    pair('Rejected input rows', s.rejectedRows), pair('Rejected rows tied to no driver', s.unattributedRejects),

    t('h1', '2. Scope statement'),
    ...b.scope.map(x => t('text', `- ${x}`)),

    t('h1', '3. Rate schedules used'),
    ...(b.schedules.length === 0 ? [NONE] : b.schedules.map(x => pair(x.id, `${x.status}${x.verifiedBy === null ? '' : `, verified by ${x.verifiedBy}`}`))),

    t('h1', '4. Input file manifest'),
    ...(b.manifest.length === 0 ? [t('text', 'No files were ingested for this run.')] : b.manifest.flatMap(m => [
      t('text', `${m.name} (${m.format}, ${m.bytes} bytes)`),
      t('mono', `sha256 ${m.sha256}`),
      ...m.tables.map(x => t('small', `${x.table}: ${x.acceptedRows} of ${x.dataRows} rows accepted`)),
    ])),
    t('h2', 'Sources recorded in the run'),
    ...b.inputSources.flatMap(x => [t('small', x.name), t('mono', x.digest)]),

    t('h1', '5. Findings'),
    ...(b.findings.length === 0 ? [NONE] : b.findings.flatMap(f => [
      pair(`${f.driverId} / ${f.payPeriodId} / ${f.ruleId}`, `${f.nature.replace(/_/g, ' ')}, ${formatCents(f.amountCents)}`),
      t('small', f.sentence),
    ])),

    t('h1', '6. Gaps'),
    t('small', 'A gap is missing or unusable data. It is never filled with a default; the affected result is insufficient data.'),
    ...(b.gaps.length === 0 ? [NONE] : b.gaps.flatMap(g => [
      pair(`${g.driverId} / ${g.payPeriodId ?? 'driver'} / ${g.code}`, g.recordIds.join(', ')),
      t('small', g.detail),
    ])),

    t('h1', '7. Rejected input rows'),
    ...(b.withheldDrivers.map(w => t('text', `Driver ${w.driverId} withheld: ${w.rejectedRows} rejected row(s).`))),
    ...(b.rejects.length === 0 ? [NONE] : b.rejects.map(r =>
      t('small', `${r.file} row ${r.rowNumber}, ${r.table}${r.field === null ? '' : `.${r.field}`}: ${r.reason}${r.raw === '' ? '' : ` (value: "${r.raw}")`}`))),
  ];

  for (const w of b.worksheets) {
    blocks.push({ kind: 'page_break' }, t('h1', `Worksheet: driver ${w.driverId}`),
      pair('Payment verdict', verdictText(w.verdict)), pair('Records verdict', recordsText(w.recordsVerdict)),
      ...w.scope.map(n => t('small', `Scope: ${n.sentence}`)),
      ...w.gaps.flatMap(g => [pair(`Gap: ${g.code}`, g.recordIds.join(', ')), t('small', g.detail)]));
    for (const p of w.periods) {
      blocks.push(t('h2', `Pay period ${p.payPeriodId}`), pair('Payment verdict', verdictText(p.verdict)), pair('Records verdict', recordsText(p.recordsVerdict)),
        t('small', p.statement), ...p.figures.map(f => pair(f.label, f.value)),
        ...p.findings.flatMap(f => [pair(`Finding: ${f.ruleId}`, `${f.nature.replace(/_/g, ' ')}, ${formatCents(f.amountCents)}`), t('small', f.sentence)]),
        ...p.gaps.flatMap(g => [pair(`Gap: ${g.code}`, g.recordIds.join(', ')), t('small', g.detail)]),
        t('small', `Rules: ${p.evaluations.filter(e => e.status !== 'not_applicable').map(e => `${e.ruleId} ${e.status.replace(/_/g, ' ')}`).join('; ')}.`));
    }
  }
  return blocks;
}
