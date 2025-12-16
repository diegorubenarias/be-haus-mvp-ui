// src/components/user-list.js

class UserList extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    // Observa cambios en el atributo 'users-data'
    static get observedAttributes() {
        return ['users-data'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'users-data' && newValue) {
            this.users = JSON.parse(newValue);
            this.render();
        }
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
                button { margin-right: 5px; cursor: pointer; }
                .active-status { color: green; }
                .inactive-status { color: red; }
                .admin-role { font-weight: bold; color: navy; }
            </style>
            <h2>Listado de Usuarios</h2>
            <button onclick="this.dispatchEvent(new CustomEvent('edit-user', { detail: null, bubbles: true, composed: true }))">
                + Nuevo Usuario
            </button>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Username</th>
                        <th>Email</th>
                        <th>Rol</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.users && this.users.map(user => `
                        <tr>
                            <td>${user.id}</td>
                            <td>${user.username}</td>
                            <td>${user.email || 'N/A'}</td>
                            <td class="${user.role}-role">${user.role}</td>
                            <td class="${user.is_active ? 'active-status' : 'inactive-status'}">
                                ${user.is_active ? 'Activo' : 'Inactivo'}
                            </td>
                            <td>
                                <button onclick='this.dispatchEvent(new CustomEvent("edit-user", { detail: ${JSON.stringify(user)}, bubbles: true, composed: true }))'>Editar</button>
                                ${user.is_active ? 
                                    `<button onclick='this.handleDeactivate(${user.id})'>Desactivar</button>` : 
                                    ''
                                }
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
    
    // Método para manejar la desactivación (borrado suave)
    handleDeactivate(userId) {
        if (confirm('¿Estás seguro de desactivar a este usuario?')) {
            // Llama a tu API de DELETE /api/users/:id aquí
            fetch(`/api/users/${userId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer TU_TOKEN_AQUI` }
            }).then(() => {
                // Emite evento para que el componente padre recargue la lista
                this.dispatchEvent(new CustomEvent('user-saved', { bubbles: true, composed: true }));
            }).catch(err => console.error(err));
        }
    }
}

customElements.define('user-list', UserList);
