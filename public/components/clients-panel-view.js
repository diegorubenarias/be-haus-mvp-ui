// public/components/clients-panel-view.js
class ClientsPanelView extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.clients = [];
        this.shadowRoot.innerHTML = `
            <style>
                .container { padding: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ccc; padding: 10px; text-align: left; }
                th { background-color: #0056b3; color: white; }
                button { padding: 5px 10px; cursor: pointer; margin-right: 5px; }
                .form-container { margin-bottom: 20px; padding: 15px; border: 1px solid #ccc; border-radius: 5px; }
                input, select { padding: 8px; margin-right: 10px; }
            </style>
            <div class="container">
                <h2>Administrar Clientes</h2>
                <div class="form-container">
                    <h3>Añadir/Editar Cliente</h3>
                    <input type="hidden" id="clientId">
                    <input type="text" id="clientName" placeholder="Nombre de Empresa" required>
                    <input type="text" id="clientCuit" placeholder="CUIT/CUIL" required>
                    <select id="invoiceType">
                        <option value="A">Factura A</option>
                        <option value="B">Factura B</option>
                        <option value="C">Factura C</option>
                        <option value="T">Ticket</option>
                    </select>
                    <!-- ELIMINAMOS los onclick y añadimos IDs -->
                    <button id="saveButton">Guardar</button>
                    <button id="cancelButton">Cancelar</button>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>CUIT/CUIL</th>
                            <th>Tipo Factura</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="clientTableBody">
                    </tbody>
                </table>
            </div>
        `;
    }

    connectedCallback() {
        // Adjuntamos los listeners a los botones del formulario superior
        this.shadowRoot.getElementById('saveButton').addEventListener('click', () => this.saveClient());
        this.shadowRoot.getElementById('cancelButton').addEventListener('click', () => this.resetForm());
        this.fetchClients();
    }

    async fetchClients() {
        const response = await fetch('/api/clients');
        if (response.status === 401) { window.location.href = '/'; return; }
        const data = await response.json();
        this.clients = data.data;
        this.renderTable();
    }

    renderTable() {
        const tbody = this.shadowRoot.getElementById('clientTableBody');
        tbody.innerHTML = '';
        this.clients.forEach(client => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${client.name}</td>
                <td>${client.cuit_cuil}</td>
                <td>${client.invoice_type}</td>
                <td>
                    <!-- ELIMINAMOS los onclick y usamos data-attributes -->
                    <button data-action="edit" data-client-id="${client.id}">Editar</button>
                    <button data-action="delete" data-client-id="${client.id}">Eliminar</button>
                </td>
            `;
            tbody.appendChild(row);
        });

        // Añadimos un listener DELEGADO para manejar los clics en los botones de la tabla
        tbody.addEventListener('click', (event) => {
            const button = event.target;
            if (button.tagName === 'BUTTON') {
                const clientId = button.dataset.clientId;
                if (button.dataset.action === 'edit') {
                    this.editClient(parseInt(clientId));
                } else if (button.dataset.action === 'delete') {
                    this.deleteClient(parseInt(clientId));
                }
            }
        });
    }

    async saveClient() {
        const id = this.shadowRoot.getElementById('clientId').value;
        const name = this.shadowRoot.getElementById('clientName').value;
        const cuit_cuil = this.shadowRoot.getElementById('clientCuit').value;
        const invoice_type = this.shadowRoot.getElementById('invoiceType').value;
        
        if (!name || !cuit_cuil || !invoice_type) {
            alert("Por favor complete todos los campos.");
            return;
        }

        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/clients/${id}` : '/api/clients';

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, cuit_cuil, invoice_type })
        });

        if (response.ok) {
            this.fetchClients();
            this.resetForm();
        } else {
            const errorData = await response.json();
            alert(`Error: ${errorData.error}`);
        }
    }

    editClient(id) {
        const client = this.clients.find(c => c.id === id);
        if (client) {
            this.shadowRoot.getElementById('clientId').value = client.id;
            this.shadowRoot.getElementById('clientName').value = client.name;
            this.shadowRoot.getElementById('clientCuit').value = client.cuit_cuil;
            this.shadowRoot.getElementById('invoiceType').value = client.invoice_type;
        }
    }

    async deleteClient(id) {
        if (confirm('¿Estás seguro de eliminar este cliente?')) {
            const response = await fetch(`/api/clients/${id}`, { method: 'DELETE' });
            if (response.ok) {
                this.fetchClients();
            } else {
                const errorData = await response.json();
                alert(`Error al eliminar: ${errorData.error}`);
            }
        }
    }

    resetForm() {
        this.shadowRoot.getElementById('clientId').value = '';
        this.shadowRoot.getElementById('clientName').value = '';
        this.shadowRoot.getElementById('clientCuit').value = '';
        this.shadowRoot.getElementById('invoiceType').value = 'B';
    }
}

customElements.define('clients-panel-view', ClientsPanelView);
