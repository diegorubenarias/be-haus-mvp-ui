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
// ... dentro de la clase BookingModal ...

    // ... dentro de la clase BookingModal ...

    async handleCheckOut() {
        // Asegúrate de que tenemos un ID de reserva válido O que se va a crear uno nuevo en handleSave
        // Si this.currentBookingId es null, handleSave creará uno y lo devolverá.
        if (!this.currentBookingId) {
             // Si no hay ID actual y estamos intentando hacer check-out, algo raro pasa.
             // En un flujo normal de check-out, la reserva ya existe.
             alert("Error: No se puede facturar una reserva inexistente.");
             return;
        }

        const total = this.shadow.getElementById('totalAmountDisplay').textContent;
        if (confirm(`El total a pagar es $${total}. ¿Confirmar Check-Out y generar factura?`)) {
            // 1. Establecer el estado a checked-out en el select
            this.shadow.getElementById('statusSelect').value = 'checked-out';
            
            try {
                // 2. Guardar/actualizar la reserva. Esperamos a que termine y CAPTURAMOS el ID devuelto.
                // handleSave() devuelve this.currentBookingId al finalizar.
               await this.handleSave(); 
                
                // 3. Si se guardó correctamente, generamos la factura usando el ID retornado.
                if (this.currentBookingId) {
                    await this.generateInvoice(this.currentBookingId);
                } else {
                    throw new Error("El ID de reserva necesario para facturar no se pudo obtener.");
                }
                
            } catch (error) {
                // handleSave o generateInvoice pueden lanzar errores que capturamos aquí
                console.error("Error durante el check-out:", error);
                alert("Ocurrió un error crítico durante el check-out o la facturación: " + error.message);
            }
        }
    }

// ...


    // NUEVA FUNCION: Generar la factura
    async generateInvoice(bookingId) {
        try {
            const response = await fetch(`/api/invoices/generate/${bookingId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.ok) {
                const data = await response.json();
                alert(`Check-out completado. Factura #${data.invoiceNumber} generada exitosamente.`);
                // Opcional: Redirigir al usuario a ver la factura generada
                // window.location.href = `/invoices.html?id=${data.invoiceId}`;
            } else {
                const errorData = await response.json();
                alert(`Facturación completada con advertencias: ${errorData.error}`);
            }
        } catch (error) {
            console.error("Error generating invoice:", error);
            alert("Error de conexión al generar la factura. Revise el backend.");
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
        //this.currentBookingId = null;
        this.shadow.getElementById('consumptionsList').innerHTML = '';
    }

    // ... dentro de la clase BookingModal ...

    async handleSave(e) {
        if (e) e.preventDefault();
        
        const bookingData = {
            room_id: this.shadow.getElementById('roomIdInput').value,
            client_name: this.shadow.getElementById('clientName').value,
            start_date: this.shadow.getElementById('startDate').value,
            end_date: this.shadow.getElementById('endDate').value,
            status: this.shadow.getElementById('statusSelect').value,
            price_per_night: parseFloat(this.shadow.getElementById('pricePerNight').value)
        };

        if (!bookingData.client_name || !bookingData.start_date || !bookingData.end_date) {
            alert("Por favor complete todos los campos requeridos (Nombre, Fecha Inicio, Fecha Fin).");
            // Si validamos aquí, devolvemos null o lanzamos un error si es necesario en el flujo de checkout.
            if (e) return null; 
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
                const result = await response.json();

                if (method === 'POST' && result.id) {
                    // Capturamos el nuevo ID en la propiedad del objeto
                    this.currentBookingId = result.id;
                }
                
                // Notificar al planificador que debe refrescar los datos
                document.dispatchEvent(new CustomEvent('booking-saved'));

                this.closeModal(); 
                
                // *** CLAVE: Devolvemos explícitamente el ID de la reserva ***
                return this.currentBookingId; 

            } else {
                const errorData = await response.json();
                // Si la respuesta no es OK, lanzamos un error con el mensaje del backend
                throw new Error(errorData.error || "Error desconocido al guardar reserva.");
            }
        } catch (error) {
            console.error("Error saving booking:", error);
            alert(`Error de conexión/lógica al guardar la reserva: ${error.message}`);
            // Propagamos el error para que handleCheckOut lo capture y detenga el flujo de facturación.
            throw error; 
        }
    }

// ...

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

     renderConsumptions(consumptions) {
        const list = this.shadow.getElementById('consumptionsList');
        list.innerHTML = '';
        let consumptionsTotal = 0; // Acumulador

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
        // CLAVE: Llama a la función que actualiza la UI del total, pasándole el total calculado
        this.updateTotalAmount(consumptionsTotal);
    }

    
        calculateTotals() {
        // Obtenemos los valores de los inputs. El formato debe ser YYYY-MM-DD (TEXTO)
        const startDateValue = this.shadow.getElementById('startDate').value;
        const endDateValue = this.shadow.getElementById('endDate').value;
        const pricePerNight = parseFloat(this.shadow.getElementById('pricePerNight').value) || 0;
        
        let durationDays = 0;

        // Validamos que ambas fechas existan y la de fin sea posterior a la de inicio
        if (startDateValue && endDateValue) {
            // Creamos objetos Date. Usamos el formato 'T00:00:00Z' para asegurar que SQLite y JS 
            // interpreten la fecha de la misma manera (UTC medianoche), evitando problemas de huso horario.
            const start = new Date(startDateValue + 'T00:00:00Z');
            const end = new Date(endDateValue + 'T00:00:00Z');

            if (end > start) {
                const diffTime = Math.abs(end - start);
                // Calculamos las noches. Usamos Math.round() porque la diferencia de días
                // debería ser un número entero si las fechas son solo YYYY-MM-DD.
                durationDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
            }
        }

        const stayCost = durationDays * pricePerNight;

        // Actualizamos los elementos visuales del modal con los nuevos valores calculados
        this.shadow.getElementById('stayDuration').textContent = `${durationDays} noches`;
        this.shadow.getElementById('stayCost').textContent = stayCost.toFixed(2);
        
        // Llamamos a esta función para asegurarnos de que el total final se actualice, 
        // sumando cualquier consumo que ya esté listado.
        // Si no hay consumos cargados, consumptionsTotal será 0 por defecto.
        //this.updateTotalAmount(); 
    }


    // ... dentro de la clase BookingModal ...

    async handleAddConsumption() {
        const descriptionInput = this.shadow.getElementById('consumptionDescription');
        const amountInput = this.shadow.getElementById('consumptionAmount');
        const description = descriptionInput.value;
        const amount = parseFloat(amountInput.value);

        if (!description || isNaN(amount) || amount <= 0 || !this.currentBookingId) {
            alert("Ingrese una descripción y un monto válido.");
            return;
        }

        // Asume que el endpoint /api/consumptions existe
        const response = await fetch('/api/consumptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                booking_id: this.currentBookingId, 
                description, 
                amount,
                date: new Date().toISOString().split('T')[0] // Aseguramos formato YYYY-MM-DD
            })
        });

        if (response.ok) {
            // Refrescar lista de consumos y totales
            descriptionInput.value = '';
            amountInput.value = '';
            // Después de añadir, volvemos a fetchear los consumos, lo cual llama a renderConsumptions, que llama a updateTotalAmount
            await this.fetchConsumptions(this.currentBookingId); 
        } else {
            alert("Error al añadir consumo.");
        }
    }
    
    // Esta funcion es llamada por fetchConsumptions -> renderConsumptions para actualizar el total final
      // Esta funcion recibe ahora el total de consumos desde renderConsumptions
    updateTotalAmount(consumptionsTotal = 0) {
         const stayCostText = this.shadow.getElementById('stayCost').textContent.replace('$', '').replace(',', '') || '0.00';
         const stayCost = parseFloat(stayCostText);
         
         // Ahora suma correctamente ambos valores
         const total = stayCost + consumptionsTotal;
         this.shadow.getElementById('totalAmountDisplay').textContent = total.toFixed(2);
    }
}

customElements.define('booking-modal', BookingModal);
