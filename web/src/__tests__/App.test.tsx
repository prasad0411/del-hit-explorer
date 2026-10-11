import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { clearCache } from '../data';

const SUMMARY = {
  samples: [], library_size: 400, reads: 72000, passed_quality: 66134, barcode_found: 65434, matched: 65163, corrected: 1301,
  qc: [{ sample: 'BRD4_R1', reads: 12000, passed_quality: 11047, barcode_found: 10926, matched: 10876, corrected: 213 }],
  targets: ['BRD4', 'KRAS'], settings: { min_quality: 30, primer: 'AGCTAG', barcode_length: 12, pseudocount: 1, min_target_rpm: 50 },
};
const HITS = [
  { target: 'BRD4', rank: 1, compound: 'CMP-0054', barcode: 'ACGT', bb1: 'BB1-03', bb2: 'BB2-11', bb3: 'BB3-04',
    target_rpm: 10595, control_rpm: 1244, log2_r1: 2.97, log2_r2: 3.2, min_log2: 2.97 },
  { target: 'KRAS', rank: 1, compound: 'CMP-0229', barcode: 'TTGA', bb1: 'BB1-08', bb2: 'BB2-11', bb3: 'BB3-02',
    target_rpm: 19446, control_rpm: 1700, log2_r1: 3.5, log2_r2: 3.6, min_log2: 3.47 },
];
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });

function routeFetch() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const u = String(input);
    if (u.endsWith('summary.json')) return json(SUMMARY);
    if (u.endsWith('hits.json')) return json(HITS);
    return json([]);
  });
}

describe('DEL Hit Explorer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearCache();
  });

  it('shows the read quality summary', async () => {
    routeFetch();
    render(<App />);
    expect(await screen.findByText('72,000')).toBeInTheDocument();
    expect(screen.getByText('1,301')).toBeInTheDocument();
    expect(screen.getAllByText('BRD4_R1')).toHaveLength(2);
  });

  it('lists hits per target and switches targets', async () => {
    routeFetch();
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('link', { name: 'Hits' }));
    expect(await screen.findByText('CMP-0054')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Target'), 'KRAS');
    expect(await screen.findByText('CMP-0229')).toBeInTheDocument();
    expect(screen.queryByText('CMP-0054')).not.toBeInTheDocument();
  });

  it('downloads the filtered hits as CSV', async () => {
    routeFetch();
    const created: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => { created.push(b); return 'blob:hits'; });
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('link', { name: 'Hits' }));
    await screen.findByText('CMP-0054');
    await user.click(screen.getByRole('button', { name: 'Download CSV' }));
    expect(click).toHaveBeenCalledTimes(1);
    expect(await created[0].text()).toContain('CMP-0054');
  });

  it('explains a failed load', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }));
    render(<App />);
    expect((await screen.findAllByRole('alert'))[0]).toHaveTextContent('Could not load summary.json');
  });
});
