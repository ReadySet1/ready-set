/**
 * Returns the bound value for `column` from a mocked raw INSERT call
 * (`[sql, ...params]`), resolving it through the column list and its `$N`
 * placeholder instead of a hard-coded argument position.
 */
export function insertParamFor(call: unknown[], column: string): unknown {
  const sql = String(call[0]);
  const columns = /INSERT INTO\s+\w+\s*\(([^)]*)\)/i.exec(sql)?.[1];
  if (!columns) throw new Error('No INSERT column list found');
  const index = columns.split(',').map((c) => c.trim()).indexOf(column);
  if (index < 0) throw new Error(`Column ${column} not in INSERT`);

  // Split the VALUES tuple on top-level commas (function args nest in parens).
  const valuesStart = sql.search(/VALUES\s*\(/i);
  const body = sql.slice(sql.indexOf('(', valuesStart) + 1);
  const items: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of body) {
    if (ch === '(') depth++;
    if (ch === ')') {
      if (depth === 0) break;
      depth--;
    }
    if (ch === ',' && depth === 0) {
      items.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  items.push(current);

  const placeholder = /\$(\d+)/.exec(items[index] ?? '')?.[1];
  if (!placeholder) throw new Error(`No placeholder for ${column}`);
  return call[Number(placeholder)];
}
