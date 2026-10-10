import { Notice } from '../components/Notice';
import { Panel } from '../components/Panel';
import { ScatterPlot } from '../components/ScatterPlot';
import { useData } from '../data';
import type { Replicates as ReplicateData } from '../types';

export function Replicates() {
  const { data, error } = useData<ReplicateData>('replicates');
  return (
    <div className="stack">
      <Notice error={error} loading={!data && !error} />
      {data && (
        <div className="grid-even">
          {Object.entries(data).map(([target, r]) => (
            <Panel key={target} title={`${target}: replicate agreement`} subtitle={`Pearson r = ${r.pearson.toFixed(2)} across ${r.points.length} barcodes`}>
              <ScatterPlot points={r.points} xLabel={`${r.r1}, log10 RPM`} yLabel={`${r.r2}, log10 RPM`} />
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
