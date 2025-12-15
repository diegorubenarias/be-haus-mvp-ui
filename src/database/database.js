// src/config/database.js
const { Sequelize } = require('sequelize');

// Usamos variables de entorno para la conexión en Railway/Producción
// Si DATABASE_URL está definida (común en Railway), la usamos.
// De lo contrario, usamos SQLite local para desarrollo si es necesario.
const connectionString = process.env.DATABASE_URL || 'sqlite://hotel_bookings.db';

const sequelize = new Sequelize(connectionString, {
    dialect: process.env.DATABASE_URL ? 'postgres' : 'sqlite',
    logging: false, // Desactiva los logs SQL en consola
    dialectOptions: process.env.DATABASE_URL ? {
        ssl: {
            require: true,
            rejectUnauthorized: false // A veces necesario en entornos cloud como Railway/Heroku
        }
    } : {}
});

module.exports = sequelize;
