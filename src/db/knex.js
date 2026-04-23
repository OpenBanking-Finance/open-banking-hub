import knex from 'knex'
import config from '../../knexfile.cjs'

const db = knex(config)

export default db
