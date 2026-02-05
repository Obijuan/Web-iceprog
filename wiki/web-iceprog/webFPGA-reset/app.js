import * as ftdi from './ftdi.js';

//-- Elementos de Interfaz
const mainApp = document.getElementById('main-app');
const noSupport = document.getElementById('no-support');
const connectBtn = document.getElementById('connect-btn');
const statusCard = document.getElementById('status-card');
const statusText = document.getElementById('status-text');
const deviceName = document.getElementById('device-name');
const actionsArea = document.getElementById('actions-area');

log("Aplicacion iniciada...", "system");

let device = null;

// -----------------------------------------------------
//-- Comprobar si el navegador soporta WebUSB
//--
//-- DEVUELVE:
//--   true: Soporte OK
//--   false: No hay soporte
//-----------------------------------------------------
function checkCompatibility() {

    if (!navigator.usb) {
        //-- NO hay soporte!
        //-- Ocultar la app principal y mostrar el mensaje
        mainApp.classList.add('hidden');

        //-- Mostrar el mensaje de no soporte
        noSupport.classList.remove('hidden');
        return false;
    }
    return true;
}


// Función centralizada para desconectar
async function performDisconnect() {
    if (device) {
        await ftdi.disconnect(device);
        device = null;
        updateUI(false);
    }
}

//-----------------------------------------------------
//-- Actualizar la interfaz de usuario
//--
//-- ENTRADA:
//--   connected: true si el dispositivo está conectado
//-----------------------------------------------------
async function updateUI(connected) {

    //-- Limpiar el estado de error
    statusCard.classList.remove('error-active'); 

    if (connected) {

        //-- Tarjeta de estado: Ahora pertenece a la clase connected
        statusCard.classList.add('connected');
        log("Conexion OK!", "success");

        //-- Actualizar textos
        statusText.textContent = "Estado: Activo";
        deviceName.textContent = device.productName || "Alhambra-II";

        //-- Ocultar el botón de conexión
        connectBtn.classList.add('hidden');

        // Creamos el botón de desconectar en el área de acciones
        actionsArea.innerHTML = `
        <button id="disconnect-btn" class="secondary-btn danger">
            ✕ Desconectar
        </button>
        `;
        document.getElementById('disconnect-btn').onclick = performDisconnect;

        // Insertamos el botón de Reset ANTES del de desconectar
        const resetBtnHTML = `<button id="reset-btn" class="primary-btn">Resetear FPGA</button>`;
        actionsArea.insertAdjacentHTML('afterbegin', resetBtnHTML);
        
        document.getElementById('reset-btn').onclick = handleReset;
        document.getElementById('disconnect-btn').onclick = performDisconnect;


    } else {
        //-- Tarjeta de estado: Ya no pertenece a la clase connected
        statusCard.classList.remove('connected');

        //-- Actualizar textos
        statusText.textContent = "Estado: Desconectado";
        deviceName.textContent = "Placa no conectada";

        //-- Mostrar el botón de conexión 
        connectBtn.classList.remove('hidden');

        // Limpiamos botones cuando no hay conexión
        actionsArea.innerHTML = ""; 
    }
}

function log(message, type = 'default') {
    const consoleElem = document.getElementById('console-log');
    const entry = document.createElement('div'); // Cambiado de span a div para forzar bloque
    entry.classList.add('log-entry', type);
    
    const time = new Date().toLocaleTimeString([], { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });
    
    entry.textContent = `[${time}] ${message}`;
    consoleElem.appendChild(entry);
    
    // Auto-scroll
    consoleElem.scrollTop = consoleElem.scrollHeight;
}

async function handleConnectionError(err) {
    statusCard.classList.add('error-active');
    const isLinux = (navigator.userAgentData?.platform === 'Linux') || 
                    (navigator.platform.indexOf('Linux') !== -1);

    let title = "Error de conexión";
    let message = err.message;
    let solution = "";
    log(`ERROR: ${err.message}`, "error");

    // ESCENARIO A: Permisos de sistema (udev)
    // Suele ocurrir en device.open() y devuelve SecurityError
    if (err.name === 'SecurityError' || 
        err.message.toLowerCase().includes('access denied')) {
        if (isLinux) {
            title = "Faltan permisos (udev)";
            message = "Tu usuario no tiene permiso para escribir " +
                      "en el dispositivo USB.";
            solution = `
                <p>Crea un archivo de reglas ejecutando:</p>
                <code>echo 'SUBSYSTEM=="usb", ATTR{idVendor}=="0403", 
                  MODE="0666"' | 
                  sudo tee /etc/udev/rules.d/99-alhambra.rules && 
                  sudo udevadm control --reload-rules
                </code>
            `;
        } else {
            message = "El sistema operativo ha bloqueado el acceso al USB.";
        }
    } 
    
    // ESCENARIO B: Interfaz ocupada (ftdi_sio)
    // Suele ocurrir en claimInterface() y devuelve NetworkError
    else if (err.name === 'NetworkError' || err.message.includes('claimInterface')) {
        if (isLinux) {
            title = "Driver en conflicto";
            message = "El módulo 'ftdi_sio' está bloqueando la placa.";
            solution = `
                <p>Ejecuta este comando para liberarla:</p>
                <code>sudo modprobe -r ftdi_sio</code>d
            `;
        } else {
            message = "La placa está siendo usada por otro programa.";
        }
    }

    // Renderizado en la UI
    statusText.innerHTML = `
        <div class="linux-error">
            <strong>${title}</strong><br>
            <span style="font-size: 0.8rem; opacity: 0.8;">${message}</span>
            ${solution}
        </div>
    `;
    consoleWrapper.classList.add('expanded');
    toggleLogBtn.classList.add('active');
    log(`ERROR CRÍTICO: ${err.message}`, 'error');
}

async function handleReset() {
    const resetBtn = document.getElementById('reset-btn');
    try {
        resetBtn.disabled = true;
        resetBtn.textContent = "Reseteando...";

        // 1. Bajamos CRESET (Inicia el reset de la FPGA)
        log("Iniciando pulso de Reset (Bit 7)...", "system");
        await ftdi.setResetPin(device, false);
        
        // 2. Esperamos 100ms (tiempo de seguridad)
        await new Promise(r => setTimeout(r, 100));
        
        // 3. Subimos CRESET (La FPGA arranca de nuevo)
        await ftdi.setResetPin(device, true);

        statusText.textContent = "✅ FPGA Reiniciada";
        log("Reset completado. Pin CRESET liberado.", "success");

    } catch (err) {
        console.error("Error en reset:", err);
        statusText.textContent = "❌ Fallo al resetear";
        log(`ERROR: ${err.message}`, "error");
    } finally {
        setTimeout(() => {
            resetBtn.disabled = false;
            resetBtn.textContent = "Resetear FPGA";
            statusText.textContent = "Estado: Activo";
        }, 800);
    }
}

//-----------------------------------------------------
//-- MAIN: Punto de entrada
//-----------------------------------------------------

//-- 1. Comprobar si el navegador soporta WEBUSB
//--    Si no es así, se muestra un mensaje y no se hace nada más
if (checkCompatibility()) {

    //-- 2. Configurar el botón de conexión
    connectBtn.addEventListener('click', async () => {
        log("Intentando conectar con Alhambra-II...", "system");
        try {

            //-- Boton PULSADO: Conectar al dispositivo FTDI
            device = await ftdi.connect();

            //-- Inicializar el FTDI
            await ftdi.initialize(device);

            //-- Actualizar la interfaz
            updateUI(true);

        } catch (err) {
            // Capturamos el error y lo mostramos en la UI
            handleConnectionError(err);
        }
    });

    //-- Accion cuando se desconecta el USB
    navigator.usb.addEventListener('disconnect', (event) => {
        if (device && event.device === device) {
            device = null;
            updateUI(false);
            log("Conexión cerrada por el usuario.", "system");
        }
    });
}

// Selector del nuevo botón y contenedor
const toggleLogBtn = document.getElementById('toggle-log');
const consoleWrapper = document.getElementById('console-wrapper');

toggleLogBtn.addEventListener('click', () => {
    const isExpanded = consoleWrapper.classList.toggle('expanded');
    toggleLogBtn.classList.toggle('active');
    
    // Cambiamos el texto según el estado
    toggleLogBtn.querySelector('span').textContent = isExpanded ? 
        "Ocultar Log" : "Ver Log de Sistema";
    
    // Si se expande, hacemos scroll al final automáticamente
    if (isExpanded) {
        const log = document.getElementById('console-log');
        log.scrollTop = log.scrollHeight;
    }
});



