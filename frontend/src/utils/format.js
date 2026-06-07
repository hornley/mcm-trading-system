export const FABRIC_CATEGORY = 'Fabrics';

export const qtyLabel = (qty) => {
  if (qty == null) return '';
  const n = Number(qty);
  const whole = Math.floor(n);
  const frac = Math.round((n - whole) * 100) / 100;
  let fracStr = '';
  if (Math.abs(frac - 0.5) < 0.001) fracStr = '½';
  else if (Math.abs(frac - 0.25) < 0.001) fracStr = '¼';
  else if (Math.abs(frac - 0.75) < 0.001) fracStr = '¾';
  else if (frac > 0) fracStr = n.toFixed(2);
  if (whole === 0) return fracStr || n.toString();
  return fracStr ? `${whole} ${fracStr}` : whole.toString();
};

export const fmtQty = (qty, isFabric, unit) => {
  if (qty == null) return '0';
  const formatted = isFabric ? qtyLabel(qty) : Number(qty).toLocaleString();
  return unit ? `${formatted} ${unit}` : formatted;
};
