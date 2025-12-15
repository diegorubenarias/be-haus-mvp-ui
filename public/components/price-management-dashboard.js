class PriceManagementDashboard extends HTMLElement {
    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });

        shadow.innerHTML = `
            <style>
                .price-container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th, td { border: 1px solid #ddd; padding: 12px; text-align: left; vertical-align: middle; }
                th { background-color: #0056b3; color: white; }
                input[type="number"] { width: 80px; padding: 5px; }
                button { padding: 5px 10px; background-color: #4CAF50; color: white; border: none; cursor: pointer; margin-left: 5px; }
                button:hover { background-color: #45a049; }
                .message { margin-bottom: 10px; padding: 10px; border-radius: 4px; display: none; }
                .success { background-color: #e8f5e9; color: #388e3c; }
                .error { background-color: #ffebee; color: #d32f2f; }
            </style>
            <div class="price-container">
                <h2>Lista de Precios Actuales</h2>
                <div id="messageArea" class="message"></div>
                <table>
                    <thead>
                        <tr>
                            <th>ID Habitación</th>
                            <th>Nombre</th>
                            <th>Precio Actual ($)</th>
                            <th>Acción</th>
                        </tr>
                    </thead>
                    <tbody id="priceTableBody">
                        <!-- Filas de habitaciones aquí -->
                    </tbody>
                </table>
            </div>
        `;
    }

    connectedCallback() {
        this.fetchPrices();
    }

    async fetchPrices() {
        try {
            const response = await fetch('/api/rooms');
            if (response.status === 401) { window.location.href = '/'; return; }
            const data = await response.json();
            this.renderTable(data.data);
        } catch (error) {
            console.error("Error fetching prices:", error);
            this.showMessage("Error al cargar los precios.", "error");
        }
    }

    renderTable(rooms) {
        const tbody = this.shadowRoot.getElementById('priceTableBody');
        tbody.innerHTML = '';
        rooms.forEach(room => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${room.id}</td>
                <td>${room.name}</td>
                <td>
                    <input type="number" id="price-${room.id}" value="${parseFloat(room.price).toFixed(2)}" step="0.01" min="0">
                </td>
                <td>
                    <button data-room-id="${room.id}">Actualizar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Adjuntar listeners a los botones de la tabla
        tbody.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', (e) => this.updatePrice(e.target.dataset.roomId));
        });
    }

    async updatePrice(roomId) {
        const input = this.shadowRoot.getElementById(`price-${roomId}`);
        const newPrice = parseFloat(input.value);

        if (isNaN(newPrice) || newPrice < 0) {
            this.showMessage("Ingrese un precio válido.", "error");
            return;
        }

        try {
            const response = await fetch(`/api/rooms/${roomId}/price`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ price: newPrice })
            });

            if (response.ok) {
                this.showMessage(`Precio de habitación ${roomId} actualizado a $${parseFloat(newPrice).toFixed(2)}.`, "success");
                // Opcional: refetch para asegurar consistencia
                // this.fetchPrices(); 
            } else {
                const errorData = await response.json();
                this.showMessage(`Error: ${errorData.error}`, "error");
            }
        } catch (error) {
            console.error("Error updating price:", error);
            this.showMessage("Error de conexión al actualizar el precio.", "error");
        }
    }

    showMessage(message, type) {
        const messageArea = this.shadowRoot.getElementById('messageArea');
        messageArea.textContent = message;
        messageArea.className = `message ${type}`;
        messageArea.style.display = 'block';
        // Ocultar mensaje después de 3 segundos
        setTimeout(() => {
            messageArea.style.display = 'none';
        }, 3000);
    }
}

customElements.define('price-management-dashboard', PriceManagementDashboard);
