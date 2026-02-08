import * as ftdi from './ftdi.js';

//-- Elementos de Interfaz
const mainApp = document.getElementById('main-app');
const noSupport = document.getElementById('no-support');
const statusCard = document.getElementById('status-card');
const statusText = document.getElementById('status-text');
const deviceName = document.getElementById('device-name');
const actionsArea = document.getElementById('actions-area');
const infoArea = document.getElementById('flash-info'); 
const readTool = document.getElementById('read-tool');
const addressInput = document.getElementById('address-input');

// Referencias a los botones
const connectBtn = document.getElementById('connect-btn');
const resetBtn = document.getElementById('reset-btn');
const flashBtn = document.getElementById('flash-id-btn');
const disconnectBtn = document.getElementById('disconnect-btn');
const readByteBtn = document.getElementById('read-byte-btn');

//-- Otros
const byteDisplay = document.getElementById('byte-value-display');


log("Aplicacion iniciada...", "system");

let device = null;


// Asignamos los eventos una sola vez al cargar el script
flashBtn.onclick = handleCheckFlash;
resetBtn.onclick = handleReset;
disconnectBtn.onclick = handleDisconnect;
readByteBtn.onclick = handleRead8;


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


async function handleDisconnect() {
    try {
        if (device && device.opened) {
            await device.close();
        }
    } catch (err) {
        console.error("Error al cerrar:", err);
    } finally {
        device = null;
        updateUI(false); // Esto disparará la ocultación del ID
        log("Dispositivo desconectado.", "system");
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
        statusText.textContent = "Estado: Conectad";
        deviceName.textContent = device.productName || "Alhambra-II";

        //-- Ocultar el botón de conexión
        connectBtn.classList.add('hidden');

        //-- Mostrar el resto de botones de interfaz
        resetBtn.classList.remove('hidden');
        flashBtn.classList.remove('hidden');
        disconnectBtn.classList.remove('hidden');
        readByteBtn.classList.remove('hidden');

        //-- Otros.. (por documentar)
        readTool.classList.remove('hidden');

        //-- TEST
        let value = await ftdi.FPGA_get_cdone(device)
        console.log("CDONE: " + value)

    } else {
        //-- Tarjeta de estado: Ya no pertenece a la clase connected
        statusCard.classList.remove('connected');

        //-- Actualizar textos
        statusText.textContent = "Estado: Desconectado";
        deviceName.textContent = "Placa no conectada";

        //-- Mostrar el botón de conexión 
        connectBtn.classList.remove('hidden');

        //-- Ocultar los otros botones
        resetBtn.classList.add('hidden');
        flashBtn.classList.add('hidden');
        disconnectBtn.classList.add('hidden');
        readByteBtn.classList.add('hidden');

        // --- Ocultar el identificador de la flash
        infoArea.classList.add('hidden'); // La transición ocurrirá sola

        //-- Otros
        readTool.classList.add('hidden');

        // Dentro de updateUI(false)
        byteDisplay.textContent = "--";
        addressInput.value = "0";

       
        //-- Vaciar los chips
        //document.getElementById('id-chips-container').innerHTML = ''; 
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

        log("Bajando CRESET (Reset activado)...", "system");
        await ftdi.FPGA_reset_assert(device);
        
        // Espera de 100ms para asegurar que la FPGA detecta el flanco
        await new Promise(r => setTimeout(r, 100));
        
        log("Subiendo CRESET (Liberando FPGA)...", "system");
        //await ftdi.setResetPin(device, true);
        await ftdi.FPGA_reset_deassert(device)

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
    
    //-- Leer señal CDONE
    const isDone = await ftdi.FPGA_get_cdone(device);

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

            //-- Configurar para trabajar con el SPI
            await ftdi.spi_init(device);

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

//-------------------------------------------------------------
//-- Convertir un array con los bytes de identificacion de
//-- la flash en una cadena
//-------------------------------------------------------------
function id_to_string(id)
{
  let cad = ""

  for (const byte of id)
    cad += " 0x" + byte.toString(16);

  return cad
}


function displayFlashID(idObject) {
    const container = document.getElementById('id-chips-container');
    const infoArea = document.getElementById('flash-info');
    
    // Convertimos el objeto en un array de bytes para iterar
    //const bytes = [idObject.manufacturer, idObject.memType, idObject.capacity];
    
    container.innerHTML = ''; // Limpiar anterior
    
    idObject.forEach(byte => {
        const chip = document.createElement('div');
        chip.className = 'hex-chip';
        chip.textContent = byte.toString(16).toUpperCase().padStart(2, '0');
        container.appendChild(chip);
    });

    infoArea.classList.remove('hidden');
}

async function handleCheckFlash() {
    try {
        log("Preparando bus SPI (FPGA en Reset)...", "system");
        
        //-- Para enviar cualquier comando a la flash
        //-- la FPGA debe estar en estado de reset
        await ftdi.FPGA_reset_assert(device);
        await new Promise(r => setTimeout(r, 50));

        //-- Sacar la flash del modo sleep (de bajo consumo
        //-- Es obligatorio hacerlo, o de lo contrario NO
        //-- se podra leer nada de ella
        await ftdi.FLASH_release_power_down(device);
    
        console.log("TEST!");
        const buffer_id = await ftdi.FLASH_read_id(device)
        displayFlashID(buffer_id);
    
        //-- Obtener una cadena con el identificador
        let flash_id_str = id_to_string(buffer_id);
    
        console.log("✅FLASH-ID: " + flash_id_str);
        log("✅FLASH-ID: " + flash_id_str, "success");

        
        

    } catch (err) {
        log("Error al identificar Flash: " + err.message, "error");
    } finally {
        //-- Quitar el Reset de la FPGA (opcional)
        await ftdi.FPGA_reset_deassert(device)
    }
}


async function handleRead8() {

    try {

        // 1. Obtener y parsear la dirección
        let rawValue = addressInput.value.trim();
        let address;

        if (rawValue.toLowerCase().startsWith('0x')) {
            address = parseInt(rawValue, 16);
        } else {
            address = parseInt(rawValue, 10);
        }

        if (isNaN(address)) {
            log("Error: Dirección no válida", "error");
            return;
        }

        const address_str = "0x" + address.toString(16).toUpperCase().padStart(6, '0');

        log("Leyendo dirección " + address_str, "system");

        //-- Para enviar cualquier comando a la flash
        //-- la FPGA debe estar en estado de reset
        await ftdi.FPGA_reset_assert(device);
        await new Promise(r => setTimeout(r, 50));

        //-- Sacar la flash del modo sleep (de bajo consumo
        //-- Es obligatorio hacerlo, o de lo contrario NO
        //-- se podra leer nada de ella
        await ftdi.FLASH_release_power_down(device);

        //-- Lectura del byte
        const value = await ftdi.FLASH_read8(device, address);
        const value_str = value.toString(16).toUpperCase().padStart(2, '0');
        log("Dato en " + address_str + ": " + value_str, "success");

        // --- ACTUALIZACIÓN GRÁFICA ---
        const hexString = value.toString(16).toUpperCase().padStart(2, '0');
        byteDisplay.textContent = hexString;
        
        // También podemos cambiar ligeramente el brillo al actualizar para dar feedback
        byteDisplay.style.filter = "brightness(1.5)";
        setTimeout(() => byteDisplay.style.filter = "brightness(1)", 1500);
        
    } catch (err) {
        byteDisplay.textContent = "??";
        log("Error de lectura: " + err.message, "error");
    } finally {
        await ftdi.FPGA_reset_deassert(device);
    }
}
