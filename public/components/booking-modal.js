class BookingModal extends HTMLElement {
    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });
        this.currentBookingId = null; 
        this.currentRoomPrice = 0;

        this.shadow.innerHTML = `
            <style>
                .modal-overlay {
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0, 0, 0, 0.6); display: none; 
                    justify-content: center; align-items: center; z-index: 1000;
                }
                .modal-content {
                    background: white; padding: 30px; border-radius: 8px;
                    width: 500px; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3); 
                    max-height: 80vh; overflow-y: auto;
                }
                .modal-header {
                    display: flex; justify-content: space-between;
                    align-items: center; border-bottom: 1px solid #eee;
                    padding-bottom: 10px; margin-bottom: 20px;
                }
                .close-button {
                    background: none; border: none; font-size: 24px; cursor: pointer;
                }
                .form-group { margin-bottom: 15px; }
                label { display: block; margin-bottom: 5px; font-weight: bold; }
                input, select { width: 100%; padding: 8px; box-sizing: border-box; }
                .button-group { display: flex; justify-content: space-between; margin-top: 20px; }
                button { padding: 10px 15px; border: none; cursor: pointer; }
                .btn-save { background-color: #0056b3; color: white; }
                .btn-delete { background-color: #f44336; color: white; }
                .btn-cancel { background-color: #ccc; color: black; }
                
                .billing-section { margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; }
                .consumption-item { display: flex; justify-content: space-between; padding: 5px 0; }
                .total-amount { font-size: 1.2em; font-weight: bold; margin-top: 10px; }
            </style>
            <div class="modal-overlay" id="bookingModalOverlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="modalTitle">Detalle de Reserva</h3>
                        <button class="close-button" id="closeModal">&times;</button>
                    </div>
                    <form id="bookingForm">
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
                                <option value="blocked">Bloqueada</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="clientName">Nombre del Ocupante:</label>
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

                        <!-- SECCION DE FACTURACION -->
                        <div class="billing-section" id="billingSection" style="display:none;">
                            <h4>Facturación y Consumos</h4>
                            <p>Estadía Total: <span id="stayDuration">0 noches</span> | Base: $<span id="stayCost">0.00</span></p>
                            <h5>Consumos Adicionales:</h5>
                            <div id="consumptionsList"></div>
                            <div class="total-amount">Total a Pagar: $<span id="totalAmountDisplay">0.00</span></div>
                            
                            <!-- Formulario para añadir nuevo consumo -->
                            <hr>
                            <div class="form-group">
                                <input type="text" id="consumptionDescription" placeholder="Descripción (ej: Minibar, Lavandería)">
                                <input type="number" id="consumptionAmount" placeholder="Monto ($)" min="0">
                                <button type="button" id="addConsumptionButton">Añadir Consumo</button>
                            </div>
                        </div>

                        <div class="button-group">
                            <button type="button" class="btn-cancel" id="cancelButton">Cancelar</button>
                            <button type="button" class="btn-delete" id="deleteButton" style="display:none;">Eliminar</button>
                            <button type="button" class="btn-save">Guardar Cambios</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }

    connectedCallback() {
        this.shadow.getElementById('closeModal').addEventListener('click', () => this.closeModal());
        this.shadow.getElementById('cancelButton').addEventListener('click', () => this.closeModal());
        
        // Listener para los botones de acción
        this.shadow.getElementById('deleteButton').addEventListener('click', () => this.handleDelete());
        this.shadow.querySelector('.btn-save').addEventListener('click', (e) => this.handleSave(e));
        this.shadow.getElementById('addConsumptionButton').addEventListener('click', () => this.handleAddConsumption());
    }

    openModal(data) {
        this.currentBookingId = data.bookingId;
        this.shadow.getElementById('roomIdInput').value = data.roomId;
        this.shadow.getElementById('roomNameDisplay').value = data.roomName;
        this.currentRoomPrice = data.roomPrice || 0;

        if (this.currentBookingId && data.bookingDetails) {
            const details = data.bookingDetails;
            this.shadow.getElementById('modalTitle').textContent = `Editar Reserva #${this.currentBookingId}`;
            this.shadow.getElementById('deleteButton').style.display = 'inline-block';
            this.shadow.getElementById('billingSection').style.display = 'block';

            this.shadow.getElementById('statusSelect').value = details.status;
            this.shadow.getElementById('clientName').value = details.client_name;
            this.shadow.getElementById('startDate').value = details.start_date;
            this.shadow.getElementById('endDate').value = details.end_date;
            
            this.loadBillingDetails();

        } else {
            this.shadow.getElementById('modalTitle').textContent = `Nueva Reserva para Hab ${data.roomId}`;
            this.shadow.getElementById('deleteButton').style.display = 'none';
            this.shadow.getElementById('billingSection').style.display = 'none';
        }
        
        this.shadow.getElementById('bookingModalOverlay').style.display = 'flex';
    }
    
    closeModal() {
        this.shadow.getElementById('bookingModalOverlay').style.display = 'none';
        this.shadow.getElementById('bookingForm').reset();
        this.currentBookingId = null;
    }

    async handleSave(e) {
        // e.preventDefault() no es necesario si el botón es type="button"

        const bookingData = {
            room_id: parseInt(this.shadow.getElementById('roomIdInput').value),
            status: this.shadow.getElementById('statusSelect').value,
            client_name: this.shadow.getElementById('clientName').value,
            start_date: this.shadow.getElementById('startDate').value,
            end_date: this.shadow.getElementById('endDate').value,
        };

        if (!bookingData.client_name || !bookingData.start_date || !bookingData.end_date) {
            alert("Por favor completa todos los campos de fecha y nombre.");
            return;
        }

        const method = this.currentBookingId ? 'PUT' : 'POST';
        const url = this.currentBookingId ? `/api/bookings/${this.currentBookingId}` : '/api/bookings';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookingData)
            });

            if (response.ok) {
                alert(`Reserva ${this.currentBookingId ? 'actualizada' : 'creada'} exitosamente.`);
                this.closeModal();
                // Notificar al room-planner que debe refrescar sus datos
                document.dispatchEvent(new CustomEvent('booking-saved', { bubbles: true, composed: true }));

            } else {
                const errorData = await response.json();
                alert("Error al guardar la reserva: " + errorData.error);
            }
        } catch (error) {
            console.error("Error en la petición:", error);
            alert("Error de conexión al servidor.");
        }
    }

    async handleDelete() {
        if (!confirm("¿Estás seguro de que deseas cancelar esta reserva?")) return;

        try {
            const response = await fetch(`/api/bookings/${this.currentBookingId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                alert("Reserva eliminada exitosamente.");
                this.closeModal();
                document.dispatchEvent(new CustomEvent('booking-saved', { bubbles: true, composed: true }));
            } else {
                const errorData = await response.json();
                alert("Error al eliminar la reserva: " + errorData.error);
            }
        } catch (error) {
            console.error("Error en la petición DELETE:", error);
            alert("Error de conexión al servidor.");
        }
    }

    async loadBillingDetails() {
        const startDate = new Date(this.shadow.getElementById('startDate').value + 'T00:00:00Z');
        const endDate = new Date(this.shadow.getElementById('endDate').value + 'T00:00:00Z');
        const stayDurationMs = endDate - startDate;
        const stayNights = Math.floor(stayDurationMs / (1000 * 60 * 60 * 24));
        const baseCost = stayNights * this.currentRoomPrice;

        this.shadow.getElementById('stayDuration').textContent = `${stayNights} noches`;
        this.shadow.getElementById('stayCost').textContent = `${baseCost.toFixed(2)}`;

        const response = await fetch(`/api/consumptions/${this.currentBookingId}`);
        const data = await response.json();
        const consumptions = data.data;

        const list = this.shadow.getElementById('consumptionsList');
        list.innerHTML = '';
        let totalConsumptions = 0;

        if (consumptions.length > 0) {
            consumptions.forEach(item => {
                const div = document.createElement('div');
                div.classList.add('consumption-item');
                div.innerHTML = `<span>${item.description}</span><span>$${item.amount.toFixed(2)}</span>`;
                list.appendChild(div);
                totalConsumptions += item.amount;
            });
        } else {
            list.innerHTML = '<p>No hay consumos registrados.</p>';
        }

        const totalAmount = baseCost + totalConsumptions;
        this.shadow.getElementById('totalAmountDisplay').textContent = `${totalAmount.toFixed(2)}`;
    }
    
    async handleAddConsumption() {
        const description = this.shadow.getElementById('consumptionDescription').value;
        const amount = parseFloat(this.shadow.getElementById('consumptionAmount').value);

        if (!description || isNaN(amount) || amount <= 0) {
            alert("Ingrese una descripción y un monto válido.");
            return;
        }

        const newConsumption = {
            booking_id: this.currentBookingId,
            description: description,
            amount: amount,
            date: new Date().toISOString().split('T')[0] // Formato YYYY-MM-DD
        };

        await fetch('/api/consumptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newConsumption)
        });

        // Refrescar la sección de facturación
        this.loadBillingDetails();
        this.shadow.getElementById('consumptionDescription').value = '';
        this.shadow.getElementById('consumptionAmount').value = '';
    }
}

customElements.define('booking-modal', BookingModal);
