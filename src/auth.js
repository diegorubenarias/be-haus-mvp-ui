// src/auth.js
// const db = require('./database'); // ELIMINAR
const bcrypt = require('bcrypt'); 
const { User } = require('./models'); // USAMOS EL MODELO

// Middleware de Autenticación (Este middleware de cookies no cambia, sigue igual)
function authenticateMiddleware(req, res, next) {
    if (req.cookies && req.cookies.user_id) {
        next(); 
    } else {
        res.redirect('/');
    }
}

// Lógica de Login (MODIFICADA A ASYNC/AWAIT CON SEQUELIZE)
async function handleLogin(req, res) {
    const { username, password } = req.body;
    
    try {
        // 1. Buscamos el usuario usando el modelo Sequelize
        const user = await User.findOne({ where: { username } });

        if (user) {
            // 2. Comparamos la contraseña ingresada con el hash almacenado
            const result = await bcrypt.compare(password, user.password);
            
            if (result) {
                // Contraseña correcta
                res.cookie('user_id', user.id, { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 });
                  res.status(200).json({ 
                    message: "Login exitoso", 
                    user: { 
                        id: user.id, 
                        username: user.username,
                        role: user.role // <-- Asegúrate que esta línea esté aquí
                    } 
                });
            } else {
                // Contraseña incorrecta
                res.status(401).json({ error: "Usuario o contraseña incorrectos" });
            }
        } else {
            // Usuario no encontrado
            res.status(401).json({ error: "Usuario o contraseña incorrectos" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
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
