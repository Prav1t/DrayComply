import { ApiForm } from '../../../components/ApiForm';
import { listAudit } from '../../../server/audit';
import { atLeast } from '../../../server/context';
import { getOrganization, listInvitations, listMembers } from '../../../server/orgs';
import { pageContext } from '../../../server/page';

export default async function Settings() {
  const { ctx } = await pageContext();
  const org = await getOrganization(ctx);
  const members = await listMembers(ctx);
  const owner = atLeast(ctx.role, 'owner');
  const invitations = owner ? await listInvitations(ctx) : [];
  const audit = owner ? await listAudit(ctx, 50) : [];
  return (
    <>
      <section className="card">
        <h2>{org.name}</h2>
        <table>
          <thead><tr><th>Member</th><th>Email</th><th>Role</th><th></th></tr></thead>
          <tbody>{members.map(m => (
            <tr key={m.userId}><td>{m.name}</td><td>{m.email}</td><td>{m.role}</td>
              <td>{owner && m.userId !== ctx.userId && (
                <div className="row">
                  <ApiForm action={`/api/org/members/${m.userId}`} method="PATCH" submit="Change role" then="refresh" secondary>
                    <select name="role" defaultValue={m.role} aria-label="Role"><option value="owner">owner</option><option value="payroll">payroll</option><option value="viewer">viewer</option></select>
                  </ApiForm>
                  <ApiForm action={`/api/org/members/${m.userId}`} method="DELETE" submit="Remove" then="refresh" secondary />
                </div>
              )}</td></tr>
          ))}</tbody>
        </table>
        <p className="muted">Owner: everything, including members, export and deletion. Payroll: drivers, data, runs and reports. Viewer: read and download only.</p>
      </section>
      {owner && (
        <>
          <section className="card">
            <h2>Invite a member</h2>
            <p className="muted">This makes a one-time link, valid for 7 days, for that email address only. The app does not send email: copy the link and send it yourself. It is shown once.</p>
            <ApiForm action="/api/org/invitations" submit="Create invitation link" then="refresh" show={['link']}>
              <label>Email<input type="email" name="email" required /></label>
              <label>Role<select name="role" defaultValue="payroll"><option value="owner">owner</option><option value="payroll">payroll</option><option value="viewer">viewer</option></select></label>
            </ApiForm>
            {invitations.length > 0 && <p className="muted">Open invitations: {invitations.map(i => `${i.email} (${i.role}, expires ${i.expiresAt.slice(0, 10)})`).join('; ')}.</p>}
          </section>
          <section className="card">
            <h2>Your data</h2>
            <p><a className="button secondary" href="/api/org/export">Download everything (zip)</a></p>
            <p className="muted">The zip holds every original file, every report, and every stored row as JSON.</p>
            <h2>Delete this organization</h2>
            <p className="muted">Permanently deletes every driver, file, template, run, report and log entry of this organization. This cannot be undone. Download your data first if an audit may still need it.</p>
            <ApiForm action="/api/org/delete" submit="Delete everything" then="/" confirmText="Delete this organization and all of its data permanently?" secondary>
              <label>Type the organization name to confirm<input type="text" name="confirmName" required autoComplete="off" /></label>
            </ApiForm>
          </section>
          <section className="card">
            <h2>Activity log (latest 50)</h2>
            <div className="scroll"><table>
              <thead><tr><th>When</th><th>Who</th><th>What</th><th>Record</th></tr></thead>
              <tbody>{audit.map(a => <tr key={a.id}><td>{a.at.slice(0, 19).replace('T', ' ')}</td><td>{members.find(m => m.userId === a.userId)?.email ?? 'former member'}</td><td>{a.action}</td><td><code>{a.entityId?.slice(0, 8) ?? ''}</code></td></tr>)}</tbody>
            </table></div>
          </section>
        </>
      )}
    </>
  );
}
