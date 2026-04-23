/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = function(knex) {
  return knex.schema.createTable('consents', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid())
    table.string('user_id').notNullable().index() // Keycloak 'sub'
    table.enum('status', [
      'AWAITING_AUTHORISATION',
      'AUTHORISED',
      'REJECTED',
      'REVOKED'
    ]).defaultTo('AWAITING_AUTHORISATION')
    table.jsonb('permissions').notNullable()
    table.timestamp('expiration_date')
    table.timestamps(true, true) // created_at, updated_at
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = function(knex) {
  return knex.schema.dropTable('consents')
}
