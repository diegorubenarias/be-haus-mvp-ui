// src/services/emailService.js
const nodemailer = require('nodemailer');

// Configuración del transportador (ejemplo usando un servicio SMTP genérico)
// En producción, usarías las variables de entorno de tu servicio (Mailgun, SendGrid, etc.)
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.hostinger.com', // Host SMTP
    port: process.env.EMAIL_PORT || 465, // Puerto SMTP
    secure: true, // true para 465, false para otros puertos como 587 o 2525
    auth: {
        user: process.env.EMAIL_USER || 'Reservas@behausargentina.com', // Usuario SMTP
        pass: process.env.EMAIL_PASS || 'Behaus2025***'  // Contraseña SMTP
    },
    tls: {
        rejectUnauthorized: false // Puede ser necesario en algunos entornos cloud como Railway
    }
});

/**
 * Función para enviar un correo de confirmación de reserva
 * @param {string} toEmail - El correo del cliente
 * @param {object} bookingDetails - Detalles de la reserva
 */
async function sendBookingConfirmation(toEmail, bookingDetails) {
    // Puedes crear un template HTML bonito aquí para el cuerpo del correo
    const emailBody = `
        <h1>Confirmación de Reserva de Habitación</h1>
        <p>Hola ${bookingDetails.client_name},</p>
        <p>Tu reserva en nuestro hotel ha sido confirmada con éxito.</p>
        <ul>
            <li><strong>Habitación:</strong> ${bookingDetails.room_name}</li>
            <li><strong>Check-in:</strong> ${bookingDetails.start_date}</li>
            <li><strong>Check-out:</strong> ${bookingDetails.end_date}</li>
            <li><strong>Precio por noche:</strong> $${bookingDetails.price_per_night.toFixed(2)}</li>
        </ul>
        <p>¡Gracias por tu reserva!</p>
    `;

    const mailOptions = {
        from: '"Hotel BeHaus" <reservas@behaus.com>',
        to: toEmail,
        subject: 'Confirmación de Reserva - Hotel BeHaus',
        html: emailBody // Usamos HTML para un correo formateado
        // text: 'Versión de texto plano para clientes sin HTML'
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent: %s', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
}

module.exports = {
    sendBookingConfirmation
};
