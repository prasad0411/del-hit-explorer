import { DataTable } from '../components/DataTable';
import { Notice } from '../components/Notice';
import { Panel } from '../components/Panel';
import { StatCard } from '../components/StatCard';
import { useData } from '../data';
import { num, pct } from '../format';
import type { SampleQC, Summary } from '../types';

const STEPS = [
  { title: 'Read the FASTQ files', text: 'Each sample is a FASTQ file of sequencing reads, streamed one record at a time so memory stays flat.' },
  { title: 'Filter by quality', text: 'Reads with a mean Phred score below Q30 (more than 1 error in 1,000 bases) are dropped.' },
  { title: 'Match the barcode', text: 'The 12 base barcode after the primer is matched to the library FASTA, correcting one sequencing error when it is unambiguous.' },
  { title: 'Rank the hits', text: 'Counts become reads per million, then log2 fold change over the no target control. A hit must be enriched in every replicate.' },
];

export function Overview() {
  const { data: s, error } = useData<Summary>('summary');
  return (
    <div className="stack">
      <Notice error={error} loading={!s && !error} />
      {s && (
        <div className="stats">
          <StatCard label="Reads sequenced" value={num(s.reads)} note={`${s.qc.length} samples`} />
          <StatCard label="Passed quality" value={pct(s.passed_quality / s.reads)} note={`mean Phred of at least Q${s.settings.min_quality}`} />
          <StatCard label="Matched to the library" value={pct(s.matched / s.reads)} note={`${num(s.library_size)} compounds`} />
          <StatCard label="Sequencing errors corrected" value={num(s.corrected)} note="one mismatch, only when unambiguous" />
        </div>
      )}
      <Panel title="How a DEL screen becomes a hit list">
        <ol className="steps">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <span className="step-n">{i + 1}</span>
              <div><strong>{step.title}</strong><p>{step.text}</p></div>
            </li>
          ))}
        </ol>
      </Panel>
      {s && (
        <Panel title="Read quality by sample">
          <DataTable<SampleQC>
            rows={s.qc}
            rowKey={(r) => r.sample}
            caption="Read quality by sample"
            columns={[
              { key: 'sample', header: 'Sample', render: (r) => <strong>{r.sample}</strong> },
              { key: 'reads', header: 'Reads', align: 'right', render: (r) => num(r.reads), sortValue: (r) => r.reads },
              { key: 'q', header: 'Passed quality', align: 'right', render: (r) => pct(r.passed_quality / r.reads), sortValue: (r) => r.passed_quality / r.reads },
              { key: 'bc', header: 'Barcode found', align: 'right', render: (r) => pct(r.barcode_found / r.reads), sortValue: (r) => r.barcode_found / r.reads },
              { key: 'm', header: 'Matched', align: 'right', render: (r) => pct(r.matched / r.reads), sortValue: (r) => r.matched / r.reads },
              { key: 'c', header: 'Corrected', align: 'right', render: (r) => num(r.corrected), sortValue: (r) => r.corrected },
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
