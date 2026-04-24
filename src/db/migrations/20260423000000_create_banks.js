/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = function(knex) {
  return knex.schema.createTable('banks', (table) => {
    table.string('id').primary(); 
    table.string('name').notNullable();
    table.string('authorise_url').notNullable();
    table.string('api_url').notNullable();
    table.string('jwks_url').nullable();         // URL to fetch the bank's public keys
    table.string('status').defaultTo('active');
    table.timestamps(true, true);
  }).then(() => {
    // Only seed default banks if SEED_DEMO_DATA is true
    if (process.env.SEED_DEMO_DATA === 'true') {
      return knex('banks').insert([
        { 
          id: 'alpha-bank-001', 
          name: 'MockBank Alpha', 
          authorise_url: 'http://127.0.0.1:3001/consents/authorise',
          api_url: 'http://127.0.0.1:3001',
          status: 'active'
        },
        { 
          id: 'beta-bank-002', 
          name: 'MockBank Beta', 
          authorise_url: 'http://127.0.0.1:3002/consents/authorise',
          api_url: 'http://127.0.0.1:3002',
          status: 'active'
        }
      ]);
    }
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = function(knex) {
  return knex.schema.dropTable('banks');
};
