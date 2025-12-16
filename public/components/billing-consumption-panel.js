// public/components/billing-consumption-panel.js
class BillingConsumptionPanel extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
            <style>
                .billing-section { margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; }
                .consumption-item { display: flex; justify-content: space-between; padding: 5px 0; }
                .total-amount { font-size: 1.2em; font-weight: bold; margin-top: 10px; }
                .form-group { margin-bottom: 15px; }
                input, select, button { padding: 8px; box-sizing: border-box; }
                #consumptionDescription { width: 50%; }
                #consumptionAmount { width: 25%; }
                #addConsumptionButton { width: 20%; }
            </style>
            <div class="billing-section">
                <h4>Facturación y Consumos</h4>
                <p>Estadía Total: <span id="stayDuration">0 noches</span> | Base: $<span id="stayCost">0.00</span></p>
                <h5>Consumos Adicionales:</h5>
                <div id="consumptionsList"></div>
                <div class="total-amount">Total a Pagar: $<span id="totalAmountDisplay">0.00</span></div>
                
                <hr>
                <div class="form-group">
                    <label for="paymentMethodSelect">Método de Pago:</label>
                    <select id="paymentMethodSelect">
                        <option value="Contado">Contado</option>
                        <option value="Tarjeta">Tarjeta de Crédito/Débito</option>
                        <option value="Cuenta Corriente">Cuenta Corriente (Crédito Hotelero)</option>
                    </select>
                </div>
                <div class="form-group">
                    <input type="text" id="consumptionDescription" placeholder="Descripción (ej: Minibar, Lavandería)">
                    <input type="number" id="consumptionAmount" placeholder="Monto ($)" min="0">
                    <button type="button" id="addConsumptionButton">Añadir Consumo</button>
                </div>
            </div>
        `;
    }

    connectedCallback() {
        this.shadowRoot.getElementById('addConsumptionButton').addEventListener('click', () => this.handleAddConsumption());
    }

    // Recibe los detalles de la reserva para calcular totales
    calculateTotals(startDateValue, endDateValue, pricePerNight) {
        let durationDays = 0;
        if (startDateValue && endDateValue) {
            const start = new Date(startDateValue + 'T00:00:00Z');
            const end = new Date(endDateValue + 'T00:00:00Z');
            if (end > start) {
                durationDays = Math.round(Math.abs(end - start) / (1000 * 60 * 60 * 24));
            }
        }
        const stayCost = durationDays * pricePerNight;
        this.shadowRoot.getElementById('stayDuration').textContent = `${durationDays} noches`;
        this.shadowRoot.getElementById('stayCost').textContent = stayCost.toFixed(2);
        this.updateTotalAmount(); 
    }

    // Carga consumos existentes para la bookingId
    async fetchConsumptions(bookingId) {
        if (!bookingId) return;
        const response = await fetch(`/api/bookings/${bookingId}/consumptions`);
        if (response.ok) {
            const data = await response.json();
            this.renderConsumptions(data.data);
        } else {
            this.shadowRoot.getElementById('consumptionsList').innerHTML = '<p>Error al cargar consumos.</p>';
        }
    }

    renderConsumptions(consumptions) {
        const list = this.shadowRoot.getElementById('consumptionsList');
        list.innerHTML = '';
        let consumptionsTotal = 0;
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
                consumptionsTotal += item.amount;
            });
        }
        this.updateTotalAmount(consumptionsTotal);
    }

    updateTotalAmount(consumptionsTotal = 0) {
         const stayCostText = this.shadowRoot.getElementById('stayCost').textContent.replace('$', '').replace(',', '') || '0.00';
         const stayCost = parseFloat(stayCostText);
         const total = stayCost + consumptionsTotal;
         this.shadowRoot.getElementById('totalAmountDisplay').textContent = total.toFixed(2);
    }

    // Añadir consumo via API
    async handleAddConsumption() {
        const descriptionInput = this.shadowRoot.getElementById('consumptionDescription');
        const amountInput = this.shadowRoot.getElementById('consumptionAmount');
        const description = descriptionInput.value;
        const amount = parseFloat(amountInput.value);
        // Dispatch custom event to parent (BookingModal shell) to get currentBookingId
        const event = new CustomEvent('get-booking-id', { bubbles: true, composed: true, detail: { callback: async (bookingId) => {
            if (!description || isNaN(amount) || amount <= 0 || !bookingId) {
                alert("Ingrese una descripción y un monto válido y asegúrese de que la reserva exista.");
                return;
            }
            const response = await fetch('/api/consumptions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ booking_id: bookingId, description, amount, date: new Date().toISOString().split('T')[0] })
            });
            if (response.ok) {
                descriptionInput.value = '';
                amountInput.value = '';
                await this.fetchConsumptions(bookingId); // Refresca la lista local
            } else {
                alert("Error al añadir consumo.");
            }
        }}});
        this.dispatchEvent(event);
    }
    
    // Método para obtener el método de pago seleccionado
    getPaymentMethod() {
        return this.shadowRoot.getElementById('paymentMethodSelect').value;
    }
}
customElements.define('billing-consumption-panel', BillingConsumptionPanel);
