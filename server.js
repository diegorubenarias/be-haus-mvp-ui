const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Configuración de la Base de Datos ---
const db = new sqlite3.Database('./hotel_bookings.db', (err) => {
    if (err) {
        console.error('Error al abrir la base de datos', err.message);
    } else {
        console.log('Conectado a la base de datos SQLite.');
        db.run(`CREATE TABLE IF NOT EXISTS rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL
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
        seedDatabase(db);
    }
});

function seedDatabase(db) {
    // Insertar habitaciones (existía antes, se mantiene)
    db.get("SELECT COUNT(*) as count FROM rooms", (err, row) => {
        if (row && row.count === 0) {
            const rooms = ['101 Simple', '102 Doble', '103 Suite', '201 Simple', '202 Doble', '203 Doble Luxury', '301 Presidencial'];
            rooms.forEach(name => db.run('INSERT INTO rooms (name) VALUES (?)', [name]));
            console.log("Habitaciones iniciales insertadas.");
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
// ----------------------------------------

// --- Rutas de Frontend ---
// La ruta '/' seguirá sirviendo el login.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Rutas protegidas (temporalmente solo por redirección frontend)
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/planner.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'planner.html'));
});
// ----------------------------------------

// --- Rutas de API REST ---

// NUEVO: Endpoint de Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, user) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (user) {
            // Login exitoso. En una app real, aquí generarías un token JWT o iniciarías una sesión.
            res.status(200).json({ message: "Login exitoso", user: { id: user.id, username: user.username } });
        } else {
            res.status(401).json({ error: "Usuario o contraseña incorrectos" });
        }
    });
});


// Endpoints de habitaciones y reservas (sin cambios por ahora)
app.get('/api/rooms', (req, res) => { /* ... */ }); // (Mantener el código anterior)
app.get('/api/bookings', (req, res) => { /* ... */ }); // (Mantener el código anterior)
app.post('/api/bookings', (req, res) => { /* ... */ }); // (Mantener el código anterior)

// ----------------------------------------

// Mantenemos el app.listen de siempre
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
