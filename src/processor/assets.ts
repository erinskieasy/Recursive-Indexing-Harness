import { sql } from '../db';

export type AssetPermissionType = 'read' | 'write' | 'search';

export interface AssetAction {
    type: AssetPermissionType;
    assetLogicalName: string;
    limit?: number;
    query?: string;
    text?: string;
    textTemplate?: string;
    metadata?: Record<string, unknown>;
}

const IDENTIFIER_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;

function ensureSafeIdentifier(name: string) {
    if (!IDENTIFIER_REGEX.test(name)) {
        throw new Error(`Invalid identifier: ${name}`);
    }
}

function bracketIdentifier(name: string) {
    ensureSafeIdentifier(name);
    return `[${name}]`;
}

export async function ensureAssetStorageTable(pool: any, physicalTableName: string) {
    const escaped = bracketIdentifier(physicalTableName);
    await pool.request().query(`
      IF OBJECT_ID('${physicalTableName}', 'U') IS NULL
      BEGIN
        CREATE TABLE ${escaped} (
          id INT IDENTITY(1,1) PRIMARY KEY,
          content NVARCHAR(MAX) NOT NULL,
          metadata NVARCHAR(MAX) NULL,
          created_at DATETIME2 DEFAULT GETDATE()
        )
      END
    `);
}

export async function getAssetByLogicalName(pool: any, logicalName: string) {
    const result = await pool.request()
        .input('logical_name', sql.NVarChar(128), logicalName)
        .query('SELECT * FROM AssetTables WHERE logical_name = @logical_name');
    return result.recordset[0] || null;
}

export async function getAgentAssetBinding(pool: any, agentId: number, assetTableId: number) {
    const result = await pool.request()
        .input('agent_id', sql.Int, agentId)
        .input('asset_table_id', sql.Int, assetTableId)
        .query('SELECT * FROM AgentAssetBindings WHERE agent_id = @agent_id AND asset_table_id = @asset_table_id');
    return result.recordset[0] || null;
}

export async function executeAssetRead(pool: any, physicalTableName: string, limit = 10) {
    const escaped = bracketIdentifier(physicalTableName);
    const request = pool.request();
    request.input('limit', sql.Int, Math.min(Math.max(limit, 1), 100));
    const result = await request.query(`
      SELECT TOP (@limit) id, content, metadata, created_at
      FROM ${escaped}
      ORDER BY created_at DESC, id DESC
    `);
    return result.recordset;
}

export async function executeAssetSearch(pool: any, physicalTableName: string, query: string, limit = 10) {
    const escaped = bracketIdentifier(physicalTableName);
    const request = pool.request();
    request.input('limit', sql.Int, Math.min(Math.max(limit, 1), 100));
    request.input('q', sql.NVarChar(sql.MAX), `%${query}%`);
    const result = await request.query(`
      SELECT TOP (@limit) id, content, metadata, created_at
      FROM ${escaped}
      WHERE content LIKE @q
      ORDER BY created_at DESC, id DESC
    `);
    return result.recordset;
}

export async function executeAssetWrite(pool: any, physicalTableName: string, text: string, metadata?: Record<string, unknown>) {
    const escaped = bracketIdentifier(physicalTableName);
    const request = pool.request();
    request.input('content', sql.NVarChar(sql.MAX), text);
    request.input('metadata', sql.NVarChar(sql.MAX), metadata ? JSON.stringify(metadata) : null);
    await request.query(`
      INSERT INTO ${escaped} (content, metadata) VALUES (@content, @metadata)
    `);
}

function renderTemplate(template: string, context: Record<string, string>) {
    return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => context[key] ?? '');
}

export async function executeAgentActions(pool: any, agentId: number, rawJson: string | null, context: Record<string, string>) {
    const logs: any[] = [];
    if (!rawJson) return logs;

    let parsed: AssetAction[] = [];
    try {
        const maybe = JSON.parse(rawJson);
        if (Array.isArray(maybe)) parsed = maybe;
    } catch {
        return [{ status: 'error', message: 'Invalid JSON in configured actions' }];
    }

    for (const action of parsed) {
        try {
            const asset = await getAssetByLogicalName(pool, action.assetLogicalName);
            if (!asset) {
                logs.push({ status: 'error', action, message: 'Asset not found' });
                continue;
            }

            const binding = await getAgentAssetBinding(pool, agentId, asset.id);
            if (!binding) {
                logs.push({ status: 'error', action, message: 'No binding for asset' });
                continue;
            }

            if (action.type === 'read') {
                if (!binding.can_read) {
                    logs.push({ status: 'error', action, message: 'Read permission denied' });
                    continue;
                }
                const rows = await executeAssetRead(pool, asset.physical_table_name, action.limit || 10);
                logs.push({ status: 'ok', action, rows });
            }

            if (action.type === 'search') {
                if (!binding.can_search) {
                    logs.push({ status: 'error', action, message: 'Search permission denied' });
                    continue;
                }
                const rows = await executeAssetSearch(pool, asset.physical_table_name, action.query || '', action.limit || 10);
                logs.push({ status: 'ok', action, rows });
            }

            if (action.type === 'write') {
                if (!binding.can_write) {
                    logs.push({ status: 'error', action, message: 'Write permission denied' });
                    continue;
                }
                const text = action.textTemplate ? renderTemplate(action.textTemplate, context) : (action.text || context.latest_note || '');
                if (!text.trim()) {
                    logs.push({ status: 'error', action, message: 'No text generated for write action' });
                    continue;
                }
                await executeAssetWrite(pool, asset.physical_table_name, text, action.metadata);
                logs.push({ status: 'ok', action });
            }
        } catch (err: any) {
            logs.push({ status: 'error', action, message: err.message || 'Unknown error' });
        }
    }

    return logs;
}

export async function buildAgentPromptAssetContext(pool: any, agentId: number) {
    const bindingsResult = await pool.request()
        .input('agent_id', sql.Int, agentId)
        .query(`
          SELECT b.prompt_row_limit, a.logical_name, a.display_name, a.physical_table_name
          FROM AgentAssetBindings b
          INNER JOIN AssetTables a ON a.id = b.asset_table_id
          WHERE b.agent_id = @agent_id AND b.include_in_prompt = 1 AND b.can_read = 1
          ORDER BY a.display_name ASC
        `);

    const sections: string[] = [];
    for (const binding of bindingsResult.recordset) {
        const rows = await executeAssetRead(pool, binding.physical_table_name, binding.prompt_row_limit || 5);
        const rowsText = rows.map((row: any) => `- ${row.content}`).join('\n');
        sections.push(`# Asset: ${binding.display_name} (${binding.logical_name})\n${rowsText || '- No rows'}\n`);
    }

    return sections.join('\n');
}
