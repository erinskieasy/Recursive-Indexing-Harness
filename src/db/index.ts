import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const connectionString = process.env.AZURE_SQL_CONNECTION_STRING;

if (!connectionString) {
  console.error('AZURE_SQL_CONNECTION_STRING is not defined in .env');
  process.exit(1);
}

const config: sql.config = {
  // Parse connection string logic is handled better by mssql direct string usage or parsing it manually
  // Using connection string directly
  server: '', // Placeholder, will be parsed or overriden by string
  authentication: {
    type: 'default',
    options: {
      userName: '',
      password: '',
    }
  },
  options: {
    encrypt: true,
    trustServerCertificate: false,
  }
};

// Singleton pool
let pool: sql.ConnectionPool | null = null;

export async function getPool() {
  if (pool) return pool;
  
  try {
     // mssql connect can take a connection string directly
    pool = await sql.connect(connectionString!);
    return pool;
  } catch (err) {
    console.error('Database connection failed:', err);
    throw err;
  }
}

export { sql };
