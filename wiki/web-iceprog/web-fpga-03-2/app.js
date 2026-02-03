console.log("Web FPGA 03-2 loaded");

/**
 * web-fpga-03.js
 * Gestión de conexión y reconexión automática
 */

const statusMessage = document.getElementById('status-message');
const connectBtn = document.getElementById('connect-btn');
const deviceInfo = document.getElementById('device-info');

// Función para actualizar la tarjeta con los datos del dispositivo
function showDeviceInfo(device) {
    document.getElementById('vendor-name').textContent = device.manufacturerName || "FTDI";
    document.getElementById('vendor-id').textContent = `0x${device.vendorId.toString(16).toUpperCase().padStart(4, '0')}`;
    document.getElementById('product-id').textContent = `0x${device.productId.toString(16).toUpperCase().padStart(4, '0')}`;
    
    deviceInfo.style.display = "block";
    statusMessage.textContent = "✅ Dispositivo conectado y reconocido.";
    connectBtn.classList.add('hidden');
}

function resetUI() {
    deviceInfo.style.display = "none";
    statusMessage.textContent = "✅ Navegador compatible. Esperando conexión...**";
    statusMessage.className = "status supported";
    connectBtn.classList.remove('hidden');
}

// 1. EVENTO DE CONEXIÓN (Plug)
// Se dispara si el dispositivo ya tiene permisos previos
navigator.usb.addEventListener('connect', (event) => {
    console.log("Dispositivo reconectado automáticamente:", event.device);
    showDeviceInfo(event.device);
});

// 2. EVENTO DE DESCONEXIÓN (Unplug)
navigator.usb.addEventListener('disconnect', (event) => {
    console.log("Dispositivo desconectado:", event.device);
    resetUI();
    statusMessage.textContent = "🔌 Dispositivo desconectado.";
});

// 3. Verificación inicial de soporte
if (navigator.usb) {
    resetUI();
    
    // Opcional: Verificar si ya hay dispositivos con permiso conectados al cargar la página
    navigator.usb.getDevices().then(devices => {
        if (devices.length > 0) {
            showDeviceInfo(devices[0]);
        }
    });
} else {
    statusMessage.textContent = "❌ Tu navegador no soporta WebUSB.";
    statusMessage.className = "status not-supported";
    connectBtn.classList.add('hidden');
}

// 4. Lógica del botón (para la primera vez o si no hay permisos)
connectBtn.addEventListener('click', async () => {
    try {
        const device = await navigator.usb.requestDevice({
            filters: [{ vendorId: 0x0403 }] 
        });
        showDeviceInfo(device);
    } catch (error) {
        console.warn("Conexión cancelada:", error);
    }
});