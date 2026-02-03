
import * as ftdi from './ftdi.js';

let device;
let bitstreamData = null; // Aquí guardaremos los bytes

const statusMessage = document.getElementById('status-message');
const connectBtn = document.getElementById('connect-btn');
const initBtn = document.getElementById('init-btn');
const fileBtn = document.getElementById('file-btn');
const fileInput = document.getElementById('file-input');
const logConsole = document.getElementById('log-console');
const prepBtn = document.getElementById('prep-btn'); // Añade este botón al HTML

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

// Función que centraliza la visibilidad según el estado
function updateUIState(state) {
    switch(state) {
        case 'connected':
            connectBtn.classList.add('hidden');
            initBtn.classList.remove('hidden');
            fileBtn.classList.remove('hidden');
            break;
        case 'initialized':
            initBtn.classList.add('hidden'); // Ya no lo necesitamos
            prepBtn.classList.remove('hidden'); // ¡Aquí aparece el botón de preparar!
            break;
        case 'ready':
            prepBtn.classList.add('hidden');
            // Aquí mostraremos el botón de "Programar" en el siguiente paso
            break;
    }
}



// --- Lógica de conexión (reutilizada) ---

// En el setupDevice inicial también llamamos al estado
async function setupDevice(selectedDevice) {
    device = selectedDevice;
    document.getElementById('vendor-name').textContent = device.manufacturerName;
    document.getElementById('device-info').style.display = "block";
    updateUIState('connected');
    log("Dispositivo vinculado.");
}

initBtn.addEventListener('click', async () => {
    try {

        log("Abriendo canal...");
        await device.open();
        await device.selectConfiguration(1);
        await device.claimInterface(0);
        
        log("Reseteando FTDI...");
        await ftdi.reset(device);
        
        log("Configurando modo MPSSE (SPI)...");
        await ftdi.enableMPSSE(device);
        
        log("✅ Hardware en modo síncrono listo.");
        statusMessage.textContent = "MPSSE ACTIVADO";
        initBtn.disabled = true;
        
        // Cambiamos el estado de la interfaz
        updateUIState('initialized');

        // Si ya hay un archivo cargado, podríamos mostrar el botón de "Programar"
        checkReadyToProgram();

    } catch (err) {
        log("❌ ERROR: " + err.message);
    }
});

function checkReadyToProgram() {
    if (bitstreamData && device && device.opened) {
        log("🚀 Sistema listo para enviar bitstream.");
        // Aquí habilitaremos el botón de descarga en el siguiente paso
    }
}

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

prepBtn.addEventListener('click', async () => {
    try {
        log("Configurando reloj SPI...");
        await ftdi.setClock(device, 0x0000); // Máxima velocidad para empezar

        log("Bajando CRESET (Resetando FPGA)...");
        // Configuramos direcciones: ADBUS0(CLK), ADBUS1(MOSI), ADBUS4(CRESET) como salidas
        // 0x13 = 00010011 en binario (bits 0, 1 y 4)
        const direction = 0x13; 
        
        // Ponemos CRESET en bajo (bit 4 = 0)
        await ftdi.setLowPins(device, 0x00, direction);
        
        // Pequeña espera (simulada con delay)
        await new Promise(r => setTimeout(r, 100));

        log("Subiendo CRESET... FPGA lista para recibir datos.");
        // Subimos CRESET (bit 4 = 1) -> 0x10
        await ftdi.setLowPins(device, 0x10, direction);

        statusMessage.textContent = "FPGA EN MODO ESCLAVO";
        prepBtn.disabled = true;

    } catch (err) {
        log("❌ Error en secuencia: " + err.message);
    }
});

// Chequeo inicial
if (navigator.usb) {
    connectBtn.classList.remove('hidden');
    navigator.usb.getDevices().then(devices => { if(devices.length > 0) setupDevice(devices[0]); });
}
