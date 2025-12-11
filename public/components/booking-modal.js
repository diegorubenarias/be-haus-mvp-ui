class BookingModal extends HTMLElement {
    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });
        this.currentBookingId = null; 
        this.currentRoomPrice = 0; // Este es el precio base de la habitacion
        this.currentPricePerNight = 0; // Este es el precio de la reserva editable

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
                .btn-checkin { background-color: #ff9800; color: white; }
                .btn-checkout { background-color: #607d8b; color: white; }
                .billing-section { margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; }
                .consumption-item { display: flex; justify-content: space-between; padding: 5px 0; }
                .total-amount { font-size: 1.2em; font-weight: bold; margin-top: 10px; }
                .price-per-night-input { width: 50% !important; display: inline-block; }
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
                                <option value="checked-out">Checked-Out (Finalizada)</option>
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
                         <!-- NUEVO CAMPO EDITABLE DE PRECIO -->
                        <div class="form-group">
                            <label for="pricePerNight">Precio por Noche ($):</label>
                            <input type="number" id="pricePerNight" class="price-per-night-input" step="0.01" min="0">
                        </div>


                        <div class="billing-section" id="billingSection" style="display:none;">
                            <h4>Facturación y Consumos</h4>
                            <p>Estadía Total: <span id="stayDuration">0 noches</span> | Base: $<span id="stayCost">0.00</span></p>
                            <h5>Consumos Adicionales:</h5>
                            <div id="consumptionsList"></div>
                            <div class="total-amount">Total a Pagar: $<span id="totalAmountDisplay">0.00</span></div>
                            
                            <hr>
                            <div class="form-group">
                                <input type="text" id="consumptionDescription" placeholder="Descripción (ej: Minibar, Lavandería)">
                                <input type="number" id="consumptionAmount" placeholder="Monto ($)" min="0">
                                <button type="button" id="addConsumptionButton">Añadir Consumo</button>
                            </div>
                        </div>

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
        this.shadow.getElementById('closeModal').addEventListener('click', () => this.closeModal());
        this.shadow.getElementById('cancelButton').addEventListener('click', () => this.closeModal());
        
        this.shadow.getElementById('deleteButton').addEventListener('click', () => this.handleDelete());
        this.shadow.getElementById('checkInButton').addEventListener('click', () => this.handleCheckIn());
        this.shadow.getElementById('checkOutButton').addEventListener('click', () => this.handleCheckOut());
        
        // El botón de guardar cambios manual
        this.shadow.getElementById('saveButton').addEventListener('click', (e) => this.handleSave(e));
        
        // El botón para añadir consumos
        this.shadow.getElementById('addConsumptionButton').addEventListener('click', () => this.handleAddConsumption());

        // CLAVE: Escuchar el evento personalizado en el documento principal
        document.addEventListener('open-booking-modal', (e) => this.openModal(e.detail));
        
        // Listener para recalcular totales si cambian las fechas o el precio por noche
        this.shadow.getElementById('startDate').addEventListener('change', () => this.calculateTotals());
        this.shadow.getElementById('endDate').addEventListener('change', () => this.calculateTotals());
        this.shadow.getElementById('pricePerNight').addEventListener('change', () => this.calculateTotals());
    }

    // NUEVO: Funciones de Check-In/Out
    handleCheckIn() {
        this.shadow.getElementById('statusSelect').value = 'occupied';
        this.handleSave(); 
    }

    handleCheckOut() {
        const total = this.shadow.getElementById('totalAmountDisplay').textContent;
        if (confirm(`El total a pagar es $${total}. ¿Confirmar Check-Out y finalizar estadía?`)) {
            this.shadow.getElementById('statusSelect').value = 'checked-out';
            this.handleSave();
        }
    }


    async openModal(data) {
        this.currentBookingId = data.bookingId;
        this.shadow.getElementById('roomIdInput').value = data.roomId;
        this.shadow.getElementById('roomNameDisplay').value = data.roomName;
        this.currentRoomPrice = data.roomPrice || 0;

        // Limpiamos las fechas por defecto para nuevas reservas
        this.shadow.getElementById('startDate').value = data.startDate || '';
        this.shadow.getElementById('endDate').value = data.endDate || '';
        this.shadow.getElementById('clientName').value = data.clientName || '';
        this.shadow.getElementById('statusSelect').value = data.status || 'reserved';
        
        // Usamos el precio de la reserva si existe, sino el precio base de la habitacion
        this.currentPricePerNight = data.pricePerNight || this.currentRoomPrice;
        this.shadow.getElementById('pricePerNight').value = this.currentPricePerNight.toFixed(2);


        // Ocultar todos los botones de acción dinámicos por defecto
        this.shadow.getElementById('deleteButton').style.display = 'none';
        this.shadow.getElementById('checkInButton').style.display = 'none';
        this.shadow.getElementById('checkOutButton').style.display = 'none';
        this.shadow.getElementById('billingSection').style.display = 'none';

        if (this.currentBookingId) {
            // Es una reserva existente
            this.shadow.getElementById('modalTitle').textContent = 'Editar Reserva';
            this.shadow.getElementById('deleteButton').style.display = 'inline-block';
            
            // Lógica de botones de estado dinámicos
            if (data.status === 'reserved') {
                this.shadow.getElementById('checkInButton').style.display = 'inline-block';
            } else if (data.status === 'occupied') {
                this.shadow.getElementById('checkOutButton').style.display = 'inline-block';
                this.shadow.getElementById('billingSection').style.display = 'block';
                await this.fetchConsumptions(this.currentBookingId);
            }

        } else {
            this.shadow.getElementById('modalTitle').textContent = 'Nueva Reserva';
            // Para nuevas reservas, por ahora solo mostramos el botón de guardar.
        }

        this.calculateTotals();
        this.shadow.getElementById('bookingModalOverlay').style.display = 'flex';
    }
    
    closeModal() {
        this.shadow.getElementById('bookingModalOverlay').style.display = 'none';
        this.shadow.getElementById('bookingForm').reset();
        this.currentBookingId = null;
        this.shadow.getElementById('consumptionsList').innerHTML = '';
    }

    async handleSave(e) {
        if (e) e.preventDefault();
        
        const bookingData = {
            room_id: this.shadow.getElementById('roomIdInput').value,
            client_name: this.shadow.getElementById('clientName').value,
            start_date: this.shadow.getElementById('startDate').value,
            end_date: this.shadow.getElementById('endDate').value,
            status: this.shadow.getElementById('statusSelect').value,
            price_per_night: parseFloat(this.shadow.getElementById('pricePerNight').value) // Capturamos el precio editable
        };

        const method = this.currentBookingId ? 'PUT' : 'POST';
        const url = this.currentBookingId ? `/api/bookings/${this.currentBookingId}` : '/api/bookings';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookingData)
            });

            if (response.ok) {
                alert("Reserva guardada/actualizada exitosamente.");
                this.closeModal();
                // Notificar al planificador que debe refrescar los datos
                document.dispatchEvent(new CustomEvent('booking-saved'));
            } else {
                const errorData = await response.json();
                alert(`Error al guardar reserva: ${errorData.error}`);
            }
        } catch (error) {
            console.error("Error saving booking:", error);
            alert("Error de conexión al guardar la reserva.");
        }
    }

    async handleDelete() {
        if (!this.currentBookingId || !confirm("¿Está seguro de que desea eliminar esta reserva? Esta acción no se puede deshacer.")) return;

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
    
    // --- Lógica de Consumos (Billing) ---
    async fetchConsumptions(bookingId) {
        // Asume que el endpoint /api/bookings/:bookingId/consumptions existe (lo crearemos a continuacion)
        const response = await fetch(`/api/bookings/${bookingId}/consumptions`);
        if (response.ok) {
            const data = await response.json();
            this.renderConsumptions(data.data);
        } else {
            console.error("Error fetching consumptions");
            this.shadow.getElementById('consumptionsList').innerHTML = '<li>Error al cargar consumos.</li>';
        }
        this.calculateTotals();
    }

    // ... dentro de la clase BookingModal ... (busca la función renderConsumptions y reemplázala)

    renderConsumptions(consumptions) {
        const list = this.shadow.getElementById('consumptionsList');
        list.innerHTML = '';
        let consumptionsTotal = 0; // Acumulador para los totales

        if (consumptions.length === 0) {
            list.innerHTML = '<p>No hay consumos registrados para esta estadía.</p>';
        } else {
            consumptions.forEach(item => {
                const div = document.createElement('div');
                div.classList.add('consumption-item');
                div.innerHTML = `
                    <span>${item.description}</span>
                    <span>$${item.amount.toFixed(2)}</span>
                `;
                list.appendChild(div);
                consumptionsTotal += item.amount; // Sumamos al total
            });
        }
        // Llamamos a la función que actualiza la UI del total
        this.updateTotalAmount(consumptionsTotal);
    }

    // Esta funcion es llamada por fetchConsumptions para actualizar el total final (FALTABA)
    updateTotalAmount(consumptionsTotal = 0) {
         // Asegúrate de que stayCost tenga un valor numérico válido
         const stayCostText = this.shadow.getElementById('stayCost').textContent.replace('$', '').replace(',', '') || '0';
         const stayCost = parseFloat(stayCostText);
         
         const total = stayCost + consumptionsTotal;
         this.shadow.getElementById('totalAmountDisplay').textContent = total.toFixed(2);
    }



    async handleAddConsumption() {
        const descriptionInput = this.shadow.getElementById('consumptionDescription');
        const amountInput = this.shadow.getElementById('consumptionAmount');
        const description = descriptionInput.value;
        const amount = parseFloat(amountInput.value);

        if (!description || isNaN(amount) || amount <= 0 || !this.currentBookingId) {
            alert("Ingrese una descripción y un monto válido.");
            return;
        }

        // Asume que el endpoint /api/consumptions existe (lo crearemos a continuacion)
        const response = await fetch('/api/consumptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                booking_id: this.currentBookingId, 
                description, 
                amount,
                date: new Date().toISOString().split('T')[0]
            })
        });

        if (response.ok) {
            // Refrescar lista de consumos y totales
            descriptionInput.value = '';
            amountInput.value = '';
            await this.fetchConsumptions(this.currentBookingId);
        } else {
            alert("Error al añadir consumo.");
        }
    }
    
    calculateTotals() {
        const start = new Date(this.shadow.getElementById('startDate').value);
        const end = new Date(this.shadow.getElementById('endDate').value);
        const pricePerNight = parseFloat(this.shadow.getElementById('pricePerNight').value) || 0;
        
        let durationDays = 0;
        if (start && end && end > start) {
            // Calculamos noches: diferencia en milisegundos / milisegundos por día
            const diffTime = Math.abs(end - start);
            durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        const stayCost = durationDays * pricePerNight;
        this.shadow.getElementById('stayDuration').textContent = `${durationDays} noches`;
        this.shadow.getElementById('stayCost').textContent = stayCost.toFixed(2);

        // Sumar consumos (simplificado, ya que los consumos se fetchan async)
        // Esta parte asume que fetchConsumptions ya actualizó la UI y se recalculará al cargar.
        // Para ser precisos, deberíamos tener una variable local de consumos.
        // Por ahora, el cálculo total se hace bien al cargar/añadir consumos.
    }

    // Esta funcion es llamada por fetchConsumptions para actualizar el total final
    updateTotalAmount(consumptionsTotal = 0) {
         const stayCost = parseFloat(this.shadow.getElementById('stayCost').textContent) || 0;
         const total = stayCost + consumptionsTotal;
         this.shadow.getElementById('totalAmountDisplay').textContent = total.toFixed(2);
    }
    
}

customElements.define('booking-modal', BookingModal);
