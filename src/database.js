require('dotenv').config(); // Carga variables de entorno localmente
const { Pool } = require('pg'); // Importa el cliente de Postgres
const bcrypt = require('bcrypt');
const saltRounds = 10;

// Configuración de la base de datos usando variables de entorno de Railway
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.connect(err => {
    if (err) {
        console.error('Error connecting to the database', err.stack);
    } else {
        console.log('Conectado a la base de datos PostgreSQL.');
        setupDatabase();
    }
});

async function setupDatabase() {
    try {
        await pool.query(`drop table if exists invoices`);
        await pool.query(`drop table if exists consumptions`);
        await pool.query(`drop table if exists bookings`);
        await pool.query(`drop table if exists rooms`);
        await pool.query(`drop table if exists users`);
        await pool.query(`drop table if exists shifts`);
        await pool.query(`drop table if exists employees`);
        await pool.query(`drop table if exists expenses`);  
        
        await pool.query(`CREATE TABLE IF NOT EXISTS rooms (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT 'standard',
            price REAL NOT NULL DEFAULT 0.0,
            -- NUEVO: Estado de limpieza (clean, dirty, servicing)
            clean_status TEXT NOT NULL DEFAULT 'clean' 
        )`);
        await pool.query(`CREATE TABLE IF NOT EXISTS bookings (
            id SERIAL PRIMARY KEY,
            room_id INTEGER NOT NULL,
            client_name TEXT NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            status TEXT NOT NULL
        )`);
        // NUEVO: Tabla de usuarios
        await pool.query(`CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL
        )`);
         await pool.query(`CREATE TABLE IF NOT EXISTS consumptions (
            id SERIAL PRIMARY KEY,
            booking_id INTEGER NOT NULL,
            description TEXT NOT NULL,
            amount REAL NOT NULL, -- El importe del consumo
            date TEXT NOT NULL
        )`);
        await pool.query(`CREATE TABLE IF NOT EXISTS invoices (
            id SERIAL PRIMARY KEY,
            booking_id INTEGER NOT NULL UNIQUE, -- Una factura por reserva
            invoice_number TEXT NOT NULL UNIQUE, -- Número de factura único (ej. A0001-000001)
            issue_date TEXT NOT NULL,
            total_amount REAL NOT NULL,
            details TEXT, -- Un campo JSON o texto para guardar los detalles de la línea (estadia y consumos)
            payment_method TEXT NOT NULL DEFAULT 'Contado', 
            FOREIGN KEY(booking_id) REFERENCES bookings(id)
        );`);

        await pool.query(`CREATE TABLE IF NOT EXISTS employees (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'Operador',
            monthly_salary REAL NOT NULL
        );`);

        await pool.query(`CREATE TABLE IF NOT EXISTS shifts (
            id SERIAL PRIMARY KEY,
            employee_id INTEGER NOT NULL,
            shift_date TEXT NOT NULL, -- Formato YYYY-MM-DD
            shift_type TEXT NOT NULL, -- Ej: 'Mañana', 'Tarde', 'Noche', 'Soporte', 'Franco'
            FOREIGN KEY(employee_id) REFERENCES employees(id)
        );`);

        await pool.query(`CREATE TABLE IF NOT EXISTS expenses (
            id SERIAL PRIMARY KEY,
            description TEXT NOT NULL,
            amount REAL NOT NULL,
            date TEXT NOT NULL,
            category TEXT NOT NULL -- Ej: 'Servicios', 'Impuestos', 'Limpieza', 'Minibar'
        );
        `);
        
        const userCount = await pool.query('SELECT COUNT(*) AS count FROM users');
        if (userCount.rows[0].count == 0) {
            const hashedPassword = bcrypt.hashSync('1234', saltRounds);
            await pool.query('INSERT INTO users (username, password) VALUES ($1, $2)', ['admin', hashedPassword]);
            console.log("Usuario inicial 'admin' insertado.");
        }
        const roomCount = await pool.query('SELECT COUNT(*) AS count FROM rooms');
        if (roomCount.rows[0].count == 0) {
            const insertRoomText = 'INSERT INTO rooms (name, category, price, clean_status) VALUES ($1, $2, $3, $4)';
             const rooms = [
                ['BeH101', 'executive', 80.00, 'clean'], 
                ['BeH103', 'executive', 120.00, 'clean'], 
                ['BeH201', 'executive', 250.00, 'clean'], 
                ['BeH203', 'executive', 85.00, 'clean'], 
                ['BeH301', 'executive', 130.00, 'clean'], 
                ['BeH303', 'executive', 180.00, 'clean'], 
                ['BeH401', 'executive', 400.00, 'clean'],
                ['BeH102', 'studio', 80.00, 'clean'], 
                ['BeH104', 'studio', 120.00, 'clean'], 
                ['BeH204', 'studio', 250.00, 'clean'], 
                ['BeH202', 'studio', 85.00, 'clean'], 
                ['BeH302', 'studio', 130.00, 'clean'], 
                ['BeH304', 'studio', 180.00, 'clean'], 
                ['BeH402', 'studio', 400.00, 'clean'],
                ['BeH403', 'loft', 80.00, 'clean'], 
                ['De6-5D', 'studio', 120.00, 'clean'], 
                ['De6-6D', 'studio', 250.00, 'clean'], 
                ['De6-6C', 'executive', 85.00, 'clean'], 
                ['De6-7C', 'executive', 130.00, 'clean'], 
                ['De6-7E', 'executive', 180.00, 'clean'], 
                ['De6-11E', 'executive', 400.00, 'clean'],
                ['De4-9D', 'executive', 80.00, 'clean'], 
                ['De4-10D', 'executive', 120.00, 'clean'], 
                ['Mi3-1B', 'family', 250.00, 'clean'] 
            ];
            for (const room of rooms) {
                await pool.query(insertRoomText, room);
            }
            console.log("Habitaciones iniciales insertadas.");
        }

        console.log('Base de datos configurada correctamente.');
    } catch (err) { 

        console.error('Error setting up the database', err);
    }
}


module.exports = pool;