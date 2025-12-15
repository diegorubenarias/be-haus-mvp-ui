// src/routes/api.js
const express = require('express');
const router = express.Router();
const db = require('../database/database');
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
// src/routes/api.js (COMPLETO Y MIGRADO A SEQUELIZE)
const express = require('express');
const router = express.Router();
const { authenticateMiddleware } = require('../auth');
const bcrypt = require('bcrypt');
const { Room, Booking, Consumption, Invoice, Employee, Shift, Expense, User, sequelize } = require('../models'); 
const { Op } = require('sequelize'); // Operadores de Sequelize para consultas complejas

// Aplicamos el middleware de autenticación a todas las rutas de este router por defecto
router.use(authenticateMiddleware);

// --- Endpoints de habitaciones y reservas ---

// Endpoint para obtener todas las habitaciones
router.get('/rooms', async (req, res) => {
    try {
        const rooms = await Room.findAll();
        res.json({
            message: "success",
            data: rooms
        });
    } catch (err) {
        res.status(400).json({"error": err.message});
    }
});

// Endpoint para obtener todas las reservas
router.get('/bookings', async (req, res) => {
    try {
        const bookings = await Booking.findAll();
        res.json({
            message: "success",
            data: bookings
        });
    } catch (err) {
        res.status(400).json({"error": err.message});
    }
});

// Endpoint para crear una nueva reserva
router.post('/bookings', async (req, res) => {
    const { room_id, client_name, start_date, end_date, status } = req.body;

    if (!room_id || !client_name || !start_date || !end_date || !status) {
        return res.status(400).json({ error: "Faltan campos requeridos." });
    }
    
    try {
        const room = await Room.findOne({ where: { id: room_id }, attributes: ['price'] });
        if (!room) {
            return res.status(404).json({ error: "Habitación no encontrada o error de precio." });
        }
        const price_per_night = room.price;

        // Lógica de validación de superposición usando operadores Sequelize (Op)
        const conflictCount = await Booking.count({
            where: {
                room_id: room_id,
                [Op.or]: [
                    { start_date: { [Op.between]: [start_date, end_date] } },
                    { end_date: { [Op.between]: [start_date, end_date] } },
                    { start_date: { [Op.lte]: start_date }, end_date: { [Op.gte]: end_date } }
                ]
            }
        });

        if (conflictCount > 0) {
            return res.status(409).json({ error: "Conflicto de reserva: La habitación ya está ocupada o reservada en esas fechas." });
        }

        const newBooking = await Booking.create({
            room_id,
            client_name,
            start_date,
            end_date,
            status,
            price_per_night
        });
        
        res.status(201).json({
            message: "Reserva creada exitosamente",
            data: newBooking,
            id: newBooking.id,
            price_per_night: price_per_night
        });

    } catch (err) {
        res.status(500).json({"error": err.message});
    }
});

// Endpoint para ACTUALIZAR una reserva existente
router.put('/bookings/:id', async (req, res) => {
    const { id } = req.params;
    const { room_id, client_name, start_date, end_date, status, price_per_night } = req.body;

    if (!room_id || !client_name || !start_date || !end_date || !status) {
        return res.status(400).json({ error: "Faltan campos requeridos." });
    }
    
    try {
        const [updatedRowsCount] = await Booking.update(
            { room_id, client_name, start_date, end_date, status, price_per_night },
            { where: { id: id } }
        );

        if (updatedRowsCount > 0) {
            res.status(200).json({ message: "Reserva actualizada exitosamente", changes: updatedRowsCount });
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
        const row = await Booking.findByPk(id);
        
        if (row) {
            res.json({
                message: "success",
                data: row
            });
        } else {
            res.status(404).json({"error": "Reserva no encontrada."});
        }
    } catch (err) {
        res.status(400).json({"error": err.message});
    }
});

router.delete('/bookings/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const booking = await Booking.findByPk(id);

        if (!booking) {
            return res.status(404).json({ "error": "Reserva no encontrada." });
        }

        if (booking.status === 'occupied' || booking.status === 'checked-in') {
            return res.status(403).json({ "error": "No se puede cancelar una reserva con check-in realizado. Use el proceso de check-out." });
        }

        const deletedRows = await Booking.destroy({
            where: { id: id }
        });
        
        if (deletedRows > 0) {
             res.json({ message: "Reserva cancelada exitosamente.", changes: deletedRows });
        } else {
             res.status(404).json({ "error": "Reserva no encontrada para eliminar." });
        }
       
    } catch (err) {
        res.status(500).json({ "error": err.message });
    }
});

// Endpoint para obtener consumos de una reserva específica
router.get('/consumptions/:bookingId', async (req, res) => {
    const { bookingId } = req.params;
    try {
        const consumptions = await Consumption.findAll({ where: { booking_id: bookingId } });
        res.json({ data: consumptions });
    } catch (err) {
        res.status(400).json({"error": err.message});
    }
});

// Endpoint para obtener consumos de una reserva específica (Ruta alternativa)
router.get('/bookings/:bookingId/consumptions', async (req, res) => {
    const { bookingId } = req.params;
    try {
        const consumptions = await Consumption.findAll({ where: { booking_id: bookingId } });
        res.json({
            message: "success",
            data: consumptions
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
    try {
        const newConsumption = await Consumption.create({ booking_id, description, amount, date });

        res.status(201).json({
            message: "Consumo añadido exitosamente",
            data: newConsumption,
            id: newConsumption.id
        });
    } catch (err) {
        res.status(400).json({"error": err.message});
    }
});

// Endpoint para actualizar estado de limpieza de habitación
router.put('/rooms/status/:roomId', async (req, res) => {
    const { clean_status } = req.body;
    const { roomId } = req.params;

    if (!clean_status) {
        return res.status(400).json({ error: "Falta el estado de limpieza." });
    }

    try {
        const [updatedRowsCount] = await Room.update(
            { clean_status: clean_status },
            { where: { id: roomId } }
        );

        if (updatedRowsCount > 0) {
            res.json({ message: "Estado de limpieza actualizado.", changes: updatedRowsCount });
        } else {
            res.status(404).json({ error: "Habitación no encontrada." });
        }
    } catch (err) {
        res.status(400).json({"error": err.message});
    }
});

// Endpoint para actualizar precio de habitación
router.put('/rooms/:id/price', async (req, res) => {
    const { price } = req.body;
    const { id } = req.params;

    if (typeof price !== 'number' || price < 0) {
        return res.status(400).json({ error: "El precio debe ser un número positivo." });
    }

    try {
        const [updatedRowsCount] = await Room.update(
            { price: price },
            { where: { id: id } }
        );

        if (updatedRowsCount > 0) {
            res.status(200).json({ message: "Precio de habitación actualizado exitosamente.", changes: updatedRowsCount });
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
        const booking = await Booking.findByPk(bookingId);
        if (!booking) {
            return res.status(404).json({ error: "Reserva no encontrada." });
        }

        const consumptions = await Consumption.findAll({ where: { booking_id: bookingId } });

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

        const newInvoice = await Invoice.create({
            booking_id: bookingId,
            invoice_number: invoiceNumber,
            issue_date: issueDate,
            total_amount: totalAmount,
            details: invoiceDetails,
            payment_method: payment_method
        });
        
        await Room.update(
            { clean_status: 'dirty' },
            { where: { id: booking.room_id } }
        );
        
        res.status(201).json({
            message: "Factura generada y habitación marcada como sucia.",
            invoiceId: newInvoice.id,
            invoiceNumber: invoiceNumber,
            totalAmount: totalAmount,
            roomStatusUpdatedTo: 'dirty',
            paymentMethodUsed: payment_method
        });

    } catch (err) {
        if (err.name === 'SequelizeUniqueConstraintError') {
             return res.status(409).json({ error: "La reserva ya tiene una factura generada." });
        }
        res.status(500).json({ error: err.message });
    }
});

// Endpoint para obtener una factura específica por su ID
router.get('/invoices/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const invoice = await Invoice.findByPk(id);
        
        if (!invoice) {
            res.status(404).json({ error: "Factura no encontrada." });
            return;
        }
        
        const responseData = invoice.toJSON();
        responseData.details = JSON.parse(responseData.details); 
        
        res.json(responseData);
    } catch (err) {
        res.status(404).json({ error: err.message });
    }
});

// Endpoint para listar TODAS las facturas
router.get('/invoices', async (req, res) => {
    try {
        const invoices = await Invoice.findAll({
            attributes: ['id', 'booking_id', 'invoice_number', 'issue_date', 'total_amount'],
            order: [['issue_date', 'DESC']]
        });
        res.json({ data: invoices });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**** GASTOS */
// --- Endpoints de Empleados (Employees) ---
router.get('/employees', async (req, res) => {
    try {
        const employees = await Employee.findAll();
        res.json({ data: employees });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

router.post('/employees', async (req, res) => {
    const { name, role, monthly_salary } = req.body;
    if (!name || !role || !monthly_salary) { return res.status(400).json({ error: "Faltan campos requeridos." }); }
    try {
        const newEmployee = await Employee.create({ name, role, monthly_salary });
        res.status(201).json({ message: "Empleado añadido.", id: newEmployee.id });
    } catch (err) { 
        res.status(400).json({ error: err.message }); 
    }
});

router.put('/employees/:id', async (req, res) => {
    const { name, role, monthly_salary } = req.body;
    try {
        const [updatedRowsCount] = await Employee.update(
            { name, role, monthly_salary },
            { where: { id: req.params.id } }
        );
        res.status(200).json({ message: "Empleado actualizado.", changes: updatedRowsCount });
    } catch (err) { 
        res.status(400).json({ error: err.message }); 
    }
});

router.delete('/employees/:id', async (req, res) => {
    try {
        const deletedRows = await Employee.destroy({ where: { id: req.params.id } });
        res.status(200).json({ message: "Empleado eliminado.", changes: deletedRows });
    } catch (err) { 
        res.status(400).json({ error: err.message }); 
    }
});

// Obtener turnos para un mes específico
router.get('/shifts', async (req, res) => {
    const { year, month } = req.query; 
    if (!year || !month) { return res.status(400).json({ error: "Se requieren año y mes." }); }
    
    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const endDate = `${year}-${month.padStart(2, '0')}-31`; 

    try {
        const shifts = await Shift.findAll({
            where: {
                shift_date: {
                    [Op.between]: [startDate, endDate]
                }
            }
        });
        res.json({ data: shifts });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

// Planificar o actualizar un turno (POST para simplificar, idempotente)
router.post('/shifts', async (req, res) => {
    const { employee_id, shift_date, shift_type } = req.body;
    if (!employee_id || !shift_date || !shift_type) { return res.status(400).json({ error: "Faltan campos requeridos." }); }
    
    try {
        const [shift, created] = await Shift.upsert({
            employee_id,
            shift_date,
            shift_type
        });

        res.status(201).json({ 
            message: created ? "Turno guardado (insertado)." : "Turno guardado (actualizado).", 
            id: shift.id 
        });
    } catch (err) { 
        res.status(400).json({ error: err.message }); 
    }
});

// --- Endpoints de Gastos (Expenses) ---
router.get('/expenses', async (req, res) => {
    try {
        const expenses = await Expense.findAll({ order: [['date', 'DESC']] });
        res.json({ data: expenses });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

router.post('/expenses', async (req, res) => {
    const { description, amount, date, category } = req.body;
    if (!description || !amount || !date || !category) { return res.status(400).json({ error: "Faltan campos requeridos." }); }
    try {
        const newExpense = await Expense.create({ description, amount, date, category });
        res.status(201).json({ message: "Gasto añadido exitosamente", id: newExpense.id });
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

    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const lastDay = new Date(year, parseInt(month) - 1, 0).getDate(); 
    const endDate = `${year}-${month.padStart(2, '0')}-${lastDay}`;
    
    const responseData = {
        period: `${year}-${month}`,
        invoicesTotal: 0,
        expensesTotal: 0,
        salariesTotal: 0,
        profit: 0
    };

    try {
        const invoicesResult = await sequelize.query(
            `SELECT SUM(total_amount) as total FROM invoices WHERE issue_date BETWEEN :startDate AND :endDate`,
            { replacements: { startDate, endDate }, type: sequelize.QueryTypes.SELECT }
        );
        responseData.invoicesTotal = invoicesResult[0].total || 0;

        const expensesResult = await sequelize.query(
            `SELECT SUM(amount) as total FROM expenses WHERE date BETWEEN :startDate AND :endDate`,
            { replacements: { startDate, endDate }, type: sequelize.QueryTypes.SELECT }
        );
        responseData.expensesTotal = expensesResult[0].total || 0;

        const salariesResult = await sequelize.query(
            `SELECT SUM(monthly_salary) as total FROM employees`,
            { type: sequelize.QueryTypes.SELECT }
        );
        responseData.salariesTotal = salariesResult[0].total || 0;
        
        const totalCosts = responseData.expensesTotal + responseData.salariesTotal;
        responseData.profit = responseData.invoicesTotal - totalCosts;

        res.json(responseData);

    } catch (err) {
        console.error(err); 
        res.status(500).json({ error: "Error al generar el reporte: " + err.message });
    }
});

// Endpoint para cambiar contraseña de usuario logueado
router.put('/user/password', async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.cookies.user_id; 

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Faltan la contraseña actual o la nueva contraseña." });
    }
    
    try {
        const user = await User.findByPk(userId, { attributes: ['id', 'password'] });
        
        if (!user) {
            return res.status(500).json({ error: "Error interno al verificar usuario." });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);

        if (!isMatch) {
            return res.status(401).json({ error: "La contraseña actual es incorrecta." });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await User.update(
            { password: hashedPassword },
            { where: { id: userId } }
        );

        res.status(200).json({ message: "Contraseña actualizada exitosamente." });

    } catch (err) {
         console.error(err);
         res.status(500).json({ error: "Error interno del servidor al cambiar la contraseña." });
    }
});

// Exporta el router para que server.js lo pueda usar
module.exports = router;
