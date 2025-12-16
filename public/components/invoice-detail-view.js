class InvoiceDetailView extends HTMLElement {
    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });

        shadow.innerHTML = `
            <style>
                .invoice-page {
                    background: white;
                    padding: 40px;
                    margin: 20px;
                    max-width: 800px;
                    box-shadow: 0 0 10px rgba(0,0,0,0.1);
                    font-family: 'Courier New', Courier, monospace;
                    font-size: 14px;
                    line-height: 1.6;
                }
                .invoice-header, .invoice-footer {
                    text-align: center;
                    margin-bottom: 20px;
                }
                .invoice-details, .billing-details {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 20px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                }
                th, td {
                    border-bottom: 1px solid #ddd;
                    padding: 8px;
                    text-align: left;
                }
                th {
                    background-color: #f4f4f4;
                }
                .text-right {
                    text-align: right;
                }
                .total-section {
                    display: flex;
                    justify-content: flex-end;
                }
                .total-section table {
                    width: 300px;
                }
                .print-button {
                    margin-top: 20px;
                    padding: 10px 20px;
                    background-color: #0056b3;
                    color: white;
                    border: none;
                    cursor: pointer;
                }
            </style>
            <div class="invoice-page">
                <div class="no-print">
                    <button class="print-button" id="printButton">Imprimir Factura</button>
                    <button class="print-button" onclick="window.close()">Cerrar Vista</button>
                </div>
                <div class="invoice-header">
                    <h2>BeHaus.</h2>
                    <p>Dirección: Calle Falsa 123, CABA</p>
                    <p>CUIT: 30-12345678-9</p>
                </div>

                <hr>

                <div class="invoice-details">
                    <div>
                        <strong>Factura N°:</strong> <span id="invoiceNumber"></span><br>
                        <strong>Fecha Emisión:</strong> <span id="issueDate"></span>
                    </div>
                    <div>
                        <strong>Reserva ID:</strong> <span id="bookingId"></span>
                    </div>
                </div>

                <div class="billing-details">
                    <!-- Sección de Cliente Expandida -->
                    <div>
                        <strong>Cliente:</strong> <span id="clientName"></span><br>
                        <strong>CUIT/CUIL:</strong> <span id="clientCuitCuil"></span><br>
                        <strong>Tipo Factura:</strong> <span id="invoiceTypeDisplay"></span><br>
                        <strong>Estadía:</strong> <span id="stayDates"></span>
                    </div>
                    <div>
                        <strong>Método de Pago:</strong> <span id="paymentMethod"></span>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Descripción</th>
                            <th class="text-right">Monto ($)</th>
                        </tr>
                    </thead>
                    <tbody id="invoiceItems">
                        <!-- Detalles de la estadía y consumos -->
                    </tbody>
                </table>

                <div class="total-section">
                    <table>
                        <tr>
                            <td>Subtotal Base:</td>
                            <td class="text-right" id="subtotalAmount">0.00</td>
                        </tr>
                        <tr>
                            <td>IVA (21%):</td>
                            <td class="text-right" id="vatAmount">0.00</td>
                        </tr>
                        <tr>
                            <strong><td>Total Final:</td></strong>
                            <strong class="text-right" id="totalAmount">0.00</strong>
                        </tr>
                    </table>
                </div>

                <div class="invoice-footer">
                    <p>Gracias por su estadía en BeHaus.</p>
                </div>
            </div>
        `;
    }

    connectedCallback() {
        this.shadowRoot.getElementById('printButton').addEventListener('click', () => window.print());
        const urlParams = new URLSearchParams(window.location.search);
        const invoiceId = urlParams.get('id');
        if (invoiceId) {
            this.fetchInvoiceDetails(invoiceId);
        } else {
            this.shadowRoot.getElementById('invoiceNumber').textContent = 'ID de factura no proporcionado.';
        }
    }

    async fetchInvoiceDetails(invoiceId) {
        try {
            // SOLO USAMOS ESTE ENDPOINT. El backend ya se encarga de dar todos los datos.
            const response = await fetch(`/api/invoices/${invoiceId}`);
            if (response.status === 404) {
                this.shadowRoot.getElementById('invoiceNumber').textContent = 'Factura no encontrada.';
                return;
            }
            const invoice = await response.json();
            
            // Renderizamos la factura usando solo el objeto invoice que ya tiene todo
            this.renderInvoice(invoice);

        } catch (error) {
            console.error("Error fetching invoice details:", error);
            this.shadowRoot.getElementById('invoiceNumber').textContent = 'Error al cargar los detalles de la factura.';
        }
    }

    renderInvoice(invoice) {
        // ... (detalles principales y datos fiscales) ...
        this.shadowRoot.getElementById('invoiceNumber').textContent = invoice.invoice_number;
        this.shadowRoot.getElementById('issueDate').textContent = invoice.issue_date;
        this.shadowRoot.getElementById('bookingId').textContent = invoice.booking_id;
        this.shadowRoot.getElementById('paymentMethod').textContent = invoice.payment_method; 
       
        if (invoice.details && invoice.details.clientDetails) {
            this.shadowRoot.getElementById('clientName').textContent = invoice.details.clientDetails.name;
            this.shadowRoot.getElementById('clientCuitCuil').textContent = invoice.details.clientDetails.cuit_cuil;
            this.shadowRoot.getElementById('invoiceTypeDisplay').textContent = invoice.details.clientDetails.invoice_type;
        } else {
            this.shadowRoot.getElementById('clientName').textContent = 'N/A';
        }
        
        // CLAVE: Extraer la duración de la descripción de la estadía
        if (invoice.details && invoice.details.stay && invoice.details.stay.description) {
             this.shadowRoot.getElementById('stayDuration').textContent = invoice.details.stay.description; // Ej: "Estadía 3 noches"
        }

 const tbody = this.shadowRoot.getElementById('invoiceItems');
        tbody.innerHTML = '';
        let subtotal = 0;

        if (invoice.details.stay) {
            const stayRow = document.createElement('tr');
            stayRow.innerHTML = `<td>${invoice.details.stay.description}</td><td class="text-right">$${invoice.details.stay.amount.toFixed(2)}</td>`;
            tbody.appendChild(stayRow);
            subtotal += invoice.details.stay.amount;
        }

        if (invoice.details.consumptions) {
            invoice.details.consumptions.forEach(item => {
                const row = document.createElement('tr');
                row.innerHTML = `<td>Consumo: ${item.description}</td><td class="text-right">$${item.amount.toFixed(2)}</td>`;
                tbody.appendChild(row);
                subtotal += item.amount;
            });
        }
        
        // Calculamos el IVA y el total final (usando el total calculado, no el totalAmount de la DB si queremos mostrar desglose)
        // Para este MVP, el IVA es 21%
        const vatRate = 0.21;
        const vatAmount = subtotal * vatRate;
        const total = subtotal + vatAmount;

        // Mostrar totales calculados
        this.shadowRoot.getElementById('subtotalAmount').textContent = subtotal.toFixed(2);
        this.shadowRoot.getElementById('vatAmount').textContent = vatAmount.toFixed(2);
        this.shadowRoot.getElementById('totalAmount').textContent = total.toFixed(2);
        
    }
}

customElements.define('invoice-detail-view', InvoiceDetailView);
