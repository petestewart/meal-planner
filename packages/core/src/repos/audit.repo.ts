/**
 * Audit repository - logging operations for audit trail
 *
 * Handles the audit_log table for tracking entity mutations.
 * Uses raw SQL with parameterized queries (no ORM).
 */

import type { Database } from 'better-sqlite3';
import { v4 as uuid } from 'uuid';

/**
 * Valid actor types for audit logging.
 * - 'user': Direct user action
 * - 'cli': Command line interface
 * - 'api': API endpoint
 * - 'agent:curator': Curator agent
 * - 'agent:planner': Planner agent
 */
export type AuditActor =
  | 'user'
  | 'cli'
  | 'api'
  | 'agent:curator'
  | 'agent:planner';

/**
 * Valid action types for audit logging.
 */
export type AuditAction = 'create' | 'update' | 'delete';

/**
 * Options for flexible audit log queries.
 */
export interface AuditQueryOptions {
  /** Filter by actor (exact match) */
  actor?: string;
  /** Filter by entity type (exact match) */
  entityType?: string;
  /** Filter by entity ID (exact match) */
  entityId?: string;
  /** Filter by action type (exact match) */
  action?: AuditAction;
  /** Filter entries on or after this ISO 8601 timestamp */
  startTime?: string;
  /** Filter entries on or before this ISO 8601 timestamp */
  endTime?: string;
  /** Maximum number of entries to return */
  limit?: number;
  /** Number of entries to skip (for pagination) */
  offset?: number;
}

/**
 * Input for creating an audit log entry.
 */
export interface CreateAuditLogEntry {
  actor: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
}

/**
 * Audit log entry as stored in the database.
 */
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
}

/** Raw audit log row from database */
interface AuditLogRow {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: string | null;
}

/**
 * Convert database row to AuditLogEntry model
 */
function rowToAuditLogEntry(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    timestamp: row.timestamp,
    actor: row.actor,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    details: row.details ? JSON.parse(row.details) : null,
  };
}

export class AuditRepository {
  constructor(private db: Database) {}

  /**
   * Log an audit entry.
   */
  log(entry: CreateAuditLogEntry): AuditLogEntry {
    const id = uuid();
    const detailsJson = entry.details ? JSON.stringify(entry.details) : null;

    this.db
      .prepare(
        `
        INSERT INTO audit_log (id, actor, action, entity_type, entity_id, details)
        VALUES (?, ?, ?, ?, ?, ?)
      `
      )
      .run(
        id,
        entry.actor,
        entry.action,
        entry.entityType,
        entry.entityId,
        detailsJson
      );

    // Fetch and return the created entry
    const row = this.db
      .prepare('SELECT * FROM audit_log WHERE id = ?')
      .get(id) as AuditLogRow;

    return rowToAuditLogEntry(row);
  }

  /**
   * Get audit log entries for a specific entity.
   */
  getByEntityId(entityId: string): AuditLogEntry[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM audit_log WHERE entity_id = ? ORDER BY timestamp DESC'
      )
      .all(entityId) as AuditLogRow[];

    return rows.map(rowToAuditLogEntry);
  }

  /**
   * Get audit log entries by entity type.
   */
  getByEntityType(entityType: string, limit?: number): AuditLogEntry[] {
    let sql = 'SELECT * FROM audit_log WHERE entity_type = ? ORDER BY timestamp DESC';
    const params: (string | number)[] = [entityType];

    if (limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(limit);
    }

    const rows = this.db.prepare(sql).all(...params) as AuditLogRow[];

    return rows.map(rowToAuditLogEntry);
  }

  /**
   * Get recent audit log entries.
   */
  getRecent(limit: number = 100): AuditLogEntry[] {
    const rows = this.db
      .prepare('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?')
      .all(limit) as AuditLogRow[];

    return rows.map(rowToAuditLogEntry);
  }

  /**
   * Get audit log entries by actor.
   */
  getByActor(actor: string, limit?: number): AuditLogEntry[] {
    let sql = 'SELECT * FROM audit_log WHERE actor = ? ORDER BY timestamp DESC';
    const params: (string | number)[] = [actor];

    if (limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(limit);
    }

    const rows = this.db.prepare(sql).all(...params) as AuditLogRow[];

    return rows.map(rowToAuditLogEntry);
  }

  /**
   * Get audit log entries within a time range.
   * @param startTime ISO 8601 timestamp (inclusive)
   * @param endTime ISO 8601 timestamp (inclusive)
   * @param limit Optional maximum number of entries
   */
  getByTimeRange(startTime: string, endTime: string, limit?: number): AuditLogEntry[] {
    let sql = 'SELECT * FROM audit_log WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC';
    const params: (string | number)[] = [startTime, endTime];

    if (limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(limit);
    }

    const rows = this.db.prepare(sql).all(...params) as AuditLogRow[];

    return rows.map(rowToAuditLogEntry);
  }

  /**
   * Build WHERE clause and parameters from query options.
   * Helper method for query() and count().
   */
  private buildWhereClause(options: AuditQueryOptions): { whereClause: string; params: (string | number)[] } {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (options.actor !== undefined) {
      conditions.push('actor = ?');
      params.push(options.actor);
    }

    if (options.entityType !== undefined) {
      conditions.push('entity_type = ?');
      params.push(options.entityType);
    }

    if (options.entityId !== undefined) {
      conditions.push('entity_id = ?');
      params.push(options.entityId);
    }

    if (options.action !== undefined) {
      conditions.push('action = ?');
      params.push(options.action);
    }

    if (options.startTime !== undefined) {
      conditions.push('timestamp >= ?');
      params.push(options.startTime);
    }

    if (options.endTime !== undefined) {
      conditions.push('timestamp <= ?');
      params.push(options.endTime);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { whereClause, params };
  }

  /**
   * Flexible query method with multiple filter options.
   */
  query(options: AuditQueryOptions = {}): AuditLogEntry[] {
    const { whereClause, params } = this.buildWhereClause(options);

    let sql = `SELECT * FROM audit_log ${whereClause} ORDER BY timestamp DESC`;

    if (options.limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options.offset !== undefined) {
      // SQLite requires LIMIT before OFFSET, default to -1 (no limit) if not specified
      if (options.limit === undefined) {
        sql += ' LIMIT -1';
      }
      sql += ' OFFSET ?';
      params.push(options.offset);
    }

    const rows = this.db.prepare(sql).all(...params) as AuditLogRow[];

    return rows.map(rowToAuditLogEntry);
  }

  /**
   * Count audit log entries matching the given filters.
   */
  count(options: AuditQueryOptions = {}): number {
    const { whereClause, params } = this.buildWhereClause(options);

    const sql = `SELECT COUNT(*) as count FROM audit_log ${whereClause}`;
    const result = this.db.prepare(sql).get(...params) as { count: number };

    return result.count;
  }
}
