export const num = (n: number) => Math.round(n).toLocaleString('en-US');
export const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;
export const fixed = (x: number, digits = 2) => x.toFixed(digits);
