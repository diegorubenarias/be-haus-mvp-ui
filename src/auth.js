// src/auth.js
const db = require('./database');
const bcrypt = require('bcrypt');

// Middleware de Autenticación
function authenticateMiddleware(req, res, next) {
    if (req.cookies && req.cookies.user_id) {
        next(); 
    } else {
        res.redirect('/');
    }
}

// Lógica de Login/Logout que usaremos en las rutas
// Lógica de Login (MODIFICADA)
function handleLogin(req, res) {
    const { username, password } = req.body;
    
    // 1. Buscamos el usuario por nombre
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (user) {
            // 2. Comparamos la contraseña ingresada con el hash almacenado
            bcrypt.compare(password, user.password, (err, result) => {
                if (result) {
                    // Contraseña correcta
                    res.cookie('user_id', user.id, { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 });
                    res.status(200).json({ message: "Login exitoso", user: { id: user.id, username: user.username } });
                } else {
                    // Contraseña incorrecta
                    res.status(401).json({ error: "Usuario o contraseña incorrectos" });
                }
            });
        } else {
            // Usuario no encontrado
            res.status(401).json({ error: "Usuario o contraseña incorrectos" });
             }
    });
}

function handleLogout(req, res) {
    res.clearCookie('user_id');
    res.status(200).json({ message: "Sesión cerrada exitosamente" });
}

module.exports = {
    authenticateMiddleware,
    handleLogin,
    handleLogout
};
