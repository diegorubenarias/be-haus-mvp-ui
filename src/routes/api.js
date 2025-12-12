// src/routes/api.js
const express = require('express');
const router = express.Router();
const pool = require('../database'); // Usamos 'pool' de pg
const { authenticateMiddleware } = require('../auth');
const bcrypt = require('bcrypt');
const saltRounds = 10; 

// Aplicamos el middleware de autenticación a todas las rutas de este router por defecto
router.use(authenticateMiddleware);

// Endpoint para obtener todas las habitaciones
router.get('/rooms', (req, res) => {
    pool.query("SELECT * FROM rooms", (err, result) => { // Eliminamos [] extra, usamos result
        if (err) {
            res.status(400).json({"error":err.message});
            return;
        }
        res.json({
            message: "success",
            data: result.rows // Postgres usa result.rows
        });
    });
});

router.get('/bookings',(req, res) => {
    pool.query("SELECT * FROM bookings", (err, result) => { // Eliminamos [] extra, usamos result
        if (err) {
            res.status(400).json({"error":err.message});
            return;
        }
        res.json({
            message: "success",
            data: result.rows // Postgres usa result.rows
        });
    });
});

// Endpoint para crear una nueva reserva (ACTUALIZADO para Postgres)
router.post('/bookings', (req, res) => {
    const { room_id, client_name, start_date, end_date, status } = req.body;

    if (!room_id || !client_name || !start_date || !end_date || !status) {
        return res.status(400).json({ error: "Faltan campos requeridos." });
    }
    
    // Primero, obtenemos el precio actual de la habitación
    pool.query("SELECT price_per_night FROM rooms WHERE id = $1", [room_id], (err, result) => { // Usamos $1
        if (err || result.rows.length === 0) { // Verificamos result.rows.length
            return res.status(404).json({ error: "Habitación no encontrada o error de precio." });
        }
        const price_per_night = result.rows[0].price_per_night; // Accedemos a result.rows[0].price

        // Lógica de validación de superposición...
        const query = `SELECT COUNT(*) as count FROM bookings 
                       WHERE room_id = $1 
                       AND (
                           (start_date BETWEEN $2 AND $3) OR 
                           (end_date BETWEEN $2 AND $3) OR
                           ($2 BETWEEN start_date AND end_date) OR
                           ($3 BETWEEN start_date AND end_date)
                       )`;
        
        pool.query(query, [room_id, start_date, end_date], (err, resultOverlap) => { // Usamos $1, $2, $3 y otro nombre de resultado
            if (err) {
                res.status(500).json({"error": err.message});
                return;
            }

            // resultOverlap.rows[0].count es un string en pg, lo parseamos o comparamos como string
            if (parseInt(resultOverlap.rows[0].count) > 0) {
                res.status(409).json({ error: "Conflicto de reserva: La habitación ya está ocupada o reservada en esas fechas." });
                return;
            }

            // Si no hay superposición, procede con la inserción
            const insert = 'INSERT INTO bookings (room_id, client_name, start_date, end_date, status, price_per_night) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id'; // Usamos $ y RETURNING ID
            pool.query(insert, [room_id, client_name, start_date, end_date, status, price_per_night], (err, insertResult) => { // Usamos result
                if (err) {
                    res.status(400).json({"error": err.message});
                    return;
                }
                res.status(201).json({
                    message: "Reserva creada exitosamente",
                    data: req.body,
                    id: insertResult.rows[0].id, // El ID devuelto por RETURNING ID
                    price_per_night: price_per_night 
                });
            });
        });
    });
});

// Endpoint para ACTUALIZAR una reserva existente (ACTUALIZADO P1/P3 para Postgres)
router.put('/bookings/:id', (req, res) => {
    const { room_id, client_name, start_date, end_date, status, price_per_night } = req.body;
    const { id } = req.params;

    if (!room_id || !client_name || !start_date || !end_date || !status) {
        return res.status(400).json({ error: "Faltan campos requeridos." });
    }

    const update = `UPDATE bookings SET room_id = $1, client_name = $2, start_date = $3, end_date = $4, status = $5, price_per_night = COALESCE($6, price_per_night) WHERE id = $7`;
    
    pool.query(update, [room_id, client_name, start_date, end_date, status, price_per_night, id], (err, result) => {
        if (err) {
            res.status(400).json({"error": err.message});
            return;
        }
        if (result.rowCount > 0) { // Postgres usa result.rowCount
            res.status(200).json({ message: "Reserva actualizada exitosamente", changes: result.rowCount });
        } else {
            res.status(404).json({ error: "Reserva no encontrada." });
        }
    });
});

// Endpoint para obtener una reserva específica por su ID (NUEVO para Postgres)
router.get('/bookings/:id', (req, res) => {
    const { id } = req.params;
    pool.query("SELECT * FROM bookings WHERE id = $1", [id], (err, result) => { // Usamos $1 y result
        if (err) {
            res.status(400).json({"error":err.message});
            return;
        }
        if (result.rows.length > 0) { // Verificamos si hay filas
            res.json({
                message: "success",
                data: result.rows // Devuelve un solo objeto de reserva, en array
            });
        } else {
            res.status(404).json({"error": "Reserva no encontrada."});
        }
    });
});

// Función auxiliar para finalizar la actualización de la reserva (No usada en este fragmento, pero la migro)
function finalizeBookingUpdate(id, client_name, start_date, end_date, status, room_id, res) {
    const updateQuery = `UPDATE bookings SET client_name = $1, start_date = $2, end_date = $3, status = $4, room_id = $5 WHERE id = $6`;
    pool.query(updateQuery, [client_name, start_date, end_date, status, room_id, id], (err, result) => {
        if (err) return res.status(400).json({"error": err.message});
        res.json({ message: "Reserva actualizada exitosamente.", changes: result.rowCount });
    });
}

router.delete('/bookings/:id', (req, res) => {
    const { id } = req.params;

    // Verificar el estado actual antes de eliminar
    pool.query('SELECT status, room_id FROM bookings WHERE id = $1', [id], (err, result) => {
        if (err) return res.status(500).json({ "error": err.message });
        if (result.rows.length === 0) return res.status(404).json({ "error": "Reserva no encontrada." });

        const row = result.rows; // Fila encontrada

        if (row.status === 'occupied' || row.status === 'checked-in') {
            return res.status(403).json({ "error": "No se puede cancelar una reserva con check-in realizado. Use el proceso de check-out." });
        }

        // Si es 'reserved' o 'liberated', se puede eliminar (cancelar)
        pool.query('DELETE FROM bookings WHERE id = $1', [id], (err, deleteResult) => { // Usamos $1 y result
            if (err) return res.status(400).json({ "error": err.message });
            res.json({ message: "Reserva cancelada exitosamente.", changes: deleteResult.rowCount });
        });
    });
});


// Endpoint para obtener consumos de una reserva específica
router.get('/consumptions/:bookingId', (req, res) => {
    const { bookingId } = req.params;
    pool.query("SELECT * FROM consumptions WHERE booking_id = $1", [bookingId], (err, result) => { // Usamos $1 y result
        if (err) {
            res.status(400).json({"error":err.message});
            return;
        }
        res.json({ data: result.rows }); // result.rows
    });
});

// Endpoint para obtener consumos de una reserva específica
router.get('/bookings/:bookingId/consumptions', (req, res) => {
    const { bookingId } = req.params;
    pool.query("SELECT * FROM consumptions WHERE booking_id = $1", [bookingId], (err, result) => { // Usamos $1 y result
        if (err) {
            res.status(400).json({"error":err.message});
            return;
        }
        res.json({
            message: "success",
            data: result.rows // result.rows
        });
    });
});
// src/routes/api.js (Continuación y fin, corregido)

// Endpoint para añadir un nuevo consumo
router.post('/consumptions', (req, res) => {
    const { booking_id, description, amount, date } = req.body;
    if (!booking_id || !description || !amount || !date) {
        return res.status(400).json({ error: "Faltan campos requeridos." });
    }
    const insert = 'INSERT INTO consumptions (booking_id, description, amount, date) VALUES ($1,$2,$3,$4) RETURNING id'; // Usamos $ y RETURNING ID
    pool.query(insert, [booking_id, description, amount, date], (err, result) => { // Usamos result
        if (err) {
            res.status(400).json({"error": err.message});
            return;
        }
        res.status(201).json({
            message: "Consumo añadido exitosamente",
            data: req.body,
            id: result.rows.id // Obtenemos el ID de result.rows.id
        });
    });
});

router.put('/rooms/status/:roomId', (req, res) => {
    const { clean_status } = req.body;
    const { roomId } = req.params;

    if (!clean_status) {
        return res.status(400).json({ error: "Falta el estado de limpieza." });
    }

    const query = `UPDATE rooms SET clean_status = $1 WHERE id = $2`; // Usamos $1, $2
    pool.query(query, [clean_status, roomId], (err, result) => { // Usamos result
        if (err) {
            res.status(400).json({"error": err.message});
            return;
        }
        res.json({ message: "Estado de limpieza actualizado.", changes: result.rowCount }); // result.rowCount
    });
});

router.put('/rooms/:id/price', (req, res) => {
    const { price } = req.body;
    const { id } = req.params;

    if (typeof price !== 'number' || price < 0) {
        return res.status(400).json({ error: "El precio debe ser un número positivo." });
    }

    pool.query('UPDATE rooms SET price = $1 WHERE id = $2', [price, id], (err, result) => { // Usamos $1, $2, result
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (result.rowCount > 0) { // result.rowCount
            res.status(200).json({ message: "Precio de habitación actualizado exitosamente.", changes: result.rowCount });
        } else {
            res.status(404).json({ error: "Habitación no encontrada." });
        }
    });
});

// Endpoint para GENERAR una factura a partir de una reserva (CORREGIDO para Postgres)
router.post('/invoices/generate/:bookingId', (req, res) => {
    const { bookingId } = req.params;
    const { payment_method } = req.body; 

    if (!payment_method) {
        return res.status(400).json({ error: "Se requiere el método de pago." });
    }

    // 1. Necesitamos OBTENER todos los datos: reserva, consumos, precio/noche
    pool.query("SELECT * FROM bookings WHERE id = $1", [bookingId], (err, resultBooking) => { // $1, resultBooking
        if (err || resultBooking.rows.length === 0) {
            return res.status(404).json({ error: "Reserva no encontrada." });
        }
        const booking = resultBooking.rows;

        pool.query("SELECT * FROM consumptions WHERE booking_id = $1", [bookingId], (err, resultConsumptions) => { // $1, resultConsumptions
            if (err) {
                return res.status(500).json({ error: "Error al obtener consumos." });
            }
            const consumptions = resultConsumptions.rows;

            if (booking.status !== 'checked-out') {
                return res.status(400).json({ error: "No se puede facturar una reserva que no ha completado el check-out." });
            }

            const startDate = new Date(booking.start_date + 'T00:00:00Z');
            const endDate = new Date(booking.end_date + 'T00:00:00Z');
            const durationDays = Math.ceil(Math.abs(endDate - startDate) / (1000 * 60 * 60 * 24));
            const stayCost = durationDays * booking.price_per_night;
            const consumptionsTotal = consumptions.reduce((sum, item) => sum + item.amount, 0);
            const totalAmount = stayCost + consumptionsTotal;

            const invoiceDetails = JSON.stringify({
                stay: { description: `Estadía ${durationDays} noches`, amount: stayCost },
                consumptions: consumptions.map(c => ({ description: c.description, amount: c.amount }))
            });

            const issueDate = new Date().toISOString().split('T')[0];
            const invoiceNumber = `INV-${issueDate.replace(/-/g, '')}-${bookingId}`;

            // 4. Insertar la factura
            const insert = 'INSERT INTO invoices (booking_id, invoice_number, issue_date, total_amount, details, payment_method) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, invoice_number';
            pool.query(insert, [bookingId, invoiceNumber, issueDate, totalAmount, invoiceDetails, payment_method], (err, insertResult) => {
                if (err) { return res.status(409).json({ error: "La reserva ya tiene una factura generada." }); }
                
                // Actualizar estado de limpieza a 'dirty'
                pool.query('UPDATE rooms SET clean_status = $1 WHERE id = $2', ['dirty', booking.room_id], (updateErr, updateResult) => {
                    if (updateErr) console.error("Advertencia: No se pudo actualizar el estado de limpieza de la habitación:", updateErr.message);
                    
                    res.status(201).json({
                        message: "Factura generada y habitación marcada como sucia.",
                        invoiceId: insertResult.rows.id,
                        invoiceNumber: insertResult.rows.invoice_number,
                        totalAmount: totalAmount,
                        roomStatusUpdatedTo: 'dirty',
                        paymentMethodUsed: payment_method
                    });
                });
            });
        });
    });
});

// Endpoint para obtener una factura específica por su ID
router.get('/invoices/:id', (req, res) => {
    const { id } = req.params;
    pool.query("SELECT * FROM invoices WHERE id = $1", [id], (err, result) => {
        if (err || result.rows.length === 0) {
            res.status(404).json({ error: "Factura no encontrada." });
            return;
        }
        const invoice = result.rows;
        // Parseamos los detalles JSON antes de enviarlos al frontend
        invoice.details = JSON.parse(invoice.details);
        res.json(invoice);
    });
});

// Endpoint para listar TODAS las facturas
router.get('/invoices', (req, res) => {
    pool.query("SELECT id, booking_id, invoice_number, issue_date, total_amount, payment_method FROM invoices ORDER BY issue_date DESC", (err, result) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ data: result.rows });
    });
});

// --- Endpoints de Empleados (Employees) ---
router.get('/employees', (req, res) => {
    pool.query("SELECT * FROM employees", (err, result) => {
        if (err) { res.status(500).json({ error: err.message }); return; }
        res.json({ data: result.rows });
    });
});

router.post('/employees', (req, res) => {
    const { name, role, monthly_salary } = req.body;
    if (!name || !role || !monthly_salary) { return res.status(400).json({ error: "Faltan campos requeridos." }); }
    const insert = 'INSERT INTO employees (name, role, monthly_salary) VALUES ($1, $2, $3) RETURNING id';
    pool.query(insert, [name, role, monthly_salary], (err, result) => {
        if (err) { res.status(400).json({ error: err.message }); return; }
        res.status(201).json({ message: "Empleado añadido.", id: result.rows.id });
    });
});

router.put('/employees/:id', (req, res) => {
    const { name, role, monthly_salary } = req.body;
    pool.query('UPDATE employees SET name = $1, role = $2, monthly_salary = $3 WHERE id = $4', [name, role, monthly_salary, req.params.id], (err, result) => {
        if (err) { res.status(400).json({ error: err.message }); return; }
        res.status(200).json({ message: "Empleado actualizado.", changes: result.rowCount });
    });
});

router.delete('/employees/:id', (req, res) => {
    pool.query('DELETE FROM employees WHERE id = $1', [req.params.id], (err, result) => {
        if (err) { res.status(400).json({ error: err.message }); return; }
        res.status(200).json({ message: "Empleado eliminado.", changes: result.rowCount });
    });
});

// Obtener turnos para un mes específico (ej: ?year=2023&month=10)
router.get('/shifts', (req, res) => {
    const { year, month } = req.query; 
    if (!year || !month) { return res.status(400).json({ error: "Se requieren año y mes." }); }
    // En Postgres, usamos TO_DATE para asegurar que el filtro de rango de fechas funcione bien si es necesario.
    // O simplemente filtramos por el prefijo del mes si la DB solo tiene YYYY-MM-DD
    const startDate = `${year}-${month}-01`;
    const endDate = `${year}-${month}-31`; // Simplificado para el mes, postgres es flexible con esto
    
    pool.query("SELECT * FROM shifts WHERE shift_date BETWEEN $1 AND $2", [startDate, endDate], (err, result) => {
        if (err) { res.status(500).json({ error: err.message }); return; }
        res.json({ data: result.rows });
    });
});


// Planificar o actualizar un turno (POST para simplificar, idempotente)
router.post('/shifts', (req, res) => {
    const { employee_id, shift_date, shift_type } = req.body;
    if (!employee_id || !shift_date || !shift_type) { return res.status(400).json({ error: "Faltan campos requeridos." }); }
    
    // Usamos INSERT INTO ... ON CONFLICT DO UPDATE SET (El equivalente a INSERT OR REPLACE de SQLite en Postgres)
    const query = `
        INSERT INTO shifts (employee_id, shift_date, shift_type) 
        VALUES ($1, $2, $3)
        ON CONFLICT (employee_id, shift_date) 
        DO UPDATE SET shift_type = $3 RETURNING id;
    `;
    pool.query(query, [employee_id, shift_date, shift_type], (err, result) => {
        if (err) { res.status(400).json({ error: err.message }); return; }
        res.status(201).json({ message: "Turno guardado.", id: result.rows.id });
    });
});


// --- Endpoints de Gastos (Expenses) ---
router.get('/expenses', (req, res) => {
    pool.query("SELECT * FROM expenses ORDER BY date DESC", (err, result) => {
        if (err) { res.status(500).json({ error: err.message }); return; }
        res.json({ data: result.rows });
    });
});

router.post('/expenses', (req, res) => {
    const { description, amount, date, category } = req.body;
    if (!description || !amount || !date || !category) { return res.status(400).json({ error: "Faltan campos requeridos." }); }
    const insert = 'INSERT INTO expenses (description, amount, date, category) VALUES ($1, $2, $3, $4) RETURNING id';
    pool.query(insert, [description, amount, date, category], (err, result) => {
        if (err) { res.status(400).json({ error: err.message }); return; }
        res.status(201).json({ message: "Gasto añadido exitosamente", id: result.rows.id });
    });
});

// --- Endpoint de Reporte de Ganancias Mensual ---
router.get('/reports/profit-loss', (req, res) => {
    const { year, month } = req.query; 

    if (!year || !month) {
        return res.status(400).json({ error: "Se requieren los parámetros 'year' y 'month'." });
    }

    const startDate = `${year}-${month}-01`;
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
    const invoicesQuery = `SELECT SUM(total_amount) as total FROM invoices WHERE issue_date BETWEEN $1 AND $2`;
    pool.query(invoicesQuery, [startDate, endDate], (err, result) => {
        if (err) return res.status(500).json({ error: "en invoice query: " + err.message });
        responseData.invoicesTotal = parseFloat(result.rows.total) || 0; // Postgres devuelve total como string/null

        // 2. Calcular Gastos Operativos (en el mes)
        const expensesQuery = `SELECT SUM(amount) as total FROM expenses WHERE date BETWEEN $1 AND $2`;
        pool.query(expensesQuery, [startDate, endDate], (err, resultExp) => {
            if (err) return res.status(500).json({ error: "en expenses query: " + err.message });
            responseData.expensesTotal = parseFloat(resultExp.rows.total) || 0;

            // 3. Calcular Sueldos (Asumimos que todos los empleados cobran cada mes)
            const salariesQuery = `SELECT SUM(monthly_salary) as total FROM employees`;
            pool.query(salariesQuery, (err, resultSal) => { 
                if (err) { console.error(err); return res.status(500).json({ error: "Error 500 en consulta de Sueldos: " + err.message }); }
                responseData.salariesTotal = parseFloat(resultSal.rows.total) || 0; 
                
                // 4. Calcular Ganancia
                const totalCosts = responseData.expensesTotal + responseData.salariesTotal;
                responseData.profit = responseData.invoicesTotal - totalCosts;

                // Devolver el reporte completo
                res.json(responseData);
            });
        });
    });
});


// Endpoint para cambiar la contraseña del usuario logueado
router.put('/user/password', (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.cookies.user_id; 

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Faltan la contraseña actual o la nueva contraseña." });
    }
    
    // 1. Obtener el hash actual del usuario desde la DB
    pool.query("SELECT password FROM users WHERE id = $1", [userId], (err, result) => {
        if (err || result.rows.length === 0) {
            return res.status(500).json({ error: "Error interno al verificar usuario." });
        }
        const user = result.rows;

        // 2. Comparar la contraseña actual ingresada con el hash guardado
        bcrypt.compare(currentPassword, user.password, (compareErr, bcryptResult) => {
            if (!bcryptResult) {
                return res.status(401).json({ error: "La contraseña actual es incorrecta." });
            }

            // 3. Si la actual es correcta, hashear la nueva contraseña
            bcrypt.hash(newPassword, saltRounds, (hashErr, hashedPassword) => {
                if (hashErr) {
                    return res.status(500).json({ error: "Error al hashear la nueva contraseña." });
                }

                // 4. Guardar el nuevo hash en la base de datos
                pool.query("UPDATE users SET password = $1 WHERE id = $2", [hashedPassword, userId], (updateErr, updateResult) => {
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
