console.log("Web FPGA 02 loaded");

/**
 * web-fpga-02.js
 * Selección de la Alhambra-II con control de visibilidad
 */

const statusMessage = document.getElementById('status-message');
const connectBtn = document.getElementById('connect-btn');
const deviceInfo = document.getElementById('device-info');

// 1. Verificación inicial de soporte
if (navigator.usb) {
    statusMessage.textContent = "✅ Navegador compatible.";
    statusMessage.className = "status supported";
    // Si es compatible, mostramos el botón eliminando la clase 'hidden'
    connectBtn.classList.remove('hidden');
} else {
    statusMessage.textContent = "❌ Tu navegador no soporta WebUSB";
    statusMessage.className = "status not-supported";
    // Nos aseguramos de que el botón esté oculto (por si acaso)
    connectBtn.classList.add('hidden');
}

// 2. Lógica del botón de conexión
connectBtn.addEventListener('click', async () => {
    try {
        // Solicitamos el dispositivo 
        // (Vendor ID 0x0403 es el estándar de FTDI)
        const device = await navigator.usb.requestDevice({
            filters: [{ vendorId: 0x0403 }] 
        });

        // Actualizar UI con la info del dispositivo
        vendor_name = document.getElementById('vendor-name')
        vendor_name.textContent = device.manufacturerName || "FTDI";

        vendor_id = document.getElementById('vendor-id')
        vendor_id.textContent = `0x${device.vendorId.toString(16).toUpperCase().padStart(4, '0')}`;


        document.getElementById('product-id').textContent = `0x${device.productId.toString(16).toUpperCase().padStart(4, '0')}`;
        
        deviceInfo.style.display = "block";
        statusMessage.textContent = "✅ Dispositivo vinculado.";

    } catch (error) {
        // El usuario canceló el selector o hubo un error de permisos
        console.warn("Conexión cancelada:", error);
    }
});
