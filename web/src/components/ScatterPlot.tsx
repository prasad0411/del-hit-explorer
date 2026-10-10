const W = 420;
const H = 420;
const PAD = 44;

interface Props { points: [number, number][]; xLabel: string; yLabel: string }

/** Replicate agreement: each dot is one barcode, log10 reads per million in each replicate. */
export function ScatterPlot({ points, xLabel, yLabel }: Props) {
  const max = Math.max(1, ...points.flat());
  const top = Math.ceil(max);
  const sx = (v: number) => PAD + (v / top) * (W - PAD * 1.5);
  const sy = (v: number) => H - PAD - (v / top) * (H - PAD * 1.5);
  const ticks = Array.from({ length: top + 1 }, (_, i) => i);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="scatter" role="img" aria-label={`${yLabel} against ${xLabel}, ${points.length} barcodes`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={sx(0)} x2={sx(top)} y1={sy(t)} y2={sy(t)} className="grid" />
          <text x={PAD - 8} y={sy(t)} className="axis" textAnchor="end" dominantBaseline="middle">{t}</text>
          <text x={sx(t)} y={H - PAD + 18} className="axis" textAnchor="middle">{t}</text>
        </g>
      ))}
      <line x1={sx(0)} y1={sy(0)} x2={sx(top)} y2={sy(top)} className="diagonal" />
      {points.map(([x, y], i) => <circle key={i} cx={sx(x)} cy={sy(y)} r={2.6} className="dot" />)}
      <text x={W / 2 + PAD / 2} y={H - 6} className="axis-title" textAnchor="middle">{xLabel}</text>
      <text x={14} y={H / 2} className="axis-title" textAnchor="middle" transform={`rotate(-90 14 ${H / 2})`}>{yLabel}</text>
    </svg>
  );
}
