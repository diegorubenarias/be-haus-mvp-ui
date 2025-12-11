// public/components/profit-loss-report-view.js
class ProfitLossReportView extends HTMLElement {
    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        shadow.innerHTML = `
            <style>
                .report-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                .controls { margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                .total-row td { font-weight: bold; background-color: #f2f2f2; }
                .profit-pos { color: green; }
                .profit-neg { color: red; }
            </style>
            <div class="report-card">
                <h2>Reporte de Ganancias y Pérdidas</h2>
                <div class="controls">
                    <input type="month" id="monthSelector">
                    <button id="generateReportButton">Generar Reporte</button>
                </div>
                <div id="reportPeriod"></div>
                <table>
                    <thead>
                        <tr><th>Categoría</th><th>Total ($)</th></tr>
                    </thead>
                    <tbody id="reportBody">
                        <!-- Resultados aquí -->
                    </tbody>
                </table>
                <div id="profitSummary"></div>
            </div>
        `;
    }

    connectedCallback() {
        const today = new Date();
        const monthSelector = this.shadowRoot.getElementById('monthSelector');
        // Establecer el mes actual por defecto en el input (formato YYYY-MM)
        monthSelector.value = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
        
        this.shadowRoot.getElementById('generateReportButton').addEventListener('click', () => this.generateReport());
        // Generar reporte inicial al cargar
        this.generateReport();
    }

    async generateReport() {
        const monthSelector = this.shadowRoot.getElementById('monthSelector').value;
        if (!monthSelector) return;

        const [year, month] = monthSelector.split('-');
        const response = await fetch(`/api/reports/profit-loss?year=${year}&month=${month}`);
        
        if (response.ok) {
            const data = await response.json();
            this.renderReport(data);
        } else {
            alert("Error al generar el reporte.");
        }
    }

    renderReport(data) {
        this.shadowRoot.getElementById('reportPeriod').textContent = `Reporte para el período: ${data.period}`;
        const tbody = this.shadowRoot.getElementById('reportBody');
        tbody.innerHTML = '';

        // Renderizar ingresos
        tbody.innerHTML += `<tr><td>Ingresos por Facturación</td><td>$${data.invoicesTotal.toFixed(2)}</td></tr>`;
        
        // Renderizar costos
        tbody.innerHTML += `<tr><td>Gastos Operativos (Minibar, Limpieza, Servicios)</td><td>$${data.expensesTotal.toFixed(2)}</td></tr>`;
        tbody.innerHTML += `<tr><td>Sueldos Empleados</td><td>$${data.salariesTotal.toFixed(2)}</td></tr>`;
        
        // Total Costos
        const totalCosts = data.expensesTotal + data.salariesTotal;
        tbody.innerHTML += `<tr class="total-row"><td>Total Costos</td><td>$${totalCosts.toFixed(2)}</td></tr>`;

        // Resumen de Ganancia
        const profitSummary = this.shadowRoot.getElementById('profitSummary');
        profitSummary.innerHTML = `<h3>Ganancia Neta: $<span id="profitAmount">${data.profit.toFixed(2)}</span></h3>`;
        
        const profitAmountSpan = this.shadowRoot.getElementById('profitAmount');
        if (data.profit >= 0) {
            profitAmountSpan.classList.add('profit-pos');
            profitAmountSpan.classList.remove('profit-neg');
        } else {
            profitAmountSpan.classList.add('profit-neg');
            profitAmountSpan.classList.remove('profit-pos');
        }
    }
}

customElements.define('profit-loss-report-view', ProfitLossReportView);
