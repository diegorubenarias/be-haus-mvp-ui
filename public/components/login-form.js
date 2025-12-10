class LoginForm extends HTMLElement {
    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });

        shadow.innerHTML = `
            <style>
                .login-card {
                    background: white;
                    padding: 40px;
                    width: 300px;
                    text-align: center;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                input {
                    width: 100%;
                    padding: 10px;
                    margin-bottom: 15px;
                    border: 1px solid #ccc;
                    box-sizing: border-box;
                }
                button {
                    width: 100%;
                    padding: 10px;
                    background-color: #0056b3;
                    color: white;
                    border: none;
                    cursor: pointer;
                }
                button:hover {
                    background-color: #004494;
                }
                .error-message {
                    color: red;
                    margin-bottom: 10px;
                    display: none;
                }
            </style>
            <div class="login-card">
                <h2>Iniciar Sesión</h2>
                <div class="error-message" id="errorMessage"></div>
                <form id="loginForm">
                    <input type="text" id="username" placeholder="Usuario (admin)" required>
                    <input type="password" id="password" placeholder="Contraseña (1234)" required>
                    <button type="submit">Ingresar</button>
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

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (response.ok) {
                // Login exitoso: redirige al dashboard
                window.location.href = '/dashboard';
            } else {
                // Login fallido: muestra error
                const errorData = await response.json();
                errorMessage.textContent = errorData.error;
                errorMessage.style.display = 'block';
            }
        } catch (error) {
            errorMessage.textContent = 'Error de conexión con el servidor.';
            errorMessage.style.display = 'block';
        }
    }
}

customElements.define('login-form', LoginForm);
