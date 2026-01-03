/**
 * Output formatting helpers for consistent CLI output
 */

/**
 * Print data as formatted JSON
 */
export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Column definition for table printing
 */
export interface TableColumn {
  /** Header text */
  header: string;
  /** Key to extract from row object */
  key: string;
  /** Optional width (defaults to auto) */
  width?: number;
  /** Optional alignment */
  align?: 'left' | 'right' | 'center';
}

/**
 * Print data as a formatted table
 */
export function printTable(
  rows: Record<string, unknown>[],
  columns: TableColumn[]
): void {
  if (rows.length === 0) {
    console.log('No data to display.');
    return;
  }

  // Calculate column widths
  const widths = columns.map((col) => {
    const headerWidth = col.header.length;
    const maxDataWidth = rows.reduce((max, row) => {
      const value = String(row[col.key] ?? '');
      return Math.max(max, value.length);
    }, 0);
    return col.width ?? Math.max(headerWidth, maxDataWidth);
  });

  // Print header
  const headerLine = columns
    .map((col, i) => padCell(col.header, widths[i], col.align ?? 'left'))
    .join('  ');
  console.log(headerLine);

  // Print separator
  const separator = widths.map((w) => '-'.repeat(w)).join('  ');
  console.log(separator);

  // Print rows
  for (const row of rows) {
    const line = columns
      .map((col, i) => {
        const value = String(row[col.key] ?? '-');
        return padCell(value, widths[i], col.align ?? 'left');
      })
      .join('  ');
    console.log(line);
  }
}

/**
 * Pad a cell value to the specified width with the given alignment
 */
function padCell(
  value: string,
  width: number,
  align: 'left' | 'right' | 'center'
): string {
  const truncated = value.length > width ? value.slice(0, width - 1) + '~' : value;
  const padding = width - truncated.length;

  switch (align) {
    case 'right':
      return ' '.repeat(padding) + truncated;
    case 'center': {
      const left = Math.floor(padding / 2);
      const right = padding - left;
      return ' '.repeat(left) + truncated + ' '.repeat(right);
    }
    case 'left':
    default:
      return truncated + ' '.repeat(padding);
  }
}

/**
 * Print a success message
 */
export function printSuccess(message: string): void {
  console.log(`[OK] ${message}`);
}

/**
 * Print an error message
 */
export function printError(message: string): void {
  console.error(`[ERROR] ${message}`);
}

/**
 * Print an info message (suppressed in quiet mode)
 */
export function printInfo(message: string): void {
  console.log(`[INFO] ${message}`);
}

/**
 * Print a warning message
 */
export function printWarning(message: string): void {
  console.warn(`[WARN] ${message}`);
}

/**
 * Print debug information (only shown in verbose mode)
 */
export function printDebug(message: string): void {
  console.log(`[DEBUG] ${message}`);
}

/**
 * Get global options from the root command
 */
export interface GlobalOptions {
  json?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  db?: string;
}

interface CommandLike {
  parent?: CommandLike;
  opts?: () => GlobalOptions;
}

/**
 * Extract global options from a command
 */
export function getGlobalOptions(command: CommandLike): GlobalOptions {
  // Walk up the command tree to find root options
  let current: CommandLike = command;
  while (current.parent) {
    current = current.parent;
  }
  return current.opts?.() ?? {};
}
