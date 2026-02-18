export async function execute(params: any) {
  const { data: dataStr, filename = 'export.csv', columns: columnsStr } = params;

  if (!dataStr) throw new Error('JSON data is required');

  let rows: any[];
  try {
    rows = typeof dataStr === 'string' ? JSON.parse(dataStr) : dataStr;
  } catch {
    throw new Error('Invalid JSON data. Expected an array of objects.');
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Data must be a non-empty JSON array');
  }

  // Determine columns
  let selectedColumns: string[];
  if (columnsStr && typeof columnsStr === 'string' && columnsStr.trim()) {
    selectedColumns = columnsStr.split(',').map((c: string) => c.trim()).filter(Boolean);
  } else {
    // Use all keys from first object
    selectedColumns = Object.keys(rows[0]);
  }

  // Generate CSV
  const escapeCsvValue = (val: any): string => {
    if (val === null || val === undefined) return '';
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  const headerLine = selectedColumns.map(escapeCsvValue).join(',');
  const dataLines = rows.map(row =>
    selectedColumns.map(col => escapeCsvValue(row[col])).join(',')
  );

  const csv = [headerLine, ...dataLines].join('\n');

  return {
    csv,
    filename,
    rowCount: rows.length,
    columnCount: selectedColumns.length,
    columns: selectedColumns,
    preview: csv.split('\n').slice(0, 6).join('\n'),
    message: `CSV generated: ${rows.length} rows, ${selectedColumns.length} columns. Copy the CSV content below.`,
  };
}
