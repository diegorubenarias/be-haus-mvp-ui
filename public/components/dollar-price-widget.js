// public/components/dollar-price-widget.js
class DollarPriceWidget extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
            <style>
                .widget {
                    padding: 15px;
                    background-color: #e3f2fd;
                    border: 1px solid #bbdefb;
                    border-radius: 8px;
                    font-family: sans-serif;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .price {
                    font-size: 1.5em;
                    font-weight: bold;
                    color: #0d47a1;
                }
                .label {
                    font-size: 0.8em;
                    color: #444;
                }
            </style>
            <div class="widget">
                <div>
                    <div class="label">Dólar Oficial Venta</div>
                    <div class="price" id="priceDisplay">Cargando...</div>
                </div>
                <img src="/images/usd-icon.png" alt="USD" style="width: 30px; height: 30px;">
            </div>
        `;
    }

    connectedCallback() {
        this.fetchDollarPrice();
    }

    async fetchDollarPrice() {
        try {
            const response = await fetch('https://dolarapi.com/v1/dolares/oficial');
            if (!response.ok) {
                throw new Error('No se pudo obtener la cotización del dólar');
            }
            const data = await response.json();
            
            // Asumiendo que el JSON tiene una propiedad 'price'
            const price = parseFloat(data.compra).toFixed(2); 
             const venta = parseFloat(data.venta).toFixed(2); 
            this.shadowRoot.getElementById('priceDisplay').textContent = `compra: $${price} ARS - venta: $${venta} ARS `;

        } catch (error) {
            console.error("Error fetching dollar price:", error);
            this.shadowRoot.getElementById('priceDisplay').textContent = 'Error al cargar';
        }
    }
}

customElements.define('dollar-price-widget', DollarPriceWidget);
