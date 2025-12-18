// src/models/index.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// --- Definición de Modelos ---

const Room = sequelize.define('Room', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.TEXT, allowNull: false },
    category: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'standard' },
    price: { type: DataTypes.REAL, allowNull: false, defaultValue: 0.0 },
    clean_status: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'clean' }
}, { tableName: 'rooms', timestamps: false });

const Booking = sequelize.define('Booking', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    room_id: { type: DataTypes.INTEGER, allowNull: false },
    
    // Mantenemos client_name para clientes individuales o el nombre del contacto
    client_name: { type: DataTypes.TEXT, allowNull: false }, 

    // client_id ahora es OPCIONAL (allowNull: true por defecto)
    client_id: { 
        type: DataTypes.INTEGER,
        allowNull: true, // Importante: Permitir valores NULL
        references: {
            model: 'clients',
            key: 'id',
        }
    },

    start_date: { type: DataTypes.TEXT, allowNull: false }, 
    end_date: { type: DataTypes.TEXT, allowNull: false },
    status: { type: DataTypes.TEXT, allowNull: false },
    price_per_night: { type: DataTypes.REAL, allowNull: false, defaultValue: 0.0 },
    email: { type: DataTypes.TEXT, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },

}, { tableName: 'bookings', timestamps: false });

// src/models/index.js (Modificado)

// ... otras definiciones de modelos ...

const User = sequelize.define('User', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    username: { type: DataTypes.TEXT, allowNull: false, unique: true },
    email: { // Añadimos email como identificador adicional
        type: DataTypes.TEXT,
        allowNull: true, // Puede ser nulo por ahora si no todos lo tienen
        unique: true,
        validate: { isEmail: true }
    },
    password: { type: DataTypes.TEXT, allowNull: false },
    role: { // Campo para definir el rol del usuario
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'operador', // Rol por defecto
        validate: {
            isIn: [['admin', 'supervisor', 'operador']] // Roles permitidos
        }
    },
    is_active: { // Para el "Baja" lógica del ABM (borrado suave)
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    }
}, { tableName: 'users', timestamps: false });

// ... el resto de relaciones y exportaciones ...

const Consumption = sequelize.define('Consumption', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    booking_id: { type: DataTypes.INTEGER, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false },
    amount: { type: DataTypes.REAL, allowNull: false },
    date: { type: DataTypes.TEXT, allowNull: false },
    
}, { tableName: 'consumptions', timestamps: false });

const Invoice = sequelize.define('Invoice', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    booking_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    invoice_number: { type: DataTypes.TEXT, allowNull: false, unique: true },
    issue_date: { type: DataTypes.TEXT, allowNull: false },
    total_amount: { type: DataTypes.REAL, allowNull: false },
    details: { type: DataTypes.TEXT },
    payment_method: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'Contado' },
}, { tableName: 'invoices', timestamps: false });

const Employee = sequelize.define('Employee', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.TEXT, allowNull: false },
    role: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'Operador' },
    monthly_salary: { type: DataTypes.REAL, allowNull: false }
}, { tableName: 'employees', timestamps: false });

const Shift = sequelize.define('Shift', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    employee_id: { type: DataTypes.INTEGER, allowNull: false },
    shift_date: { type: DataTypes.TEXT, allowNull: false },
    shift_type: { type: DataTypes.TEXT, allowNull: false },
}, { tableName: 'shifts', timestamps: false });

const Expense = sequelize.define('Expense', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    description: { type: DataTypes.TEXT, allowNull: false },
    amount: { type: DataTypes.REAL, allowNull: false },
    date: { type: DataTypes.TEXT, allowNull: false },
    category: { type: DataTypes.TEXT, allowNull: false },
}, { tableName: 'expenses', timestamps: false });

const Client = sequelize.define('Client', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.TEXT, allowNull: false },
    cuit_cuil: { type: DataTypes.TEXT, allowNull: false, unique: true }, // CUIT/CUIL único
    invoice_type: { 
        type: DataTypes.TEXT, 
        allowNull: false, 
        defaultValue: 'B',
        validate: {
            isIn: [['A', 'B', 'C', 'T']] // Validación para asegurar tipos válidos
        }
    }
}, { tableName: 'clients', timestamps: false });


// --- Definición de Relaciones (Foreign Keys) ---
Booking.belongsTo(Room, { foreignKey: 'room_id' });
Room.hasMany(Booking, { foreignKey: 'room_id' });
Consumption.belongsTo(Booking, { foreignKey: 'booking_id' });
Booking.hasMany(Consumption, { foreignKey: 'booking_id' });
Invoice.belongsTo(Booking, { foreignKey: 'booking_id' });
Booking.hasOne(Invoice, { foreignKey: 'booking_id' });
Shift.belongsTo(Employee, { foreignKey: 'employee_id' });
Employee.hasMany(Shift, { foreignKey: 'employee_id' });
Booking.belongsTo(Client, { foreignKey: 'client_id' });
Client.hasMany(Booking, { foreignKey: 'client_id' });


module.exports = {
    sequelize,
    Room,
    Booking,
    User,
    Consumption,
    Invoice,
    Employee,
    Shift,
    Expense,
    Client
};
