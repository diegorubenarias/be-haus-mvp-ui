class BookingModal extends HTMLElement {
    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });
        this.shadow.innerHTML = `
            <style>
                /* (Mantén los mismos estilos CSS que antes para el modal) */
                .modal-overlay {
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0, 0, 0, 0.6); display: none; 
                    justify-content: center; align-items: center; z-index: 1000;
                }
                .modal-content {
                    background: white; padding: 30px; border-radius: 8px;
                    width: 400px; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
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
                button {
                    padding: 10px 15px; background-color: #0056b3;
                    color: white; border: none; cursor: pointer; margin-top: 10px;
                }
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
                        <button type="submit">Guardar Cambios</button>
                    </form>
                </div>
            </div>
        `;
    }

    connectedCallback() {
        document.addEventListener('open-booking-modal', (e) => this.openModal(e.detail));
        this.shadow.getElementById('closeModal').addEventListener('click', () => this.closeModal());
        this.shadow.getElementById('bookingForm').addEventListener('submit', (e) => this.handleSave(e));
    }

    openModal(data) {
        this.shadow.getElementById('roomIdInput').value = data.roomId;
        // Si hay un bookingId, podrías hacer un fetch para precargar todos los datos reales aquí
        // Por ahora, solo abrimos el modal con lo básico.
        this.shadow.getElementById('bookingModalOverlay').style.display = 'flex';
    }

    closeModal() {
        this.shadow.getElementById('bookingModalOverlay').style.display = 'none';
        this.shadow.getElementById('bookingForm').reset(); // Limpiar formulario al cerrar
    }

    async handleSave(e) {
        e.preventDefault();
        
        const roomId = parseInt(this.shadow.getElementById('roomIdInput').value);
        const status = this.shadow.getElementById('statusSelect').value;
        const clientName = this.shadow.getElementById('clientName').value;
        const startDate = this.shadow.getElementById('startDate').value;
        const endDate = this.shadow.getElementById('endDate').value;

        // Validación simple
        if (!clientName || !startDate || !endDate) {
            alert("Por favor completa todos los campos de fecha y nombre.");
            return;
        }

        const bookingData = {
            room_id: roomId,
            client_name: clientName,
            start_date: startDate,
            end_date: endDate,
            status: status
        };

        // Enviar datos al backend
        try {
            const response = await fetch('/api/bookings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(bookingData)
            });

            if (response.ok) {
                alert("Reserva guardada exitosamente en la base de datos.");
                this.closeModal();
                // Notificar al room-planner que debe refrescar sus datos
                document.dispatchEvent(new CustomEvent('booking-saved', { bubbles: true, composed: true }));

            } else {
                const errorData = await response.json();
                alert("Error al guardar la reserva: " + errorData.error);
            }
        } catch (error) {
            console.error("Error en la petición POST:", error);
            alert("Error de conexión al servidor.");
        }
    }
}

customElements.define('booking-modal', BookingModal);
