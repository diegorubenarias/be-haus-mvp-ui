// src/components/user-abm-page.js
import './user-list.js';
import './user-form.js';

class UserAbmPage extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.users = [];
        this.editingUser = null; // null si es nuevo, objeto si se edita
    }

    connectedCallback() {
        this.render();
        this.fetchUsers();
        // Escucha eventos personalizados de los sub-componentes
        this.shadowRoot.addEventListener('edit-user', (event) => this.handleEditUser(event.detail));
        this.shadowRoot.addEventListener('user-saved', () => this.handleUserSaved());
        this.shadowRoot.addEventListener('cancel-form', () => this.closeForm());
    }

    async fetchUsers() {
        // Debes asegurarte de enviar el token de auth aquí, ej:
        const response = await fetch('/api/users', {
            headers: { 'Authorization': `Bearer TU_TOKEN_AQUI` }
        });
        if (response.ok) {
            const result = await response.json();
            this.users = result;
            this.render(); // Vuelve a renderizar tras cargar datos
        } else {
            console.error('Error fetching users:', await response.json());
        }
    }

    handleEditUser(user) {
        this.editingUser = user;
        this.render();
    }

    handleUserSaved() {
        this.closeForm();
        this.fetchUsers(); // Recarga la lista completa
    }

    closeForm() {
        this.editingUser = null;
        this.render();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                .container { padding: 20px; }
                h1 { color: #333; }
                /* Estilos básicos para alternar vistas */
                user-form { display: ${this.editingUser || this.editingUser === null ? 'block' : 'none'}; }
                user-list { display: ${this.editingUser ? 'none' : 'block'}; }
            </style>
            <div class="container">
                <h1>Gestión de Usuarios y Roles (ABM)</h1>
                
                <user-form user-data='${JSON.stringify(this.editingUser)}'></user-form>
                
                <user-list users-data='${JSON.stringify(this.users)}'></user-list>
            </div>
        `;
    }
}

customElements.define('user-abm-page', UserAbmPage);
