console.log("Web FPGA 03 loaded");

/**
 * web-fpga-03.js
 * Gestión de conexión y desconexión automática
 */

const statusMessage = document.getElementById('status-message');
const connectBtn = document.getElementById('connect-btn');
const deviceInfo = document.getElementById('device-info');

// Función para volver la interfaz al estado inicial
function resetUI() {
    deviceInfo.style.display = "none";
    statusMessage.textContent = "✅ Navegador compatible. Esperando conexión...";
    statusMessage.className = "status supported";
    connectBtn.classList.remove('hidden');
    
    // Limpiar textos de la tarjeta
    document.getElementById('vendor-name').textContent = "-";
    document.getElementById('vendor-id').textContent = "-";
    document.getElementById('product-id').textContent = "-";
}

// 1. Verificación inicial de soporte
if (navigator.usb) {
    resetUI();
} else {
    statusMessage.textContent = "❌ Tu navegador no soporta WebUSB.";
    statusMessage.className = "status not-supported";
    connectBtn.classList.add('hidden');
}

// 2. Evento para detectar cuando se desenchufa el dispositivo
navigator.usb.addEventListener('disconnect', (event) => {
    console.log("Dispositivo desconectado:", event.device);
    // Si se desconecta, reiniciamos la interfaz
    resetUI();
    statusMessage.textContent = "🔌 Dispositivo desconectado.";
});

// 3. Lógica del botón de conexión
connectBtn.addEventListener('click', async () => {
    try {
        const device = await navigator.usb.requestDevice({
            filters: [{ vendorId: 0x0403 }] 
        });

        // Actualizar UI
        document.getElementById('vendor-name').textContent = device.manufacturerName || "FTDI";
        document.getElementById('vendor-id').textContent = `0x${device.vendorId.toString(16).toUpperCase().padStart(4, '0')}`;
        document.getElementById('product-id').textContent = `0x${device.productId.toString(16).toUpperCase().padStart(4, '0')}`;
        
        deviceInfo.style.display = "block";
        statusMessage.textContent = "✅ Dispositivo vinculado.";
        // Opcional: podemos ocultar el botón de conectar mientras ya está conectado
        connectBtn.classList.add('hidden');

    } catch (error) {
        console.warn("Conexión cancelada:", error);
    }
});