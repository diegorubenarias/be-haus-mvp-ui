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
                .button-group { display: flex; justify-content: space-between; margin-top: 20px; }
                button { padding: 10px 15px; border: none; cursor: pointer; }
                .btn-save { background-color: #0056b3; color: white; }
                .btn-delete { background-color: #f44336; color: white; }
                .btn-cancel { background-color: #ccc; color: black; }
                .btn-checkin { background-color: #ff9800; color: white; }
                .btn-checkout { background-color: #607d8b; color: white; }
            </style>
            <div class="modal-overlay" id="bookingModalOverlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="modalTitle">Detalle de Reserva</h3>
                        <button class="close-button" id="closeModal">&times;</button>
                    </div>
                    <form id="bookingForm">
                        <!-- Componente de Detalles -->
                        <booking-details-form id="detailsForm"></booking-details-form>
                        
                        <!-- Componente de Facturación/Consumos -->
                        <billing-consumption-panel id="billingPanel" style="display:none;"></billing-consumption-panel>

                        <div class="button-group">
                            <button type="button" class="btn-cancel" id="cancelButton">Cancelar</button>
                            <button type="button" class="btn-delete" id="deleteButton" style="display:none;">Cancelar Reserva (Eliminar)</button>
                            <button type="button" class="btn-checkin" id="checkInButton" style="display:none;">Realizar Check-In</button>
                            <button type="button" class="btn-checkout" id="checkOutButton" style="display:none;">Facturar y Check-Out</button>
                            <button type="button" class="btn-save" id="saveButton">Guardar Cambios</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }

    connectedCallback() {
        // Event listeners locales del shell
        this.shadow.getElementById('closeModal').addEventListener('click', () => this.closeModal());
        this.shadow.getElementById('cancelButton').addEventListener('click', () => this.closeModal());
        this.shadow.getElementById('deleteButton').addEventListener('click', () => this.handleDelete());
        this.shadow.getElementById('checkInButton').addEventListener('click', () => this.handleCheckIn());
        this.shadow.getElementById('checkOutButton').addEventListener('click', () => this.handleCheckOut());
        this.shadow.getElementById('saveButton').addEventListener('click', () => this.handleSave());
        
        // Escuchar eventos globales del dashboard
        document.addEventListener('open-booking-modal', (e) => this.openModal(e.detail));
        
        // Escuchar eventos de los subcomponentes
        this.shadow.getElementById('detailsForm').addEventListener('details-changed', () => this.syncDetailsToBilling());
        this.addEventListener('get-booking-id', (e) => e.detail.callback(this.currentBookingId)); // Maneja la petición de ID desde el panel de consumos
    }
    
    // Sincroniza datos del formulario principal al panel de facturación
    syncDetailsToBilling() {
        const details = this.shadow.getElementById('detailsForm').getDetails();
        this.shadow.getElementById('billingPanel').calculateTotals(
            details.start_date, details.end_date, details.price_per_night
        );
    }

    async openModal(data) {
        this.currentBookingId = data.bookingId;
        this.currentRoomPrice = data.roomPrice || 0;
        
        // Pasar datos iniciales al subcomponente de detalles
        this.shadow.getElementById('detailsForm').setDetails(data, this.currentRoomPrice);

        // Actualizar visibilidad de botones y panel de facturación
        this.updateActionButtonVisibility(data.status);
        if (data.status === 'occupied' || data.status === 'checked-out') {
            this.shadow.getElementById('billingPanel').fetchConsumptions(this.currentBookingId);
        }
        
        this.shadow.getElementById('modalTitle').textContent = data.bookingId ? 'Editar Reserva' : 'Nueva Reserva';
        this.syncDetailsToBilling();
        this.shadow.getElementById('bookingModalOverlay').style.display = 'flex';
    }
    
    closeModal() {
        this.shadow.getElementById('bookingModalOverlay').style.display = 'none';
        // Emitir evento personalizado para que el padre (dashboard) refresque datos
        this.dispatchEvent(new CustomEvent('booking-updated', { bubbles: true, composed: true }));
        this.shadow.getElementById('bookingForm').reset();
    }
    
    updateActionButtonVisibility(status) {
        // ... Lógica de visibilidad de botones (simplificada) ...
        this.shadow.getElementById('saveButton').style.display = 'inline-block';
        this.shadow.getElementById('deleteButton').style.display = 'none';
        this.shadow.getElementById('checkInButton').style.display = 'none';
        this.shadow.getElementById('checkOutButton').style.display = 'none';
        this.shadow.getElementById('billingPanel').style.display = 'none';

        if (this.currentBookingId) {
            this.shadow.getElementById('deleteButton').style.display = 'inline-block';
            if (status === 'reserved' || status === 'liberated') {
                this.shadow.getElementById('checkInButton').style.display = 'inline-block';
            } else if (status === 'occupied') {
                this.shadow.getElementById('checkOutButton').style.display = 'inline-block';
                this.shadow.getElementById('billingPanel').style.display = 'block';
            }
        }
    }

    // --- Funciones de Acción ---

    async handleSave() {
        // Obtiene TODOS los datos, incluyendo client_email, gracias a la modificación anterior de getDetails()
        const bookingData = this.shadow.getElementById('detailsForm').getDetails();
        
        // Añadimos validación básica para el email si es una nueva reserva o si lo requieres siempre
        if (!bookingData.client_name || !bookingData.start_date || !bookingData.end_date ) {
            alert("Por favor complete todos los campos requeridos (Nombre, Fecha Inicio, Fecha Fin, Email).");
            return;
        }

        const method = this.currentBookingId ? 'PUT' : 'POST';
        const url = this.currentBookingId ? `/api/bookings/${this.currentBookingId}` : '/api/bookings';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 
                    'Content-Type': 'application/json',
                    // Asegúrate de añadir tu token de auth aquí si lo usas con cookies/localStorage
                },
                body: JSON.stringify(bookingData) // Envía el objeto completo, ahora con 'client_email'
            });

            if (response.ok) {
                const result = await response.json();
                if (method === 'POST' && result.id) {
                    this.currentBookingId = result.id;
                }
                document.dispatchEvent(new CustomEvent('booking-saved'));
                this.closeModal(); 

            } else {
                const errorData = await response.json();
                alert("Error al guardar la reserva: " + (errorData.error || "Error desconocido"));
            }
        } catch (error) {
            console.error('Fetch error:', error);
            alert("Hubo un error de conexión con el servidor.");
        }
    }
    
    handleCheckIn() {
        // Obtenemos el statusSelect del subcomponente y lo actualizamos antes de guardar
        this.shadow.getElementById('detailsForm').shadowRoot.getElementById('statusSelect').value = 'occupied';
        this.handleSave();
    }

    async handleCheckOut() {
        if (!this.currentBookingId) {
             alert("Error: No se puede facturar una reserva inexistente.");
             return;
        }

        const billingPanel = this.shadow.getElementById('billingPanel');
        const paymentMethod = billingPanel.getPaymentMethod();
        const total = billingPanel.shadowRoot.getElementById('totalAmountDisplay').textContent;

        if (confirm(`El total a pagar es $${total}. ¿Confirmar Check-Out y generar factura?`)) {
            // 1. Establecer el estado a checked-out en el subcomponente
            this.shadow.getElementById('detailsForm').shadowRoot.getElementById('statusSelect').value = 'checked-out';
            
            try {
                // 2. Guardar/actualizar la reserva.
               await this.handleSave(); 
                
                // 3. Generamos la factura.
                await this.generateInvoice(this.currentBookingId, paymentMethod); 
                
            } catch (error) {
                console.error("Error durante el check-out:", error);
                alert("Ocurrió un error crítico durante el check-out o la facturación: " + error.message);
            }
        }
    }
    
    async generateInvoice(bookingId, paymentMethod) {
        try {
            const response = await fetch(`/api/invoices/generate/${bookingId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ payment_method: paymentMethod }) 
            });

            if (response.ok) {
                const data = await response.json();
                alert(`Check-out completado. Factura #${data.invoiceNumber} generada exitosamente.`);
                document.dispatchEvent(new CustomEvent('booking-saved'));
                this.closeModal();
            } else {
                const errorData = await response.json();
                alert(`Facturación completada con advertencias: ${errorData.error}`);
            }
        } catch (error) {
            console.error("Error generating invoice:", error);
            alert("Error de conexión al generar la factura. Revise el backend.");
        }
    }

    async handleDelete() {
        if (!this.currentBookingId || !confirm("¿Está seguro de que desea eliminar esta reserva?")) return;

        try {
            const response = await fetch(`/api/bookings/${this.currentBookingId}`, { method: 'DELETE' });
            if (response.ok) {
                alert("Reserva eliminada exitosamente.");
                this.closeModal();
                document.dispatchEvent(new CustomEvent('booking-saved'));
            } else {
                const errorData = await response.json();
                alert(`Error al eliminar reserva: ${errorData.error}`);
            }
        } catch (error) {
            alert("Error de conexión al eliminar la reserva.");
        }
    }
}

customElements.define('booking-modal', BookingModal);
