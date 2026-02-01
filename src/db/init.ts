import { getPool } from './index';

async function initDB() {
  try {
    const pool = await getPool();
    console.log('Connected to database.');

    // Create TextChunks table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='TextChunks' AND xtype='U')
      CREATE TABLE TextChunks (
        id INT IDENTITY(1,1) PRIMARY KEY,
        content NVARCHAR(MAX) NOT NULL,
        created_at DATETIME2 DEFAULT GETDATE()
      )
    `);
    console.log('Ensured TextChunks table exists.');

    // Create OrchestrationRules table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='OrchestrationRules' AND xtype='U')
      CREATE TABLE OrchestrationRules (
        id INT IDENTITY(1,1) PRIMARY KEY,
        instruction NVARCHAR(MAX) NOT NULL,
        created_at DATETIME2 DEFAULT GETDATE()
      )
    `);
    console.log('Ensured OrchestrationRules table exists.');

    // Create Notes table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Notes' AND xtype='U')
      CREATE TABLE Notes (
        id INT IDENTITY(1,1) PRIMARY KEY,
        text_chunk_id INT NULL, -- Can be null if it's a general note or linked to a rule, but spec says linked to processing
        content NVARCHAR(MAX) NOT NULL,
        created_at DATETIME2 DEFAULT GETDATE()
      )
    `);
    console.log('Ensured Notes table exists.');

    console.log('Database initialization complete.');
    process.exit(0);
  } catch (err) {
    console.error('Error initializing database:', err);
    process.exit(1);
  }
}

initDB();
