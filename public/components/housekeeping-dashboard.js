class HousekeepingDashboard extends HTMLElement {
    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        
        shadow.innerHTML = `
            <style>
                .hk-container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                .room-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px; }
                .room-card { padding: 15px; border-radius: 5px; border: 1px solid #ccc; }
                .room-card h4 { margin-top: 0; }
                .status-dirty { background-color: #f44336; color: white; }
                .status-clean { background-color: #4caf50; color: white; }
                .status-servicing { background-color: #ffeb3b; color: #333; }
                select { padding: 5px; width: 100%; }
            </style>
            <div class="hk-container">
                <h2>Gestión de Limpieza</h2>
                <div class="room-list" id="roomList">
                    <!-- Cards de habitaciones aquí -->
                </div>
            </div>
        `;
    }

    connectedCallback() {
        this.fetchRoomsStatus();
    }

    async fetchRoomsStatus() {
        const response = await fetch('/api/rooms');
        const data = await response.json();
        const rooms = data.data;
        this.renderRooms(rooms);
    }

    renderRooms(rooms) {
        const list = this.shadowRoot.getElementById('roomList');
        list.innerHTML = '';
        rooms.forEach(room => {
            const card = document.createElement('div');
            card.classList.add('room-card', `status-${room.clean_status}`);
            card.innerHTML = `
                <h4>${room.name}</h4>
                <p>Estado Actual: ${room.clean_status}</p>
                <select data-room-id="${room.id}">
                    <option value="dirty" ${room.clean_status === 'dirty' ? 'selected' : ''}>Sucia</option>
                    <option value="clean" ${room.clean_status === 'clean' ? 'selected' : ''}>Limpia</option>
                    <option value="servicing" ${room.clean_status === 'servicing' ? 'selected' : ''}>En Servicio</option>
                </select>
            `;
            card.querySelector('select').addEventListener('change', (e) => this.updateRoomStatus(e.target, room.id));
            list.appendChild(card);
        });
    }

    async updateRoomStatus(selectElement, roomId) {
        const newStatus = selectElement.value;
        const response = await fetch(`/api/rooms/status/${roomId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clean_status: newStatus })
        });

        if (response.ok) {
            alert(`Estado de habitación ${roomId} cambiado a ${newStatus}.`);
            // Actualizar visualmente la tarjeta sin recargar todo
            const card = selectElement.closest('.room-card');
            card.classList.remove('status-dirty', 'status-clean', 'status-servicing');
            card.classList.add(`status-${newStatus}`);
        } else {
            alert("Error al actualizar el estado.");
        }
    }
}

customElements.define('housekeeping-dashboard', HousekeepingDashboard);
