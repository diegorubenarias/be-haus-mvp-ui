// src/config/database.js
const { Sequelize } = require('sequelize');

// Usamos variables de entorno para la conexión en Railway/Producción
// Si DATABASE_URL está definida (común en Railway), la usamos.
// De lo contrario, usamos SQLite local para desarrollo si es necesario.
const connectionString = process.env.DATABASE_URL || 'sqlite://hotel_bookings.db';

const sequelize = new Sequelize(connectionString, {
    dialect: process.env.DATABASE_URL ? 'postgres' : 'sqlite',
      logging: console.log, 
    dialectOptions: process.env.DATABASE_URL ? {
        ssl: {
            require: true,
            rejectUnauthorized: false // A veces necesario en entornos cloud como Railway/Heroku
        },
         pool: { // Ajustes de pool para evitar bloqueos silenciosos
            max: 5,
            min: 0,
            acquire: 30000, // 30 segundos para adquirir conexión
            idle: 10000     // 10 segundos de inactividad
        }
    } : {}
});

module.exports = sequelize;
