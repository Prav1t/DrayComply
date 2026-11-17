import Link from 'next/link';
import { ApiForm } from '../../../../components/ApiForm';
import { atLeast } from '../../../../server/context';
import { getDriver, listDrivers } from '../../../../server/drivers';
import { load, pageContext, pageId } from '../../../../server/page';

const CLASS_NAMES = { DEO: 'Company driver (DEO)', IEO: 'Employed by an independent operator (IEO)', IO_HOURLY: 'Independent operator, hourly', IO_TRIP: 'Independent operator, per trip' } as const;

export default async function Driver({ params }: { params: Promise<{ id: string }> }) {
  const { ctx } = await pageContext();
  const id = pageId((await params).id);
  const d = await load(() => getDriver(ctx, id));
  const others = (await listDrivers(ctx)).filter(x => x.id !== d.id);
  const canEdit = atLeast(ctx.role, 'payroll');
  const yesNo = (v: boolean | null): string => (v === null ? '' : v ? 'yes' : 'no');
  return (
    <>
      <p><Link href="/app/drivers">All drivers</Link></p>
      <section className="card">
        <h2>Driver {d.externalId}</h2>
        <p className="muted">Leave a field blank if you do not know it. A blank is reported as &quot;not reported&quot; and is never replaced with a guess; it may make a result &quot;insufficient data&quot;.</p>
        {canEdit ? (
          <ApiForm action={`/api/drivers/${d.id}`} method="PUT" submit="Save" then="refresh">
            <label>Driver id<input type="text" name="externalId" defaultValue={d.externalId} required /></label>
            <label>Name<input type="text" name="displayName" defaultValue={d.displayName ?? ''} /></label>
            <label>Container trucking hours for any licensee before the first hours you upload, in minutes<input type="text" name="openingCumulativeMinutes" inputMode="numeric" defaultValue={d.openingCumulativeMinutes ?? ''} /></label>
            <label>Uploaded hours are complete from<input type="date" name="hourlyCoverageFrom" defaultValue={d.hourlyCoverageFrom ?? ''} /></label>
            <label>Fuel surcharge basis
              <select name="fuelBasis" defaultValue={d.fuelBasis ?? ''}><option value="">Not reported</option><option value="published">Published percentage</option><option value="io_discounted">Operator&apos;s discounted fuel price</option></select>
            </label>
            <label>Callout days are flagged in the data
              <select name="calloutsFlagged" defaultValue={yesNo(d.calloutsFlagged)}><option value="">Not stated</option><option value="yes">Yes</option><option value="no">No</option></select>
            </label>
            <label>Hours for other licensees are known and listed below
              <select name="otherLicenseeHoursReported" defaultValue={yesNo(d.otherLicenseeHoursReported)}><option value="">Not reported</option><option value="yes">Yes</option><option value="no">No</option></select>
            </label>
          </ApiForm>
        ) : <p>Name: {d.displayName ?? 'not given'}</p>}
      </section>

      <section className="card">
        <h2>Class periods</h2>
        <table>
          <thead><tr><th>Class</th><th>From</th><th>To</th><th></th></tr></thead>
          <tbody>
            {d.classPeriods.map(p => (
              <tr key={p.id}>
                <td>{CLASS_NAMES[p.class]}{p.employingIoDriverId === null ? '' : ` (employed by ${others.find(o => o.id === p.employingIoDriverId)?.externalId ?? 'another driver'})`}</td>
                <td>{p.fromDate}</td><td>{p.toDate ?? 'still current'}</td>
                <td>{canEdit && (
                  <div className="row">
                    {p.toDate === null && (
                      <ApiForm action={`/api/drivers/${d.id}/class-periods/${p.id}`} method="PATCH" submit="End period" then="refresh" secondary>
                        <label>Last day<input type="date" name="to" required /></label>
                      </ApiForm>
                    )}
                    <ApiForm action={`/api/drivers/${d.id}/class-periods/${p.id}`} method="DELETE" submit="Remove" then="refresh" secondary />
                  </div>
                )}</td>
              </tr>
            ))}
            {d.classPeriods.length === 0 && <tr><td colSpan={4} className="muted">No class period. This driver&apos;s records are rejected until one is set.</td></tr>}
          </tbody>
        </table>
        {canEdit && (
          <ApiForm action={`/api/drivers/${d.id}/class-periods`} submit="Add class period" then="refresh">
            <label>Class
              <select name="class" required defaultValue="">
                <option value="" disabled>Choose</option>
                {Object.entries(CLASS_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label>First day<input type="date" name="from" required /></label>
            <label>Last day (blank if current)<input type="date" name="to" /></label>
            <label>For an IEO: the employing operator
              <select name="employingIoDriverId" defaultValue=""><option value="">Not an IEO</option>{others.map(o => <option key={o.id} value={o.id}>{o.externalId}</option>)}</select>
            </label>
          </ApiForm>
        )}
      </section>

      <section className="card">
        <h2>Hours worked for other licensees</h2>
        <p className="muted">The higher hourly rate starts after 2,340 hours of container trucking for any licensee. Record hours for other licensees here where you know them. If they are not reported, every report says so.</p>
        <table>
          <thead><tr><th>Date</th><th>Minutes</th><th></th></tr></thead>
          <tbody>
            {d.otherHours.map(h => (
              <tr key={h.id}><td>{h.workDate}</td><td className="num">{h.minutes}</td>
                <td>{canEdit && <ApiForm action={`/api/drivers/${d.id}/other-hours/${h.id}`} method="DELETE" submit="Remove" then="refresh" secondary />}</td></tr>
            ))}
            {d.otherHours.length === 0 && <tr><td colSpan={3} className="muted">{d.otherLicenseeHoursReported === true ? 'Recorded as known: none.' : 'Not reported.'}</td></tr>}
          </tbody>
        </table>
        {canEdit && d.otherLicenseeHoursReported === true && (
          <ApiForm action={`/api/drivers/${d.id}/other-hours`} submit="Add hours" then="refresh">
            <label>Date<input type="date" name="workDate" required /></label>
            <label>Minutes<input type="text" name="minutes" inputMode="numeric" required /></label>
          </ApiForm>
        )}
      </section>
    </>
  );
}
