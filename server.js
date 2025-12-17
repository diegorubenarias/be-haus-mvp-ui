// server.js (CORREGIDO PARA RAILWAY)
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser'); 
const app = express();

// --- CAMBIOS CLAVE AQUÍ ---
// 1. Usar process.env.PORT proporcionado por Railway (fallback a 3000 para desarrollo local)
const PORT = process.env.PORT || 3000;
// 2. Usar 0.0.0.0 para que el servidor escuche en todas las interfaces de red del contenedor
const HOST = '0.0.0.0'; 
// -------------------------

// const db = require('./src/database'); // ELIMINAR
const seedDatabase = require('./src/utils/seeder'); // Importamos el seeder
const { authenticateMiddleware, handleLogin, handleLogout } = require('./src/auth'); 
const apiRoutes = require('./src/routes/api'); 

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


// --- Rutas de Autenticación (Login/Logout no usan el API router) ---
app.post('/api/login', handleLogin);
app.post('/api/logout', handleLogout);


// --- Rutas de Frontend ---
// ... (Estas rutas no cambian, déjalas como estaban) ...

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard', authenticateMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});
app.get('/clients.html', authenticateMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'clients.html'));
});
app.get('/users-abm.html', authenticateMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'clients.html'));
});

// ----------------------------------------
app.use('/api', apiRoutes);


// --- Iniciar DB y Servidor ---
seedDatabase().then(() => {
    console.log("Base de datos sincronizada y sembrada.");
    
    // --- CAMBIO CLAVE EN app.listen() ---
    app.listen(PORT, HOST, () => {
        console.log(`Servidor corriendo en http://${HOST}:${PORT}`);
    });
    // ------------------------------------

}).catch(err => {
    console.error("Error al iniciar la base de datos:", err);
});

