const sqlite3 = require('sqlite3').verbose();

// --- Configuración de la Base de Datos ---
const db = new sqlite3.Database('./hotel_bookings.db', (err) => {
    if (err) {
        console.error('Error al abrir la base de datos', err.message);
    } else {
        console.log('Conectado a la base de datos SQLite.');
        db.run(`CREATE TABLE IF NOT EXISTS rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT 'standard',
            price REAL NOT NULL DEFAULT 0.0,
            -- NUEVO: Estado de limpieza (clean, dirty, servicing)
            clean_status TEXT NOT NULL DEFAULT 'clean' 
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id INTEGER NOT NULL,
            client_name TEXT NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            status TEXT NOT NULL
        )`);
        // NUEVO: Tabla de usuarios
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL
        )`);
         db.run(`CREATE TABLE IF NOT EXISTS consumptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            booking_id INTEGER NOT NULL,
            description TEXT NOT NULL,
            amount REAL NOT NULL, -- El importe del consumo
            date TEXT NOT NULL
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS invoices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            booking_id INTEGER NOT NULL UNIQUE, -- Una factura por reserva
            invoice_number TEXT NOT NULL UNIQUE, -- Número de factura único (ej. A0001-000001)
            issue_date TEXT NOT NULL,
            total_amount REAL NOT NULL,
            details TEXT, -- Un campo JSON o texto para guardar los detalles de la línea (estadia y consumos)
            FOREIGN KEY(booking_id) REFERENCES bookings(id)
        );`);
        seedDatabase(db);
    }
});

function seedDatabase(db) {
    // Insertar habitaciones (existía antes, se mantiene)
    db.get("SELECT COUNT(*) as count FROM rooms", (err, row) => {
        if (row && row.count === 0) {
             const rooms = [
                ['BeH101', 'executive', 80.00], 
                ['BeH103', 'executive', 120.00], 
                ['BeH201', 'executive', 250.00], 
                ['BeH203', 'executive', 85.00], 
                ['BeH301', 'executive', 130.00], 
                ['BeH303', 'executive', 180.00], 
                ['BeH401', 'executive', 400.00],
                ['BeH102', 'studio', 80.00], 
                ['BeH104', 'studio', 120.00], 
                ['BeH204', 'studio', 250.00], 
                ['BeH202', 'studio', 85.00], 
                ['BeH302', 'studio', 130.00], 
                ['BeH304', 'studio', 180.00], 
                ['BeH402', 'studio', 400.00],
                ['BeH403', 'loft', 80.00], 
                ['De6-5D', 'studio', 120.00], 
                ['De6-6D', 'studio', 250.00], 
                ['De6-6C', 'executive', 85.00], 
                ['De6-7C', 'executive', 130.00], 
                ['De6-7E', 'executive', 180.00], 
                ['De6-11E', 'executive', 400.00],
                ['De4-9D', 'executive', 80.00], 
                ['De4-10D', 'executive', 120.00], 
                ['Mi3-1B', 'family', 250.00] 
            ];
            rooms.forEach(room => {
                db.run('INSERT INTO rooms (name, category, price) VALUES (?, ?, ?)', [room[0], room[1], room[2]]);
            });
            console.log("Habitaciones iniciales con precios insertadas.");
        }
    });

    // NUEVO: Insertar usuario inicial
    db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
        if (row && row.count === 0) {
            // NOTA: En producción usarías hashing (ej: bcrypt). Para este MVP, texto plano está bien.
            db.run('INSERT INTO users (username, password) VALUES (?, ?)', ['admin', '1234']);
            console.log("Usuario inicial 'admin'/'1234' insertado.");
        }
    });
}

module.exports = db;