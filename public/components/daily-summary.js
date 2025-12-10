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
                    ${/* Reutilizamos el estilo card */''}
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .summary-card h4 {
                    margin-top: 0;
                }
                .summary-card ul {
                    list-style: none;
                    padding: 0;
                }
            </style>
            <div class="summary-grid">
                <div class="summary-card">
                    <h4>Check-Ins Hoy</h4>
                    <ul>
                        <li>Habitación 101: Juan Perez</li>
                        <li>Habitación 204: Maria Garcia</li>
                    </ul>
                </div>
                <div class="summary-card">
                    <h4>Check-Outs Hoy</h4>
                    <ul>
                        <li>Habitación 105: Carlos Sanchez</li>
                        <li>Habitación 301: Ana Rodriguez</li>
                    </ul>
                </div>
            </div>
        `;
    }
}
customElements.define('daily-summary', DailySummary);
