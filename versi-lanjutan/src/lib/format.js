export const money = (value) =>
  'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(Number(value) || 0));

export const number = (value) => new Intl.NumberFormat('id-ID').format(Number(value) || 0);

export const dateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const clock = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(date);
};

export const dayKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
};

export const todayKey = () => dayKey(new Date());

export const initials = (name) =>
  String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

export const uid = (prefix) =>
  prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);

export const stockStatus = (product) => {
  if (Number(product.stock) <= 0) return 'habis';
  if (Number(product.stock) <= Number(product.minStock)) return 'menipis';
  return 'aman';
};

export const toCSV = (rows) => {
  const escape = (value) => '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"';
  return '\uFEFF' + rows.map((row) => row.map(escape).join(',')).join('\r\n');
};

export const downloadFile = (content, filename, type) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
