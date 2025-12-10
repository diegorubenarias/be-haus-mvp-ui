class BookingModal extends HTMLElement {
    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });
        this.currentBookingId = null; // Para rastrear si estamos editando o creando
        this.shadow.innerHTML = `
            <style>
                .modal-overlay {
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0, 0, 0, 0.6); display: none; 
                    justify-content: center; align-items: center; z-index: 1000;
                }
                .modal-content {
                    background: white; padding: 30px; border-radius: 8px;
                    width: 450px; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
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
            </style>
            <div class="modal-overlay" id="bookingModalOverlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="modalTitle">Detalle de Reserva</h3>
                        <button class="close-button" id="closeModal">&times;</button>
                    </div>
                    <form id="bookingForm">
                        <div class="form-group">
                            <label>Habitación ID:</label>
                            <input type="text" id="roomIdInput" readonly>
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
                        <div class="button-group">
                            <button type="button" class="btn-cancel" id="cancelButton">Cancelar</button>
                            <button type="button" class="btn-delete" id="deleteButton" style="display:none;">Eliminar</button>
                            <button type="submit" class="btn-save">Guardar Cambios</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }

    connectedCallback() {
        document.addEventListener('open-booking-modal', (e) => this.openModal(e.detail));
        this.shadow.getElementById('closeModal').addEventListener('click', () => this.closeModal());
        this.shadow.getElementById('cancelButton').addEventListener('click', () => this.closeModal());
        this.shadow.getElementById('bookingForm').addEventListener('submit', (e) => this.handleSave(e));
        this.shadow.getElementById('deleteButton').addEventListener('click', () => this.handleDelete());
    }

    // ... dentro de BookingModal class ...

    // Eliminar la función fetchBookingDetails() ya que los datos vienen en el evento openModal

    openModal(data) {
        this.currentBookingId = data.bookingId;
        this.shadow.getElementById('roomIdInput').value = data.roomId;
        
        // Cargar datos si es una edición (data.bookingDetails ahora viene del planner)
        if (this.currentBookingId && data.bookingDetails) {
            const details = data.bookingDetails;
            this.shadow.getElementById('modalTitle').textContent = `Editar Reserva #${this.currentBookingId}`;
            this.shadow.getElementById('deleteButton').style.display = 'inline-block';
            
            // Precargar el formulario con datos reales
            this.shadow.getElementById('statusSelect').value = details.status;
            this.shadow.getElementById('clientName').value = details.client_name;
            this.shadow.getElementById('startDate').value = details.start_date;
            this.shadow.getElementById('endDate').value = details.end_date;

        } else {
            this.shadow.getElementById('modalTitle').textContent = `Nueva Reserva para Hab ${data.roomId}`;
            this.shadow.getElementById('deleteButton').style.display = 'none';
            // Opcional: precargar la fecha de inicio con el día clickeado si te parece útil
            // const clickedDate = ... logic to get date from data.day ...
        }
        
        this.shadow.getElementById('bookingModalOverlay').style.display = 'flex';
    }

// ... el resto de funciones (handleSave, handleDelete, closeModal) se mantienen ...

    
    async fetchBookingDetails(id) {
        // En un sistema real, harías GET /api/bookings/:id
        // Como tenemos los datos en el planner, esto es temporalmente complejo.
        // Por ahora, el modal espera a ser llenado por el usuario o usaré datos mock si es necesario.
        // Mejoraremos esto cuando implementemos la carga dinámica en room-planner.js
        console.log(`Fetching details for booking ID ${id} is not fully implemented yet.`);
    }

    closeModal() {
        this.shadow.getElementById('bookingModalOverlay').style.display = 'none';
        this.shadow.getElementById('bookingForm').reset();
        this.currentBookingId = null;
    }

    async handleSave(e) {
        e.preventDefault();
        const bookingData = {
            room_id: parseInt(this.shadow.getElementById('roomIdInput').value),
            status: this.shadow.getElementById('statusSelect').value,
            client_name: this.shadow.getElementById('clientName').value,
            start_date: this.shadow.getElementById('startDate').value,
            end_date: this.shadow.getElementById('endDate').value,
        };

        if (!bookingData.client_name || !bookingData.start_date || !bookingData.end_date) {
            alert("Por favor completa todos los campos.");
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
}

customElements.define('booking-modal', BookingModal);
