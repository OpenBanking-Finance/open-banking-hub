/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = function(knex) {
  return knex.schema.alterTable('consents', (table) => {
    table.text('access_token').alter();
    table.text('refresh_token').alter();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = function(knex) {
  return knex.schema.alterTable('consents', (table) => {
    table.string('access_token', 255).alter();
    table.string('refresh_token', 255).alter();
  });
};
