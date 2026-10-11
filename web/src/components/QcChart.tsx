import { pct } from '../format';
import { qcSegments } from '../qc';
import type { SampleQC } from '../types';

/** One stacked bar per sample, showing where every read ended up. */
export function QcChart({ qc }: { qc: SampleQC[] }) {
  const legend = qc.length ? qcSegments(qc[0]) : [];
  return (
    <div className="qc">
      <ul className="qc-legend" aria-hidden="true">
        {legend.map((s) => <li key={s.key}><span className={`swatch seg-${s.key}`} />{s.label}</li>)}
      </ul>
      {qc.map((q) => {
        const segs = qcSegments(q);
        return (
          <div key={q.sample} className="qc-row">
            <span className="qc-name">{q.sample}</span>
            <div className="qc-bar" role="img" aria-label={`${q.sample}: ${segs.map((s) => `${s.label} ${pct(s.share)}`).join(', ')}`}>
              {segs.map((s) => <span key={s.key} className={`seg seg-${s.key}`} style={{ width: `${s.share * 100}%` }} title={`${s.label}: ${pct(s.share)}`} />)}
            </div>
            <span className="qc-value">{pct(segs[0].share)}</span>
          </div>
        );
      })}
    </div>
  );
}
