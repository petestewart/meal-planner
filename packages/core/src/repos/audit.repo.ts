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
}
