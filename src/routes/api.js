// src/routes/api.js (COMPLETO Y MIGRADO A SEQUELIZE)
const express = require('express');
const router = express.Router();
const { authenticateMiddleware } = require('../auth');
const bcrypt = require('bcrypt');
const { Room, Booking, Consumption, Invoice, Employee, Shift, Expense, User, sequelize, Client } = require('../models'); 
const { Op } = require('sequelize'); // Operadores de Sequelize para consultas complejas
const { sendBookingConfirmation } = require('../services/email-service'); // Importa el nuevo servicio


// Aplicamos el middleware de autenticación a todas las rutas de este router por defecto
router.use(authenticateMiddleware);

// --- Endpoints de habitaciones y reservas ---

// Endpoint para obtener todas las habitaciones
// src/routes/api.js (Actualiza este endpoint con el código a continuación)

// Endpoint para obtener todas las habitaciones (MODIFICADO CON ORDEN PERSONALIZADO)
router.get('/rooms', async (req, res) => {
    try {
        // Usamos una consulta cruda para un ordenamiento complejo y específico:
        // 1. Prioriza las habitaciones cuyo nombre empieza por 'BeH' (1 = BeH, 0 = Otros)
        // 2. Ordena las habitaciones BeH numéricamente si es posible, o alfabéticamente si no.
        // 3. El resto de habitaciones se listan a continuación.

        const rooms = await sequelize.query(
            `SELECT * FROM rooms 
             ORDER BY 
                 CASE 
                     WHEN name LIKE 'BeH%' THEN 0 
                     ELSE 1 
                 END,
                 name ASC;`, // Orden alfabético ascendente para ordenar por número de habitación
            {
                model: Room, // Mapea los resultados de vuelta al modelo Room de Sequelize
                mapToModel: true,
                type: sequelize.QueryTypes.SELECT
            }
        );

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
     const { room_id, client_id, client_name, start_date, end_date, status, email, notes } = req.body; 

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
            client_id: client_id || null, // Guarda NULL si no se proporciona client_id
            client_name,
            start_date,
            end_date,
            status,
            price_per_night,
            email,
            notes
        });
      /*    await sendBookingConfirmation(email, {
            client_name,
            room_name: room.name,
            start_date,
            end_date,
            price_per_night: room.price
        });*/
        
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
    const { room_id, client_name, start_date, end_date, status, price_per_night, notes } = req.body;

    if (!room_id || !client_name || !start_date || !end_date || !status) {
        return res.status(400).json({ error: "Faltan campos requeridos." });
    }
    
    try {
        const [updatedRowsCount] = await Booking.update(
            { room_id, client_name, start_date, end_date, status, price_per_night, notes },
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

// Endpoint para obtener todas las reservas (MODIFICADO para incluir datos del Cliente si existe)
router.get('/bookings', async (req, res) => {
    try {
        const bookings = await Booking.findAll({
            // required: false significa que hará un LEFT OUTER JOIN, permitiendo nulos
            include: [{
                model: Client, 
                attributes: ['id', 'name', 'cuit_cuil', 'invoice_type'],
                required: false 
            }]
        });
        res.json({
            message: "success",
            data: bookings
        });
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
// src/routes/api.js (Modificar el Endpoint de Generar Factura)

router.post('/invoices/generate/:bookingId', async (req, res) => {
    const { bookingId } = req.params;
    const { payment_method } = req.body; 

    if (!payment_method) { return res.status(400).json({ error: "Se requiere el método de pago." }); }

    try {
        // 1. Obtener datos de reserva Y potencialmente del cliente asociado
        // Usamos include para traer los datos de la empresa, required: false permite que client_id sea NULL
        const booking = await Booking.findByPk(bookingId, {
            include: [{ model: Client, required: false }] 
        });

        if (!booking) { return res.status(404).json({ error: "Reserva no encontrada." }); }
        
        // Validaciones...
        if (booking.status !== 'checked-out') {
            return res.status(400).json({ error: "No se puede facturar una reserva que no ha completado el check-out." });
        }

        // 2. Calcular totales (misma lógica que antes)
        const startDate = new Date(booking.start_date + 'T00:00:00Z');
        const endDate = new Date(booking.end_date + 'T00:00:00Z');
        const durationDays = Math.ceil(Math.abs(endDate - startDate) / (1000 * 60 * 60 * 24));
        const stayCost = durationDays * booking.price_per_night;
        
        // Fetch consumos
        const consumptions = await Consumption.findAll({ where: { booking_id: bookingId } });
        const consumptionsTotal = consumptions.reduce((sum, item) => sum + item.amount, 0);
        const totalAmount = stayCost + consumptionsTotal;

        // --- Lógica CLAVE: Determinar datos de facturación ---
        let finalClientName = booking.client_name;
        let finalCuitCuil = 'CF'; // Consumidor Final por defecto
        let finalInvoiceType = 'B'; // Tipo B o C por defecto para Consumidor Final

        // console.log("Datos de empresa (booking.Client):", booking.Client); // DEBUG

        if (booking.Client) { // <-- Esto debería ser truthy si se encontró la empresa
            finalClientName = `${booking.client_name} (${booking.Client.name})`; 
            finalCuitCuil = booking.Client.cuit_cuil;
            finalInvoiceType = booking.Client.invoice_type;
        }
        // --- Fin Lógica de Facturación ---

        // Preparamos detalles para guardar como JSON en la factura
        const invoiceDetails = JSON.stringify({
            stay: { description: `Estadía ${durationDays} noches`, amount: stayCost },
            consumptions: consumptions.map(c => ({ description: c.description, amount: c.amount })),
            clientDetails: { // <-- AÑADIR estos detalles al JSON
                name: finalClientName,
                cuit_cuil: finalCuitCuil,
                invoice_type: finalInvoiceType
            }
        });

        // ... (Generar invoice number, issue date) ...
        const issueDate = new Date().toISOString().split('T')[0];
        const invoiceNumber = `INV-${issueDate.replace(/-/g, '')}-${bookingId}`;


        // 4. Insertar la factura
        const newInvoice = await Invoice.create({
            booking_id: bookingId,
            invoice_number: invoiceNumber,
            issue_date: issueDate,
            total_amount: totalAmount,
            details: invoiceDetails,
            payment_method: payment_method
        });
        
        // ... (Actualizar estado de limpieza, response JSON) ...

        res.status(201).json({
            message: "Factura generada y habitación marcada como sucia.",
            invoiceId: newInvoice.id,
            invoiceNumber: invoiceNumber,
            totalAmount: totalAmount,
            roomStatusUpdatedTo: 'dirty',
            paymentMethodUsed: payment_method
        });

    } catch (err) {
        console.error("Error generating invoice:", err); // DEBUG
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

router.get('/clients', async (req, res) => {
    try {
        const clients = await Client.findAll({ order: [['name', 'ASC']] });
        res.json({ data: clients });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Crear un nuevo cliente
router.post('/clients', async (req, res) => {
    const { name, cuit_cuil, invoice_type } = req.body;
    if (!name || !cuit_cuil || !invoice_type) {
        return res.status(400).json({ error: "Faltan campos requeridos." });
    }
    try {
        const newClient = await Client.create({ name, cuit_cuil, invoice_type });
        res.status(201).json({ message: "Cliente añadido exitosamente", id: newClient.id });
    } catch (err) {
        // Manejo de error de CUIT/CUIL duplicado
        if (err.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ error: "El CUIT/CUIL ya existe." });
        }
        res.status(400).json({ error: err.message });
    }
});

// Actualizar un cliente existente
router.put('/clients/:id', async (req, res) => {
    const { name, cuit_cuil, invoice_type } = req.body;
    try {
        const [updatedRowsCount] = await Client.update(
            { name, cuit_cuil, invoice_type },
            { where: { id: req.params.id } }
        );
        if (updatedRowsCount > 0) {
            res.status(200).json({ message: "Cliente actualizado.", changes: updatedRowsCount });
        } else {
            res.status(404).json({ error: "Cliente no encontrado." });
        }
    } catch (err) {
        if (err.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ error: "El CUIT/CUIL ya existe." });
        }
        res.status(400).json({ error: err.message });
    }
});

// Eliminar un cliente
router.delete('/clients/:id', async (req, res) => {
    try {
        const deletedRows = await Client.destroy({ where: { id: req.params.id } });
        if (deletedRows > 0) {
             res.status(200).json({ message: "Cliente eliminado.", changes: deletedRows });
        } else {
            res.status(404).json({ error: "Cliente no encontrado." });
        }
    } catch (err) {
        // En un sistema real, deberías prevenir la eliminación si el cliente tiene reservas asociadas.
        res.status(500).json({ error: err.message });
    }
});

// Middleware de permisos: Solo permite el acceso a usuarios con rol 'admin' o 'supervisor'
const authorizeRoles = (roles) => (req, res, next) => {
    // req.user debe ser seteado por tu authenticateMiddleware
    if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Acceso denegado. Permisos insuficientes.' });
    }
    next();
};


// --- READ: Obtener todos los usuarios (Solo Admin/Supervisor) ---
router.get('/users/', authorizeRoles(['admin', 'supervisor']), async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: ['id', 'username', 'email', 'role', 'is_active'] // Nunca enviar passwords aquí
        });
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- CREATE: Crear un nuevo usuario (Solo Admin/Supervisor) ---
router.post('/users/', authorizeRoles(['admin', 'supervisor']), async (req, res) => {
    const { username, email, password, role } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newUser = await User.create({
            username,
            email,
            password: hashedPassword,
            role: role || 'operador'
        });

        res.status(201).json({ 
            id: newUser.id, username: newUser.username, email: newUser.email, role: newUser.role 
        });

    } catch (error) {
        res.status(400).json({ error: 'Error al crear usuario. El email/username podría estar duplicado.' });
    }
});


// --- UPDATE: Actualizar rol/estado (Solo Admin/Supervisor) ---
router.put('/users/:id', authorizeRoles(['admin', 'supervisor']), async (req, res) => {
    const { email, role, is_active } = req.body;
    try {
        const user = await User.findByPk(req.params.id);
        if (user) {
            // Validaciones básicas para evitar que un admin se quite permisos a sí mismo si es el único
            user.email = email !== undefined ? email : user.email;
            user.role = role !== undefined ? role : user.role;
            user.is_active = is_active !== undefined ? is_active : user.is_active;
            
            await user.save();
            res.status(200).json({ message: 'Usuario actualizado con éxito' });

        } else {
            res.status(404).json({ message: 'Usuario no encontrado' });
        }
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// --- DELETE: Desactivar usuario (Solo Admin/Supervisor) ---
router.delete('/users/:id', authorizeRoles(['admin', 'supervisor']), async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (user) {
            user.is_active = false; // Borrado suave
            await user.save();
            res.status(200).json({ message: 'Usuario desactivado con éxito' });
        } else {
            res.status(404).json({ message: 'Usuario no encontrado' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// Exporta el router para que server.js lo pueda usar
module.exports = router;
