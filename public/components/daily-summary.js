class DailySummary extends HTMLElement {
    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        
        shadow.innerHTML = `
            <style>
                .summary-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 20px;
                }
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
            </style>
            <div class="summary-grid">
                <div class="summary-card">
                    <h4>Check-Ins Hoy</h4>
                    <ul id="checkInsList">
                        <li>Cargando check-ins...</li>
                    </ul>
                </div>
                <div class="summary-card">
                    <h4>Check-Outs Hoy</h4>
                    <ul id="checkOutsList">
                        <li>Cargando check-outs...</li>
                    </ul>
                </div>
            </div>
        `;
    }

    connectedCallback() {
        this.fetchDailyBookings();
    }

    async fetchDailyBookings() {
        try {
            const response = await fetch('/api/bookings');
            const data = await response.json();
            const bookings = data.data;

            // Filtra y renderiza las listas
            this.renderLists(bookings);

        } catch (error) {
            console.error("Error fetching daily bookings:", error);
            this.shadowRoot.getElementById('checkInsList').innerHTML = '<li>Error al cargar datos.</li>';
            this.shadowRoot.getElementById('checkOutsList').innerHTML = '<li>Error al cargar datos.</li>';
        }
    }

    renderLists(bookings) {
        const checkInsList = this.shadowRoot.getElementById('checkInsList');
        const checkOutsList = this.shadowRoot.getElementById('checkOutsList');
        
        checkInsList.innerHTML = '';
        checkOutsList.innerHTML = '';

        const today = new Date();
        // Normalizamos la fecha de hoy a YYYY-MM-DD para comparación simple con SQLite TEXT format
        const todayISO = today.toISOString().split('T')[0]; 

        const checkIns = bookings.filter(b => b.start_date === todayISO);
        const checkOuts = bookings.filter(b => b.end_date === todayISO);
        
        if (checkIns.length > 0) {
            checkIns.forEach(booking => {
                const li = document.createElement('li');
                li.textContent = `Habitación ${booking.room_id}: ${booking.client_name} (${booking.status})`;
                checkInsList.appendChild(li);
            });
        } else {
            checkInsList.innerHTML = '<li>No hay check-ins programados hoy.</li>';
        }

        if (checkOuts.length > 0) {
            checkOuts.forEach(booking => {
                const li = document.createElement('li');
                li.textContent = `Habitación ${booking.room_id}: ${booking.client_name} (${booking.status})`;
                checkOutsList.appendChild(li);
            });
        } else {
            checkOutsList.innerHTML = '<li>No hay check-outs programados hoy.</li>';
        }
    }
}

customElements.define('daily-summary', DailySummary);
