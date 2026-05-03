
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = function(knex) {
  return knex.schema.createTable('transfers', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('consent_id').notNullable().references('id').inTable('consents');
    table.string('bank_id').notNullable().references('id').inTable('banks');
    table.decimal('amount', 18, 4).notNullable();
    table.string('currency').defaultTo('CVE');
    table.string('debtor_account').notNullable();
    table.string('creditor_account').notNullable();
    table.string('creditor_name').notNullable();
    table.string('mojaloop_transfer_id').nullable();
    table.jsonb('party_info').nullable();
    table.jsonb('quote_info').nullable();
    table.enum('status', ['INITIATED', 'PARTY_CONFIRMED', 'COMPLETED', 'FAILED', 'REJECTED']).defaultTo('INITIATED');
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = function(knex) {
  return knex.schema.dropTable('transfers');
};
