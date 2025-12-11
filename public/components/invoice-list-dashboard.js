class InvoiceListDashboard extends HTMLElement {
    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        shadow.innerHTML = `
            <style>
                .invoice-container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                th { background-color: #0056b3; color: white; }
                tr:nth-child(even) { background-color: #f2f2f2; }
                a { color: #0056b3; text-decoration: none; }
            </style>
            <div class="invoice-container">
                <h2>Listado de Facturas</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Factura #</th>
                            <th>Reserva ID</th>
                            <th>Fecha Emisión</th>
                            <th>Total ($)</th>
                            <th>Acción</th>
                        </tr>
                    </thead>
                    <tbody id="invoiceTableBody">
                        <!-- Filas de facturas aquí -->
                    </tbody>
                </table>
            </div>
        `;
    }

    connectedCallback() {
        this.fetchInvoices();
    }

    async fetchInvoices() {
        try {
            const response = await fetch('/api/invoices');
            if (response.status === 401) { window.location.href = '/'; return; }
            const data = await response.json();
            this.renderTable(data.data);
        } catch (error) {
            console.error("Error fetching invoices:", error);
            // ... mostrar error en UI si es necesario ...
        }
    }

     renderTable(invoices) {
        const tbody = this.shadowRoot.getElementById('invoiceTableBody');
        tbody.innerHTML = '';
        invoices.forEach(invoice => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${invoice.invoice_number}</td>
                <td>${invoice.booking_id}</td>
                <td>${invoice.issue_date}</td>
                <td>$${invoice.total_amount.toFixed(2)}</td>
                <!-- ENLACE ACTUALIZADO -->
                <td><a href="/invoice-detail.html?id=${invoice.id}" target="_blank">Ver/Imprimir</a></td>
            `;
            tbody.appendChild(tr);
        });

        // Eliminamos el listener de alerta anterior, el <a> ahora funciona nativamente
        // tbody.querySelectorAll('.view-invoice').forEach(...) 
    }
}

customElements.define('invoice-list-dashboard', InvoiceListDashboard);
