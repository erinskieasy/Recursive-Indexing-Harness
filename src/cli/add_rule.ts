import { getPool, sql } from '../db';

async function addRule() {
    const instruction = process.argv[2];

    if (!instruction) {
        console.error('Usage: npx tsx src/cli/add_rule.ts "Rule content"');
        process.exit(1);
    }

    try {
        const pool = await getPool();
        await pool.request()
            .input('instruction', sql.NVarChar(sql.MAX), instruction)
            .query('INSERT INTO OrchestrationRules (instruction) VALUES (@instruction)');

        console.log('Orchestration rule added successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error adding orchestration rule:', err);
        process.exit(1);
    }
}

addRule();
