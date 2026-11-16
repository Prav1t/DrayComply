import { Workbench } from '../components/Workbench';

export default function Page() {
  return (
    <main>
      <header className="masthead">
        <h1>DrayComply</h1>
        <p>Recompute driver payments against the OBCCTC rate orders. Files are read in this browser and are not uploaded anywhere.</p>
      </header>
      <Workbench />
      <footer>
        Results are calculations under the rules as encoded, for the data provided. They are not legal advice.
      </footer>
    </main>
  );
}
