const escapeCell = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }

  const text = String(value);
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
};

export const rowsToCsv = (rows: Array<Record<string, unknown>>): string => {
  if (!rows.length) {
    return '';
  }

  const headers = Object.keys(rows[0]);
  const headerLine = headers.map(escapeCell).join(',');
  const body = rows
    .map((row) => headers.map((header) => escapeCell(row[header])).join(','))
    .join('\n');

  return `${headerLine}\n${body}`;
};
