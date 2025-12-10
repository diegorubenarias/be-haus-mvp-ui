class RoomPlanner extends HTMLElement {
    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        
        this.rooms = [];
        this.bookings = [];
        this.today = new Date();
        this.currentViewDate = new Date(this.today.getFullYear(), this.today.getMonth(), 1);
        this.monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

        this.daysInMonth = 0;
        this.currentYear = 0;
        this.currentMonthIndex = 0;
        this.startDate = null;

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
                
                .month-selector { 
                    padding: 10px; background-color: #e9e9e9; font-weight: bold; 
                    display: flex; justify-content: space-between; align-items: center;
                }
                .nav-button {
                    background: #0056b3; color: white; border: none; padding: 5px 10px; cursor: pointer;
                }
            </style>
            <div class="month-selector">
                <button class="nav-button" id="prevMonth">&lt; Anterior</button>
                <span id="currentMonthDisplay">Mes Actual</span>
                <button class="nav-button" id="nextMonth">Siguiente &gt;</button>
            </div>
            <div class="planner-container">
                <div class="planner-grid" id="plannerGrid">
                    <!-- Grid se genera aquí con JS -->
                </div>
            </div>
        `;
    }

    async connectedCallback() {
        // CLAVE: Esperar a que los datos se carguen antes de renderizar
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
                fetch('/api/rooms'),
                fetch('/api/bookings')
            ]);
            const roomsData = await roomsRes.json();
            const bookingsData = await bookingsRes.json();

            this.rooms = roomsData.data;
            this.bookings = bookingsData.data;
            console.log("Datos cargados. Habitaciones:", this.rooms.length, "Reservas:", this.bookings.length);
        } catch (error) {
            console.error("Error fetching data:", error);
        }
    }

    refreshPlanner() {
        console.log("Refrescando planificador...");
        this.fetchData().then(() => {
            this.renderView();
        });
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

        grid.innerHTML += `<div class="cell header-cell room-header">Habitación</div>`; 
        for (let i = 1; i <= this.daysInMonth; i++) {
            const headerCell = document.createElement('div');
            headerCell.classList.add('cell', 'header-cell');
            if (dayClasses[i - 1] === 'weekend-cell') {
                headerCell.classList.add('weekend-header');
            }
            headerCell.textContent = i;
            grid.appendChild(headerCell);
        }

        this.rooms.forEach(room => {
            grid.innerHTML += `<div class="cell room-header" data-room-id="${room.id}">${room.name}</div>`;
            
            for (let i = 1; i <= this.daysInMonth; i++) {
                const cell = document.createElement('div');
                cell.classList.add('cell', 'status-liberated');
                cell.dataset.roomId = room.id;
                cell.dataset.day = i;
                
                if (dayClasses[i - 1] === 'weekend-cell') {
                    cell.classList.add('weekend-cell');
                }

                const booking = this.findBookingForDay(room.id, i);
                if (booking) {
                    cell.classList.remove('status-liberated');
                    cell.classList.add(`status-${booking.status}`);
                    if(dayClasses[i - 1] === 'weekend-cell' && booking.status !== 'liberated') {
                         cell.classList.remove('weekend-cell');
                    }
                    cell.textContent = `${booking.client_name.split(' ')} (${booking.status.charAt(0).toUpperCase()})`;
                    cell.dataset.bookingId = booking.id;
                }
                
                // NO adjuntamos listeners individuales aquí (usamos delegación)
                
                grid.appendChild(cell);
            }
        });
    }
    
    findBookingForDay(roomId, day) {
        const targetDate = new Date(Date.UTC(this.currentYear, this.currentMonthIndex, day));
        
        return this.bookings.find(b => {
            const start = new Date(b.start_date + 'T00:00:00Z'); 
            const end = new Date(b.end_date + 'T00:00:00Z');

            return b.room_id == roomId && targetDate >= start && targetDate < end; 
        });
    }

    // Maneja todos los clics del grid a través de delegación
    handleGridClick(event) {
        let cell = event.target;

        // Subir en el árbol DOM si el clic fue en el texto (span) dentro de la celda
        while (cell !== this.shadowRoot.getElementById('plannerGrid') && !cell.classList.contains('cell')) {
            cell = cell.parentNode;
        }

        // Asegurarse de que el elemento clickeado sea una celda y no un encabezado
        if (cell.classList.contains('cell') && !cell.classList.contains('header-cell')) {
            console.log("Delegación de evento - Celda clickeada:", cell);
            this.handleCellClickLogic(cell);
        }
    }

    // Lógica de click separada
    // ... dentro de RoomPlanner class ...

    // Lógica de click separada
    handleCellClickLogic(cell) {
        // Calcular la fecha exacta de la celda clickeada
        const day = cell.dataset.day;
        // Usamos this.currentYear y this.currentMonthIndex (0-indexed)
        const clickedDate = new Date(this.currentYear, this.currentMonthIndex, day);
        // Formatear a YYYY-MM-DD para compatibilidad con input type="date" y backend
        const formattedDate = clickedDate.toISOString().split('T')[0]; 


        const roomId = cell.dataset.roomId;
        const roomDetails = this.rooms.find(r => r.id == roomId);

        const bookingId = cell.dataset.bookingId || null; 
        
        let bookingDetails = null;

        if (bookingId) {
            bookingDetails = this.bookings.find(b => b.id == bookingId);
        }
        
        const modalData = { 
            roomId, 
            day, 
            bookingId, 
            bookingDetails,
            roomName: roomDetails ? roomDetails.name : 'N/A',
            roomPrice: roomDetails ? roomDetails.price : 0,
            // *** CLAVE: Pasar la fecha clickeada ***
            clickedDate: formattedDate 
        };

        const bookingModal = document.querySelector('booking-modal'); 
        if (bookingModal) {
            bookingModal.openModal(modalData);
        } else {
            console.error("No se encontró el elemento <booking-modal> en el documento.");
        }
    }
}

customElements.define('room-planner', RoomPlanner);
