const { Sequelize } = require('sequelize');
const path = require('path');

let sequelize;

if (process.env.DATABASE_URL) {
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
    logging: false,
  });
} else {
  const dbPath = process.env.DB_PATH || './database.sqlite';
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.resolve(dbPath),
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
  });
}

module.exports = { sequelize };
