export interface BarItem { label: string; value: number; detail?: string; highlight?: boolean }

export function BarList({ items, format, max: shared }: { items: BarItem[]; format: (v: number) => string; max?: number }) {
  const max = shared ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="barlist">
      {items.map((i) => (
        <li key={i.label} className={i.highlight ? 'highlight' : undefined}>
          <span className="barlist-label">{i.label}</span>
          <span className="barlist-track"><span className="barlist-fill" style={{ width: `${(i.value / max) * 100}%` }} /></span>
          <span className="barlist-value">{format(i.value)}{i.detail ? <small> {i.detail}</small> : null}</span>
        </li>
      ))}
    </ul>
  );
}
