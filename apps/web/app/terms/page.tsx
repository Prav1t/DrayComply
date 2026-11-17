import Link from 'next/link';

export const metadata = { title: 'Terms of service (draft) - DrayComply' };

export default function Terms() {
  return (
    <main>
      <header className="masthead"><h1>Terms of service</h1></header>
      <div className="banner bad"><b>DRAFT - NEEDS LEGAL REVIEW.</b> This text has not been reviewed by a lawyer and is not yet in force.</div>
      <section className="card prose">
        <h2>1. What the service does</h2>
        <p>DrayComply recomputes amounts under the British Columbia <i>Container Trucking Act</i>, its Regulation and the Commissioner&apos;s rate orders, as those rules have been encoded in the software, from the data you provide, and reports differences between what was paid and what the calculation finds owing.</p>
        <h2>2. What it does not do</h2>
        <p><b>The service reports calculations. It does not give legal advice, and it does not state that any person has or has not met a legal obligation.</b> A result of &quot;no shortfall detected under the rules as encoded, for the data provided&quot; means only that. The Commissioner may read the rules differently, may have information the service does not, and is not bound by any report.</p>
        <h2>3. Limits you should know</h2>
        <ul>
          <li>Results depend entirely on the completeness and accuracy of the data you upload and of your driver roster.</li>
          <li>Some rate schedules are marked unverified. Reports that rely on them are watermarked and must not be relied on.</li>
          <li>Some rules rest on readings of the law that no lawyer has reviewed. Every report lists the ones it relied on.</li>
          <li>Where data is missing, the service reports &quot;insufficient data&quot; and gives no result. It never fills in a value.</li>
        </ul>
        <h2>4. Your responsibilities</h2>
        <p>You confirm you are entitled to upload the data, including personal information about drivers, and that you will keep sign-in details confidential and give each person their own account.</p>
        <h2>5. Your data</h2>
        <p>Your data remains yours. We handle it as described in the <Link href="/privacy">privacy policy</Link>. You can export or delete it at any time.</p>
        <h2>6. Fees</h2>
        <p>[TO CONFIRM: fees, invoicing and payment terms.]</p>
        <h2>7. Liability</h2>
        <p>[TO BE DRAFTED BY A LAWYER: warranty disclaimer, limitation of liability, indemnities, governing law (British Columbia), termination.]</p>
        <p><Link href="/">Back</Link></p>
      </section>
    </main>
  );
}
