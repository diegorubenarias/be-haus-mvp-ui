// src/utils/seeder.js
const bcrypt = require('bcrypt');
const { Room, User, Employee, sequelize } = require('../models');

async function seedDatabase() {
    // Usamos { alter: true } en desarrollo para actualizar el esquema sin perder datos
    await sequelize.sync({ alter: true }); 

    // Seed Rooms
    const roomCount = await Room.count();
    if (roomCount === 0) {
         const roomsData = [
            { name: 'BeH101', category: 'executive', price: 80.00 }, 
            { name: 'BeH103', category: 'executive', price: 120.00 }, 
            { name: 'BeH201', category: 'executive', price: 250.00 }, 
            { name: 'BeH203', category: 'executive', price: 85.00 }, 
            { name: 'BeH301', category: 'executive', price: 130.00 }, 
            { name: 'BeH303', category: 'executive', price: 180.00 }, 
            { name: 'BeH401', category: 'executive', price: 400.00 },
            { name: 'BeH102', category: 'studio', price: 80.00 }, 
            { name: 'BeH104', category: 'studio', price: 120.00 }, 
            { name: 'BeH204', category: 'studio', price: 250.00 }, 
            { name: 'BeH202', category: 'studio', price: 85.00 }, 
            { name: 'BeH302', category: 'studio', price: 130.00 }, 
            { name: 'BeH304', category: 'studio', price: 180.00 }, 
            { name: 'BeH402', category: 'studio', price: 400.00 },
            { name: 'BeH403', category: 'loft', price: 80.00 }, 
            { name: 'De6-5D', category: 'studio', price: 120.00 }, 
            { name: 'De6-6D', category: 'studio', price: 250.00 }, 
            { name: 'De6-6C', category: 'executive', price: 85.00 }, 
            { name: 'De6-7C', category: 'executive', price: 130.00 }, 
            { name: 'De6-7E', category: 'executive', price: 180.00 }, 
            { name: 'De6-11E', category: 'executive', price: 400.00 },
            { name: 'De4-9D', category: 'executive', price: 80.00 }, 
            { name: 'De4-10D', category: 'executive', price: 120.00 }, 
            { name: 'Mi3-1B', category: 'family', price: 250.00 } 
        ];
        await Room.bulkCreate(roomsData);
        console.log("Habitaciones iniciales con precios insertadas.");
    }

    // Seed Users
    //await User.truncate(); // Limpiamos la tabla de usuarios para evitar duplicados en desarrollo
    const userCount = await User.count();
    if (userCount === 0) {
        const passwordTextoPlano = '123456';
        const hashedPassword = await bcrypt.hash(passwordTextoPlano, 10);
        await User.bulkCreate([
            { username: 'admin@behaus.com', password: hashedPassword, role: 'admin' },
            { username: 'operador@behaus.com', password: hashedPassword, role: 'operador' }
        ]);
        console.log("Usuarios iniciales insertados.");
    }

    // Seed Employees
    const employeeCount = await Employee.count();
    if (employeeCount === 0) {
        await Employee.bulkCreate([
            { name: 'Juan Perez', role: 'Gerente', monthly_salary: 8000.00 },
            { name: 'Maria Garcia', role: 'Recepcionista', monthly_salary: 4500.00 }
        ]);
        console.log("Empleados iniciales insertados.");
    }
}

module.exports = seedDatabase;
