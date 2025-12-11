class DashboardMenu extends HTMLElement {
    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        shadow.innerHTML = `
            <style>
                .menu { width: 220px; background-color: #333; color: white; padding: 20px 0; box-shadow: 2px 0 5px rgba(0,0,0,0.2); }
                .menu h3 { text-align: center; margin-bottom: 30px; }
                .menu ul { list-style: none; padding: 0; }
                .menu li a { display: block; padding: 10px 20px; color: white; text-decoration: none; transition: background-color 0.3s; }
                .menu li a:hover, .menu li a.active { background-color: #0056b3; }
                .logout-btn { background: none; border: none; color: white; cursor: pointer; width: 100%; text-align: left; padding: 10px 20px; }
            </style>
            <nav class="menu">
                <h3>Hotel Admin</h3>
                <ul>
                    <li><a href="/dashboard">Dashboard</a></li>
                    <li><a href="/planner.html">Ocupación/Reservas</a></li>
                    <li><a href="/reports.html">Reportes</a></li>
                    <li><a href="#">Stock/Minibar</a></li>
                    <li><a href="/housekeeping.html">Limpieza</a></li>
                    <li><a href="/prices.html">Precios</a></li>
                     <li><a href="/invoices.html">Facturas</a></li> 
                    <!-- Reemplazamos el <a> por un botón que maneja el logout real -->
                    <li><button class="logout-btn" id="logoutButton">Cerrar Sesión</button></li>
                </ul>
            </nav>
        `;
    }

    connectedCallback() {
        // Manejar el logout real
        this.shadowRoot.getElementById('logoutButton').addEventListener('click', async () => {
            await fetch('/api/logout', { method: 'POST' });
            window.location.href = '/'; // Redirigir al login después del logout
        });
        
        // Lógica simple para resaltar el enlace activo
        const currentPath = window.location.pathname;
        this.shadowRoot.querySelectorAll('.menu li a').forEach(link => {
            if (link.getAttribute('href') === currentPath) {
                link.classList.add('active');
            }
        });
    }
}

customElements.define('dashboard-menu', DashboardMenu);
