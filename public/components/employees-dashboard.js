// public/components/employees-dashboard.js
class EmployeesDashboard extends HTMLElement {
    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        shadow.innerHTML = `
            <style>
                .employee-container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                .form-grid { display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 10px; margin-bottom: 20px; }
                input, select, button { padding: 8px; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: middle; }
                th { background-color: #0056b3; color: white; }
                button.delete-btn { background-color: #f44336; color: white; border: none; cursor: pointer; }
                button.save-btn { background-color: #4CAF50; color: white; border: none; cursor: pointer; margin-left: 5px; }
                input.edit-mode, select.edit-mode { border: 1px solid #0056b3; }
            </style>
            <div class="employee-container">
                <h2>Registrar Nuevo Empleado</h2>
                <div class="form-grid">
                    <input type="text" id="name" placeholder="Nombre Completo" required>
                    <select id="role">
                        <option value="Operador">Operador</option>
                        <option value="Admin">Admin</option>
                        <option value="Limpieza">Limpieza</option>
                        <option value="Soporte">Soporte</option>
                    </select>
                    <input type="number" id="salary" placeholder="Sueldo Mensual ($)" min="0" required>
                    <button id="addEmployeeButton">Añadir Empleado</button>
                </div>
                <h2>Listado de Empleados</h2>
                <table>
                    <thead>
                        <tr><th>ID</th><th>Nombre</th><th>Rol</th><th>Sueldo Mensual ($)</th><th>Acciones</th></tr>
                    </thead>
                    <tbody id="employeeTableBody">
                    </tbody>
                </table>
            </div>
        `;
    }

    connectedCallback() {
        this.shadowRoot.getElementById('addEmployeeButton').addEventListener('click', () => this.addEmployee());
        this.fetchEmployees();
    }

    async fetchEmployees() {
        const response = await fetch('/api/employees');
        if (response.status === 401) { window.location.href = '/'; return; }
        const data = await response.json();
        this.renderTable(data.data);
    }

    renderTable(employees) {
        const tbody = this.shadowRoot.getElementById('employeeTableBody');
        tbody.innerHTML = '';
        employees.forEach(employee => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${employee.id}</td>
                <td><input type="text" value="${employee.name}" data-field="name"></td>
                <td>
                    <select data-field="role">
                        <option value="Operador" ${employee.role === 'Operador' ? 'selected' : ''}>Operador</option>
                        <option value="Admin" ${employee.role === 'Admin' ? 'selected' : ''}>Admin</option>
                        <option value="Limpieza" ${employee.role === 'Limpieza' ? 'selected' : ''}>Limpieza</option>
                        <option value="Soporte" ${employee.role === 'Soporte' ? 'selected' : ''}>Soporte</option>
                    </select>
                </td>
                <td><input type="number" value="${employee.monthly_salary}" data-field="salary"></td>
                <td>
                    <button class="save-btn" data-id="${employee.id}">Guardar</button>
                    <button class="delete-btn" data-id="${employee.id}">Eliminar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        this.shadowRoot.querySelectorAll('.save-btn').forEach(button => {
            button.addEventListener('click', (e) => this.updateEmployee(e.target.dataset.id));
        });
        this.shadowRoot.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', (e) => this.deleteEmployee(e.target.dataset.id));
        });
    }

    async addEmployee() {
        const name = this.shadowRoot.getElementById('name').value;
        const role = this.shadowRoot.getElementById('role').value;
        const salary = parseFloat(this.shadowRoot.getElementById('salary').value);

        if (!name || !role || isNaN(salary) || salary < 0) {
            alert("Complete todos los campos."); return;
        }

        await fetch('/api/employees', {
            method: 'POST', body: JSON.stringify({ name, role, monthly_salary: salary }),
            headers: { 'Content-Type': 'application/json' }
        });
        this.fetchEmployees();
    }

    async updateEmployee(id) {
        const tr = this.shadowRoot.querySelector(`button.save-btn[data-id="${id}"]`).closest('tr');
        const name = tr.querySelector('input[data-field="name"]').value;
        const role = tr.querySelector('select[data-field="role"]').value;
        const salary = parseFloat(tr.querySelector('input[data-field="salary"]').value);

        if (!name || !role || isNaN(salary) || salary < 0) {
            alert("Valores inválidos."); return;
        }

        await fetch(`/api/employees/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ name, role, monthly_salary: salary }),
            headers: { 'Content-Type': 'application/json' }
        });
        this.fetchEmployees();
    }

    async deleteEmployee(id) {
        if (!confirm("¿Seguro que desea eliminar a este empleado?")) return;
        await fetch(`/api/employees/${id}`, { method: 'DELETE' });
        this.fetchEmployees();
    }
}

customElements.define('employees-dashboard', EmployeesDashboard);
