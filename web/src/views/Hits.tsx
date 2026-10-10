import { useMemo, useState } from 'react';
import { DataTable } from '../components/DataTable';
import { Notice } from '../components/Notice';
import { Panel } from '../components/Panel';
import { useData } from '../data';
import { fixed, num } from '../format';
import { filterHits } from '../hits';
import type { Hit, Summary } from '../types';

const PAGE = 25;

export function Hits() {
  const { data: hits, error } = useData<Hit[]>('hits');
  const { data: summary } = useData<Summary>('summary');
  const targets = summary?.targets ?? [];
  const [target, setTarget] = useState('');
  const [q, setQ] = useState('');
  const [minLog2, setMinLog2] = useState(1);
  const [shown, setShown] = useState(PAGE);
  const active = target || targets[0] || '';

  const rows = useMemo(() => (hits ? filterHits(hits, { target: active, q, minLog2 }) : []), [hits, active, q, minLog2]);

  return (
    <div className="stack">
      <form className="filters" role="search" onSubmit={(e) => e.preventDefault()}>
        <label className="field">
          <span>Target</span>
          <select value={active} onChange={(e) => { setTarget(e.target.value); setShown(PAGE); }}>
            {targets.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className="field grow">
          <span>Search</span>
          <input type="search" placeholder="Compound, building block or barcode" value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} />
        </label>
        <label className="field">
          <span>Minimum log2 fold in every replicate</span>
          <select value={minLog2} onChange={(e) => { setMinLog2(Number(e.target.value)); setShown(PAGE); }}>
            {[0, 1, 2, 2.5].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      </form>
      <Notice error={error} loading={!hits && !error} />
      {hits && (
        <Panel title={`${num(rows.length)} hits for ${active}`}>
          <DataTable<Hit>
            rows={rows.slice(0, shown)}
            rowKey={(h) => `${h.target}-${h.barcode}`}
            caption={`Hits for ${active}`}
            empty="No compounds pass these filters"
            columns={[
              { key: 'rank', header: 'Rank', align: 'right', render: (h) => h.rank, sortValue: (h) => h.rank },
              { key: 'compound', header: 'Compound', render: (h) => <strong>{h.compound}</strong>, sortValue: (h) => h.compound },
              { key: 'bbs', header: 'Building blocks', render: (h) => <span className="mono">{h.bb1} · {h.bb2} · {h.bb3}</span> },
              { key: 'trpm', header: 'Target RPM', align: 'right', render: (h) => num(h.target_rpm), sortValue: (h) => h.target_rpm },
              { key: 'crpm', header: 'Control RPM', align: 'right', render: (h) => num(h.control_rpm), sortValue: (h) => h.control_rpm },
              { key: 'r1', header: 'log2 R1', align: 'right', render: (h) => fixed(h.log2_r1), sortValue: (h) => h.log2_r1 },
              { key: 'r2', header: 'log2 R2', align: 'right', render: (h) => fixed(h.log2_r2), sortValue: (h) => h.log2_r2 },
              {
                key: 'min', header: 'Min log2', align: 'right', sortValue: (h) => h.min_log2,
                render: (h) => <span className={h.min_log2 >= 2 ? 'strong-hit' : undefined}>{fixed(h.min_log2)}</span>,
              },
            ]}
          />
          {rows.length > shown && (
            <div className="more"><button type="button" onClick={() => setShown((n) => n + PAGE)}>Show more</button></div>
          )}
        </Panel>
      )}
    </div>
  );
}
