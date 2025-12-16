// src/components/user-form.js

class UserForm extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.user = null;
    }

    static get observedAttributes() {
        return ['user-data'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'user-data') {
            this.user = newValue === 'null' ? null : JSON.parse(newValue);
            this.render();
        }
    }

    render() {
        const isEditing = this.user !== null;
        this.shadowRoot.innerHTML = `
            <style>
                .form-card { padding: 20px; border: 1px solid #ccc; margin-bottom: 20px; }
                input, select { display: block; width: 100%; margin-bottom: 10px; padding: 8px; }
                button { margin-top: 10px; }
            </style>
            <div class="form-card">
                <h3>${isEditing ? 'Editar Usuario' : 'Crear Nuevo Usuario'}</h3>
                <form id="userForm">
                    <input type="hidden" id="userId" value="${isEditing ? this.user.id : ''}">

                    <label for="username">Username:</label>
                    <input type="text" id="username" value="${isEditing ? this.user.username : ''}" ${isEditing ? 'disabled' : ''} required>
                    
                    <label for="email">Email:</label>
                    <input type="email" id="email" value="${isEditing ? this.user.email || '' : ''}">

                    ${!isEditing ? `
                        <label for="password">Contraseña (Mín 6 chars):</label>
                        <input type="password" id="password" required minlength="6">
                    ` : ''}
                    
                    <label for="role">Rol:</label>
                    <select id="role">
                        <option value="operador" ${isEditing && this.user.role === 'operador' ? 'selected' : ''}>Operador</option>
                        <option value="supervisor" ${isEditing && this.user.role === 'supervisor' ? 'selected' : ''}>Supervisor</option>
                        <option value="admin" ${isEditing && this.user.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>

                    <label for="is_active">Activo:</label>
                    <input type="checkbox" id="is_active" ${isEditing && this.user.is_active ? 'checked' : isEditing ? '' : 'checked'}>

                    <button type="submit">${isEditing ? 'Guardar Cambios' : 'Crear Usuario'}</button>
                    <button type="button" onclick="this.dispatchEvent(new CustomEvent('cancel-form', {bubbles: true, composed: true}))">Cancelar</button>
                </form>
            </div>
        `;
        this.shadowRoot.getElementById('userForm').addEventListener('submit', (e) => this.handleSubmit(e));
    }

    handleSubmit(event) {
        event.preventDefault();
        const form = event.target;
        const userId = form.elements.userId.value;
        const method = userId ? 'PUT' : 'POST';
        const url = userId ? `/api/users/${userId}` : '/api/users';

        const body = {
            username: form.elements.username.value,
            email: form.elements.email.value,
            role: form.elements.role.value,
            is_active: form.elements.is_active.checked,
        };

        // Solo añadir la contraseña si estamos creando un nuevo usuario
        if (!userId) {
            body.password = form.elements.password.value;
        }
        
        fetch(url, {
            method: method,
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer TU_TOKEN_AQUI`
            },
            body: JSON.stringify(body)
        })
        .then(response => response.json())
        .then(data => {
            if (data.error || data.message === 'Acceso denegado') {
                alert('Error al guardar: ' + (data.error || data.message));
                return;
            }
            alert('Usuario guardado con éxito!');
            // Notificar al componente padre que recargue la lista
            this.dispatchEvent(new CustomEvent('user-saved', { bubbles: true, composed: true }));
        })
        .catch(error => {
            console.error('Fetch error:', error);
            alert('Hubo un error de conexión o del servidor.');
        });
    }
}

customElements.define('user-form', UserForm);
