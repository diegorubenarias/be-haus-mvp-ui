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
                .cell { border: 1px solid #e0e0e0; padding: 4px 5px; text-align: center; min-height: 20px; box-sizing: border-box; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; }
                
                .header-cell { background-color: #0056b3; color: white; font-weight: bold; position: sticky; top: 0; z-index: 10; padding: 8px 5px; }
                .header-day-letter { font-size: 0.7em; display: block; margin-bottom: 3px; }

                .employee-header { background-color: #f9f9f9; color: #333; text-align: left; font-weight: normal; position: sticky; left: 0; z-index: 5; }
                
                /* CAMBIO 1: El fondo de la celda de fin de semana es más claro */
                .weekend-cell { background-color: #f0f0f0 !important; }

                /* CAMBIO 2: Aplicamos color de texto oscuro a weekend-cell y usamos !important para asegurar */
                /* Esto hace que el texto sea oscuro incluso si es un turno N (Noche, que por defecto es blanco) */
                .weekend-cell.shift-N { color: #333333 !important; }

                /* CAMBIO 3: Fondo de fin de semana más claro y texto oscuro para la cabecera */
                .weekend-header { 
                    background-color: #a0a0a0 !important;
                    color: #333333 !important; 
                } 

                /* Clases de colores para turnos (Noche y Franco tienen texto blanco por defecto) */
                .shift-M { background-color: #ffeb3b; }
                .shift-T { background-color: #ff9800; }
                .shift-N { background-color: #607d8b; color: white; }
                .shift-S { background-color: #00bcd4; }
                .shift-F { background-color: #f44336; color: white; }

                .month-selector { padding: 10px; background-color: #e9e9e9; font-weight: bold; display: flex; justify-content: space-between; align-items: center; }
                .nav-button { background: #0056b3; color: white; border: none; padding: 5px 10px; cursor: pointer; }
                .legend { margin-top: 10px; font-size: 0.8em; padding: 0 10px; }
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

    connectedCallback() {
        // ... (El resto del JS permanece igual)
        this.shadowRoot.getElementById('prevMonth').addEventListener('click', () => this.navigateMonth(-1));
        this.shadowRoot.getElementById('nextMonth').addEventListener('click', () => this.navigateMonth(1));
        this.fetchDataAndRender();
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
        this.shifts = {};
        shiftsData.data.forEach(s => {
            this.shifts[`${s.employee_id}-${s.shift_date}`] = s.shift_type;
        });
    }

    navigateMonth(offset) {
        this.currentViewDate.setMonth(this.currentViewDate.getMonth() + offset);
        this.fetchDataAndRender();
    }
    
    getDayLetter(dayIndex) {
        const letters = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
        return letters[dayIndex];
    }


    renderView() {
        const year = this.currentViewDate.getFullYear();
        const monthIndex = this.currentViewDate.getMonth();
        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
        this.shadowRoot.getElementById('currentMonthDisplay').textContent = `${this.monthNames[monthIndex]} ${year}`;

        const grid = this.shadowRoot.getElementById('plannerGrid');
        grid.innerHTML = '';
        this.shadowRoot.querySelector('.planner-grid').style.gridTemplateColumns = `150px repeat(${daysInMonth}, 40px)`;

        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(year, monthIndex, i);
            const dayOfWeek = date.getDay(); 

            if (i === 1) { 
                 grid.innerHTML += `<div class="cell header-cell employee-header">Empleado/Rol</div>`; 
            }
            
            const headerCell = document.createElement('div');
            headerCell.classList.add('cell', 'header-cell');
            if (dayOfWeek === 0 || dayOfWeek === 6) { headerCell.classList.add('weekend-header'); }
            
            headerCell.innerHTML = `
                <span class="header-day-letter">${this.getDayLetter(dayOfWeek)}</span>
                <span>${i}</span>
            `;

            grid.appendChild(headerCell);
        }
        
        this.employees.forEach(employee => {
            grid.innerHTML += `<div class="cell employee-header" data-employee-id="${employee.id}">${employee.name} (${employee.role})</div>`;
            for (let i = 1; i <= daysInMonth; i++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                
                const date = new Date(year, monthIndex, i);
                if (date.getDay() === 0 || date.getDay() === 6) { cell.classList.add('weekend-cell'); }

                const dateString = `${year}-${(monthIndex + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
                const shiftType = this.shifts[`${employee.id}-${dateString}`];
                
                cell.dataset.employeeId = employee.id;
                cell.dataset.date = dateString;
                cell.dataset.shiftType = shiftType || 'F';

                if (shiftType) {
                    cell.textContent = shiftType; 
                    cell.classList.add(`shift-${shiftType}`);
                } else {
                    cell.textContent = 'F'; 
                    cell.classList.add('shift-F');
                }
                grid.appendChild(cell);
            }
        });
    }

    async handleGridClick(event) {
        let cell = event.target;
        if (!cell.classList.contains('cell') || cell.classList.contains('header-cell') || cell.classList.contains('employee-header')) return;

        const employeeId = cell.dataset.employeeId;
        const date = cell.dataset.date;
        const currentShift = cell.dataset.shiftType;

        const types = Object.keys(this.shiftTypes);
        const currentIndex = types.indexOf(currentShift);
        const nextIndex = (currentIndex + 1) % types.length;
        const nextShiftType = types[nextIndex];
        
        cell.textContent = nextShiftType;
        Object.keys(this.shiftTypes).forEach(type => cell.classList.remove(`shift-${type}`));
        cell.classList.add(`shift-${nextShiftType}`);
        cell.dataset.shiftType = nextShiftType;

        await fetch('/api/shifts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                employee_id: employeeId, 
                shift_date: date, 
                shift_type: nextShiftType 
            })
        });
        
        this.shifts[`${employeeId}-${date}`] = nextShiftType;
        console.log(`Turno para empleado ${employeeId} en ${date} cambiado a ${nextShiftType}`);
    }
}

customElements.define('shifts-planner-view', ShiftsPlannerView);
