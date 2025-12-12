// public/components/settings-panel.js
class SettingsPanel extends HTMLElement {
    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        
        shadow.innerHTML = `
            <style>
                .settings-card {
                    background: white;
                    padding: 30px;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    max-width: 500px;
                    margin: 20px auto;
                }
                .form-group {
                    margin-bottom: 20px;
                }
                label {
                    display: block;
                    margin-bottom: 8px;
                    font-weight: bold;
                    color: #555;
                }
                input[type="password"] {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    box-sizing: border-box; /* Importante para padding/ancho */
                }
                button {
                    background-color: #0056b3;
                    color: white;
                    padding: 12px 20px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    width: 100%;
                    font-size: 16px;
                    transition: background-color 0.3s;
                }
                button:hover {
                    background-color: #004494;
                }
                .message {
                    margin-bottom: 15px;
                    padding: 10px;
                    border-radius: 4px;
                    display: none; /* Oculto por defecto */
                }
                .success { background-color: #e8f5e9; color: #1b5e20; border: 1px solid #4CAF50; }
                .error { background-color: #ffebee; color: #b71c1c; border: 1px solid #f44336; }
            </style>
            <div class="settings-card">
                <h3>Cambiar Contraseña</h3>
                <div class="message" id="messageArea"></div>
                <form id="passwordForm">
                    <div class="form-group">
                        <label for="currentPassword">Contraseña Actual:</label>
                        <input type="password" id="currentPassword" required>
                    </div>
                    <div class="form-group">
                        <label for="newPassword">Nueva Contraseña:</label>
                        <input type="password" id="newPassword" required>
                    </div>
                    <div class="form-group">
                        <label for="confirmPassword">Confirmar Nueva Contraseña:</label>
                        <input type="password" id="confirmPassword" required>
                    </div>
                    <button type="submit">Guardar Cambios</button>
                </form>
            </div>
        `;
    }

    connectedCallback() {
        this.shadowRoot.getElementById('passwordForm').addEventListener('submit', (e) => this.handleChangePassword(e));
    }

    async handleChangePassword(event) {
        event.preventDefault();
        const currentPassword = this.shadowRoot.getElementById('currentPassword').value;
        const newPassword = this.shadowRoot.getElementById('newPassword').value;
        const confirmPassword = this.shadowRoot.getElementById('confirmPassword').value;
        const messageArea = this.shadowRoot.getElementById('messageArea');

        messageArea.style.display = 'none';

        if (newPassword !== confirmPassword) {
            this.showMessage(messageArea, 'Las nuevas contraseñas no coinciden.', 'error');
            return;
        }
        
        if (newPassword.length < 4) { // Requisito simple de MVP
             this.showMessage(messageArea, 'La nueva contraseña debe tener al menos 4 caracteres.', 'error');
            return;
        }

        try {
            const response = await fetch('/api/user/password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const data = await response.json();

            if (response.ok) {
                this.showMessage(messageArea, data.message, 'success');
                // Limpiar el formulario tras un cambio exitoso
                this.shadowRoot.getElementById('passwordForm').reset();
            } else {
                // Maneja errores de backend (ej: contraseña actual incorrecta)
                this.showMessage(messageArea, data.error || 'Error desconocido.', 'error');
            }
        } catch (error) {
            console.error("Fetch error:", error);
            this.showMessage(messageArea, 'Error de conexión con el servidor.', 'error');
        }
    }

    showMessage(element, msg, type) {
        element.textContent = msg;
        element.className = `message ${type}`;
        element.style.display = 'block';
    }
}

customElements.define('settings-panel', SettingsPanel);
