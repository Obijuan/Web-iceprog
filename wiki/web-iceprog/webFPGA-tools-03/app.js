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
const prevBtn = document.getElementById('prev-addr-btn');
const nextBtn = document.getElementById('next-addr-btn');

//-- Otros
const byteDisplay = document.getElementById('byte-value-display');
const hexdumpGrid = document.getElementById('hexdump-grid');
const hexdumpContainer = document.getElementById('hexdump-container');
const eraseBtn = document.getElementById('erase-btn');
const writeTool = document.getElementById('write-tool');
const writeByteBtn = document.getElementById('write-byte-btn');
const byteInput = document.getElementById('byte-input');
const fileInput = document.getElementById('file-input');
const selectFileBtn = document.getElementById('select-file-btn');
const uploadBtn = document.getElementById('upload-btn');
const progressBar = document.getElementById('progress-bar');
const progressContainer = document.getElementById('progress-container');
const fileTool = document.getElementById('file-tool'); 
const quickProgramBtn = document.getElementById('quick-program-btn');
const customFileBtn = document.getElementById('custom-file-btn');
const fileInfoArea = document.getElementById('file-info-area');
const test0Btn = document.getElementById('test0-btn');
const test7Btn = document.getElementById('test7-btn');
const fileStatus = document.getElementById('file-status');

log("Aplicacion iniciada...", "system");

let device = null;


// Asignamos los eventos una sola vez al cargar el script
flashBtn.onclick = handleCheckFlash;
resetBtn.onclick = handleReset;
disconnectBtn.onclick = handleDisconnect;
readByteBtn.onclick = handleRead8;
// Eventos de los botones
prevBtn.onclick = () => stepAddress(-1);
nextBtn.onclick = () => stepAddress(1);
eraseBtn.onclick = handleErase;
writeByteBtn.onclick = handleWriteByte;
let selectedFileBuffer = null;




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
        hexdumpContainer.classList.remove('hidden');
        writeTool.classList.remove('hidden');
        fileTool.classList.remove('hidden');


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

        hexdumpContainer.classList.add('hidden');
        writeTool.classList.add('hidden');
        fileTool.classList.add('hidden');

        // --- RESET DE ESTADOS INTERNOS ---
        // Limpiamos los valores para que no aparezcan datos viejos al reconectar
        document.getElementById('id-chips-container').innerHTML = '';
        document.getElementById('byte-value-display').textContent = '--';
        document.getElementById('hexdump-grid').innerHTML = '';
        
        // Reset del panel de archivos
        document.getElementById('file-name').textContent = 'Ningún archivo seleccionado';
        document.getElementById('upload-btn').classList.add('hidden');
        document.getElementById('progress-bar').style.width = '0%';
        document.getElementById('progress-container').classList.add('hidden');
        
        // Reset de inputs
        document.getElementById('address-input').value = '0';
        document.getElementById('byte-input').value = '0xAA';

        fileInfoArea.classList.add('hidden');
        document.getElementById('file-name').textContent = 'Archivo: ---';
        progressBar.style.width = '0%';

       
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

        // Efecto visual: "limpiamos" el display un instante
        byteDisplay.style.opacity = "0.5";
        byteDisplay.textContent = "..";

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
        byteDisplay.style.opacity = "1";

        // También podemos cambiar ligeramente el brillo al actualizar para dar feedback
        byteDisplay.style.filter = "brightness(1.5)";
        setTimeout(() => byteDisplay.style.filter = "brightness(1)", 1500);

        console.log("TEST!");

        //-- Mostrar el volcado hexadecimal
        await updateHexdump(address);
        
    } catch (err) {
        byteDisplay.textContent = "??";
        log("Error de lectura: " + err.message, "error");
    } finally {
        await ftdi.FPGA_reset_deassert(device);
    }
}


// 1. Escuchar la tecla ENTER en el input
addressInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault(); // Evitar comportamientos extraños del navegador
        handleRead8();
    }
    if (event.key === 'ArrowUp') {
        event.preventDefault();
        stepAddress(1);
    } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        stepAddress(-1);
    }
});


// 2. UX: Seleccionar el texto al hacer foco para facilitar la edición
addressInput.addEventListener('focus', () => {
    addressInput.select();
});

addressInput.addEventListener('input', () => {
    let val = addressInput.value.trim();
    // Regex para validar: o es solo números, o empieza por 0x seguido de hex
    const isValid = /^(0x[0-9a-fA-F]+|[0-9]+)$/.test(val);
    
    if (isValid || val === "") {
        addressInput.style.borderColor = "#10b981"; // Verde normal
        addressInput.style.boxShadow = "none";
    } else {
        addressInput.style.borderColor = "#ef4444"; // Rojo error real
        addressInput.style.boxShadow = "0 0 5px rgba(239, 68, 68, 0.5)";
    }
});

/**
 * Modifica la dirección actual y dispara la lectura
 * @param {number} delta - Cantidad a sumar (1) o restar (-1)
 */
function stepAddress(delta) {
    let rawValue = addressInput.value.trim();
    let isHex = rawValue.toLowerCase().startsWith('0x');
    let currentAddr = isHex ? parseInt(rawValue, 16) : parseInt(rawValue, 10);

    if (isNaN(currentAddr)) currentAddr = 0;

    let newAddr = currentAddr + delta;
    if (newAddr < 0) newAddr = 0; // Evitar direcciones negativas

    // Actualizamos el input manteniendo el formato preferido del usuario
    if (isHex) {
        addressInput.value = '0x' + newAddr.toString(16).toUpperCase();
    } else {
        addressInput.value = newAddr.toString(10);
    }

    // Disparamos la lectura automática
    handleRead8();
}

async function updateHexdump(address) {
    try {
        // Leemos 16 bytes empezando en la dirección actual
        const data = await ftdi.FLASH_read(device, address, 16);
        
        hexdumpGrid.innerHTML = ''; // Limpiar
        hexdumpContainer.classList.remove('hidden');

        data.forEach((byte, index) => {
            const div = document.createElement('div');
            div.className = 'dump-byte' + (index === 0 ? ' active' : '');
            div.textContent = byte.toString(16).toUpperCase().padStart(2, '0');
            hexdumpGrid.appendChild(div);
        });
    } catch (err) {
        console.error("Error en hexdump:", err);
    }
}

async function handleErase() {

    // 1. Obtener la dirección actual del input de lectura
    let rawValue = addressInput.value.trim();
    let address = rawValue.toLowerCase().startsWith('0x') 
        ? parseInt(rawValue, 16) 
        : parseInt(rawValue, 10);

    if (isNaN(address)) {
        log("Error: Dirección no válida para borrar", "error");
        return;
    }

    // 2. Confirmación dinámica
    const hexAddr = "0x" + address.toString(16).toUpperCase().padStart(6, '0');
    if (!confirm(`¿Estás seguro de borrar el bloque de 64KB a partir de ${hexAddr}?`)) return;


    try {
        log(`Iniciando borrado de sector en ${hexAddr}...`, "system");
        eraseBtn.disabled = true;
        eraseBtn.textContent = "Borrando...";

        //-- Poner la FPGA en reset
        await ftdi.FPGA_reset_assert(device);
        await new Promise(r => setTimeout(r, 50));

        //-- Sacar la FLASH del modo sleep
        await ftdi.FLASH_release_power_down(device);

        //-- Medir tiempo de inicio
        const startTime = performance.now();


        // Habilitar escritura en la flash
        await ftdi.FLASH_write_enable(device);


        //-- Borrar bloque de 64KB
        await ftdi.FLASH_block_64kB_erase(device, address);

        //-- Esperar a que la operción se complete
        await ftdi.FLASH_wait(device);

        //-- Calcular la duracion del proceso
        const duration = ((performance.now() - startTime) / 1000).toFixed(2);

        log(`Borrado completado en ${duration}s`, "success");
        
        // Actualizamos la vista para comprobar el borrado
        await handleRead8();

    } catch (err) {
        log("Error al borrar: " + err.message, "error");
    } finally {
        //-- Quitar el Reset de la FPGA (opcional)
        await ftdi.FPGA_reset_deassert(device);

        eraseBtn.disabled = false;
        eraseBtn.textContent = "Borrar Bloque 64KB";
        eraseBtn.style.opacity = "1";
    }
}

// Opcional: Permitir ENTER en el input del byte para grabar
byteInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleWriteByte();
});

async function handleWriteByte() {
    try {
        // 1. Obtener dirección del input de lectura
        let addrRaw = addressInput.value.trim();
        let address = addrRaw.toLowerCase().startsWith('0x') ? parseInt(addrRaw, 16) : parseInt(addrRaw, 10);

        // 2. Obtener valor del nuevo input de byte
        let byteRaw = byteInput.value.trim();
        let value = byteRaw.toLowerCase().startsWith('0x') ? parseInt(byteRaw, 16) : parseInt(byteRaw, 10);

        if (isNaN(address) || isNaN(value) || value < 0 || value > 255) {
            log("Error: Dirección o valor de byte no válido", "error");
            return;
        }

        log(`Grabando 0x${value.toString(16).toUpperCase()} en 0x${address.toString(16).toUpperCase()}...`, "system");
        
        writeByteBtn.disabled = true;
        //-- Poner la FPGA en reset
        await ftdi.FPGA_reset_assert(device);
        await new Promise(r => setTimeout(r, 50));

        //-- Sacar la FLASH del modo sleep
        await ftdi.FLASH_release_power_down(device);

        
        // Operación de hardware
        await ftdi.FLASH_write_enable(device);
        await ftdi.FLASH_prog_page(device, address, [value]);
        
        log("Byte grabado correctamente", "success");

        // 3. Verificación automática (Refresca el display y el hexdump)
        await handleRead8();

    } catch (err) {
        log("Error al grabar: " + err.message, "error");
    } finally {
        //-- Quitar el Reset de la FPGA (opcional)
        await ftdi.FPGA_reset_deassert(device);
        writeByteBtn.disabled = false;
    }
}

// Manejo de selección de archivo
//electFileBtn.onclick = () => fileInput.click();

fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    document.getElementById('file-name').textContent = file.name;
    selectedFileBuffer = await file.arrayBuffer();
    uploadBtn.classList.remove('hidden');
};

async function handleUpload() {
    if (!selectedFileBuffer) return;

    try {
        const data = new Uint8Array(selectedFileBuffer);
        const totalSize = data.length;
        const startAddr = 0x000000; // Por defecto al inicio para la iCE40

        log(`Iniciando programación de ${totalSize} bytes...`, "system");
        
        //uploadBtn.disabled = true;
        progressContainer.classList.remove('hidden');
        
        //-- Poner la FPGA en reset
        await ftdi.FPGA_reset_assert(device);
        await new Promise(r => setTimeout(r, 50));

        //-- Sacar la FLASH del modo sleep
        await ftdi.FLASH_release_power_down(device);

        // 1. EL BORRADO ES CRÍTICO
        // Para simplificar, borramos los sectores necesarios (64KB cada uno)
        const sectorsNeeded = Math.ceil(totalSize / 65536);
        let addr = 0;
        for(let i = 0; i < sectorsNeeded; i++) {
            log(`Borrando sector ${i+1}/${sectorsNeeded}...`, "system");
            await ftdi.FLASH_write_enable(device); 
            await ftdi.FLASH_block_64kB_erase(device, addr);
            await ftdi.FLASH_wait(device);

            //-- Incrementar direccion para apuntar al siguiente bloque
            addr += 0x10000;
        }

        // 2. PROGRAMACIÓN POR PÁGINAS
        const pageSize = 256;
        for (let addr = 0; addr < totalSize; addr += pageSize) {
            const chunk = data.slice(addr, addr + pageSize);
            
            // Reutilizamos la lógica de habilitar escritura y Page Program
            // Pero enviando la ráfaga 'chunk'
            await ftdi.FLASH_write_enable(device); 
            await ftdi.FLASH_prog_page(device, startAddr + addr, chunk);
            await ftdi.FLASH_wait(device);

            // Actualizar progreso
            const percent = Math.round((addr / totalSize) * 100);
            progressBar.style.width = `${percent}%`;
        }

        progressBar.style.width = `100%`;
        log("¡Programación completada con éxito!", "success");
        fileStatus.textContent = `LISTO!`;

    } catch (err) {
        log("Error durante la carga: " + err.message, "error");
    } finally {
        //-- Quitar el Reset de la FPGA (opcional)
        await ftdi.FPGA_reset_deassert(device);
        uploadBtn.disabled = false;
    }
}

//uploadBtn.onclick = handleUpload;

/**
 * Descarga un archivo .bin desde el servidor y lo programa
 * @param {string} url - Ruta al archivo .bin
 */
async function programFromUrl(url) {
    try {
        log(`Descargando bitstream desde ${url}...`, "system");
        
        // 1. Descargar el archivo
        const response = await fetch(url);
        if (!response.ok) throw new Error("No se pudo descargar el archivo del servidor");
        
        // 2. Convertirlo a ArrayBuffer (lo que espera nuestra lógica)
        selectedFileBuffer = await response.arrayBuffer();
        
        // 3. Actualizar la UI para que el usuario vea qué archivo se va a grabar
        document.getElementById('file-name').textContent = url.split('/').pop();
        uploadBtn.classList.remove('hidden');

        // 4. Disparar la programación automáticamente
        log("Archivo listo. Iniciando programación automática...", "system");
        await handleUpload();

    } catch (err) {
        log("Error en carga directa: " + err.message, "error");
    }
}

// Evento para el botón
//quickProgramBtn.onclick = () => {
//    // Aquí pones la ruta a tu archivo .bin alojado en tu servidor
//    programFromUrl('test0.bin');
//};


/**
 * Lógica central que borra y programa el buffer recibido
 */
async function startAutomaticProgramming(buffer, fileName) {
    if (!buffer) return;
    selectedFileBuffer = buffer; // Para compatibilidad con handleUpload
    fileStatus.textContent = `Preparando: ${fileName}...`;
    
    // Llamamos a la función handleUpload que ya definimos (Borra + Programa)
    await handleUpload(); 
}

// --- ACCIÓN 1: ARCHIVO LOCAL ---
customFileBtn.onclick = () => fileInput.click();

fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const buffer = await file.arrayBuffer();
    await startAutomaticProgramming(buffer, file.name);
    fileInput.value = ""; // Reset del input para poder repetir el mismo archivo
};

// --- ACCIÓN 2: TEST 0 ---
test0Btn.onclick = async () => {
    try {
        const response = await fetch('Blinky0.bin');
        if (!response.ok) throw new Error("Blinky0.bin no encontrado");
        const buffer = await response.arrayBuffer();
        await startAutomaticProgramming(buffer, "Blinky0.bin");
    } catch (err) { log(err.message, "error"); }
};

// --- ACCIÓN 3: TEST 7 ---
test7Btn.onclick = async () => {
    try {
        const response = await fetch('Blinky7.bin');
        if (!response.ok) throw new Error("Blinky7.bin no encontrado");
        const buffer = await response.arrayBuffer();
        await startAutomaticProgramming(buffer, "Blinky7.bin");
    } catch (err) { log(err.message, "error"); }
};

