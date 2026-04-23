const dotenv = require('dotenv');
const path = require('path');

// Carrega o .env local
dotenv.config({ path: path.resolve(__dirname, './.env') });

module.exports = {
  client: 'postgresql',
  connection: {
    host: '127.0.0.1',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASS
  },
  pool: {
    min: 2,
    max: 10
  },
  migrations: {
    directory: './src/db/migrations',
    tableName: 'knex_migrations'
  }
};
