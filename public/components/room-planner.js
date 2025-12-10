class RoomPlanner extends HTMLElement {
    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        
        this.rooms = [];
        this.bookings = [];
        
        // --- DINÁMICO: Calcular mes y días actuales ---
        this.today = new Date();
        this.currentYear = this.today.getFullYear();
        this.currentMonthIndex = this.today.getMonth(); // 0-indexed (Enero=0)
        this.monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        this.currentMonthName = this.monthNames[this.currentMonthIndex];
        // Calcular el número de días en el mes actual
        this.daysInMonth = new Date(this.currentYear, this.currentMonthIndex + 1, 0).getDate();
        this.startDate = new Date(this.currentYear, this.currentMonthIndex, 1);
        
        shadow.innerHTML = `
            <style>
                /* (Mantén los mismos estilos CSS que antes para la estética de Excel) */
                .planner-container {
                    overflow-x: auto; 
                    background: white;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    border-radius: 4px;
                }
                .planner-grid {
                    display: grid;
                    grid-template-columns: 150px repeat(${this.daysInMonth}, 40px);
                    border-collapse: collapse;
                    width: max-content; 
                }
                .cell {
                    border: 1px solid #e0e0e0;
                    padding: 8px 5px;
                    text-align: center;
                    cursor: pointer;
                    min-height: 20px;
                    box-sizing: border-box;
                    transition: background-color 0.2s;
                    white-space: nowrap; /* Evita que el texto de la reserva se rompa */
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .cell:hover {
                    background-color: #f2f2f2;
                }
                .header-cell {
                    background-color: #0056b3;
                    color: white;
                    font-weight: bold;
                    position: sticky;
                    top: 0;
                    z-index: 10;
                }
                .room-header {
                    background-color: #f9f9f9;
                    color: #333;
                    text-align: left;
                    font-weight: normal;
                    position: sticky; 
                    left: 0; 
                    z-index: 5;
                }
                .status-reserved { background-color: #ffeb3b; color: #333; }
                .status-occupied { background-color: #4caf50; color: white; }
                .status-blocked { background-color: #f44336; color: white; }
                .status-liberated { background-color: white; }
                .month-selector {
                    padding: 10px;
                    background-color: #e9e9e9;
                    font-weight: bold;
                }
            </style>
            <div class="month-selector">
                <span>&lt; Septiembre</span> | <span>${this.currentMonth}</span> | <span>Noviembre &gt;</span>
            </div>
            <div class="planner-container">
                <div class="planner-grid" id="plannerGrid">
                    <!-- Grid se genera aquí con JS -->
                </div>
            </div>
        `;
    }

    async connectedCallback() {
        // Cargar datos reales del backend
        await this.fetchData();
        this.renderGrid();
        this.addEventListeners();
        // Escucha el evento de 'booking-saved' para refrescar la vista
        document.addEventListener('booking-saved', () => this.refreshPlanner());
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
        } catch (error) {
            console.error("Error fetching data:", error);
        }
    }

    refreshPlanner() {
        // Vuelve a cargar los datos y renderiza la cuadrícula para reflejar cambios
        this.fetchData().then(() => {
            this.shadowRoot.getElementById('plannerGrid').innerHTML = ''; // Limpiar grid anterior
            this.renderGrid();
        });
    }

   // ... dentro de RoomPlanner class ...

    renderGrid() {
        const grid = this.shadowRoot.getElementById('plannerGrid');
        grid.innerHTML = ''; 

        // Aseguramos que el grid tenga el tamaño correcto si el número de días cambió
        this.shadowRoot.querySelector('.planner-grid').style.gridTemplateColumns = `150px repeat(${this.daysInMonth}, 40px)`;


        // Fila de encabezado (Días)
        grid.innerHTML += `<div class="cell header-cell room-header">Habitación</div>`; 
        for (let i = 1; i <= this.daysInMonth; i++) {
            grid.innerHTML += `<div class="cell header-cell">${i}</div>`;
        }

        // Filas de Habitaciones y Celdas de Reserva
        this.rooms.forEach(room => {
            grid.innerHTML += `<div class="cell room-header" data-room-id="${room.id}">${room.name}</div>`;
            
            for (let i = 1; i <= this.daysInMonth; i++) {
                const cell = document.createElement('div');
                cell.classList.add('cell', 'status-liberated');
                cell.dataset.roomId = room.id;
                cell.dataset.day = i;
                
                // *** Verificar si este día está ocupado/reservado usando los datos FRESCOS ***
                const booking = this.findBookingForDay(room.id, i);
                if (booking) {
                    cell.classList.remove('status-liberated');
                    cell.classList.add(`status-${booking.status}`);
                    cell.textContent = `${booking.client_name.split(' ')[0]} (${booking.status.charAt(0).toUpperCase()})`; // Mostrar solo el primer nombre
                    cell.dataset.bookingId = booking.id;
                }
                
                cell.addEventListener('click', (event) => this.handleCellClick(event.target));
                grid.appendChild(cell);
            }
        });
    }
    
    findBookingForDay(roomId, day) {
        // Creamos la fecha objetivo para la comparación UTC
        const targetDate = new Date(Date.UTC(this.currentYear, this.currentMonthIndex, day));
        
        return this.bookings.find(b => {
            // Convertimos las fechas de la BD a objetos Date UTC para una comparación fiable
            const start = new Date(b.start_date + 'T00:00:00Z'); 
            const end = new Date(b.end_date + 'T00:00:00Z');

            // Comparamos si la fecha objetivo está dentro del rango [inicio, fin)
            // Una reserva incluye la noche de inicio, pero termina la mañana del end_date
            return b.room_id == roomId && targetDate >= start && targetDate < end; 
        });
    }

// ... el resto de la clase (fetchData, refreshPlanner, handleCellClick) se mantiene ...

    addEventListeners() {
        // ... (se mantiene igual) ...
        this.shadowRoot.querySelectorAll('.cell').forEach(cell => {
            if (!cell.classList.contains('header-cell')) {
                cell.addEventListener('click', () => this.handleCellClick(cell));
            }
        });
    }

    handleCellClick(cell) {
        const roomId = cell.dataset.roomId;
        const day = cell.dataset.day;
        const bookingId = cell.dataset.bookingId || null; 
        
        let bookingDetails = null;

        // Si existe un bookingId, busca los detalles completos para pasarlos al modal
        if (bookingId) {
            bookingDetails = this.bookings.find(b => b.id == bookingId); // Usar == porque bookingId viene como string de dataset
        }
        
        const event = new CustomEvent('open-booking-modal', {
            bubbles: true,
            composed: true, 
            // Pasa los detalles completos, incluyendo el ID de la reserva si existe
            detail: { roomId, day, bookingId, bookingDetails } 
        });
        this.dispatchEvent(event);
    }
// ... fin de RoomPlanner class ...

}

customElements.define('room-planner', RoomPlanner);
