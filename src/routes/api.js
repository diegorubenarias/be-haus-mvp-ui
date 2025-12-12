// src/routes/api.js
const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateMiddleware } = require('../auth');
const bcrypt = require('bcrypt');
const saltRounds = 10; // Mismo nivel de seguridad que en database.js

// Aplicamos el middleware de autenticación a todas las rutas de este router por defecto
router.use(authenticateMiddleware);


// Endpoints de habitaciones y reservas (sin cambios por ahora)
// Endpoint para obtener todas las habitaciones
router.get('/rooms', (req, res) => {
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
router.get('/bookings',(req, res) => {
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
router.post('/bookings', (req, res) => {
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
router.put('/bookings/:id', (req, res) => {
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

// Endpoint para obtener una reserva específica por su ID (NUEVO)
router.get('/bookings/:id', (req, res) => {
    const { id } = req.params;
    db.get("SELECT * FROM bookings WHERE id = ?", [id], (err, row) => {
        if (err) {
            res.status(400).json({"error":err.message});
            return;
        }
        if (row) {
            res.json({
                message: "success",
                data: row // Devuelve un solo objeto de reserva, no un array
            });
        } else {
            res.status(404).json({"error": "Reserva no encontrada."});
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

router.delete('/bookings/:id', (req, res) => {
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
router.get('/consumptions/:bookingId', (req, res) => {
    const { bookingId } = req.params;
    db.all("SELECT * FROM consumptions WHERE booking_id = ?", [bookingId], (err, rows) => {
        if (err) {
            res.status(400).json({"error":err.message});
            return;
        }
        res.json({ data: rows });
    });
});

// Endpoint para obtener consumos de una reserva específica
router.get('/bookings/:bookingId/consumptions', (req, res) => {
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
router.post('/consumptions', (req, res) => {
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

router.put('/rooms/status/:roomId', (req, res) => {
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

router.put('/rooms/:id/price', (req, res) => {
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
router.post('/invoices/generate/:bookingId', (req, res) => {
    const { bookingId } = req.params;
    const { payment_method } = req.body; 

    if (!payment_method) {
        return res.status(400).json({ error: "Se requiere el método de pago." });
    }

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

             // 4. Insertar la factura (MODIFICADO: añadimos payment_method)
            const insert = 'INSERT INTO invoices (booking_id, invoice_number, issue_date, total_amount, details, payment_method) VALUES (?, ?, ?, ?, ?, ?)';
            // Pasamos payment_method como parámetro adicional
            db.run(insert, [bookingId, invoiceNumber, issueDate, totalAmount, invoiceDetails, payment_method], function (err) {
                if (err) { return res.status(409).json({ error: "La reserva ya tiene una factura generada.", invoiceId: this.lastID }); }
                
                // ... (Lógica de actualizar estado de limpieza a 'dirty' se mantiene igual) ...
                db.run('UPDATE rooms SET clean_status = ? WHERE id = ?', ['dirty', booking.room_id], (updateErr) => {
                    if (updateErr) console.error("Advertencia: No se pudo actualizar el estado de limpieza de la habitación:", updateErr.message);
                    
                    res.status(201).json({
                        message: "Factura generada y habitación marcada como sucia.",
                        invoiceId: this.lastID,
                        invoiceNumber: invoiceNumber,
                        totalAmount: totalAmount,
                        roomStatusUpdatedTo: 'dirty',
                        paymentMethodUsed: payment_method // Devolvemos el método usado
                    });
                });
            });
        });
    });
});

// Endpoint para obtener una factura específica por su ID (NUEVO P1.1)
router.get('/invoices/:id', (req, res) => {
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
router.get('/invoices', (req, res) => {
    // Para el listado general, no necesitamos los 'details' completos, solo un resumen
    db.all("SELECT id, booking_id, invoice_number, issue_date, total_amount FROM invoices ORDER BY issue_date DESC", [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ data: rows });
    });
});

/**** GASTOS */
// --- Endpoints de Empleados (Employees) (P7) ---
router.get('/employees', (req, res) => {
    db.all("SELECT * FROM employees", [], (err, rows) => {
        if (err) { res.status(500).json({ error: err.message }); return; }
        res.json({ data: rows });
    });
});
router.post('/employees', (req, res) => {
    const { name, role, monthly_salary } = req.body;
    if (!name || !role || !monthly_salary) { return res.status(400).json({ error: "Faltan campos requeridos." }); }
    db.run('INSERT INTO employees (name, role, monthly_salary) VALUES (?, ?, ?)', [name, role, monthly_salary], function (err) {
        if (err) { res.status(400).json({ error: err.message }); return; }
        res.status(201).json({ message: "Empleado añadido.", id: this.lastID });
    });
});

router.put('/employees/:id', (req, res) => {
    const { name, role, monthly_salary } = req.body;
    db.run('UPDATE employees SET name = ?, role = ?, monthly_salary = ? WHERE id = ?', [name, role, monthly_salary, req.params.id], function (err) {
        if (err) { res.status(400).json({ error: err.message }); return; }
        res.status(200).json({ message: "Empleado actualizado.", changes: this.changes });
    });
});

router.delete('/employees/:id', (req, res) => {
    db.run('DELETE FROM employees WHERE id = ?', req.params.id, function (err) {
        if (err) { res.status(400).json({ error: err.message }); return; }
        res.status(200).json({ message: "Empleado eliminado.", changes: this.changes });
    });
});

// Obtener turnos para un mes específico (ej: ?year=2023&month=10)
router.get('/shifts', (req, res) => {
    const { year, month } = req.query; 
    if (!year || !month) { return res.status(400).json({ error: "Se requieren año y mes." }); }
    const startDate = `${year}-${month}-01`;
    const endDate = `${year}-${month}-31`; // Simplificado para el mes

    db.all("SELECT * FROM shifts WHERE shift_date BETWEEN ? AND ?", [startDate, endDate], (err, rows) => {
        if (err) { res.status(500).json({ error: err.message }); return; }
        res.json({ data: rows });
    });
});


// Planificar o actualizar un turno (POST para simplificar, idempotente)
router.post('/shifts', (req, res) => {
    const { employee_id, shift_date, shift_type } = req.body;
    if (!employee_id || !shift_date || !shift_type) { return res.status(400).json({ error: "Faltan campos requeridos." }); }
    
    // Usamos INSERT OR REPLACE para que si el turno ya existe para esa fecha/empleado, se actualice
    const query = `INSERT OR REPLACE INTO shifts (employee_id, shift_date, shift_type) VALUES (?, ?, ?)`;
    db.run(query, [employee_id, shift_date, shift_type], function (err) {
        if (err) { res.status(400).json({ error: err.message }); return; }
        res.status(201).json({ message: "Turno guardado.", id: this.lastID });
    });
});

// Puedes añadir endpoints POST, PUT, DELETE para empleados si lo necesitas más adelante (CRUD completo)
// Pero por ahora GET es suficiente para el reporte.


// --- Endpoints de Gastos (Expenses) (P7) ---
router.get('/expenses', (req, res) => {
    // Retornamos todos los gastos por ahora
    db.all("SELECT * FROM expenses ORDER BY date DESC", [], (err, rows) => {
        if (err) { res.status(500).json({ error: err.message }); return; }
        res.json({ data: rows });
    });
});

router.post('/expenses', (req, res) => {
    const { description, amount, date, category } = req.body;
    if (!description || !amount || !date || !category) { return res.status(400).json({ error: "Faltan campos requeridos." }); }
    const insert = 'INSERT INTO expenses (description, amount, date, category) VALUES (?, ?, ?, ?)';
    db.run(insert, [description, amount, date, category], function (err) {
        if (err) { res.status(400).json({ error: err.message }); return; }
        res.status(201).json({ message: "Gasto añadido exitosamente", id: this.lastID });
    });
});

// --- Endpoint de Reporte de Ganancias Mensual (P7) ---
router.get('/reports/profit-loss', (req, res) => {
    const { year, month } = req.query; // Esperamos year=YYYY, month=MM (ej: 01 para enero)

    if (!year || !month) {
        return res.status(400).json({ error: "Se requieren los parámetros 'year' y 'month'." });
    }

    // SQLite usa formato TEXT YYYY-MM-DD. Filtramos por rango de fechas.
    const startDate = `${year}-${month}-01`;
    // Calcular el último día del mes (un poco complejo en SQL puro, más fácil en JS)
    const lastDay = new Date(year, month, 0).getDate(); 
    const endDate = `${year}-${month}-${lastDay}`;
    
    const responseData = {
        period: `${year}-${month}`,
        invoicesTotal: 0,
        expensesTotal: 0,
        salariesTotal: 0,
        profit: 0
    };

    // 1. Calcular Ingresos (Total Facturado en el mes)
    const invoicesQuery = `SELECT SUM(total_amount) as total FROM invoices WHERE issue_date BETWEEN ? AND ?`;
    db.get(invoicesQuery, [startDate, endDate], (err, row) => {
        if (err) return res.status(500).json({ error: "en invoice query" });
        responseData.invoicesTotal = row.total || 0;

        // 2. Calcular Gastos Operativos (en el mes)
        const expensesQuery = `SELECT SUM(amount) as total FROM expenses WHERE date BETWEEN ? AND ?`;
        db.get(expensesQuery, [startDate, endDate], (err, row) => {
            if (err) return res.status(500).json({ error: "en expenses query" });
            responseData.expensesTotal = row.total || 0;

            // 3. Calcular Sueldos (Asumimos que todos los empleados cobran cada mes, independientemente de la fecha de gasto)
            const salariesQuery = `SELECT SUM(monthly_salary) as total FROM employees`;
            db.get(salariesQuery, (err, row) => { 
                if (err) { 
                    console.error(err); 
                    return res.status(500).json({ error: "Error 500 en consulta de Sueldos: " + err.message });
                }
                // CLAVE: Nos aseguramos de manejar 'row' aunque 'total' sea null/undefined (si no hay empleados)
                responseData.salariesTotal = (row && row.total) || 0; 
                
                // 4. Calcular Ganancia
                const totalCosts = responseData.expensesTotal + responseData.salariesTotal;
                responseData.profit = responseData.invoicesTotal - totalCosts;

                // Devolver el reporte completo
                res.json(responseData);
            });
        });
    });

});

router.put('/user/password', (req, res) => {
        const { currentPassword, newPassword } = req.body;
        // req.cookies.user_id es accesible gracias a authenticateMiddleware y cookie-parser
        const userId = req.cookies.user_id; 

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: "Faltan la contraseña actual o la nueva contraseña." });
        }
        
        // 1. Obtener el hash actual del usuario desde la DB
        db.get("SELECT password FROM users WHERE id = ?", [userId], (err, user) => {
            if (err || !user) {
                return res.status(500).json({ error: "Error interno al verificar usuario." });
            }

            // 2. Comparar la contraseña actual ingresada con el hash guardado
            bcrypt.compare(currentPassword, user.password, (compareErr, result) => {
                if (!result) {
                    return res.status(401).json({ error: "La contraseña actual es incorrecta." });
                }

                // 3. Si la actual es correcta, hashear la nueva contraseña
                bcrypt.hash(newPassword, saltRounds, (hashErr, hashedPassword) => {
                    if (hashErr) {
                        return res.status(500).json({ error: "Error al hashear la nueva contraseña." });
                    }
                    // 4. Guardar el nuevo hash en la base de datos
                    db.run("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, userId], function (updateErr) {
                        if (updateErr) {
                            return res.status(500).json({ error: "Error al actualizar la contraseña en la DB." });
                        }
                        res.status(200).json({ message: "Contraseña actualizada exitosamente." });
                    });
                });
            });
        });

});


module.exports = router;