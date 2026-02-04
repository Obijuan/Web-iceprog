//-- Importar modulo FTDI
import * as ftdi from './ftdi.js';

//------------- Elementos de intefaz
const connectBtn = document.getElementById('connect-btn');
const statusCard = document.getElementById('status-card');
const statusText = document.getElementById('status-text');
const deviceName = document.getElementById('device-name');

let device = null;

async function updateUI(connected) {
    if (connected) {
        statusCard.classList.add('connected');
        statusText.textContent = "Conectado";
        deviceName.textContent = device.productName || "Alhambra-II";
        connectBtn.classList.add('hidden');
        // El botón de Reset aparecerá en el Paso 02
    } else {
        statusCard.classList.remove('connected');
        statusText.textContent = "Desconectado";
        deviceName.textContent = "Ninguna placa detectada";
        connectBtn.classList.remove('hidden');
    }
}

connectBtn.addEventListener('click', async () => {
    try {
        device = await ftdi.connect();
        await ftdi.initialize(device);
        updateUI(true);
    } catch (err) {
        console.error("Error de conexión:", err);
    }
});

navigator.usb.addEventListener('disconnect', (event) => {
    if (device && event.device === device) {
        device = null;
        updateUI(false);
    }
});

// Comprobar soporte inicial
if (!navigator.usb) {
    statusText.textContent = "Navegador no compatible";
    connectBtn.style.display = 'none';
}
