/**
 * web-fpga-05.js - Lógica de UI y orquestación
 */
import * as ftdi from './ftdi.js';

let device;
const statusMessage = document.getElementById('status-message');
const connectBtn = document.getElementById('connect-btn');
const initBtn = document.getElementById('init-btn');
const logConsole = document.getElementById('log-console');

function log(msg) {
    const t = new Date().toLocaleTimeString();
    logConsole.innerHTML += `<div>[${t}] ${msg}</div>`;
    logConsole.scrollTop = logConsole.scrollHeight;
}

async function setupDevice(selectedDevice) {
    device = selectedDevice;
    document.getElementById('vendor-name').textContent = device.manufacturerName;
    document.getElementById('device-info').style.display = "block";
    connectBtn.classList.add('hidden');
    initBtn.classList.remove('hidden');
    log("Dispositivo vinculado.");
}

initBtn.addEventListener('click', async () => {
    try {
        log("Abriendo canal...");
        await device.open();
        await device.selectConfiguration(1);
        await device.claimInterface(0);
        
        // Llamada al módulo importado
        log("Reseteando FTDI...");
        await ftdi.reset(device);
        
        log("✅ ¡FTDI Inicializado mediante módulo!");
        statusMessage.textContent = "SISTEMA LISTO";
        initBtn.disabled = true;
        initBtn.style.opacity = "0.5";

    } catch (err) {
        log("❌ ERROR: " + err.message);
    }
});

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