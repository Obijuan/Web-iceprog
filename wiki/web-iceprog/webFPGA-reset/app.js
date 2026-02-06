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

        //-- Insertar el boton de identificación de la flash
        const flashBtnHTML = `<button id="flash-id-btn" class="primary-btn" style="background: #a855f7;">Identificar Flash</button>`;
        actionsArea.insertAdjacentHTML('afterbegin', flashBtnHTML);
        document.getElementById('flash-id-btn').onclick = handleCheckFlash;


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
                <code>sudo modprobe -r ftdi_sio</code>
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
    
    if (!device || !device.opened) {
        log("Error: Dispositivo no inicializado.", "error");
        return;
    }

    try {
        resetBtn.disabled = true;
        resetBtn.textContent = "Verificando...";
        log("--- Iniciando secuencia de Reset ---", "system");

        // 2. Ejecutar Reset (CRESET_B es Bit 7)
        log("Bajando CRESET (Reset activado)...", "system");
        await ftdi.setResetPin(device, false);
        
        // Espera de 100ms para asegurar que la FPGA detecta el flanco
        await new Promise(r => setTimeout(r, 100));
        
        log("Subiendo CRESET (Liberando FPGA)...", "system");
        await ftdi.setResetPin(device, true);

        // 3. Feedback final
        log("Reset completado con éxito.", "success");
        statusText.textContent = "✅ FPGA Reiniciada";

        // Esperamos a que la FPGA cargue desde la Flash
        await new Promise(r => setTimeout(r, 200)); 
        await checkFPGAStatus();

    } catch (err) {
        log(`FALLO: ${err.message}`, "error");
        statusText.textContent = "❌ Error de Hardware";
        
        // Si el fallo es de conexión, limpiamos el estado de la app
        if (err.message.includes("hardware no responde") || err.name === 'NetworkError') {
            performDisconnect();
        }
    } finally {
        // Restauramos el botón tras un segundo
        setTimeout(() => {
            if (device) {
                resetBtn.disabled = false;
                resetBtn.textContent = "Resetear FPGA";
                statusText.textContent = "Estado: Activo";
            }
        }, 800);
    }
}

async function checkFPGAStatus() {
    
    //-- Leer pines
    const pins = await ftdi.readPins(device);
    
    // El bit 6 es CDONE (01000000 en binario = 0x40)
    //-- cuando CDONE es 1, la FPGA ha cargado correctamente el diseño
    const isDone = (pins & 0x40) !== 0;

    if (isDone) {
        log("Estado FPGA: DONE (Diseño cargado con éxito)", "success");
    } else {
        log("Estado FPGA: IDLE (No hay diseño o fallo de carga)", "system");
    }
    return isDone;
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
            log("FTDI inicializado", "success");

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

const clearLogBtn = document.getElementById('clear-log');

clearLogBtn.addEventListener('click', (e) => {
    // Evitamos que el clic se propague al toggle si estuvieran solapados
    e.stopPropagation();
    
    const consoleLog = document.getElementById('console-log');
    consoleLog.innerHTML = ''; 
    
    // Opcional: dejamos un mensaje indicando que se ha limpiado
    log("Consola limpia.", "system");
});

async function handleCheckFlash() {
    try {
        log("Preparando bus SPI (FPGA en Reset)...", "system");
        
        // 1. Mantenemos la FPGA en reset para liberar el bus SPI
        await ftdi.setResetPin(device, false);
        await new Promise(r => setTimeout(r, 50));

        // 2. Leemos el ID
        const id = await ftdi.readFlashID(device);
        
        // 3. Verificamos si es una Micron (0x20)
        if (id.manufacturer === 0x20) {
            log(`Flash detectada: Micron (0x20)`, "success");
            log(`Tipo: 0x${id.memType.toString(16)}, Capacidad: 0x${id.capacity.toString(16)}`, "success");
        } else {
            log(`ID desconocido: 0x${id.manufacturer.toString(16)}`, "error");
        }

    } catch (err) {
        log("Error al identificar Flash: " + err.message, "error");
    } finally {
        // 4. Liberamos la FPGA para que vuelva a su estado normal
        await ftdi.setResetPin(device, true);
    }
}


