import Link from 'next/link';
import { ApiForm } from '../../../components/ApiForm';
import { DriverImport } from '../../../components/DriverImport';
import { atLeast } from '../../../server/context';
import { listDrivers } from '../../../server/drivers';
import { pageContext } from '../../../server/page';
import { listTemplates } from '../../../server/templates';

export default async function Drivers() {
  const { ctx } = await pageContext();
  const [drivers, templates] = await Promise.all([listDrivers(ctx), listTemplates(ctx, 'drivers')]);
  const canEdit = atLeast(ctx.role, 'payroll');
  return (
    <>
      <section className="card">
        <h2>Drivers</h2>
        <p className="muted">The driver id must match the id in your payroll and trip exports. Class is set as dated periods, so an old pay period is always priced with the class the driver had then.</p>
        <div className="scroll">
          <table>
            <thead><tr><th>Driver id</th><th>Name</th><th>Class periods</th><th>Hours for other licensees</th></tr></thead>
            <tbody>
              {drivers.map(d => (
                <tr key={d.id}>
                  <td><Link href={`/app/drivers/${d.id}`}>{d.externalId}</Link></td>
                  <td>{d.displayName ?? ''}</td>
                  <td>{d.classPeriods.length === 0 ? <span className="pill warn">none set</span> : d.classPeriods.map(p => `${p.class} from ${p.fromDate}${p.toDate === null ? '' : ` to ${p.toDate}`}`).join('; ')}</td>
                  <td>{d.otherLicenseeHoursReported === true ? 'known' : 'not reported'}</td>
                </tr>
              ))}
              {drivers.length === 0 && <tr><td colSpan={4} className="muted">No drivers yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      {canEdit && (
        <>
          <section className="card">
            <h2>Add a driver</h2>
            <ApiForm action="/api/drivers" submit="Add driver" then="/app/drivers/{id}">
              <label>Driver id (as in your exports)<input type="text" name="externalId" required /></label>
              <label>Name (optional)<input type="text" name="displayName" /></label>
            </ApiForm>
          </section>
          <section className="card">
            <h2>Import drivers from a file</h2>
            <p className="muted">One row per class period. If any row cannot be read, nothing is imported. An imported driver&apos;s class periods replace the ones already here.</p>
            <DriverImport templates={templates.map(t => ({ id: t.id, name: `${t.name} (v${t.version})` }))} />
          </section>
        </>
      )}
    </>
  );
}
