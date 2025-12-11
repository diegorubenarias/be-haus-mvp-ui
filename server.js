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

app.get('/prices.html', authenticateMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'prices.html'));
});

app.get('/invoices.html', authenticateMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'invoices.html'));
});

app.get('/invoice-detail.html', authenticateMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'invoice-detail.html'));
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
// Endpoint para crear una nueva reserva (ACTUALIZADO P1/P3)
app.post('/api/bookings', authenticateMiddleware, (req, res) => {
    const { room_id, client_name, start_date, end_date, status } = req.body;

    if (!room_id || !client_name || !start_date || !end_date || !status) {
        return res.status(400).json({ error: "Faltan campos requeridos." });
    }
    
    // Primero, obtenemos el precio actual de la habitación
    db.get("SELECT price FROM rooms WHERE id = ?", [room_id], (err, room) => {
        if (err || !room) {
            return res.status(404).json({ error: "Habitación no encontrada o error de precio." });
        }
        const price_per_night = room.price; // Capturamos el precio actual

        // Lógica de validación de superposición... (mantenemos la misma lógica que tenías)
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
                res.status(409).json({ error: "Conflicto de reserva: La habitación ya está ocupada o reservada en esas fechas." });
                return;
            }

            // Si no hay superposición, procede con la inserción, incluyendo el nuevo campo price_per_night
            const insert = 'INSERT INTO bookings (room_id, client_name, start_date, end_date, status, price_per_night) VALUES (?,?,?,?,?,?)';
            db.run(insert, [room_id, client_name, start_date, end_date, status, price_per_night], function (err) {
                if (err) {
                    res.status(400).json({"error": err.message});
                    return;
                }
                res.status(201).json({
                    message: "Reserva creada exitosamente",
                    data: req.body,
                    id: this.lastID,
                    price_per_night: price_per_night // Devolvemos el precio usado
                });
            });
        });
    });
});

// Endpoint para ACTUALIZAR una reserva existente (ACTUALIZADO P1/P3)
app.put('/api/bookings/:id', authenticateMiddleware, (req, res) => {
    // Aceptamos price_per_night como un campo actualizable
    const { room_id, client_name, start_date, end_date, status, price_per_night } = req.body;
    const { id } = req.params;

    if (!room_id || !client_name || !start_date || !end_date || !status) {
        return res.status(400).json({ error: "Faltan campos requeridos." });
    }

    // Usamos COALESCE para solo actualizar price_per_night si se proporciona en el body, 
    // manteniendo el valor anterior si no se especifica.
    const update = `UPDATE bookings SET room_id = ?, client_name = ?, start_date = ?, end_date = ?, status = ?, price_per_night = COALESCE(?, price_per_night) WHERE id = ?`;
    
    // Pasamos price_per_night como un parámetro más
    db.run(update, [room_id, client_name, start_date, end_date, status, price_per_night, id], function (err) {
        if (err) {
            res.status(400).json({"error": err.message});
            return;
        }
        if (this.changes > 0) {
            res.status(200).json({ message: "Reserva actualizada exitosamente", changes: this.changes });
        } else {
            res.status(404).json({ error: "Reserva no encontrada." });
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

// --- Rutas de API REST para Consumos (NUEVO P1.1) ---

// Endpoint para obtener consumos de una reserva específica
app.get('/api/bookings/:bookingId/consumptions', authenticateMiddleware, (req, res) => {
    const { bookingId } = req.params;
    db.all("SELECT * FROM consumptions WHERE booking_id = ?", [bookingId], (err, rows) => {
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

// Endpoint para añadir un nuevo consumo
app.post('/api/consumptions', authenticateMiddleware, (req, res) => {
    const { booking_id, description, amount, date } = req.body;
    if (!booking_id || !description || !amount || !date) {
        return res.status(400).json({ error: "Faltan campos requeridos." });
    }
    const insert = 'INSERT INTO consumptions (booking_id, description, amount, date) VALUES (?,?,?,?)';
    db.run(insert, [booking_id, description, amount, date], function (err) {
        if (err) {
            res.status(400).json({"error": err.message});
            return;
        }
        res.status(201).json({
            message: "Consumo añadido exitosamente",
            data: req.body,
            id: this.lastID
        });
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

app.put('/api/rooms/:id/price', authenticateMiddleware, (req, res) => {
    const { price } = req.body;
    const { id } = req.params;

    if (typeof price !== 'number' || price < 0) {
        return res.status(400).json({ error: "El precio debe ser un número positivo." });
    }

    db.run('UPDATE rooms SET price = ? WHERE id = ?', [price, id], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes > 0) {
            res.status(200).json({ message: "Precio de habitación actualizado exitosamente.", changes: this.changes });
        } else {
            res.status(404).json({ error: "Habitación no encontrada." });
        }
    });
});

// Endpoint para GENERAR una factura a partir de una reserva (NUEVO P1.1)
app.post('/api/invoices/generate/:bookingId', authenticateMiddleware, (req, res) => {
    const { bookingId } = req.params;

    // 1. Necesitamos OBTENER todos los datos: reserva, consumos, precio/noche
    db.get("SELECT * FROM bookings WHERE id = ?", [bookingId], (err, booking) => {
        if (err || !booking) {
            return res.status(404).json({ error: "Reserva no encontrada." });
        }

        db.all("SELECT * FROM consumptions WHERE booking_id = ?", [bookingId], (err, consumptions) => {
            if (err) {
                return res.status(500).json({ error: "Error al obtener consumos." });
            }

            // Validar que el check-out ya se realizó antes de facturar (opcional, pero buena práctica)
            if (booking.status !== 'checked-out') {
                return res.status(400).json({ error: "No se puede facturar una reserva que no ha completado el check-out." });
            }

            // 2. Calcular el total (la lógica ya la tenemos en el frontend, aquí la replicamos en backend por seguridad/integridad)
            const startDate = new Date(booking.start_date + 'T00:00:00Z');
            const endDate = new Date(booking.end_date + 'T00:00:00Z');
            const durationDays = Math.ceil(Math.abs(endDate - startDate) / (1000 * 60 * 60 * 24));
            const stayCost = durationDays * booking.price_per_night;
            const consumptionsTotal = consumptions.reduce((sum, item) => sum + item.amount, 0);
            const totalAmount = stayCost + consumptionsTotal;

            // Preparamos detalles para guardar como JSON en la factura
            const invoiceDetails = JSON.stringify({
                stay: { description: `Estadía ${durationDays} noches`, amount: stayCost },
                consumptions: consumptions.map(c => ({ description: c.description, amount: c.amount }))
            });

            // 3. Generar un número de factura simple para MVP (ej: INV-YYYYMMDD-BOOKINGID)
            const issueDate = new Date().toISOString().split('T')[0];
            const invoiceNumber = `INV-${issueDate.replace(/-/g, '')}-${bookingId}`;

            // 4. Insertar la factura
            const insert = 'INSERT INTO invoices (booking_id, invoice_number, issue_date, total_amount, details) VALUES (?, ?, ?, ?, ?)';
            db.run(insert, [bookingId, invoiceNumber, issueDate, totalAmount, invoiceDetails], function (err) {
                if (err) {
                    // Esto puede ocurrir si intentan facturar la misma reserva dos veces (UNIQUE constraint)
                    return res.status(409).json({ error: "La reserva ya tiene una factura generada.", invoiceId: this.lastID });
                }
                res.status(201).json({
                    message: "Factura generada exitosamente",
                    invoiceId: this.lastID,
                    invoiceNumber: invoiceNumber,
                    totalAmount: totalAmount
                });
            });
        });
    });
});

// Endpoint para obtener una factura específica por su ID (NUEVO P1.1)
app.get('/api/invoices/:id', authenticateMiddleware, (req, res) => {
    const { id } = req.params;
    db.get("SELECT * FROM invoices WHERE id = ?", [id], (err, invoice) => {
        if (err || !invoice) {
            res.status(404).json({ error: "Factura no encontrada." });
            return;
        }
        // Parseamos los detalles JSON antes de enviarlos al frontend
        invoice.details = JSON.parse(invoice.details);
        res.json(invoice);
    });
});

// Endpoint para listar TODAS las facturas (NUEVO P1.1)
app.get('/api/invoices', authenticateMiddleware, (req, res) => {
    // Para el listado general, no necesitamos los 'details' completos, solo un resumen
    db.all("SELECT id, booking_id, invoice_number, issue_date, total_amount FROM invoices ORDER BY issue_date DESC", [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ data: rows });
    });
});


// ----------------------------------------

// Mantenemos el app.listen de siempre
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
