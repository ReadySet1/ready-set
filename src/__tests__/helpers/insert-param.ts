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

  // The value list is either a VALUES (...) tuple or, for a guarded insert,
  // an INSERT ... SELECT <list> WHERE ... projection. Split it on top-level
  // commas (function args nest in parens).
  const afterColumns = sql.slice(sql.indexOf(columns) + columns.length + 1);
  const valuesMatch = /VALUES\s*\(/i.exec(afterColumns);
  const selectMatch = /\bSELECT\b/i.exec(afterColumns);
  const isSelect = !!selectMatch && (!valuesMatch || selectMatch.index < valuesMatch.index);
  const body = isSelect
    ? afterColumns.slice(selectMatch!.index + selectMatch![0].length)
    : afterColumns.slice(valuesMatch ? valuesMatch.index + valuesMatch[0].length : 0);
  const items: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]!;
    if (ch === '(') depth++;
    if (ch === ')') {
      if (depth === 0) break;
      depth--;
    }
    if (isSelect && depth === 0 && /^\s+(WHERE|FROM|RETURNING)\b/i.test(body.slice(i))) break;
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
