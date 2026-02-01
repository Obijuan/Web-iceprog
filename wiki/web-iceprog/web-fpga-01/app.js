console.log("Web FPGA 01 loaded");

//-- Mensaje de estado: Web usb soportado o no
const statusMessage = document.getElementById('status-message');

//-- Comprobar el soporte de webUSB
function checkWebUSBSupport() {
    if (navigator.usb) {
        statusMessage.textContent = "✅ Navegador compatible con WebUSB";
        statusMessage.className = "status supported";
    } else {
        statusMessage.textContent = "❌ WebUSB no está disponible en este navegador";
        statusMessage.className = "status not-supported";
    }
}

//-- Inicialización al cargar el DOM
document.addEventListener('DOMContentLoaded', checkWebUSBSupport);
