class DashboardMenu extends HTMLElement {
    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        shadow.innerHTML = `
            <style>
                .menu {
                    width: 220px;
                    background-color: #333;
                    color: white;
                    padding: 20px 0;
                    box-shadow: 2px 0 5px rgba(0,0,0,0.2);
                }
                .menu h3 {
                    text-align: center;
                    margin-bottom: 30px;
                }
                .menu ul {
                    list-style: none;
                    padding: 0;
                }
                .menu li a {
                    display: block;
                    padding: 10px 20px;
                    color: white;
                    text-decoration: none;
                    transition: background-color 0.3s;
                }
                .menu li a:hover, .menu li a.active {
                    background-color: #0056b3;
                }
            </style>
            <nav class="menu">
                <h3>Hotel Admin</h3>
                <ul>
                    <li><a href="/dashboard" class="active">Dashboard</a></li>
                    <li><a href="/planner.html">Ocupación/Reservas</a></li>
                    <li><a href="#">Stock/Minibar</a></li>
                    <li><a href="#">Servicios Limpieza</a></li>
                    <li><a href="#">Facturación</a></li>
                    <li><a href="#">Reportes</a></li>
                    <li><a href="/">Cerrar Sesión</a></li>
                </ul>
            </nav>
        `;
    }
}

customElements.define('dashboard-menu', DashboardMenu);
