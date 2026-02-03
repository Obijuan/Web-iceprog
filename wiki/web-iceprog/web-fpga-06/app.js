/**
 * web-fpga-06.js
 */
import * as ftdi from './ftdi.js';

let device;
let bitstreamData = null; // Aquí guardaremos los bytes

const statusMessage = document.getElementById('status-message');
const connectBtn = document.getElementById('connect-btn');
const initBtn = document.getElementById('init-btn');
const fileBtn = document.getElementById('file-btn');
const fileInput = document.getElementById('file-input');
const logConsole = document.getElementById('log-console');

function log(msg) {
    const t = new Date().toLocaleTimeString();
    logConsole.innerHTML += `<div>[${t}] ${msg}</div>`;
    logConsole.scrollTop = logConsole.scrollHeight;
}

// --- Gestión de Archivos ---

fileBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    
    reader.onload = (event) => {
        // Convertimos el contenido a un array de bytes (Uint8Array)
        bitstreamData = new Uint8Array(event.target.result);
        
        log(`📂 Archivo cargado: ${file.name}`);
        log(`📏 Tamaño: ${bitstreamData.length} bytes`);
        document.getElementById('file-status').textContent = `Archivo: ${file.name} (${bitstreamData.length} bytes)`;
        
        // Aquí podríamos habilitar un botón de "Programar" en el futuro
    };

    reader.readAsArrayBuffer(file);
});

// --- Lógica de conexión (reutilizada) ---

async function setupDevice(selectedDevice) {
    device = selectedDevice;
    document.getElementById('vendor-name').textContent = device.manufacturerName;
    document.getElementById('device-info').style.display = "block";
    connectBtn.classList.add('hidden');
    initBtn.classList.remove('hidden');
    fileBtn.classList.remove('hidden'); // Permitimos elegir archivo incluso antes de inicializar
    log("Dispositivo vinculado.");
}

initBtn.addEventListener('click', async () => {
    try {
        await device.open();
        await device.selectConfiguration(1);
        await device.claimInterface(0);
        log("Reseteando dispositivo...");
        await ftdi.reset(device);
        log("✅ Hardware inicializado.");
        statusMessage.textContent = "LISTO PARA PROGRAMAR";
        initBtn.disabled = true;
    } catch (err) {
        log("❌ ERROR: " + err.message);
    }
});

// (Eventos connect/disconnect y connectBtn iguales al paso anterior...)
// ...
// Eventos de conexión (como en pasos anteriores)
navigator.usb.addEventListener('connect', e => setupDevice(e.device));
navigator.usb.addEventListener('disconnect', () => {
    log("Desconectado.");
    location.reload(); // Una forma rápida de resetear todo el estado
});

connectBtn.addEventListener('click', async () => {
    const d = await navigator.usb.requestDevice({ filters: [{ vendorId: 0x0403 }] });
    setupDevice(d);
});

// Chequeo inicial
if (navigator.usb) {
    connectBtn.classList.remove('hidden');
    navigator.usb.getDevices().then(devices => { if(devices.length > 0) setupDevice(devices[0]); });
}
