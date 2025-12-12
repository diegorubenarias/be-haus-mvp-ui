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
            this.rooms = roomsData.data; this.bookings = bookingsData.data;
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
        // Limpiamos el grid antes de renderizar
        grid.innerHTML = ''; 
        
        // Ajuste dinámico de columnas (asume this.daysInMonth ya calculado)
        this.shadowRoot.querySelector('.planner-grid').style.gridTemplateColumns = `150px repeat(${this.daysInMonth}, 40px)`;

        // Preparamos las clases de fin de semana para las celdas de días
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
                const roomHeaderCell = document.createElement('div');
                roomHeaderCell.classList.add('cell', 'room-header', 'clean-status-header', room.clean_status); // APLICAMOS EL ESTADO DE LIMPIEZA AQUI
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

                    const booking = this.findBookingForDay(room.id, i);
                    if (booking) {
                        cell.classList.remove('status-liberated'); 
                        cell.classList.add(`status-${booking.status}`);
                          // Aseguramos que la celda ocupada no tome el color de fondo del fin de semana
                        if(dayClasses[i - 1] === 'weekend-cell' && booking.status !== 'liberated') { 
                            cell.classList.remove('weekend-cell'); 
                        }
                        cell.textContent = `${booking.client_name.split(' ')[0]} (${booking.status.charAt(0).toUpperCase()})`;
                        cell.dataset.bookingId = booking.id;
                    }
                    // Usamos delegación de eventos, no listeners individuales aquí.
                    grid.appendChild(cell);
                }
            });
        }
    }
     // ... dentro de RoomPlanner class ...

    findBookingForDay(roomId, day) {
        const targetDate = new Date(Date.UTC(this.currentYear, this.currentMonthIndex, day));
        return this.bookings.find(b => {
            const start = new Date(b.start_date + 'T00:00:00Z'); 
            const end = new Date(b.end_date + 'T00:00:00Z');
            
            // Solo devolvemos la reserva si está activa (occupied o reserved)
            const isActive = (b.status === 'occupied' || b.status === 'reserved');

            return b.room_id == roomId && targetDate >= start && targetDate < end && isActive; 
        });
    }

    // Maneja todos los clics del grid a través de delegación
    handleGridClick(event) {
        let cell = event.target;
        while (cell !== this.shadowRoot.getElementById('plannerGrid') && !cell.classList.contains('cell')) {
            cell = cell.parentNode;
        }

        if (cell.classList.contains('cell') && !cell.classList.contains('header-cell')) {
            this.handleCellClickLogic(cell);
        }
    }

    // Lógica de click separada que EMITE UN EVENTO
       // ... dentro de RoomPlanner class, reemplaza handleCellClickLogic ...

    // Lógica de click separada que EMITE UN EVENTO
     // ... dentro de RoomPlanner class ...

    // Lógica de click separada que EMITE UN EVENTO
    handleCellClickLogic(cell) {
        const day = cell.dataset.day;
        const clickedDate = new Date(Date.UTC(this.currentYear, this.currentMonthIndex, day));
        const formattedDate = clickedDate.toISOString().split('T')[0]; // Formato YYYY-MM-DD
        const roomId = cell.dataset.roomId;
        const roomDetails = this.rooms.find(r => r.id == roomId);

        // Si findBookingForDay devuelve null, 'existingBooking' será null, indicando NUEVA reserva.
        const existingBooking = this.findBookingForDay(roomId, day);

        const eventDetail = {
            roomId: roomId,
            roomName: roomDetails ? roomDetails.name : `Habitación ${roomId}`,
            roomPrice: roomDetails ? roomDetails.price_per_night : 0,
            
            // Usamos los datos de la reserva existente o valores por defecto para NUEVA RESERVA
            startDate: existingBooking ? existingBooking.start_date : formattedDate,
            // Para una nueva reserva, la fecha de fin la dejamos vacía para que el usuario la elija
            endDate: existingBooking ? existingBooking.end_date : '', 
            clientName: existingBooking ? existingBooking.client_name : '',
            status: existingBooking ? existingBooking.status : 'reserved', // Nueva reserva por defecto es 'reserved'
            pricePerNight: existingBooking ? existingBooking.price_per_night : roomDetails.price_per_night,

            bookingId: existingBooking ? existingBooking.id : null // null para nueva reserva
        };

        document.dispatchEvent(new CustomEvent('open-booking-modal', {
            detail: eventDetail
        }));
    }
// ...

} 
// Asegúrate de que customElements.define('room-planner', RoomPlanner); esté al final del archivo si no lo estaba
customElements.define('room-planner', RoomPlanner);

