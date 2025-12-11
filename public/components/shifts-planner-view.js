// public/components/shifts-planner-view.js
class ShiftsPlannerView extends HTMLElement {
    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        
        this.employees = []; this.shifts = []; 
        this.currentViewDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        this.monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        // Tipos de turnos disponibles
        this.shiftTypes = {
            'M': 'Mañana (8h-16h)',
            'T': 'Tarde (16h-00h)',
            'N': 'Noche (00h-8h)',
            'S': 'Soporte (Remoto)',
            'F': 'Franco/Libre'
        };

        shadow.innerHTML = `
            <style>
                .planner-container { overflow-x: auto; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-radius: 4px; }
                .planner-grid { display: grid; border-collapse: collapse; width: max-content; }
                .cell { border: 1px solid #e0e0e0; padding: 8px 5px; text-align: center; min-height: 20px; box-sizing: border-box; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; }
                .header-cell { background-color: #0056b3; color: white; font-weight: bold; position: sticky; top: 0; z-index: 10; }
                .employee-header { background-color: #f9f9f9; color: #333; text-align: left; font-weight: normal; position: sticky; left: 0; z-index: 5; }
                .weekend-cell { background-color: #f0f0f0 !important; color: #555; }
                .weekend-header { background-color: #004494 !important; }
                /* Clases de colores para turnos */
                .shift-M { background-color: #ffeb3b; }
                .shift-T { background-color: #ff9800; }
                .shift-N { background-color: #607d8b; color: white; }
                .shift-S { background-color: #00bcd4; }
                .shift-F { background-color: #f44336; color: white; }

                .month-selector { padding: 10px; background-color: #e9e9e9; font-weight: bold; display: flex; justify-content: space-between; align-items: center; }
                .nav-button { background: #0056b3; color: white; border: none; padding: 5px 10px; cursor: pointer; }
                .legend { margin-top: 10px; font-size: 0.8em; }
            </style>
            <div class="month-selector">
                <button class="nav-button" id="prevMonth">&lt; Anterior</button>
                <span id="currentMonthDisplay">Mes Actual</span>
                <button class="nav-button" id="nextMonth">Siguiente &gt;</button>
            </div>
            <div class="planner-container">
                <div class="planner-grid" id="plannerGrid"></div>
            </div>
            <div class="legend">
                Leyenda: 
                <span class="shift-M">M: Mañana</span> | 
                <span class="shift-T">T: Tarde</span> | 
                <span class="shift-N">N: Noche</span> | 
                <span class="shift-S">S: Soporte</span> | 
                <span class="shift-F">F: Franco</span>
            </div>
        `;
    }

    async connectedCallback() {
        this.shadowRoot.getElementById('prevMonth').addEventListener('click', () => this.navigateMonth(-1));
        this.shadowRoot.getElementById('nextMonth').addEventListener('click', () => this.navigateMonth(1));
        await this.fetchDataAndRender();
        this.shadowRoot.getElementById('plannerGrid').addEventListener('click', (event) => this.handleGridClick(event));
    }

    async fetchDataAndRender() {
        await this.fetchData();
        this.renderView();
    }

    async fetchData() {
        const year = this.currentViewDate.getFullYear();
        const month = (this.currentViewDate.getMonth() + 1).toString().padStart(2, '0');

        const [employeesRes, shiftsRes] = await Promise.all([
            fetch('/api/employees'), 
            fetch(`/api/shifts?year=${year}&month=${month}`)
        ]);
        if (employeesRes.status === 401 || shiftsRes.status === 401) { window.location.href = '/'; return; }
        
        const employeesData = await employeesRes.json();
        const shiftsData = await shiftsRes.json();
        
        this.employees = employeesData.data; 
        // Mapeamos los turnos a un objeto para fácil acceso: { 'empId-YYYY-MM-DD': 'Type' }
        this.shifts = {};
        shiftsData.data.forEach(s => {
            this.shifts[`${s.employee_id}-${s.shift_date}`] = s.shift_type;
        });
    }

    navigateMonth(offset) {
        this.currentViewDate.setMonth(this.currentViewDate.getMonth() + offset);
        this.fetchDataAndRender(); // Fetch de nuevos turnos para el mes
    }

    renderView() {
        const year = this.currentViewDate.getFullYear();
        const monthIndex = this.currentViewDate.getMonth();
        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
        this.shadowRoot.getElementById('currentMonthDisplay').textContent = `${this.monthNames[monthIndex]} ${year}`;

        const grid = this.shadowRoot.getElementById('plannerGrid');
        grid.innerHTML = '';
        this.shadowRoot.querySelector('.planner-grid').style.gridTemplateColumns = `150px repeat(${daysInMonth}, 40px)`;

        // Encabezados de días y fines de semana
        let dayOfWeek = new Date(year, monthIndex, 1).getDay();
        grid.innerHTML += `<div class="cell header-cell employee-header">Empleado/Rol</div>`; 
        for (let i = 1; i <= daysInMonth; i++) {
            const headerCell = document.createElement('div');
            headerCell.classList.add('cell', 'header-cell');
            if (dayOfWeek === 0 || dayOfWeek === 6) { headerCell.classList.add('weekend-header'); }
            headerCell.textContent = i;
            grid.appendChild(headerCell);
            dayOfWeek = (dayOfWeek + 1) % 7; 
        }
        
        // Celdas de turnos
        this.employees.forEach(employee => {
            grid.innerHTML += `<div class="cell employee-header" data-employee-id="${employee.id}">${employee.name} (${employee.role})</div>`;
            for (let i = 1; i <= daysInMonth; i++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                if (new Date(year, monthIndex, i).getDay() === 0 || new Date(year, monthIndex, i).getDay() === 6) { cell.classList.add('weekend-cell'); }

                const dateString = `${year}-${(monthIndex + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
                const shiftType = this.shifts[`${employee.id}-${dateString}`];
                
                cell.dataset.employeeId = employee.id;
                cell.dataset.date = dateString;
                cell.dataset.shiftType = shiftType || 'F'; // Default Franco

                if (shiftType) {
                    cell.textContent = shiftType; // M, T, N, S, F
                    cell.classList.add(`shift-${shiftType}`);
                } else {
                    cell.textContent = 'F'; // Default Franco visual
                    cell.classList.add('shift-F');
                }
                grid.appendChild(cell);
            }
        });
    }

    // Maneja clic en celda para cambiar/asignar turno
    async handleGridClick(event) {
        let cell = event.target;
        if (!cell.classList.contains('cell') || cell.classList.contains('header-cell') || cell.classList.contains('employee-header')) return;

        const employeeId = cell.dataset.employeeId;
        const date = cell.dataset.date;
        const currentShift = cell.dataset.shiftType;

        // Lógica simple para rotar entre turnos al hacer clic (M -> T -> N -> S -> F -> M)
        const types = Object.keys(this.shiftTypes);
        const currentIndex = types.indexOf(currentShift);
        const nextIndex = (currentIndex + 1) % types.length;
        const nextShiftType = types[nextIndex];

        // Guardar el nuevo turno via API
        const response = await fetch('/api/shifts', {
            method: 'POST', // Usamos POST con INSERT OR REPLACE
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employee_id: employeeId, shift_date: date, shift_type: nextShiftType })
        });

        if (response.ok) {
            // Actualizar la UI inmediatamente tras guardar
            cell.classList.remove(`shift-${currentShift}`);
            cell.classList.add(`shift-${nextShiftType}`);
            cell.textContent = nextShiftType;
            cell.dataset.shiftType = nextShiftType;
            // Actualizar el mapa interno de shifts para consistencia
            this.shifts[`${employeeId}-${date}`] = nextShiftType;

        } else {
            alert("Error al guardar el turno.");
        }
    }
}

customElements.define('shifts-planner-view', ShiftsPlannerView);
