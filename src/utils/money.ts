export function formatMoney(value: number, showDecimals = false) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency', currency: 'PEN', minimumFractionDigits: showDecimals ? 2 : 0, maximumFractionDigits: 2,
  }).format(value);
}

export function formatMoneyText(value: string, showDecimals = false) {
  const normalized = value.trim().replace(',', '.');
  const negative = normalized.startsWith('-');
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [rawWhole = '0', rawDecimals = ''] = unsigned.split('.');
  const whole = (rawWhole.replace(/^0+(?=\d)/, '') || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const decimals = rawDecimals.padEnd(2, '0').slice(0, 2);
  const includeDecimals = showDecimals || decimals !== '00';
  return `${negative ? '-' : ''}S/ ${whole}${includeDecimals ? `.${decimals}` : ''}`;
}

export function formatPercentageText(value: string) {
  const normalized = value.trim().replace(',', '.');
  const [rawWhole = '0', rawDecimals = ''] = normalized.split('.');
  const whole = rawWhole.replace(/^0+(?=\d)/, '') || '0';
  const decimals = rawDecimals.replace(/0+$/, '').slice(0, 4);
  return `${whole}${decimals ? `,${decimals}` : ''}%`;
}

export function moneyTextToCents(value: string) {
  const normalized = value.trim().replace(',', '.');
  const match = normalized.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  const [, whole, decimals = ''] = match;
  return BigInt(whole) * 100n + BigInt(decimals.padEnd(2, '0'));
}
