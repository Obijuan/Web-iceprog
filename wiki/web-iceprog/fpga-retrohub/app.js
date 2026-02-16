import * as ftdi from './ftdi.js';

console.log("Holiii?");

//------------------------------------------------
//--  Elementos de interfaz del DOM
//------------------------------------------------
//-- Interfaz principal de la app
const mainApp = document.getElementById('main-app');

//-- Panel inicial, con el bototon de conectar
const setupPanel = document.getElementById('setup-panel');
const errorPanel = document.getElementById('no-usb-error');

//-- Boton de conectar la Alhambra
const connectBtn = document.getElementById('connect-btn');

//-- Error en la conexion
const statusCard = document.getElementById('status-card');
const statusText = document.getElementById('status-text');
const statusText2 = document.getElementById('status-text2');


//-- Botones de grabación
const Btn_zx = document.getElementById('btn-zx');
const Btn_amstrad = document.getElementById('btn-amstrad');
const Btn_defender = document.getElementById('btn-defender');
const Btn_invaders = document.getElementById('btn-invaders');
const Btn_test = document.getElementById('btn-test');
const Btn_reset = document.getElementById('id-btn-reset');



//-- Establecer funciones de retrollamada
Btn_zx.onclick = Handle_Btn_zx;
Btn_amstrad.onclick = Handle_Btn_amstrad;
Btn_defender.onclick = Handle_Btn_defender;
Btn_invaders.onclick = Handle_Btn_invaders;
Btn_test.onclick = Handle_Btn_test;
Btn_reset.onclick = Handle_Btn_reset;




const disconnectBtn = document.getElementById('disconnect-btn');
const statusBadge = document.getElementById('status-badge');

//-----------------------
//-- VARIABLES GLOBALES
//-----------------------
//-- Dispositivo USB
let device = null;

// Desconectar
disconnectBtn.addEventListener('click', async () => {
    if (device) {
        await device.close();
        device = null;
    }
    updateUI(false);
});




// -----------------------------------------------------
//-- Comprobar si el navegador soporta WebUSB
//--
//-- DEVUELVE:
//--   true: Soporte OK
//--   false: No hay soporte
//-----------------------------------------------------
function check_webusb_compatibility() {

    if (!navigator.usb) {
        //-- NO hay soporte!
        //-- Ocultar la app principal y mostrar el mensaje
        mainApp.classList.add('hidden');

        //-- Ocultar el panel con boton de conexion
        setupPanel.style.display = 'none';

        //-- Mostrar el panel de error
        errorPanel.style.display = 'block';

        return false;
    }
    console.log("Hay soporte de WEBUSB");
    return true;
}





//-----------------------------------------------------
//-- Actualizar la interfaz de usuario
//--
//-- ENTRADA:
//--   connected: true si el dispositivo está conectado
//-----------------------------------------------------
async function updateUI(connected) {

    if (connected) {

        // Ocultar panel de conexión y mostrar tarjetas
        setupPanel.style.display = 'none';
        mainApp.style.display = 'grid';
        disconnectBtn.style.display = 'block';
        statusBadge.classList.remove('offline');
        statusText.innerText = 'Alhambra-II Conectada';

    } else {

        setupPanel.style.display = 'flex';
        mainApp.style.display = 'none';
        disconnectBtn.style.display = 'none';
        statusBadge.classList.add('offline');
        statusText.innerText = 'Desconectada';

    }
}


async function handleConnectionError(err) 
{
    console.log("ERROR: " + err);

    const isLinux = (navigator.userAgentData?.platform === 'Linux') || 
                    (navigator.platform.indexOf('Linux') !== -1);

    let title = "Error de conexión";
    let message = err.message;
    let solution = "";

    // ESCENARIO A: Permisos de sistema (udev)
    // Suele ocurrir en device.open() y devuelve SecurityError
    if (err.name === 'SecurityError' || 
        err.message.toLowerCase().includes('access denied')) {
        if (isLinux) {
            title = "Faltan permisos (udev)";
            message = "Tu usuario no tiene permiso para escribir " +
                      "en el dispositivo USB.";
            solution = ``;
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
    statusText2.innerHTML = `
        <div class="linux-error">
            <strong>${title}</strong><br>
            <span style="font-size: 0.8rem; opacity: 0.8;">${message}</span>
            ${solution}
        </div>
    `;
}

function showToast(mensaje) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>✔</span> ${mensaje}`;

    container.appendChild(toast);

    // Auto-eliminar después de 4 segundos
    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 4000);
}

// Ejemplo de integración en tu función flash anterior:
// ... cuando progreso == 100 ...
// showToast(`${sistema.toUpperCase()} grabado con éxito.`);

/**
 * Lógica central que borra y programa el buffer recibido
 */
async function start_programming(buffer, sistema) {
    if (!buffer) return;

    const data = new Uint8Array(buffer);
    const totalSize = data.length;
    const startAddr = 0x000000;

    console.log(`Iniciando programación de ${totalSize} bytes...`);

    const btn = document.getElementById(`btn-${sistema}`);
    const cont = document.getElementById(`prog-cont-${sistema}`);
    const bar = document.getElementById(`prog-bar-${sistema}`);

    // 1. Bloquear interfaz
    btn.disabled = true;
    btn.innerText = "Grabando...";
    cont.style.display = "block";

    try {
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
            console.log(`Borrando sector ${i+1}/${sectorsNeeded}...`);
            await ftdi.FLASH_write_enable(device); 
            await ftdi.FLASH_block_64kB_erase(device, addr);
            await ftdi.FLASH_wait(device);

            //-- Incrementar direccion para apuntar al siguiente bloque
            addr += 0x10000;
        }

        // 2. PROGRAMACIÓN
        console.log("Configurando FPGA...");
        const pageSize = 256;
        for (let addr = 0; addr < totalSize; addr += pageSize) {
            const chunk = data.slice(addr, addr + pageSize);

            // Reutilizamos la lógica de habilitar escritura y Page Program
            // Pero enviando la ráfaga 'chunk'
            await ftdi.FLASH_write_enable(device); 
            await ftdi.FLASH_prog_page(device, startAddr + addr, chunk);
            await ftdi.FLASH_wait(device);

            // Actualizar progreso
            const progreso = Math.round((addr / totalSize) * 100);
            bar.style.width = progreso + "%";
        }

        // 3. Finalización
        bar.style.width = "100%";
        btn.innerText = "¡Completado!";
        btn.style.borderColor = "#44ff44";
        btn.style.color = "#44ff44";

        setTimeout(() => {
            // Resetear tras 3 segundos
            cont.style.display = "none";
            bar.style.width = "0%";
            btn.disabled = false;
            btn.innerText = "Grabar Bitstream";
            btn.style.borderColor = ""; 
            btn.style.color = "";
        }, 3000); 

        console.log("LISTO!")
        showToast("FPGA configurada con éxito!");

    }  catch (err) {
        log("Error durante la carga: " + err.message, "error");
    } finally {
        //-- Quitar el Reset de la FPGA (opcional)
        await ftdi.FPGA_reset_deassert(device);
    }   
}

async function Handle_Btn_zx()
{
    console.log("Grabacion del ZX!");
    let filename = 'image-zx.bin';
    try {
        const response = await fetch(filename);
        if (!response.ok) throw new Error(filename + " no encontrado");
        const buffer = await response.arrayBuffer();
        await start_programming(buffer, "zx");
    } catch(err) {
        console.error("Error: " + err.message);
    }
}

async function Handle_Btn_amstrad()
{
    console.log("Grabacion del amstrad!");
    let filename = 'image-amstrad.bin';
    try {
        const response = await fetch(filename);
        if (!response.ok) throw new Error(filename + " no encontrado");
        const buffer = await response.arrayBuffer();
        await start_programming(buffer, "amstrad");
    } catch(err) {
        console.error("Error: " + err.message);
    }
}

async function Handle_Btn_defender()
{
    console.log("Grabacion del defender!");
    let filename = 'image-defender.bin';
    try {
        const response = await fetch(filename);
        if (!response.ok) throw new Error(filename + " no encontrado");
        const buffer = await response.arrayBuffer();
        await start_programming(buffer, "defender");
    } catch(err) {
        console.error("Error: " + err.message);
    }
}

async function Handle_Btn_invaders()
{
    console.log("Grabacion del invaders!");
    let filename = 'image-invaders.bin';
    try {
        const response = await fetch(filename);
        if (!response.ok) throw new Error(filename + " no encontrado");
        const buffer = await response.arrayBuffer();
        await start_programming(buffer, "invaders");
    } catch(err) {
        console.error("Error: " + err.message);
    }
}

async function Handle_Btn_test()
{
    console.log("Grabacion del Blinky0");
    let filename = 'image-blinky0.bin';
    try {
        const response = await fetch(filename);
        if (!response.ok) throw new Error(filename + " no encontrado");
        const buffer = await response.arrayBuffer();
        await start_programming(buffer, "test");
    } catch(err) {
        console.error("Error: " + err.message);
    }
}

async function Handle_Btn_reset()
{
    console.log("Reset de la FPGA!");
    
    if (!device || !device.opened) {
        log("Error: Dispositivo no inicializado.", "error");
        return;
    }

    try {
        Btn_reset.disabled = true;
        Btn_reset.textContent = "Verificando...";
        console.log("--- Iniciando secuencia de Reset ---");

        console.log("Bajando CRESET (Reset activado)...", "system");
        await ftdi.FPGA_reset_assert(device);
        
        // Espera de 100ms para asegurar que la FPGA detecta el flanco
        await new Promise(r => setTimeout(r, 100));
        
        console.log("Subiendo CRESET (Liberando FPGA)...");
        await ftdi.FPGA_reset_deassert(device)

        // 3. Feedback final
        console.log("Reset completado con éxito.");
        statusText.textContent = "✅ FPGA Reiniciada";

        // Esperamos a que la FPGA cargue desde la Flash
        await new Promise(r => setTimeout(r, 200)); 
        await checkFPGAStatus();
        

    } catch (err) {
        log(`FALLO: ${err.message}`, "error");
    } finally {
        // Restauramos el botón tras un segundo
        setTimeout(() => {
            if (device) {
                Btn_reset.disabled = false;
                Btn_reset.textContent = "Resetear FPGA";
            }
        }, 800);
    }
}


async function checkFPGAStatus() {
    
    //-- Leer señal CDONE
    const isDone = await ftdi.FPGA_get_cdone(device);

    if (isDone) {
        console.log("Estado FPGA: DONE (Diseño cargado con éxito)");
    } else {
        console.log("Estado FPGA: IDLE (No hay diseño o fallo de carga)");
    }
    return isDone;
}



//-----------------------------------------------------
//-- MAIN: Punto de entrada
//-----------------------------------------------------

//-- 1. Comprobar si el navegador soporta WEBUSB
//--    Si no es así, se muestra un mensaje y no se hace nada más
if (check_webusb_compatibility()) {

    //-- 2. Configurar el botón de conexión
    connectBtn.addEventListener('click', async () => {
        try {

            console.log("Botón de CONEXION!");

            //-- Boton PULSADO: Conectar al dispositivo FTDI
            device = await ftdi.connect();

            //-- Inicializar el FTDI
            await ftdi.initialize(device);

            //-- Configurar para trabajar con el SPI
            await ftdi.spi_init(device);

            console.log("FTDI inicializado");

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
            console.log("Conexión cerrada por el usuario.");
        }
    });
    
}

