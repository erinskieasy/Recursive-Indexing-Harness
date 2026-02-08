import { getPool } from './index';

async function initDB() {
  try {
    const pool = await getPool();
    console.log('Connected to database.');

    // 1. Create Agents Table (Updated for Handover)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Agents' AND xtype='U')
      CREATE TABLE Agents (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(255) NOT NULL,
        system_prompt NVARCHAR(MAX),
        history_limit INT DEFAULT 10,
        trigger_mode VARCHAR(50) DEFAULT 'manual',
        output_mode VARCHAR(50) DEFAULT 'cycle',
        handover_to_agent_id INT NULL,
        created_at DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_Agents_Handover FOREIGN KEY (handover_to_agent_id) REFERENCES Agents(id)
      )
    `);

    // Ensure handover column exists (migration for existing table)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Agents' AND COLUMN_NAME = 'handover_to_agent_id')
      BEGIN
        ALTER TABLE Agents ADD handover_to_agent_id INT NULL;
        ALTER TABLE Agents ADD CONSTRAINT FK_Agents_Handover FOREIGN KEY (handover_to_agent_id) REFERENCES Agents(id);
      END

      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Agents' AND COLUMN_NAME = 'handover_mode')
      BEGIN
        ALTER TABLE Agents ADD handover_mode VARCHAR(50) DEFAULT 'aggregate';
      END
    `);
    console.log('Ensured Agents table exists and has all columns.');

    // 2. Ensure Default Agent Exists
    const defaultAgent = await pool.request().query("SELECT TOP 1 id FROM Agents");
    let defaultAgentId: number;

    if (defaultAgent.recordset.length === 0) {
      console.log('Seeding Default Agent...');
      const insertResult = await pool.request()
        .input('name', 'Default Agent')
        .input('prompt', "You are a recursive indexing assistant.")
        .query("INSERT INTO Agents (name, system_prompt) OUTPUT INSERTED.id VALUES (@name, @prompt)");

      defaultAgentId = insertResult.recordset[0].id;
    } else {
      defaultAgentId = defaultAgent.recordset[0].id;
    }

    // 3. Update TextChunks (Add agent_id)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'TextChunks' AND COLUMN_NAME = 'agent_id')
      BEGIN
        ALTER TABLE TextChunks ADD agent_id INT;
        ALTER TABLE TextChunks ADD CONSTRAINT FK_TextChunks_Agents FOREIGN KEY (agent_id) REFERENCES Agents(id);
      END
    `);
    // Backfill agent_id for existing chunks
    await pool.request().query(`UPDATE TextChunks SET agent_id = ${defaultAgentId} WHERE agent_id IS NULL`);
    console.log('Ensured TextChunks table has agent_id.');


    // 4. Update OrchestrationRules (Add agent_id)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'OrchestrationRules' AND COLUMN_NAME = 'agent_id')
      BEGIN
        ALTER TABLE OrchestrationRules ADD agent_id INT;
        ALTER TABLE OrchestrationRules ADD CONSTRAINT FK_Rules_Agents FOREIGN KEY (agent_id) REFERENCES Agents(id);
      END
    `);
    await pool.request().query(`UPDATE OrchestrationRules SET agent_id = ${defaultAgentId} WHERE agent_id IS NULL`);
    console.log('Ensured OrchestrationRules table has agent_id.');


    // 5. Update Notes (Add agent_id)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Notes' AND COLUMN_NAME = 'agent_id')
      BEGIN
        ALTER TABLE Notes ADD agent_id INT;
        ALTER TABLE Notes ADD CONSTRAINT FK_Notes_Agents FOREIGN KEY (agent_id) REFERENCES Agents(id);
      END
    `);
    await pool.request().query(`UPDATE Notes SET agent_id = ${defaultAgentId} WHERE agent_id IS NULL`);
    console.log('Ensured Notes table has agent_id.');

    // Original Creation Logic (kept for safety / first run)
    // Create TextChunks table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='TextChunks' AND xtype='U')
      CREATE TABLE TextChunks (
        id INT IDENTITY(1,1) PRIMARY KEY,
        agent_id INT,
        content NVARCHAR(MAX) NOT NULL,
        position INT,
        created_at DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (agent_id) REFERENCES Agents(id)
      )
    `);

    // Create OrchestrationRules table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='OrchestrationRules' AND xtype='U')
      CREATE TABLE OrchestrationRules (
        id INT IDENTITY(1,1) PRIMARY KEY,
        agent_id INT,
        instruction NVARCHAR(MAX) NOT NULL,
        position INT,
        created_at DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (agent_id) REFERENCES Agents(id)
      )
    `);

    // Create Notes table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Notes' AND xtype='U')
      CREATE TABLE Notes (
        id INT IDENTITY(1,1) PRIMARY KEY,
        agent_id INT,
        text_chunk_id INT NULL,
        content NVARCHAR(MAX) NOT NULL,
        created_at DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (agent_id) REFERENCES Agents(id)
      )
    `);

    console.log('Database initialization complete.');
    process.exit(0);
  } catch (err) {
    console.error('Error initializing database:', err);
    process.exit(1);
  }
}

initDB();
