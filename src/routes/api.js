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

// Endpoint para crear una nueva reserva (ACTUALIZADO CON VALIDACIÓN)
router.post('/bookings', async (req, res) => {
    const { room_id, client_name, start_date, end_date, status } = req.body;

    if (!room_id || !client_name || !start_date || !end_date || !status) {
        return res.status(400).json({ error: "Faltan campos requeridos." });
    }
    
    try {
        // 1. Obtener el precio actual de la habitación
        // Usamos $1 para el primer parámetro
        const roomResult = await pool.query("SELECT price FROM rooms WHERE id = $1", [room_id]);
        
        if (roomResult.rows.length === 0) {
            return res.status(404).json({ error: "Habitación no encontrada." });
        }
        const price_per_night = roomResult.rows[0].price; // Capturamos el precio actual

        // 2. Lógica de validación de superposición
        const overlapQuery = `SELECT COUNT(*) FROM bookings 
                       WHERE room_id = $1 
                       AND (
                           (start_date BETWEEN $2 AND $3) OR 
                           (end_date BETWEEN $2 AND $3) OR
                           ($2 BETWEEN start_date AND end_date) OR
                           ($3 BETWEEN start_date AND end_date)
                       )`;
        
        // Pasamos los parámetros posicionales al array de values
        const overlapResult = await pool.query(overlapQuery, [room_id, start_date, end_date]);
        
        // En Postgres COUNT(*) devuelve una fila con un campo 'count' (que puede ser string o number)
        if (parseInt(overlapResult.rows[0].count) > 0) {
            return res.status(409).json({ error: "Conflicto de reserva: La habitación ya está ocupada o reservada en esas fechas." });
        }

        // 3. Si no hay superposición, procede con la inserción
        const insertQuery = `INSERT INTO bookings (room_id, client_name, start_date, end_date, status, price_per_night) 
                             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`; // Usamos RETURNING ID para obtener el nuevo ID
        
        const insertResult = await pool.query(insertQuery, [room_id, client_name, start_date, end_date, status, price_per_night]);
        
        // El nuevo ID está en insertResult.rows[0].id
        res.status(201).json({
            message: "Reserva creada exitosamente",
            data: req.body,
            id: insertResult.rows[0].id, 
            price_per_night: price_per_night
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({"error": err.message});
    }
});

// Endpoint para ACTUALIZAR una reserva existente
router.put('/bookings/:id', async (req, res) => {
    const { room_id, client_name, start_date, end_date, status, price_per_night } = req.body;
    const { id } = req.params;

    if (!room_id || !client_name || !start_date || !end_date || !status) {
        return res.status(400).json({ error: "Faltan campos requeridos." });
    }

    const updateQuery = `UPDATE bookings SET 
                         room_id = $1, 
                         client_name = $2, 
                         start_date = $3, 
                         end_date = $4, 
                         status = $5, 
                         price_per_night = COALESCE($6, price_per_night) 
                         WHERE id = $7`;
    
    try {
        // Pasamos todos los parámetros en orden ($1 a $7)
        const result = await pool.query(updateQuery, [room_id, client_name, start_date, end_date, status, price_per_night, id]);
        
        // En pg, result.rowCount indica cuántas filas fueron afectadas
        if (result.rowCount > 0) {
            res.status(200).json({ message: "Reserva actualizada exitosamente", changes: result.rowCount });
        } else {
            res.status(404).json({ error: "Reserva no encontrada." });
        }
    } catch (err) {
        res.status(400).json({"error": err.message});
    }
});

// Endpoint para obtener una reserva específica por su ID
router.get('/bookings/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query("SELECT * FROM bookings WHERE id = $1", [id]);
        
        if (result.rows.length > 0) {
            res.json({
                message: "success",
                data: result.rows[0] // Devuelve el primer (y único) objeto
            });
        } else {
            res.status(404).json({"error": "Reserva no encontrada."});
        }
    } catch (err) {
        res.status(400).json({"error": err.message});
    }
});

// NOTA: La función 'finalizeBookingUpdate' ya no es necesaria con async/await

router.delete('/bookings/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // Verificar el estado actual antes de eliminar
        const selectResult = await pool.query('SELECT status, room_id FROM bookings WHERE id = $1', [id]);
        
        if (selectResult.rows.length === 0) {
            return res.status(404).json({ "error": "Reserva no encontrada." });
        }

        const row = selectResult.rows[0];

        if (row.status === 'occupied' || row.status === 'checked-in') {
            return res.status(403).json({ "error": "No se puede cancelar una reserva con check-in realizado. Use el proceso de check-out." });
        }

        // Si es 'reserved' o 'liberated', se puede eliminar (cancelar)
        const deleteResult = await pool.query('DELETE FROM bookings WHERE id = $1', [id]);
        
        res.json({ 
            message: "Reserva cancelada exitosamente.", 
            changes: deleteResult.rowCount 
        });

    } catch (err) {
        res.status(500).json({ "error": err.message });
    }
});


// Endpoint para obtener consumos de una reserva específica (Formato 1)
router.get('/consumptions/:bookingId', async (req, res) => {
    const { bookingId } = req.params;
    try {
        const result = await pool.query("SELECT * FROM consumptions WHERE booking_id = $1", [bookingId]);
        res.json({ data: result.rows });
    } catch (err) {
        res.status(400).json({"error": err.message});
    }
});

// Endpoint para obtener consumos de una reserva específica (Formato 2 - URL más RESTful)
router.get('/bookings/:bookingId/consumptions', async (req, res) => {
    const { bookingId } = req.params;
    try {
        const result = await pool.query("SELECT * FROM consumptions WHERE booking_id = $1", [bookingId]);
        res.json({
            message: "success",
            data: result.rows
        });
    } catch (err) {
        res.status(400).json({"error": err.message});
    }
});

// Endpoint para añadir un nuevo consumo
router.post('/consumptions', async (req, res) => {
    const { booking_id, description, amount, date } = req.body;

    if (!booking_id || !description || !amount || !date) {
        return res.status(400).json({ error: "Faltan campos requeridos." });
    }

    // Nota: Si usas NUMERIC en la BD, asegúrate de que 'amount' se maneje como string o float parseado.
    const insertQuery = `INSERT INTO consumptions (booking_id, description, amount, date) 
                         VALUES ($1, $2, $3, $4) RETURNING id`;
    
    try {
        const result = await pool.query(insertQuery, [booking_id, description, amount, date]);
        res.status(201).json({
            message: "Consumo registrado exitosamente",
            data: req.body,
            id: result.rows[0].id
        });
    } catch (err) {
        res.status(400).json({"error": err.message});
    }
});

router.put('/rooms/status/:roomId', async (req, res) => {
    const { clean_status } = req.body;
    const { roomId } = req.params;

    if (!clean_status) {
        return res.status(400).json({ error: "Falta el estado de limpieza." });
    }

    try {
        const query = `UPDATE rooms SET clean_status = $1 WHERE id = $2`;
        const result = await pool.query(query, [clean_status, roomId]);
        
        if (result.rowCount > 0) {
            res.json({ message: "Estado de limpieza actualizado.", changes: result.rowCount });
        } else {
            res.status(404).json({ error: "Habitación no encontrada." });
        }
    } catch (err) {
        res.status(400).json({"error": err.message});
    }
});

// Endpoint para actualizar el precio de una habitación
router.put('/rooms/:id/price', async (req, res) => {
    const { price } = req.body;
    const { id } = req.params;

    // Nota: 'price' puede llegar como string debido al tipo NUMERIC de Postgres. 
    // Lo parseamos aquí para la validación si es necesario, o lo manejamos como string en la DB.
    const priceValue = parseFloat(price);

    if (isNaN(priceValue) || priceValue < 0) {
        return res.status(400).json({ error: "El precio debe ser un número positivo." });
    }

    try {
        const result = await pool.query('UPDATE rooms SET price = $1 WHERE id = $2', [priceValue, id]);
        
        if (result.rowCount > 0) {
            res.status(200).json({ message: "Precio de habitación actualizado exitosamente.", changes: result.rowCount });
        } else {
            res.status(404).json({ error: "Habitación no encontrada." });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoint para GENERAR una factura a partir de una reserva
router.post('/invoices/generate/:bookingId', async (req, res) => {
    const { bookingId } = req.params;
    const { payment_method } = req.body; 

    if (!payment_method) {
        return res.status(400).json({ error: "Se requiere el método de pago." });
    }

    try {
        // 1. Obtener datos de la reserva
        const resultBooking = await pool.query("SELECT * FROM bookings WHERE id = $1", [bookingId]);
        
        if (resultBooking.rows.length === 0) {
            return res.status(404).json({ error: "Reserva no encontrada." });
        }
        const booking = resultBooking.rows;

        // 2. Obtener consumos
        const resultConsumptions = await pool.query("SELECT * FROM consumptions WHERE booking_id = $1", [bookingId]);
        const consumptions = resultConsumptions.rows;

        if (booking.status !== 'checked-out') {
            return res.status(400).json({ error: "No se puede facturar una reserva que no ha completado el check-out." });
        }
        
        // 3. Calcular totales (logica JS intacta, solo asegúrate que booking.price_per_night y item.amount son numéricos si usas NUMERIC en DB)
        const startDate = new Date(booking.start_date); // Ya es objeto Date si usas tipo DATE en Postgres
        const endDate = new Date(booking.end_date);
        const durationDays = Math.ceil(Math.abs(endDate - startDate) / (1000 * 60 * 60 * 24));
        const stayCost = durationDays * parseFloat(booking.price_per_night); // Parseamos de string a float
        const consumptionsTotal = consumptions.reduce((sum, item) => sum + parseFloat(item.amount), 0); // Parseamos amounts
        const totalAmount = stayCost + consumptionsTotal;

        const invoiceDetails = JSON.stringify({
            stay: { description: `Estadía ${durationDays} noches`, amount: stayCost },
            consumptions: consumptions.map(c => ({ description: c.description, amount: parseFloat(c.amount) }))
        });

        const issueDate = new Date().toISOString().split('T')[0];
        const invoiceNumber = `INV-${issueDate.replace(/-/g, '')}-${bookingId}`;

        // 4. Insertar la factura
        const insertQuery = 'INSERT INTO invoices (booking_id, invoice_number, issue_date, total_amount, details, payment_method) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, invoice_number';
        const insertResult = await pool.query(insertQuery, [bookingId, invoiceNumber, issueDate, totalAmount, invoiceDetails, payment_method]);
        
        // 5. Actualizar estado de limpieza a 'dirty' (lo hacemos concurrente o secuencialmente)
        // Usamos await para asegurar que se ejecuta, pero no bloqueamos la respuesta final
        try {
            await pool.query('UPDATE rooms SET clean_status = $1 WHERE id = $2', ['dirty', booking.room_id]);
        } catch (updateErr) {
            console.error("Advertencia: No se pudo actualizar el estado de limpieza de la habitación:", updateErr.message);
        }
        
        res.status(201).json({
            message: "Factura generada y habitación marcada como sucia.",
            invoiceId: insertResult.rows.id,
            invoiceNumber: insertResult.rows.invoice_number,
            totalAmount: totalAmount,
            roomStatusUpdatedTo: 'dirty',
            paymentMethodUsed: payment_method
        });

    } catch (err) {
        // Manejo de error de UNIQUE constraint (factura ya existente)
        if (err.code === '23505') { // Código de error de duplicado en Postgres
             return res.status(409).json({ error: "La reserva ya tiene una factura generada." });
        }
        console.error(err);
        res.status(500).json({ error: "Error interno del servidor: " + err.message });
    }
});

// Endpoint para obtener una factura específica por su ID
router.get('/invoices/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query("SELECT * FROM invoices WHERE id = $1", [id]);
        
        if (result.rows.length === 0) {
            res.status(404).json({ error: "Factura no encontrada." });
            return;
        }
        const invoice = result.rows;
        // Parseamos los detalles JSON antes de enviarlos al frontend
        invoice.details = JSON.parse(invoice.details);
        res.json(invoice);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoint para listar TODAS las facturas
router.get('/invoices', async (req, res) => {
    try {
        const result = await pool.query("SELECT id, booking_id, invoice_number, issue_date, total_amount, payment_method FROM invoices ORDER BY issue_date DESC");
        res.json({ data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Endpoints de Empleados (Employees) ---
router.get('/employees', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM employees");
        res.json({ data: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/employees/:id', async (req, res) => {
    const { name, role, monthly_salary } = req.body;
    try {
        const result = await pool.query('UPDATE employees SET name = $1, role = $2, monthly_salary = $3 WHERE id = $4', [name, role, monthly_salary, req.params.id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Empleado no encontrado." });
        }
        res.status(200).json({ message: "Empleado actualizado.", changes: result.rowCount });
    } catch (err) { 
        res.status(400).json({ error: err.message }); 
    }
});

// Eliminar empleado
router.delete('/employees/:id', async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM employees WHERE id = $1', [req.params.id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Empleado no encontrado." });
        }
        res.status(200).json({ message: "Empleado eliminado.", changes: result.rowCount });
    } catch (err) { 
        // Nota: Postgres puede dar error si hay shifts asociados (FK constraint)
        res.status(400).json({ error: err.message }); 
    }
});

// Obtener turnos para un mes específico (ej: ?year=2023&month=10)
router.get('/shifts', async (req, res) => {
    const { year, month } = req.query; 
    if (!year || !month) { return res.status(400).json({ error: "Se requieren año y mes." }); }

    // Usando el tipo DATE de Postgres podemos filtrar con rangos precisos
    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    // Calculamos el último día del mes real
    const endDate = new Date(year, month, 0).toISOString().split('T'); 
    
    try {
        // Esto funciona porque 'startDate' y 'endDate' son strings en formato YYYY-MM-DD, compatibles con el tipo DATE de Postgres
        const result = await pool.query("SELECT * FROM shifts WHERE shift_date BETWEEN $1 AND $2", [startDate, endDate]);
        res.json({ data: result.rows });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});


// Planificar o actualizar un turno (POST para simplificar, idempotente)
router.post('/shifts', async (req, res) => {
    const { employee_id, shift_date, shift_type } = req.body;
    if (!employee_id || !shift_date || !shift_type) { return res.status(400).json({ error: "Faltan campos requeridos." }); }
    
    // Usamos INSERT INTO ... ON CONFLICT DO UPDATE SET
    const query = `
        INSERT INTO shifts (employee_id, shift_date, shift_type) 
        VALUES ($1, $2, $3)
        ON CONFLICT (employee_id, shift_date) 
        DO UPDATE SET shift_type = $3 RETURNING id;
    `;
    
    try {
        const result = await pool.query(query, [employee_id, shift_date, shift_type]);
        res.status(201).json({ message: "Turno guardado.", id: result.rows.id });
    } catch (err) { 
        // Si no has añadido la restricción UNIQUE en la DB, este query fallará con el error original
        res.status(400).json({ error: err.message }); 
    }
});


// --- Endpoints de Gastos (Expenses) ---
router.get('/expenses', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM expenses ORDER BY date DESC");
        res.json({ data: result.rows });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

router.post('/expenses', async (req, res) => {
    const { description, amount, date, category } = req.body;
    if (!description || !amount || !date || !category) { return res.status(400).json({ error: "Faltan campos requeridos." }); }
    const insert = 'INSERT INTO expenses (description, amount, date, category) VALUES ($1, $2, $3, $4) RETURNING id';
    
    try {
        const result = await pool.query(insert, [description, amount, date, category]);
        res.status(201).json({ message: "Gasto añadido exitosamente", id: result.rows.id });
    } catch (err) { 
        res.status(400).json({ error: err.message }); 
    }
});

// --- Endpoint de Reporte de Ganancias Mensual ---
router.get('/reports/profit-loss', async (req, res) => {
    const { year, month } = req.query; 

    if (!year || !month) {
        return res.status(400).json({ error: "Se requieren los parámetros 'year' y 'month'." });
    }

    // Aseguramos formato YYYY-MM-DD
    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate(); 
    const endDate = `${year}-${month.padStart(2, '0')}-${lastDay}`;
    
    const responseData = {
        period: `${year}-${month}`,
        invoicesTotal: 0,
        expensesTotal: 0,
        salariesTotal: 0,
        profit: 0
    };

    try {
        // 1. Calcular Ingresos (Total Facturado en el mes)
        const invoicesQuery = `SELECT SUM(total_amount) as total FROM invoices WHERE issue_date BETWEEN $1 AND $2`;
        const resultInvoices = await pool.query(invoicesQuery, [startDate, endDate]);
        // Usamos parseFloat porque SUM() en Postgres/NUMERIC puede devolver un string o null
        responseData.invoicesTotal = parseFloat(resultInvoices.rows[0]?.total) || 0; 

        // 2. Calcular Gastos Operativos (en el mes)
        const expensesQuery = `SELECT SUM(amount) as total FROM expenses WHERE date BETWEEN $1 AND $2`;
        const resultExp = await pool.query(expensesQuery, [startDate, endDate]);
        responseData.expensesTotal = parseFloat(resultExp.rows[0]?.total) || 0;

        // 3. Calcular Sueldos (Asumimos que todos los empleados cobran cada mes)
        const salariesQuery = `SELECT SUM(monthly_salary) as total FROM employees`;
        const resultSal = await pool.query(salariesQuery); 
        responseData.salariesTotal = parseFloat(resultSal.rows[0]?.total) || 0; 
        
        // 4. Calcular Ganancia
        const totalCosts = responseData.expensesTotal + responseData.salariesTotal;
        responseData.profit = responseData.invoicesTotal - totalCosts;

        // Devolver el reporte completo
        res.json(responseData);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error al generar el reporte: " + err.message });
    }
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
