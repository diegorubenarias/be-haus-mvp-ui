// public/components/expenses-dashboard.js
class ExpensesDashboard extends HTMLElement {
    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        shadow.innerHTML = `
            <style>
                .expense-container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                .form-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr auto; gap: 10px; margin-bottom: 20px; }
                input, select, button { padding: 8px; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #0056b3; color: white; }
            </style>
            <div class="expense-container">
                <h2>Registrar Nuevo Gasto</h2>
                <div class="form-grid">
                    <input type="text" id="description" placeholder="Descripción" required>
                    <input type="number" id="amount" placeholder="Monto ($)" min="0" required>
                    <input type="date" id="date" required>
                    <select id="category">
                        <option value="Servicios">Servicios</option>
                        <option value="Impuestos">Impuestos</option>
                        <option value="Limpieza">Limpieza</option>
                        <option value="Minibar">Minibar (Stock)</option>
                        <option value="Sueldos">Sueldos</option>
                        <option value="Varios">Varios</option>
                    </select>
                    <button id="addExpense">Añadir Gasto</button>
                </div>
                <h2>Historial de Gastos</h2>
                <table>
                    <thead>
                        <tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Monto ($)</th></tr>
                    </thead>
                    <tbody id="expenseTableBody">
                    </tbody>
                </table>
            </div>
        `;
    }

    connectedCallback() {
        this.shadowRoot.getElementById('addExpense').addEventListener('click', () => this.addExpense());
        // Establecer fecha actual por defecto
        this.shadowRoot.getElementById('date').value = new Date().toISOString().split('T')[0];
        this.fetchExpenses();
    }

    async fetchExpenses() {
        const response = await fetch('/api/expenses');
        if (response.status === 401) { window.location.href = '/'; return; }
        const data = await response.json();
        this.renderTable(data.data);
    }

    renderTable(expenses) {
        const tbody = this.shadowRoot.getElementById('expenseTableBody');
        tbody.innerHTML = '';
        expenses.forEach(expense => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${expense.date}</td>
                <td>${expense.description}</td>
                <td>${expense.category}</td>
                <td>$${expense.amount.toFixed(2)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    async addExpense() {
        const description = this.shadowRoot.getElementById('description').value;
        const amount = parseFloat(this.shadowRoot.getElementById('amount').value);
        const date = this.shadowRoot.getElementById('date').value;
        const category = this.shadowRoot.getElementById('category').value;

        if (!description || isNaN(amount) || amount <= 0 || !date || !category) {
            alert("Por favor complete todos los campos requeridos con valores válidos.");
            return;
        }

        const response = await fetch('/api/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description, amount, date, category })
        });

        if (response.ok) {
            alert("Gasto registrado exitosamente.");
            // Limpiar formulario
            this.shadowRoot.getElementById('description').value = '';
            this.shadowRoot.getElementById('amount').value = '';
            // Refrescar la lista
            this.fetchExpenses();
        } else {
            alert("Error al registrar el gasto.");
        }
    }
}

customElements.define('expenses-dashboard', ExpensesDashboard);
