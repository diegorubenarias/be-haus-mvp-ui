const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser'); 
const app = express();
const PORT = 3000;
const db = require('./src/database'); // Importamos la DB (solo para asegurar la conexión)
const { authenticateMiddleware, handleLogin, handleLogout } = require('./src/auth'); // Importamos auth
const apiRoutes = require('./src/routes/api'); 

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// --- Rutas de Autenticación (Login/Logout no usan el API router) ---
app.post('/api/login', handleLogin);
app.post('/api/logout', handleLogout);


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

app.get('/expenses.html', authenticateMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'expenses.html'));
});

app.get('/profit-loss-report.html', authenticateMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'profit-loss-report.html'));
});

app.get('/employees.html', authenticateMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'employees.html'));
});

app.get('/shifts-planner.html', authenticateMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'shifts-planner.html'));
});
app.get('/settings-panel.html', authenticateMiddleware, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'settings-panel.html'));
});

// ----------------------------------------
app.use('/api', apiRoutes);
// Mantenemos el app.listen de siempre
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
