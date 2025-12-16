// public/components/booking-details-form.js
class BookingDetailsForm extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.clients = [];

        this.shadowRoot.innerHTML = `
            <style>
                .form-group { margin-bottom: 15px; }
                label { display: block; margin-bottom: 5px; font-weight: bold; }
                input, select { width: 100%; padding: 8px; box-sizing: border-box; }
                .price-per-night-input { width: 50% !important; display: inline-block; }
                .client-type-toggle { display: flex; align-items: center; margin-bottom: 10px; }
                .client-type-toggle input[type="checkbox"] { margin-right: 10px; width: auto; }
                .hidden { display: none; }
            </style>
            
            <input type="hidden" id="roomIdInput">
            <div class="form-group">
                <label>Habitación:</label>
                <input type="text" id="roomNameDisplay" readonly>
            </div>
            <div class="form-group">
                <label for="statusSelect">Estado:</label>
                <select id="statusSelect">
                    <option value="liberated">Liberada</option>
                    <option value="reserved">Reservada</option>
                    <option value="occupied">Ocupada</option>
                    <option value="checked-out">Checked-Out (Finalizada)</option>
                </select>
            </div>

            <!-- Checkbox y Dropdown para Empresa (NUEVO) -->
            <div class="client-type-toggle">
                <input type="checkbox" id="isCompanyCheckbox">
                <label for="isCompanyCheckbox">Reservado por Empresa</label>
            </div>
            
            <div class="form-group hidden" id="companyDropdownGroup">
                <label for="companySelect">Seleccionar Empresa:</label>
                <select id="companySelect"></select>
            </div>
            <!-- Fin Empresa -->

            <div class="form-group">
                <label for="clientName">Nombre del Ocupante/Contacto:</label>
                <input type="text" id="clientName">
            </div>
            <div class="form-group">
                <label for="startDate">Fecha de Inicio (YYYY-MM-DD):</label>
                <input type="date" id="startDate">
            </div>
            <div class="form-group">
                <label for="endDate">Fecha de Fin (YYYY-MM-DD):</label>
                <input type="date" id="endDate">
            </div>
            <div class="form-group">
                <label for="pricePerNight">Precio por Noche ($):</label>
                <input type="number" id="pricePerNight" class="price-per-night-input" step="0.01" min="0">
            </div>
        `;
    }

    connectedCallback() {
        this.fetchClientsList();
        this.shadowRoot.getElementById('isCompanyCheckbox').addEventListener('change', (e) => {
            this.toggleCompanySelection(e.target.checked);
        });
        // Emitir evento cuando cambian las fechas o el precio para que el panel de facturación recalcule
        ['startDate', 'endDate', 'pricePerNight'].forEach(id => {
            this.shadowRoot.getElementById(id).addEventListener('change', () => {
                this.dispatchEvent(new CustomEvent('details-changed', { bubbles: true, composed: true }));
            });
        });
    }

    async fetchClientsList() {
        const response = await fetch('/api/clients');
        if (response.ok) {
            const data = await response.json();
            this.clients = data.data;
            this.populateCompanyDropdown();
        } else {
            console.error("Error al cargar la lista de clientes/empresas");
        }
    }

    populateCompanyDropdown() {
        const select = this.shadowRoot.getElementById('companySelect');
        select.innerHTML = '<option value="">Seleccione una empresa...</option>';
        this.clients.forEach(client => {
            const option = document.createElement('option');
            option.value = client.id;
            option.textContent = `${client.name} (${client.cuit_cuil})`;
            select.appendChild(option);
        });
    }

    toggleCompanySelection(isCompany) {
        this.shadowRoot.getElementById('companyDropdownGroup').classList.toggle('hidden', !isCompany);
        if (!isCompany) {
            this.shadowRoot.getElementById('companySelect').value = '';
        }
    }

    // Método público para establecer datos iniciales
    setDetails(details, roomPrice) {
        this.shadowRoot.getElementById('roomIdInput').value = details.roomId;
        this.shadowRoot.getElementById('roomNameDisplay').value = details.roomName;
        this.shadowRoot.getElementById('startDate').value = details.startDate || '';
        this.shadowRoot.getElementById('endDate').value = details.endDate || '';
        this.shadowRoot.getElementById('clientName').value = details.clientName || '';
        this.shadowRoot.getElementById('statusSelect').value = details.status || 'reserved';
        const price = details.pricePerNight || roomPrice;
        this.shadowRoot.getElementById('pricePerNight').value = price.toFixed(2);
        
        // Cargar empresa si existe
        if (details.clientId) {
            this.shadowRoot.getElementById('isCompanyCheckbox').checked = true;
            this.toggleCompanySelection(true);
            setTimeout(() => { // Pequeño timeout para asegurar que el dropdown se haya renderizado
                this.shadowRoot.getElementById('companySelect').value = details.clientId;
            }, 50); 
        } else {
            this.shadowRoot.getElementById('isCompanyCheckbox').checked = false;
            this.toggleCompanySelection(false);
        }
    }

    // Método público para extraer todos los datos del formulario
    getDetails() {
        const isCompany = this.shadowRoot.getElementById('isCompanyCheckbox').checked;
        const companySelectValue = this.shadowRoot.getElementById('companySelect').value;

        return {
            room_id: parseInt(this.shadowRoot.getElementById('roomIdInput').value),
            status: this.shadowRoot.getElementById('statusSelect').value,
            client_name: this.shadowRoot.getElementById('clientName').value,
            start_date: this.shadowRoot.getElementById('startDate').value,
            end_date: this.shadowRoot.getElementById('endDate').value,
            price_per_night: parseFloat(this.shadowRoot.getElementById('pricePerNight').value),
            client_id: (isCompany && companySelectValue) ? parseInt(companySelectValue) : null // Aseguramos ID numérico o null
        };
    }
}
customElements.define('booking-details-form', BookingDetailsForm);
