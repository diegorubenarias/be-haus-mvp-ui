// src/auth.js (CORREGIDO)
const pool = require('./database'); 
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
function handleLogin(req, res) {
    const { username, password } = req.body;
    
    // 1. Buscamos el usuario por nombre
    pool.query("SELECT * FROM users WHERE username = $1", [username], (err, result) => {
        if (err) {
            console.error("Database error during login:", err.message); // Log the error for debugging
            res.status(500).json({ error: err.message });
            return;
        }

        // --- CORRECCIÓN CLAVE AQUÍ ---
        // Postgres devuelve un objeto 'result' con los datos en 'result.rows' (un array)
        if (result.rows.length > 0) {
            const user = result.rows[0]; // Extraemos el primer (y único) usuario del array

            // 2. Comparamos la contraseña ingresada con el hash almacenado
            // Ahora 'user' es el objeto correcto que contiene 'user.password'
            bcrypt.compare(password, user.password, (err, bcryptResult) => {
                if (bcryptResult) {
                    // Contraseña correcta
                    res.cookie('user_id', user.id, { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 });
                    res.status(200).json({ 
                        message: "Login exitoso", 
                        user: { id: user.id, username: user.username } 
                    });
                } else {
                    // Contraseña incorrecta
                    res.status(401).json({ error: "Usuario o contraseña incorrectos" });
                }
            });
        } else {
            // Usuario no encontrado (length es 0)
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
