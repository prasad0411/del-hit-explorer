import { useState } from 'react';
import { BarList } from '../components/BarList';
import { Notice } from '../components/Notice';
import { Panel } from '../components/Panel';
import { useData } from '../data';
import { pct } from '../format';
import type { BuildingBlock, Summary } from '../types';

const POSITIONS = [
  { id: 'bb1', label: 'Building block 1' },
  { id: 'bb2', label: 'Building block 2' },
  { id: 'bb3', label: 'Building block 3' },
] as const;

export function Chemistry() {
  const { data: bbs, error } = useData<BuildingBlock[]>('building_blocks');
  const { data: summary } = useData<Summary>('summary');
  const targets = summary?.targets ?? [];
  const [target, setTarget] = useState('');
  const active = target || targets[0] || '';
  const sharedMax = Math.max(1, ...(bbs ?? []).filter((b) => b.target === active).map((b) => b.fold));

  return (
    <div className="stack">
      <div className="segmented" role="group" aria-label="Target">
        {targets.map((t) => (
          <button key={t} type="button" aria-pressed={active === t} onClick={() => setTarget(t)}>{t}</button>
        ))}
      </div>
      <Notice error={error} loading={!bbs && !error} />
      {bbs && (
        <div className="grid-3">
          {POSITIONS.map((p) => {
            const items = bbs.filter((b) => b.target === active && b.position === p.id).slice(0, 8);
            return (
              <Panel key={p.id} title={p.label} subtitle="How over represented each block is in the top 25 hits, on one shared scale">
                <BarList
                  items={items.map((b) => ({ label: b.building_block, value: b.fold, highlight: b.fold >= 3, detail: `${pct(b.hit_share, 0)} of hits` }))}
                  format={(v) => `${v.toFixed(1)}x`}
                  max={sharedMax}
                />
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
