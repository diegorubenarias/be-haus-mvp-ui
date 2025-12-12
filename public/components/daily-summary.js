class DailySummary extends HTMLElement {
    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        
        shadow.innerHTML = `
            <style>
                .summary-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr); /* 3 columnas ahora */
                    gap: 20px;
                }
                /* ... (Estilos summary-card, h4, ul, li se mantienen igual) ... */
                 .summary-card {
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .summary-card h4 {
                    margin-top: 0;
                    color: #0056b3;
                }
                .summary-card ul {
                    list-style: none;
                    padding: 0;
                }
                .summary-card li {
                    padding: 5px 0;
                    border-bottom: 1px solid #eee;
                }

                /* Colores específicos para estados de limpieza */
                .status-dirty { color: #f44336; font-weight: bold; }
                .status-servicing { color: #ff9800; font-weight: bold; }
            </style>
            <div class="summary-grid">
                <div class="summary-card">
                    <h4>Check-Ins Hoy</h4>
                    <ul id="checkInsList"></ul>
                </div>
                <div class="summary-card">
                    <h4>Check-Outs Hoy</h4>
                    <ul id="checkOutsList"></ul>
                </div>
                 <!-- NUEVA SECCIÓN 1: Limpieza -->
                <div class="summary-card">
                    <h4>Estado de Habitaciones</h4>
                    <ul id="housekeepingList"></ul>
                </div>
                 <!-- NUEVA SECCIÓN 2: Empleados -->
                 <div class="summary-card" style="grid-column: span 3;">
                    <h4>Personal de Turno Hoy</h4>
                    <ul id="shiftsList"></ul>
                </div>
            </div>
        `;
    }

    connectedCallback() {
        this.fetchDailyData();
    }

    async fetchDailyData() {
        // Obtenemos la fecha de hoy en formato YYYY-MM-DD para usar en las consultas de API
        const todayISO = new Date().toISOString().split('T')[0];

        try {
            // Hacemos fetch concurrente de todas las APIs necesarias
            const [bookingsRes, roomsRes, shiftsRes, employeesRes] = await Promise.all([
                fetch('/api/bookings'),
                fetch('/api/rooms'),
                // Asumimos que la API de shifts puede filtrar por fecha si le pasamos query params
                fetch(`/api/shifts?year=${todayISO.substring(0,4)}&month=${todayISO.substring(5,7)}`), 
                fetch('/api/employees')
            ]);
            
            // Validación básica de errores de autenticación
             if (bookingsRes.status === 401) { window.location.href = '/'; return; }


            const bookingsData = await bookingsRes.json();
            const roomsData = await roomsRes.json();
            const shiftsData = await shiftsRes.json();
            const employeesData = await employeesRes.json();


            this.renderBookingsLists(bookingsData.data, todayISO);
            this.renderHousekeepingList(roomsData.data);
            this.renderShiftsList(shiftsData.data, employeesData.data, todayISO);

        } catch (error) {
            console.error("Error fetching daily data:", error);
            const root = this.shadowRoot;
            root.getElementById('checkInsList').innerHTML = '<li>Error al cargar datos.</li>';
            root.getElementById('checkOutsList').innerHTML = '<li>Error al cargar datos.</li>';
            root.getElementById('housekeepingList').innerHTML = '<li>Error al cargar datos.</li>';
             root.getElementById('shiftsList').innerHTML = '<li>Error al cargar datos.</li>';
        }
    }

    // Renombramos y ajustamos la función de renderizado de reservas
    renderBookingsLists(bookings, todayISO) {
        const checkInsList = this.shadowRoot.getElementById('checkInsList');
        const checkOutsList = this.shadowRoot.getElementById('checkOutsList');
        
        checkInsList.innerHTML = '';
        checkOutsList.innerHTML = '';

        // Filtramos por fecha exacta de inicio/fin HOY
        const checkIns = bookings.filter(b => b.start_date === todayISO && b.status === 'reserved');
        const checkOuts = bookings.filter(b => b.end_date === todayISO && b.status !== 'checked-out');
        
        if (checkIns.length > 0) {
            checkIns.forEach(booking => {
                const li = document.createElement('li');
                // Mejoramos la visualización, asociando el room_id al nombre (si tuvieramos un mapa de habitaciones)
                li.textContent = `Hab. ID ${booking.room_id}: ${booking.client_name}`;
                checkInsList.appendChild(li);
            });
        } else {
            checkInsList.innerHTML = '<li>No hay check-ins programados.</li>';
        }

        if (checkOuts.length > 0) {
            checkOuts.forEach(booking => {
                const li = document.createElement('li');
                li.textContent = `Hab. ID ${booking.room_id}: ${booking.client_name}`;
                checkOutsList.appendChild(li);
            });
        } else {
            checkOutsList.innerHTML = '<li>No hay check-outs programados.</li>';
        }
    }

    // NUEVA FUNCIÓN: Resumen de Limpieza
    renderHousekeepingList(rooms) {
        const list = this.shadowRoot.getElementById('housekeepingList');
        list.innerHTML = '';
        
        // Filtramos las habitaciones que NO están limpias
        const nonCleanRooms = rooms.filter(r => r.clean_status !== 'clean');
        
        if (nonCleanRooms.length > 0) {
            nonCleanRooms.forEach(room => {
                const li = document.createElement('li');
                li.classList.add(`status-${room.clean_status}`);
                li.textContent = `${room.name} (${room.clean_status})`;
                list.appendChild(li);
            });
        } else {
            list.innerHTML = '<li>Todas las habitaciones están limpias. 🎉</li>';
        }
    }

     // NUEVA FUNCIÓN: Resumen de Turnos de Empleados
    renderShiftsList(shifts, employees, todayISO) {
        const list = this.shadowRoot.getElementById('shiftsList');
        list.innerHTML = '';
        
        // Mapeamos empleados por ID para fácil acceso
        const employeeMap = new Map(employees.map(emp => [emp.id, emp.name]));

        // Filtramos los turnos que son para HOY (la API ya filtra por mes/año)
        const todayShifts = shifts.filter(s => s.shift_date === todayISO);

        if (todayShifts.length > 0) {
            todayShifts.forEach(shift => {
                const li = document.createElement('li');
                const employeeName = employeeMap.get(shift.employee_id) || 'Empleado Desconocido';
                li.textContent = `${employeeName}: Turno ${shift.shift_type}`;
                list.appendChild(li);
            });
        } else {
            list.innerHTML = '<li>No hay empleados programados para trabajar hoy.</li>';
        }
    }

}

customElements.define('daily-summary', DailySummary);
