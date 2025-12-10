class MonthlyOccupancyReport extends HTMLElement {
    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        
        shadow.innerHTML = `
            <style>
                .report-card {
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 15px;
                }
                th, td {
                    border: 1px solid #ddd;
                    padding: 12px;
                    text-align: left;
                }
                th {
                    background-color: #0056b3;
                    color: white;
                }
                tr:nth-child(even) {
                    background-color: #f2f2f2;
                }
            </style>
            <div class="report-card">
                <h2>Estadísticas del Mes Actual</h2>
                <div id="reportSummary">Cargando reporte...</div>
                <table id="occupancyTable">
                    <thead>
                        <tr>
                            <th>Habitación</th>
                            <th>Días Ocupados</th>
                            <th>% Ocupación</th>
                        </tr>
                    </thead>
                    <tbody id="reportBody">
                    </tbody>
                </table>
            </div>
        `;
    }

    connectedCallback() {
        this.generateReport();
    }

    async generateReport() {
        try {
            const response = await fetch('/api/bookings');
            const data = await response.json();
            const bookings = data.data;
            
            const roomsResponse = await fetch('/api/rooms');
            const roomsData = await roomsResponse.json();
            const rooms = roomsData.data;

            this.calculateAndDisplay(bookings, rooms);

        } catch (error) {
            console.error("Error generating report:", error);
            this.shadowRoot.getElementById('reportSummary').textContent = 'Error al cargar los datos del reporte.';
        }
    }

    calculateAndDisplay(bookings, rooms) {
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonthIndex = today.getMonth();
        const daysInMonth = new Date(currentYear, currentMonthIndex + 1, 0).getDate();

        // Inicializar contador de días ocupados por habitación
        const occupancyData = {};
        rooms.forEach(room => {
            occupancyData[room.id] = 0;
        });

        bookings.forEach(booking => {
            // Solo contamos reservas que caen dentro del mes actual
            const start = new Date(booking.start_date + 'T00:00:00Z');
            const end = new Date(booking.end_date + 'T00:00:00Z');
            
            // Ajustar el rango para que solo cuente días dentro del mes actual
            const effectiveStart = new Date(Math.max(start, new Date(Date.UTC(currentYear, currentMonthIndex, 1))));
            const effectiveEnd = new Date(Math.min(end, new Date(Date.UTC(currentYear, currentMonthIndex + 1, 1))));
            
            // Diferencia en días (milisegundos / (1000*60*60*24))
            if (effectiveEnd > effectiveStart) {
                const occupiedDays = Math.floor((effectiveEnd - effectiveStart) / (1000 * 60 * 60 * 24));
                if (occupancyData[booking.room_id] !== undefined) {
                    occupancyData[booking.room_id] += occupiedDays;
                }
            }
        });

        // Mostrar en la tabla
        const tbody = this.shadowRoot.getElementById('reportBody');
        tbody.innerHTML = '';
        let totalOccupiedDays = 0;

        rooms.forEach(room => {
            const occupied = occupancyData[room.id];
            totalOccupiedDays += occupied;
            const percentage = ((occupied / daysInMonth) * 100).toFixed(1);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${room.name}</td>
                <td>${occupied} días</td>
                <td>${percentage}%</td>
            `;
            tbody.appendChild(tr);
        });

        // Resumen general
        const overallOccupancy = ((totalOccupiedDays / (daysInMonth * rooms.length)) * 100).toFixed(1);
        this.shadowRoot.getElementById('reportSummary').innerHTML = `
            <p>Total de Días en el Mes: ${daysInMonth}</p>
            <p>Ocupación General del Hotel: <strong>${overallOccupancy}%</strong></p>
        `;
    }
}

customElements.define('monthly-occupancy-report', MonthlyOccupancyReport);
