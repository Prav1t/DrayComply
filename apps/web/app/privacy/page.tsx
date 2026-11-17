import Link from 'next/link';

export const metadata = { title: 'Privacy policy (draft) - DrayComply' };

export default function Privacy() {
  return (
    <main>
      <header className="masthead"><h1>Privacy policy</h1></header>
      <div className="banner bad"><b>DRAFT - NEEDS LEGAL REVIEW.</b> This text has not been reviewed by a lawyer and is not yet in force.</div>
      <section className="card prose">
        <h2>Who we are</h2>
        <p>DrayComply (&quot;we&quot;) provides a calculation service to container trucking companies licensed in British Columbia (&quot;customers&quot;). The customer decides what information to upload and why. We handle it on the customer&apos;s behalf, under the British Columbia <i>Personal Information Protection Act</i> (PIPA).</p>
        <h2>What we hold</h2>
        <ul>
          <li><b>Account information:</b> the name, email address and password hash of each person who signs in.</li>
          <li><b>Customer data:</b> the payroll and dispatch files a customer uploads, and what is derived from them. This includes personal information about drivers: identifiers, hours worked, trips, amounts paid and deductions.</li>
          <li><b>An activity log:</b> who did what and when, by identifier. It does not contain payroll values.</li>
        </ul>
        <p>We do not ask for and do not need social insurance numbers, bank details, home addresses or dates of birth. Customers should remove such columns before uploading.</p>
        <h2>Why we hold it</h2>
        <p>Only to compare driver payments with the regulated rates and to produce the customer&apos;s reports. We do not sell it, use it for advertising, or use it to train models.</p>
        <h2>Where it is stored</h2>
        <p>All customer data is stored in Canada. [TO CONFIRM BEFORE LAUNCH: name the hosting and database providers and their Canadian regions, and list every sub-processor.]</p>
        <h2>How long we keep it</h2>
        <p>For as long as the customer&apos;s account is open, because audits by the Commissioner can reach back many years. An owner can download all of the organization&apos;s data and can delete it at any time from Settings. Deletion removes it from the live system at once and from backups within 35 days. The full schedule is in our retention policy.</p>
        <h2>Security</h2>
        <p>Data is encrypted in transit. Each organization&apos;s data is separated from every other&apos;s and access is limited by role. Passwords are stored only as salted hashes. Original files and results cannot be altered once stored.</p>
        <h2>Drivers&apos; rights</h2>
        <p>A driver who wants to see or correct information about them should ask the company they drive for, which controls that information. We will help the customer respond.</p>
        <h2>Breaches</h2>
        <p>If personal information is lost or accessed without authority, we will tell the affected customer without unreasonable delay. [TO CONFIRM: notification commitments.]</p>
        <h2>Contact</h2>
        <p>[TO CONFIRM: name and contact details of the person responsible for privacy, as PIPA requires.]</p>
        <p><Link href="/">Back</Link></p>
      </section>
    </main>
  );
}
