class RoomPlanner extends HTMLElement {
    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        
        this.rooms = []; this.bookings = []; this.today = new Date();
        this.currentViewDate = new Date(this.today.getFullYear(), this.today.getMonth(), 1);
        this.monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        this.daysInMonth = 0; this.currentYear = 0; this.currentMonthIndex = 0; this.startDate = null;

        shadow.innerHTML = `
            <style>
                .planner-container { overflow-x: auto; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-radius: 4px; }
                .planner-grid { display: grid; border-collapse: collapse; width: max-content; }
                .cell { border: 1px solid #e0e0e0; padding: 8px 5px; text-align: center; cursor: pointer; min-height: 20px; box-sizing: border-box; transition: background-color 0.2s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .cell:hover { background-color: #f2f2f2; }
                .header-cell { background-color: #0056b3; color: white; font-weight: bold; position: sticky; top: 0; z-index: 10; }
                .room-header { background-color: #f9f9f9; color: #333; text-align: left; font-weight: normal; position: sticky; left: 0; z-index: 5; }
                .weekend-cell { background-color: #f0f0f0 !important; color: #555; }
                .weekend-header { background-color: #004494 !important; }
                .status-reserved { background-color: #ffeb3b; color: #333; }
                .status-occupied { background-color: #4caf50; color: white; }
                .status-blocked { background-color: #f44336; color: white; }
                .status-liberated { background-color: white; }
                 /* --- NUEVOS ESTILOS PARA EL ESTADO DE LIMPIEZA --- */
                .clean-status-header.clean { border-left: 5px solid #4CAF50; /* Verde */ }
                .clean-status-header.dirty { border-left: 5px solid #F44336; /* Rojo - SUCIA */ }
                .clean-status-header.servicing { border-left: 5px solid #FF9800; /* Naranja */ }

                .month-selector { padding: 10px; background-color: #e9e9e9; font-weight: bold; display: flex; justify-content: space-between; align-items: center; }
                .nav-button { background: #0056b3; color: white; border: none; padding: 5px 10px; cursor: pointer; }
            </style>
            <div class="month-selector">
                <button class="nav-button" id="prevMonth">&lt; Anterior</button>
                <span id="currentMonthDisplay">Mes Actual</span>
                <button class="nav-button" id="nextMonth">Siguiente &gt;</button>
            </div>
            <div class="planner-container">
                <div class="planner-grid" id="plannerGrid"></div>
            </div>
        `;
    }

    async connectedCallback() {
        await this.fetchData(); 
        this.renderView();
        // Usamos delegación de eventos en el contenedor principal
        this.shadowRoot.getElementById('plannerGrid').addEventListener('click', (event) => this.handleGridClick(event));
        document.addEventListener('booking-saved', () => this.refreshPlanner());
        this.shadowRoot.getElementById('prevMonth').addEventListener('click', () => this.navigateMonth(-1));
        this.shadowRoot.getElementById('nextMonth').addEventListener('click', () => this.navigateMonth(1));
    }

    async fetchData() {
        try {
            const [roomsRes, bookingsRes] = await Promise.all([
                fetch('/api/rooms'), fetch('/api/bookings')
            ]);
            if (roomsRes.status === 401 || bookingsRes.status === 401) { window.location.href = '/'; return; }
            const roomsData = await roomsRes.json();
            const bookingsData = await bookingsRes.json();
            
            // CONVERTIMOS A FLOAT INMEDIATAMENTE si el backend envía strings para NUMERIC
            this.rooms = roomsData.data.map(r => ({ ...r, price: parseFloat(r.price) }));
            // Asumimos que bookingsData.data también tiene price_per_night como string que parsearemos en findBookingForDay

            this.bookings = bookingsData.data;

        } catch (error) {
            console.error("Error en fetchData:", error);
        }
    }

    refreshPlanner() {
        this.fetchData().then(() => this.renderView());
    }

    navigateMonth(offset) {
        this.currentViewDate.setMonth(this.currentViewDate.getMonth() + offset);
        this.renderView();
    }

    renderView() {
        this.currentYear = this.currentViewDate.getFullYear();
        this.currentMonthIndex = this.currentViewDate.getMonth();
        this.daysInMonth = new Date(this.currentYear, this.currentMonthIndex + 1, 0).getDate();
        this.startDate = new Date(this.currentYear, this.currentMonthIndex, 1);
        this.shadowRoot.getElementById('currentMonthDisplay').textContent = `${this.monthNames[this.currentMonthIndex]} ${this.currentYear}`;
        this.renderGrid();
    }

    renderGrid() {
        const grid = this.shadowRoot.getElementById('plannerGrid');
        grid.innerHTML = ''; 
        
        this.shadowRoot.querySelector('.planner-grid').style.gridTemplateColumns = `150px repeat(${this.daysInMonth}, 40px)`;

        let dayOfWeek = new Date(this.currentYear, this.currentMonthIndex, 1).getDay();
        const dayClasses = [];
        for (let i = 0; i < this.daysInMonth; i++) {
            dayClasses.push((dayOfWeek === 0 || dayOfWeek === 6) ? 'weekend-cell' : '');
            dayOfWeek = (dayOfWeek + 1) % 7; 
        }

        // --- Encabezados de Días (Fila 1) ---
        grid.innerHTML += `<div class="cell header-cell room-header">Habitación</div>`; 
        for (let i = 1; i <= this.daysInMonth; i++) {
            const headerCell = document.createElement('div');
            headerCell.classList.add('cell', 'header-cell');
            if (dayClasses[i - 1] === 'weekend-cell') { headerCell.classList.add('weekend-header'); }
            headerCell.textContent = i;
            grid.appendChild(headerCell);
        }
        
      // --- Bucle de renderizado de celdas por habitación (Filas 2+) ---
        if (this.rooms && this.rooms.length > 0) {
            this.rooms.forEach(room => {
                
                // 1. Renderizar la celda de la cabecera de la habitación (sticky left)
                // Esto es lo que no te cambiaba de color, pero debería funcionar si el backend envía el dato.
                const roomHeaderCell = document.createElement('div');
                roomHeaderCell.classList.add('cell', 'room-header', 'clean-status-header', room.clean_status || 'clean'); // Default a 'clean' si es nulo
                roomHeaderCell.dataset.roomId = room.id;
                roomHeaderCell.textContent = room.name;
                grid.appendChild(roomHeaderCell);

                // 2. Bucle interno para los días del mes
                for (let i = 1; i <= this.daysInMonth; i++) {
                    const cell = document.createElement('div');
                    cell.classList.add('cell', 'status-liberated');
                    cell.dataset.roomId = room.id; 
                    cell.dataset.day = i;
                    
                    if (dayClasses[i - 1] === 'weekend-cell') { cell.classList.add('weekend-cell'); }

                    // *** LÓGICA DE FECHA COMPATIBLE CON POSTGRES ISO STRING ***
                    const booking = this.findBookingForDay(room.id, i); 

                    if (booking) {
                        cell.classList.remove('status-liberated'); 
                        cell.classList.add(`status-${booking.status}`);
                        if(dayClasses[i - 1] === 'weekend-cell' && booking.status !== 'liberated') { 
                            cell.classList.remove('weekend-cell'); 
                        }
                        cell.textContent = `${booking.client_name.split(' ')[0]} (${booking.status.charAt(0).toUpperCase()})`;
                        cell.dataset.bookingId = booking.id;
                    }
                    grid.appendChild(cell); // Cerraba tu código aquí
                }
            });
        }
    }
    
    // *** FUNCIÓN CLAVE PARA MANEJAR FECHAS ISO DE POSTGRES ***
    findBookingForDay(roomId, day) {
        // Creamos la fecha exacta que estamos buscando en el bucle
        const targetDate = new Date(Date.UTC(this.currentYear, this.currentMonthIndex, day));
        // Normalizamos targetDate a YYYY-MM-DD para comparación simple si es necesario, pero comparar objetos Date es mejor
        targetDate.setUTCHours(0, 0, 0, 0); 

        const bookingsForRoom = this.bookings.filter(b => b.room_id === roomId);

        return bookingsForRoom.find(booking => {
            // Parseamos las fechas ISO completas que vienen de PostgreSQL a objetos Date UTC
            const startDate = new Date(booking.start_date);
            const endDate = new Date(booking.end_date);
            startDate.setUTCHours(0, 0, 0, 0);
            endDate.setUTCHours(0, 0, 0, 0);
            
            // Comparamos si la fecha actual del bucle (targetDate) está dentro del rango de la reserva
            // targetDate >= startDate Y targetDate < endDate (el check-out es al día siguiente de la última noche de estancia)
            return targetDate >= startDate && targetDate < endDate;
        });
    }
 handleGridClick(event) {
        const cell = event.target;
        if (!cell.classList.contains('cell') || cell.classList.contains('header-cell') || cell.classList.contains('room-header')) {
            return;
        }

        const roomId = parseInt(cell.dataset.roomId);
        const day = parseInt(cell.dataset.day);
        
        if (cell.dataset.bookingId) {
            // Si tiene ID de reserva, mostramos detalles (asume que tienes un modal o componente de detalles)
            const bookingId = parseInt(cell.dataset.bookingId);
            // Disparamos un evento para que el componente padre (App/Dashboard) muestre un modal de detalles
            document.dispatchEvent(new CustomEvent('show-booking-details', {
                detail: { bookingId: bookingId }
            }));

        } else {
            // Lógica para seleccionar inicio y fin de una nueva reserva
            const clickedDate = new Date(this.currentYear, this.currentMonthIndex, day);
            
            if (this.selectedStartDate && this.selectedRoomId === roomId) {
                // Segundo clic: Fin de la reserva
                const endDate = clickedDate;
                if (endDate > this.selectedStartDate) {
                    // Disparamos evento para que el componente padre muestre el formulario de nueva reserva
                    document.dispatchEvent(new CustomEvent('create-booking', {
                        detail: {
                            roomId: roomId,
                            startDate: this.selectedStartDate.toISOString().split('T')[0],
                            endDate: endDate.toISOString().split('T')[0]
                        }
                    }));
                }
                // Limpiamos la selección
                this.clearSelection();
            } else {
                // Primer clic: Inicio de la reserva
                this.clearSelection();
                this.selectedRoomId = roomId;
                this.selectedStartDate = clickedDate;
                cell.classList.add('selected-start');
            }
        }
    }

    clearSelection() {
        // Elimina la clase 'selected-start' de todas las celdas previamente seleccionadas
        this.shadowRoot.querySelectorAll('.selected-start').forEach(c => c.classList.remove('selected-start'));
        this.selectedRoomId = null;
        this.selectedStartDate = null;
    }
}

customElements.define('room-planner', RoomPlanner);
