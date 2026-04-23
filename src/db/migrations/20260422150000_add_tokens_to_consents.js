/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = function(knex) {
  return knex.schema.table('consents', (table) => {
    table.string('bank_id').nullable();
    table.string('access_token').nullable();
    table.string('refresh_token').nullable();
    table.string('bank_user_id').nullable();
  })
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = function(knex) {
  return knex.schema.table('consents', (table) => {
    table.dropColumn('bank_id');
    table.dropColumn('access_token');
    table.dropColumn('refresh_token');
    table.dropColumn('bank_user_id');
  })
};
