// public/components/login-form.js (MEJORADO)

class LoginForm extends HTMLElement {
    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });

        shadow.innerHTML = `
            <style>
                /* Usamos colores consistentes con el tema global */
                :host {
                    --primary-color: #0056b3; 
                    --secondary-color: #ff9800;
                    --error-color: #e74c3c;
                    --shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
                }

                .login-card {
                    background: white;
                    padding: 40px;
                    width: 350px; /* Un poco más ancho para mejor estética */
                    text-align: center;
                    border-radius: 10px;
                    box-shadow: var(--shadow);
                    font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                }
                
                h2 {
                    color: var(--primary-color);
                    margin-bottom: 25px;
                    font-size: 1.8em;
                }

                input {
                    width: 100%;
                    padding: 12px;
                    margin-bottom: 15px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    box-sizing: border-box;
                    font-size: 1em;
                }
                
                input:focus {
                    outline: none;
                    border-color: var(--primary-color);
                }

                button {
                    width: 100%;
                    padding: 12px;
                    background-color: var(--primary-color);
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 1em;
                    transition: background-color 0.3s;
                }
                
                button:hover {
                    background-color: #004494;
                }

                button:disabled {
                    background-color: #cccccc;
                    cursor: not-allowed;
                }

                .error-message {
                    color: var(--error-color);
                    background-color: #ffebeb;
                    padding: 10px;
                    border-radius: 4px;
                    margin-bottom: 15px;
                    display: none;
                    font-size: 0.9em;
                }
            </style>
            <div class="login-card">
                <h2>BeHaus</h2>
                <div class="error-message" id="errorMessage"></div>
                <form id="loginForm">
                    <input type="text" id="username" placeholder="Usuario (admin)" required>
                    <input type="password" id="password" placeholder="Contraseña (1234)" required>
                    <button type="submit" id="loginButton">Ingresar</button>
                </form>
            </div>
        `;
    }

    connectedCallback() {
        this.shadowRoot.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
    }

    async handleLogin(e) {
        e.preventDefault();
        const username = this.shadowRoot.getElementById('username').value;
        const password = this.shadowRoot.getElementById('password').value;
        const errorMessage = this.shadowRoot.getElementById('errorMessage');
        const loginButton = this.shadowRoot.getElementById('loginButton');

        errorMessage.style.display = 'none';
        loginButton.disabled = true; // Deshabilita el botón durante la petición

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (response.ok) {
                window.location.href = '/dashboard';
            } else {
                const errorData = await response.json();
                errorMessage.textContent = errorData.error;
                errorMessage.style.display = 'block';
                loginButton.disabled = false; // Habilita el botón si falla
            }
        } catch (error) {
            errorMessage.textContent = 'Error de conexión con el servidor.';
            errorMessage.style.display = 'block';
            loginButton.disabled = false; // Habilita el botón si falla
        }
    }
}

customElements.define('login-form', LoginForm);
