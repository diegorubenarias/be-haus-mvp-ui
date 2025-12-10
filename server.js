const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const cookieParser = require('cookie-parser'); 
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// --- Configuración de la Base de Datos ---
const db = new sqlite3.Database('./hotel_bookings.db', (err) => {
    if (err) {
        console.error('Error al abrir la base de datos', err.message);
    } else {
        console.log('Conectado a la base de datos SQLite.');
        db.run(`CREATE TABLE IF NOT EXISTS rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price REAL NOT NULL DEFAULT 0.0,
            -- NUEVO: Estado de limpieza (clean, dirty, servicing)
            clean_status TEXT NOT NULL DEFAULT 'dirty' 
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
        seedDatabase(db);
    }
});

function seedDatabase(db) {
    // Insertar habitaciones (existía antes, se mantiene)
    db.get("SELECT COUNT(*) as count FROM rooms", (err, row) => {
        if (row && row.count === 0) {
             const rooms = [
                ['101 Simple', 80.00], 
                ['102 Doble', 120.00], 
                ['103 Suite', 250.00], 
                ['201 Simple', 85.00], 
                ['202 Doble', 130.00], 
                ['203 Doble Luxury', 180.00], 
                ['301 Presidencial', 400.00]
            ];
            rooms.forEach(room => {
                db.run('INSERT INTO rooms (name, price) VALUES (?, ?)', [room[0], room[1]]);
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
// ----------------------------------------
// --- MIDDLEWARE de Autenticación (NUEVO) ---
function authenticateMiddleware(req, res, next) {
    // En un sistema real usarías un token JWT, aquí usamos un ID de usuario simple en la cookie
    if (req.cookies && req.cookies.user_id) {
        // Podrías verificar si el user_id existe en la BD aquí para mayor seguridad
        next(); // El usuario está autenticado, continuar con la ruta solicitada
    } else {
        // No autenticado, redirigir al login
        res.redirect('/');
    }
}

// --- Rutas de Frontend ---
// La ruta '/' seguirá sirviendo el login.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Rutas protegidas (temporalmente solo por redirección frontend)
app.get('/dashboard', authenticateMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/planner.html', authenticateMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'planner.html'));
});

app.get('/reports.html', authenticateMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'reports.html'));
});

app.get('/housekeeping.html', authenticateMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'housekeeping.html'));
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
            res.cookie('user_id', user.id, { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 }); // Expira en 1 día
            res.status(200).json({ message: "Login exitoso", user: { id: user.id, username: user.username } });
        } else {
            res.status(401).json({ error: "Usuario o contraseña incorrectos" });
        }
    });
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('user_id');
    res.status(200).json({ message: "Sesión cerrada exitosamente" });
});

// Endpoints de habitaciones y reservas (sin cambios por ahora)
// Endpoint para obtener todas las habitaciones
app.get('/api/rooms', authenticateMiddleware, (req, res) => {
    db.all("SELECT * FROM rooms", [], (err, rows) => {
        if (err) {
            res.status(400).json({"error":err.message});
            return;
        }
        res.json({
            message: "success",
            data: rows
        });
    });
});
app.get('/api/bookings', authenticateMiddleware,(req, res) => {
    db.all("SELECT * FROM bookings", [], (err, rows) => {
        if (err) {
            res.status(400).json({"error":err.message});
            return;
        }
        res.json({
            message: "success",
            data: rows
        });
    });
});

// Endpoint para crear una nueva reserva (ACTUALIZADO CON VALIDACIÓN)
app.post('/api/bookings', authenticateMiddleware,(req, res) => {
    const { room_id, client_name, start_date, end_date, status } = req.body;

    if (!room_id || !client_name || !start_date || !end_date || !status) {
        return res.status(400).json({ error: "Faltan campos requeridos." });
    }
    
    // Lógica de validación de superposición:
    // Busca reservas existentes para la misma habitación que se superpongan con las fechas solicitadas.
    const query = `SELECT COUNT(*) as count FROM bookings 
                   WHERE room_id = ? 
                   AND (
                       (start_date BETWEEN ? AND ?) OR 
                       (end_date BETWEEN ? AND ?) OR
                       (? BETWEEN start_date AND end_date) OR
                       (? BETWEEN start_date AND end_date)
                   )`;
    
    db.get(query, [room_id, start_date, end_date, start_date, end_date, start_date, end_date], (err, row) => {
        if (err) {
            res.status(500).json({"error": err.message});
            return;
        }

        if (row.count > 0) {
            // Si count es mayor que 0, hay una superposición.
            res.status(409).json({ error: "Conflicto de reserva: La habitación ya está ocupada o reservada en esas fechas." });
            return;
        }

        // Si no hay superposición, procede con la inserción.
        const insert = 'INSERT INTO bookings (room_id, client_name, start_date, end_date, status) VALUES (?,?,?,?,?)';
        db.run(insert, [room_id, client_name, start_date, end_date, status], function (err) {
            if (err) {
                res.status(400).json({"error": err.message});
                return;
            }
            res.status(201).json({
                message: "Reserva creada exitosamente",
                data: req.body,
                id: this.lastID
            });
        });
    });
});

// Endpoint para ACTUALIZAR una reserva existente
// ... dentro de server.js ...

// Endpoint para ACTUALIZAR una reserva existente (ACTUALIZADO CON VALIDACIÓN)
// ... dentro de server.js ...

// Endpoint para ACTUALIZAR una reserva existente (ACTUALIZADO con lógica de Check-In/Out)
app.put('/api/bookings/:id', authenticateMiddleware, (req, res) => {
    const { client_name, start_date, end_date, status, room_id } = req.body;
    const { id } = req.params; 

    // Lógica de validación de superposición (se mantiene igual, excluyendo la reserva actual)
    // ... (Mantener la lógica overlapQuery y db.get(...) de validación de superposición aquí) ...
    const overlapQuery = `
        SELECT COUNT(*) as count FROM bookings 
        WHERE room_id = ? 
        AND id <> ?
        AND (
            (start_date BETWEEN ? AND ?) OR 
            (end_date BETWEEN ? AND ?) OR
            (? BETWEEN start_date AND end_date) OR
            (? BETWEEN start_date AND end_date)
        )`;
    
    db.get(overlapQuery, [room_id, id, start_date, end_date, start_date, end_date, start_date, end_date], (err, row) => {
        if (err) return res.status(500).json({"error": err.message});
        if (row.count > 0) {
            return res.status(409).json({ error: "Conflicto de reserva: La habitación ya está ocupada por otra reserva en esas fechas." });
        }

        // Lógica de Check-Out: Si el nuevo estado es 'checked-out', ensuciar la habitación.
        if (status === 'checked-out') {
            const updateRoomQuery = `UPDATE rooms SET clean_status = 'dirty' WHERE id = ?`;
            db.run(updateRoomQuery, [room_id], (err) => {
                if (err) console.error("Error al actualizar estado de limpieza durante check-out:", err.message);
                // Continúa con la actualización de la reserva
                finalizeBookingUpdate(id, client_name, start_date, end_date, status, room_id, res);
            });
        } else {
            // Para otros estados (reserved, occupied/checked-in), solo actualiza la reserva
            finalizeBookingUpdate(id, client_name, start_date, end_date, status, room_id, res);
        }
    });
});

// Función auxiliar para finalizar la actualización de la reserva
function finalizeBookingUpdate(id, client_name, start_date, end_date, status, room_id, res) {
    const updateQuery = `UPDATE bookings SET client_name = ?, start_date = ?, end_date = ?, status = ?, room_id = ? WHERE id = ?`;
    db.run(updateQuery, [client_name, start_date, end_date, status, room_id, id], function (err) {
        if (err) return res.status(400).json({"error": err.message});
        res.json({ message: "Reserva actualizada exitosamente.", changes: this.changes });
    });
}

// Endpoint para ELIMINAR una reserva
// ... dentro de server.js ...

// Endpoint para ELIMINAR/CANCELAR una reserva (SOLO PREVIO AL CHECK-IN)
app.delete('/api/bookings/:id', authenticateMiddleware, (req, res) => {
    const { id } = req.params;

    // Verificar el estado actual antes de eliminar
    db.get('SELECT status, room_id FROM bookings WHERE id = ?', [id], (err, row) => {
        if (err) return res.status(500).json({ "error": err.message });
        if (!row) return res.status(404).json({ "error": "Reserva no encontrada." });

        if (row.status === 'occupied' || row.status === 'checked-in') {
            return res.status(403).json({ "error": "No se puede cancelar una reserva con check-in realizado. Use el proceso de check-out." });
        }

        // Si es 'reserved' o 'liberated', se puede eliminar (cancelar)
        db.run('DELETE FROM bookings WHERE id = ?', id, function (err) {
            if (err) return res.status(400).json({ "error": err.message });
            res.json({ message: "Reserva cancelada exitosamente.", changes: this.changes });
        });
    });
});

// ... dentro de server.js, en la sección de API REST ...

// Endpoint para obtener consumos de una reserva específica
app.get('/api/consumptions/:bookingId', authenticateMiddleware, (req, res) => {
    const { bookingId } = req.params;
    db.all("SELECT * FROM consumptions WHERE booking_id = ?", [bookingId], (err, rows) => {
        if (err) {
            res.status(400).json({"error":err.message});
            return;
        }
        res.json({ data: rows });
    });
});

// Endpoint para añadir un consumo
app.post('/api/consumptions', authenticateMiddleware, (req, res) => {
    const { booking_id, description, amount, date } = req.body;
    const insert = 'INSERT INTO consumptions (booking_id, description, amount, date) VALUES (?,?,?,?)';
    db.run(insert, [booking_id, description, amount, date], function (err) {
        if (err) {
            res.status(400).json({"error": err.message});
            return;
        }
        res.status(201).json({ id: this.lastID, message: "Consumo agregado." });
    });
});

app.put('/api/rooms/status/:roomId', authenticateMiddleware, (req, res) => {
    const { clean_status } = req.body;
    const { roomId } = req.params;

    if (!clean_status) {
        return res.status(400).json({ error: "Falta el estado de limpieza." });
    }

    const query = `UPDATE rooms SET clean_status = ? WHERE id = ?`;
    db.run(query, [clean_status, roomId], function (err) {
        if (err) {
            res.status(400).json({"error": err.message});
            return;
        }
        res.json({ message: "Estado de limpieza actualizado.", changes: this.changes });
    });
});




// ----------------------------------------

// Mantenemos el app.listen de siempre
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
