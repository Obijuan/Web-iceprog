console.log("Web FPGA 4 loaded");

/**
 * web-fpga-04.js - Apertura de canal
 */
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
    initBtn.classList.remove('hidden'); // Mostramos el botón de inicializar
    log("Dispositivo vinculado: " + device.productName);
}

// Inicialización real de la comunicación
initBtn.addEventListener('click', async () => {
    try {
        log("Abriendo dispositivo...");
        await device.open(); 

        log("Seleccionando configuración...");
        await device.selectConfiguration(1); 

        log("Reclamando interfaz 0...");
        // La Alhambra-II suele usar la interfaz 0 para el canal de programación
        await device.claimInterface(0); 

        log("✅ ¡Hardware listo para recibir datos!");
        statusMessage.textContent = "CONECTADO Y ABIERTO";
        initBtn.disabled = true;
        initBtn.style.opacity = "0.5";

    } catch (err) {
        log("❌ ERROR: " + err.message);
        log("➡️ En linux ejecuta: sudo modprobe -r ftdi_sio")
        console.error(err);
    }
});

// Reutilizamos la lógica de eventos del Paso 03
navigator.usb.addEventListener('connect', e => { log("Plug detectado"); setupDevice(e.device); });
navigator.usb.addEventListener('disconnect', () => { 
    log("Dispositivo desconectado"); 
    device = null;
    initBtn.classList.add('hidden');
    connectBtn.classList.remove('hidden');
    initBtn.disabled = false;
    initBtn.style.opacity = "1";
});

connectBtn.addEventListener('click', async () => {
    try {
        const d = await navigator.usb.requestDevice({ filters: [{ vendorId: 0x0403 }] });
        setupDevice(d);
    } catch (e) { log("Selección cancelada"); }
});

// Detección inicial
if (navigator.usb) {
    statusMessage.textContent = "✅ Sistema listo";
    statusMessage.className = "status supported";
    connectBtn.classList.remove('hidden');
    navigator.usb.getDevices().then(devices => { if(devices.length > 0) setupDevice(devices[0]); });
}