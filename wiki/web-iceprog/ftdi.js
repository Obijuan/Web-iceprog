//------------------------------------------
// Comunicación a bajo nivel con el FTDI
//------------------------------------------

//-------------------------- Constantes
const FTDI_VID = 0x0403;  //-- Vendor ID de FTDI
const INTERFACE_A   = 1;  //-- Interfaz A (SPI)
const SIO_RESET_SIO = 0;
const BITMODE_MPSSE = 0x02;

//-- END_POINTS
const OUT_EP = 0x02; //-- Transfering data from host to device (writing)
const IN_EP = 0x01; //-- Transfering data from device to host (reading)


//--- COMANDOS del FTDI
const SIO_RESET_REQUEST  = 0;  //-- RESET
const SIO_RESET_PURGE_RX = 1;  //-- Limpiar buffer RX
const SIO_RESET_PURGE_TX = 2;  //-- Limpiar buffer TX
const SIO_GET_LATENCY_TIMER_REQUEST = 0x0A;
const SIO_SET_LATENCY_TIMER_REQUEST = 0x09;
const SIO_SET_BITMODE_REQUEST = 0x0B;
const SIO_READ_EEPROM_REQUEST = 0x90;


//-- Comandos FTDI del modo MPSSE
const MC_SETB_LOW    = 0x80;   // Set Data bits LowByte
const MC_READB_LOW   = 0x81;   // Read Data bits LowByte
const MC_SET_CLK_DIV = 0x86;   // Set clock divisor
const MC_TCK_D5      = 0x8B;   // Enable /5 div, backward compat to FT2232D
const FTDI_SPI_WRITE = 0x31;


//--------------- Comandos de la flash (enviados por el SPI del FTDI)
//-- Leer el ID de la flash (3 bytes: fabricante, tipo, capacidad)
const FLASH_RPD     = 0xAB;  // Release Power-Down
const FLASH_PD      = 0xB9;  // Power-down
const FLASH_READ_ID = 0x9F;  // Leer el identificador de la flash
const FLASH_READ    = 0x03;  // Leer bytes de la flash
const FLASH_WE      = 0x06;  // Habilitar la escritura de la flash
const FLASH_READ_STATUS = 0x05; //-- Leer el estado de la eeprom (busy?)
const FLASH_BLOCK_ERASE = 0xD8; // Borrar un bloque de 64KB



//-- Máscaras de acceso a los pines de los gpios del FTDI
const FPGA_RESET_PIN  = 0x80  //-- ADBUS7: Salida: Señal de reset de la FPGA
const FPGA_CDONE_PINS = 0x40  //-- ADBUS6: Entrada: Señal cdone de la FPGA
const FLASH_CS_PIN    = 0x10  //-- ADBUS4: Salida: Señal cs de la FLASH

//--------------------------------------------------
//-- Conectar al dispositivo FTDI via WEBUSB
//--------------------------------------------------
export async function connect() {
    const device = await navigator.usb.requestDevice({
        filters: [{ vendorId: FTDI_VID }]
    });
    return device;
}

export async function disconnect(device) {
    if (device && device.opened) {
        try {
            // Liberamos la interfaz antes de cerrar
            await device.releaseInterface(0);
            await device.close();
            console.log("FTDI: Conexión cerrada limpiamente.");
        } catch (err) {
            console.error("FTDI: Error al cerrar:", err);
        }
    }
}

//--------------------------------------------------
//-- Inicializar el dispositivo FTDI
//--------------------------------------------------    
export async function initialize(device) {

    //-- Abrir dispositivo
    await device.open();

    //-- El FTDI sólo tiene una configuración (la 1)
    await device.selectConfiguration(1);

    //-- Reclamar la interfaz 0 (que es la interfaz A)
    //-- Es la que se usa para el spi
    await device.claimInterface(0);
}

//----------------------------------------------------
//-- Configurar el FTDI para trabajar con el SPI
//----------------------------------------------------
export async function spi_init(device) 
{

    //-------- Inicializacion y configuracion del FTDI (MPSEE_INIT)
    await sio_reset(device);
    await purge_buffers(device);

    //-- Set latency to 1 (fastest)
    //-- 1 is the fastest polling, it means 1 kHz polling
    await set_latency_timer(device, 1);

    //-- DEBUG! Comprobar que la latencia es efectivameente 1
    let latency = await get_latency_timer(device);
    console.assert(latency === 1, "Error al establecer latencia");

    //-- Configurar el modo Bit-Bang del FTDI (para controlar pines individuales)
    await set_bitmode(device, 0xFF, BITMODE_MPSSE);

    //------ Enviar comandos al FTDI, por el canal de datos
    // enable clock divide by 5
    let data = new Uint8Array([MC_TCK_D5]);
    await device.transferOut(OUT_EP, data);

    // set 6 MHz clock
    data = new Uint8Array([MC_SET_CLK_DIV, 0x00, 0x00]);
    await device.transferOut(OUT_EP, data);
}

//-------------------------------------------------------
// Comando para habilitar la división del reloj entre 5
//-------------------------------------------------------
export async function tck_d5(device)
{
    const data = new Uint8Array([MC_TCK_D5]);
    await device.transferOut(OUT_EP, data);
}
  
//------------------------------------------------------
// Establecer un reloj de 6 MHZ
//------------------------------------------------------
export async function set_clk_div(device)
{
    const data = new Uint8Array([MC_SET_CLK_DIV, 0x00, 0x00]);
    await device.transferOut(OUT_EP, data);
}


//---------------------------------------------------
//-- Comando de reset del chip FTDI
//---------------------------------------------------
export async function sio_reset(device) {
    await device.controlTransferOut({
        requestType: 'vendor',
        recipient: 'device',
        request: SIO_RESET_REQUEST, 
        value: SIO_RESET_SIO,
        index: INTERFACE_A
    });
}

//--------------------------------------------------------
//-- Comando para limpiar el buffer de recepcion del FTDI
//--------------------------------------------------------
export async function purge_rx_buffer(device) {

  await device.controlTransferOut({
    requestType: 'vendor',
    recipient: 'device',
    request: SIO_RESET_REQUEST,
    value: SIO_RESET_PURGE_RX,
    index: INTERFACE_A
  });
}

//--------------------------------------------------------
//-- Comando para limpiar el buffer de transmision del FTDI
//--------------------------------------------------------  
export async function purge_tx_buffer(device) {

  let result = await device.controlTransferOut({
    requestType: 'vendor',
    recipient: 'device',
    request: SIO_RESET_REQUEST,
    value: SIO_RESET_PURGE_TX,
    index: INTERFACE_A
  });
}

//-- FTDI: Purge Buffers
export async function purge_buffers(device) {
  await purge_rx_buffer(device);
  await purge_tx_buffer(device);
}

//----------------------------------------------------------
//-- FTDI: Get latency timer
//----------------------------------------------------------
export async function get_latency_timer(device) {

  //-- Read 1 byte from the FTDI
  let result = await device.controlTransferIn({
    requestType: 'vendor',
    recipient: 'device',
    request: SIO_GET_LATENCY_TIMER_REQUEST,
    value: 0,
    index: INTERFACE_A
  }, 1);

  //-- Devolver la latencia actual (1 byte)
  return result.data.getUint8(0);
}

//--------------------------------------------------------
//-- Establecer la latencia del FTDI
//--------------------------------------------------------
export async function set_latency_timer(device, latency) {

  let result = await device.controlTransferOut({
    requestType: 'vendor',
    recipient: 'device',
    request: SIO_SET_LATENCY_TIMER_REQUEST,
    value: latency,
    index: INTERFACE_A
  });
}

//---------------------------------------------------------------------------
//-- Establecer el modo bitmode del FTDI (para controlar pines individuales)
//---------------------------------------------------------------------------
export async function set_bitmode(device, bitmask, mode) {

  //-- Calculate the value to sent to the FTDI
  let usb_val = (mode << 8) | bitmask;  //-- Low byte: bitmask

  let result = await device.controlTransferOut({
    requestType: 'vendor',
    recipient: 'device',
    request: SIO_SET_BITMODE_REQUEST,
    value: usb_val,
    index: INTERFACE_A
  });
}

//--------------------------------------------------------
//-- Establecer el valor de los pines gpio del FTDI
//--
//-- ENTRADAS:
//--   - gpio: Valor a sacar por los pines
//--   - direction: Mascara para indicar los pines de salida
//--     - Bits 1: Salidas
//--     - Bits 0: entradas
//--------------------------------------------------------
export async function set_gpio(device, gpio, direction) 
{
  //-- Los pines se asignan con el comando SET_BITS_LOW
  //-- Formato: [Comando, Valor, Direccion]
 
   const data = new Uint8Array([MC_SETB_LOW, gpio, direction]);
   await device.transferOut(OUT_EP, data);
}

//-----------------------------------------------------------
//-- Poner a la FPGA en modo reset
//--
//-- El reset se mantiene hasta que se quita llamando 
//--  a FPGA_reset_deassert()
//------------------------------------------------------------
export async function FPGA_reset_assert(device)
{
    //-- Logica negativa: El reset se activa poniendo a 0 el pin
    await set_gpio(device, 0, FPGA_RESET_PIN);

}

//-----------------------------------------------------------
//-- Sacar la FPGA del modo reset
//--
//-- La FPGA se empezará a configurar (cargando el bitstream
//--   desde la flash)
//------------------------------------------------------------
export async function FPGA_reset_deassert(device)
{
    //-- Logica negativa: El reset se desactiva poniendo a 1 el pin
    await set_gpio(device, FPGA_RESET_PIN, FPGA_RESET_PIN);

}

//-----------------------------------------------------------
//-- Leer el bit CDONE de la fpga
//--
//-- SALIDAS:
//--   - CDONE:
//--       1 : FPGA configurada
//--       0 : FPGA en reset o configurándose
//-----------------------------------------------------------
export async function FPGA_get_cdone(device)
{
    //-- Enviar comando para leer pines
    let data = new Uint8Array([MC_READB_LOW]);
    await device.transferOut(OUT_EP, data);

    //-- Leer datos del USB. Con este comando se reciben 3 bytes
    //-- El tercero es el que contiene el estado de los pines
    let result = await device.transferIn(IN_EP, 3);

    if (result.status === 'ok') {

        //-- Leer los pines
        let pines = result.data.getUint8(2)

        //-- Aplicar mascara para quedarse con CDONE
        pines = pines & FPGA_CDONE_PINS

        //-- Valor a devolver
        const value = pines == 0 ? 0 : 1;
        return value

    } else {
        throw new Error("Fallo al leer pines del FTDI");
    }
}

//----------------------------------------------------------
//-- Activar la memoria FLASH
//-- Ahora ya podemos leer de ella, o escribir valores
//----------------------------------------------------------
export async function FLASH_cs_assert(device)
{
   //-- El chip select de la flash está en el ADBUS 4 del FTDI (bit 4)
   //-- Logica negativa: El cs se activa poniendo a 0 el pin
    await set_gpio(device, 0, FPGA_RESET_PIN | FLASH_CS_PIN | 3);
}

//----------------------------------------------------------
//-- Desactivar la memoria FLASH
//----------------------------------------------------------
export async function FLASH_cs_deassert(device)
{
    await set_gpio(device, FLASH_CS_PIN, FPGA_RESET_PIN | FLASH_CS_PIN | 3);
}

//-------------------------------------------------------------
//-- Sacar la flash del modo sleep (power_down)
//-- Es necesario enviar este comando a la flash antes de hacer
//-- cualquier otra cosa
//--------------------------------------------------------------
export async function FLASH_release_power_down(device)
{
    
    //-- Activar el chip select de la flash
    await FLASH_cs_assert(device)

    //-- Enviar comando release-power-down a la flash
    //-- Los 3 primeros bytes son para que el FTDI mande por el SPI
    //-- un único byte
    //-- [cmd ftdi, byte bajo (tamaño-1), byte alto (tamaño-1)]
    const data = new Uint8Array([FTDI_SPI_WRITE, 0x00, 0x00, FLASH_RPD]);
    await device.transferOut(OUT_EP, data);

    //-- Leer respuesta al comando
    //-- Deben ser 3 bytes. Los 2 primeros son el estado del model. 
    //-- El tercero es 0xFF, que es lo que devuelve la flash con esta operacion
    let result = await device.transferIn(IN_EP, 3);

    //-- Debug: Obtener la cadena con los 3 bytes en hexadecimal e imprimirla!
    // const cad = Array.from(new Uint8Array(result.data.buffer, result.data.byteOffset, result.data.byteLength))
    //                  .map(byte => byte.toString(16).toUpperCase().padStart(2, '0'))
    //                  .join(' ');
    // console.log("POWER-DOWN2: " + cad)

    //-- Desactivar el chip select de la flash
    await FLASH_cs_deassert(device)
}

//-------------------------------------------------------------
//-- Poner la flash otra vez en modo sleep
//--------------------------------------------------------------
export async function FLASH_power_down(device)
{
    
    //-- Activar el chip select de la flash
    await FLASH_cs_assert(device)

    //-- Enviar comando 
    const data = new Uint8Array([FTDI_SPI_WRITE, 0x00, 0x00, FLASH_PD]);
    await device.transferOut(OUT_EP, data);

    //-- Leer respuesta al comando
    let result = await device.transferIn(IN_EP, 3);

    //-- Desactivar el chip select de la flash
    await FLASH_cs_deassert(device)
}

//--------------------------------------------------------
//-- Leer el identificador de la flash 
//--------------------------------------------------------
export async function FLASH_read_id(device)
{

    //-- Activar el chip select de la flash
    await FLASH_cs_assert(device)
    
    //-- Enviar a la flash el comando para leer su ID
    let data = new Uint8Array([FTDI_SPI_WRITE, 4, 0, FLASH_READ_ID]);

    //-- Se espera recibir 4 bytes. Se envian por tanto 4 bytes dummy
    data = new Uint8Array([...data, 0, 0, 0, 0]);
    await device.transferOut(OUT_EP, data);

    //-- La respuesta contiene 7 bytes: 2 bytes del modem, 
    //-- 1 del comando y 4 de las respuestas
    let result = await device.transferIn(IN_EP, 7);

    //-- Desactivar el chip select de la flash
    await FLASH_cs_deassert(device)

    //-- Crear un buffer con la respuesta
    let bufferId = new Uint8Array(result.data.buffer.slice(3));

    //-- Devolver el buffer
    return bufferId;

    //-- En la ALHAMBRA-II: Se deberia leer: 0xEF 0x40 0x16 0x00
}




//----------------------------------------------------------
//-- Enviar un byte al FTDI (usado para comandos MPSSE)
//----------------------------------------------------------
async function ftdi_send_byte(b) {

  let data = new Uint8Array([b]);
  await device.transferOut(OUT_EP, data); 
}


export async function setResetPin(device, level) {

    const value = level ? 0x80 : 0x00; // Nivel alto (0x80) o bajo (0x00)
    await set_gpio(device, value, 0x80);
}

export async function readPins(device) {
    //-- Enviar comando
    let data = new Uint8Array([MC_READB_LOW]);
    await device.transferOut(OUT_EP, data);

    //-- Leer datos del USB. Con este comando se reciben 3 bytes
    //-- El tercero es el que contiene el estado de los pines
    let result = await device.transferIn(IN_EP, 3);
    //console.log("pins: ", result.data.getUint8(2).toString(16));
    
    if (result.status === 'ok') {
        return result.data.getUint8(2);
    } else {
        throw new Error("Fallo al leer pines del FTDI");
    }
}

/* 🚧 FUNCION OBSOLETA */
export async function readFlashID(device) {
    // Para leer el ID, enviamos el comando 0x9E y esperamos 3 bytes de respuesta:
    // 1. Manufacturer ID (Micron = 0x20)
    // 2. Memory Type
    // 3. Memory Capacity
    
    // Comando MPSSE: 0x31 (Escribir y leer bytes simultáneamente en flanco negativo/positivo)
    // Formato: [0x31, LongitudL, LongitudH, Datos...]
    // Queremos enviar 1 byte (0x9E) y recibir 3. 
    // En MPSSE, para recibir datos después de enviar, a veces usamos secuencias separadas.
    
    // 1. Enviamos comando de escritura (0x11) para el código 0x9E
    const writeCmd = new Uint8Array([FTDI_SPI_WRITE, 0x00, 0x00, CMD_READ_ID]);
    await device.transferOut(2, writeCmd);

    // 2. Enviamos comando de lectura (0x20) para 3 bytes
    const readCmd = new Uint8Array([0x20, 0x02, 0x00]); // 0x0200 = 3 bytes (n-1)
    await device.transferOut(2, readCmd);

    // 3. Recogemos los 3 bytes + 2 de estado del modem = 5 bytes
    const result = await device.transferIn(1, 5);
    
    if (result.status === 'ok' && result.data.byteLength === 5) {
        return {
            manufacturer: result.data.getUint8(2),
            memType: result.data.getUint8(3),
            capacity: result.data.getUint8(4)
        };
    }
    throw new Error("No se pudo leer el ID de la Flash");
}


/**
 * Lee un solo byte de una dirección específica de la Flash
 * @param {Object} device - El dispositivo USB
 * @param {number} address - Dirección de 24 bits (ej: 0x000000)
 */
export async function FLASH_read8(device, address) {

    // 1. Bajar CS para iniciar la transacción
    await FLASH_cs_assert(device);

    // 2. Preparar trama: Comando (0x03) + Dirección (3 bytes)
    // Para la dirección 0x000000 -> [0x03, 0x00, 0x00, 0x00]
    const addrH = (address >> 16) & 0xFF;
    const addrM = (address >> 8) & 0xFF;
    const addrL = address & 0xFF;
    
    //-- Enviar a la flash el comando para leer 
    let cmdframe = new Uint8Array([FTDI_SPI_WRITE, 4, 0, FLASH_READ]);

    //-- Parametros de READ: 3 bytes de la dirección + 1 dumy byte
    cmdframe = new Uint8Array([...cmdframe, addrH, addrM, addrL, 0])
    //cmdframe = new Uint8Array([...cmdframe, 0x00, 0x00, 0x04, 0])
    await device.transferOut(OUT_EP, cmdframe);

    //-- La respuesta contiene 7 bytes: 2 bytes del modem, 
    //-- 1 del comando y 3 de la direccion y 1 byte de la respuesta
    let result = await device.transferIn(IN_EP, 10);

    //-- Desactivar el chip select de la flash
    await FLASH_cs_deassert(device)

    if (result.status === 'ok' && result.data.byteLength === 7) {
        return result.data.getUint8(6); // El byte de la flash
    }
    throw new Error("Error leyendo byte de la Flash");
}


/**
 * Lee una ráfaga de bytes de la Flash
 * @param {Object} device 
 * @param {number} startAddress 
 * @param {number} count - Cuántos bytes leer
 */
export async function FLASH_read(device, address, count) {

    // 1. Bajar CS para iniciar la transacción
    await FLASH_cs_assert(device);

    // 2. Preparar trama: Comando (0x03) + Dirección (3 bytes)
    // Para la dirección 0x040000 -> [0x03, 0x04, 0x00, 0x00]
    const addrH = (address >> 16) & 0xFF;
    const addrM = (address >> 8) & 0xFF;
    const addrL = address & 0xFF;

    //-- Trama a enviar al FTDI: Cabecera:
    //-- | cmd | len0 | len1 | cmd_flash |
    //-- | addr2 | addr1 | addr 0 | d0 | d1 | ... | count - 1 |
    //-- Len = count + 3
    
    //-- Calcular la longitud a poner en la cabecera
    const len = count + 3;
    const lenL = len & 0xFF;
    const lenH = (len >> 8) & 0xFF;

    //-- Crear Trama inicial (cabecera)
    let cmdframe = new Uint8Array([FTDI_SPI_WRITE, lenL, lenH, FLASH_READ]);

    //-- Añadir a la trama la direccion
    cmdframe = new Uint8Array([...cmdframe, addrH, addrM, addrL]);

    //-- Dummy bytes con los datos
    let dummy = new Uint8Array(count);

    //-- Trama final
    cmdframe = new Uint8Array([...cmdframe, ...dummy]);

    //-- Enviar el paquete!
    await device.transferOut(OUT_EP, cmdframe);


    //-- La respuesta contiene 6+count bytes:
    //--   2 bytes del modem + 1 del comando
    //--   3 bytes de la direccion
    //--   n bytes de los datos recibidos
    let result = await device.transferIn(IN_EP, count+6);

    //-- Desactivar el chip select de la flash
    await FLASH_cs_deassert(device)

    if (result.status === 'ok') {
        // Devolvemos solo los datos de la flash
        return new Uint8Array(result.data.buffer, 6);
    }
    throw new Error("Error en lectura burst");
}

/**
 * Borra un sector de 64KB (Comando 0xD8)
 */
export async function FLASH_erase64KB(device, address) {
    
    //-- Obtener los bytes de la direccion
    const addrH = (address >> 16) & 0xFF;
    const addrM = (address >> 8) & 0xFF;
    const addrL = address & 0xFF;

    //-- Activar chip de la flash
    await FLASH_cs_assert(device);

    console.log("TEST-2!");

    //-- Enviar comando de borrado
    let cmdframe = new Uint8Array([FTDI_SPI_WRITE, 0, 0, FLASH_BLOCK_ERASE]);
    await device.transferOut(OUT_EP, cmdframe);

    //-- Leer la respuesta (3 bytes)
    let result = await device.transferIn(IN_EP, 10);

    //-- Desactivar el chip select de la flash
    await FLASH_cs_deassert(device)

    //-- DEGUG
    let status = await FLASH_read_status(device);
    console.log("Status: " + status);

    // 3. Esperar a que termine (Polling)
    let busy = true;
    while (busy) {
        const status = await FLASH_read_status(device);
        busy = (status & 0x01) !== 0; // Bit 0 es WIP
        if (busy) await new Promise(r => setTimeout(r, 100)); // Esperar 100ms
    }
}


/**
 * Envía el comando Write Enable (0x06)
 */
export async function FLASH_write_enable(device) {

    //-- Activar el chip select de la flash
    await FLASH_cs_assert(device)

    //-- Enviar a la flash el comando
    let data = new Uint8Array([FTDI_SPI_WRITE, 0, 0, FLASH_WE]);
    await device.transferOut(OUT_EP, data);

    //-- Leer la respuest: 2 bytes del model + 1 del comando
    //-- (se lee para vaciar el buffer)
    let result = await device.transferIn(IN_EP, 10);

    //-- Desactivar el chip select de la flash
    await FLASH_cs_deassert(device);
}


/**
 * Lee el Status Register (0x05) y devuelve el byte
 */
export async function FLASH_read_status(device) {

    await FLASH_cs_assert(device);

    let r2;

    do {

      //-- Enviar trama para la lectura del status
      let r1 = await device.transferOut(OUT_EP, new Uint8Array([0x31, 1, 0, 0x05, 0])); 

      //-- Leer la respuesta
      r2 = await device.transferIn(IN_EP, 4);

      //-- Se deben recibir 4 bytes
      //-- Si NO es así, se repite la lectura!
        
    } while (r2.data.byteLength < 4);

    await FLASH_cs_deassert(device);

    //-- Devolver el status
    return r2.data.getUint8(3);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function FLASH_wait(device) {

  let is_busy = false;

  do {
    //-- Leer status
    let status = await FLASH_read_status(device);

    //-- Comprobar si esta ocupado
    is_busy = ((status & 0x01) == 1);

    //-- Si esta ocupado, realizamos una espera
    if (is_busy) {
      await sleep(10);
    }

  } while (is_busy);
}

export async function FLASH_block_64kB_erase(device, addr)
  {
    console.log("erase 64kB sector at 0x" + addr.toString(16) + "..");
  
    //-- Obtener los 3 bytes de la direccion
    const addrH = (addr >> 16) & 0xFF;
    const addrM = (addr >> 8) & 0xFF;
    const addrL = addr & 0xFF;

    //-- Activar el chip select de la flash
    await FLASH_cs_assert(device)

    //-- Enviar a la flash el comando
    let data = new Uint8Array([FTDI_SPI_WRITE, 3, 0, FLASH_BLOCK_ERASE, 
                               addrH, addrM, addrL]);
    await device.transferOut(OUT_EP, data);

    //-- Leer la respuest: 2 bytes del model + 1 del comando
    //-- + 3 de las direcciones
    //-- (se lee para vaciar el buffer)
    let result = await device.transferIn(IN_EP, 10);

    //-- Desactivar el chip select de la flash
    await FLASH_cs_deassert(device);
  }
  
  /**
 * Escribe un solo byte en una dirección específica (Comando 0x02)
 */
export async function FLASH_write_byte(device, address, value) {
    // 1. Habilitar escritura
    await FLASH_write_enable(device);

    // 2. Enviar comando Page Program + Dirección + Dato
    await FLASH_cs_assert(device);
    
    const addrH = (address >> 16) & 0xFF;
    const addrM = (address >> 8) & 0xFF;
    const addrL = address & 0xFF;

    // Trama: [0x11 (Data Out), Longitud L, Longitud H, 0x02 (Cmd), AddrH, AddrM, AddrL, Data]
    // Son 5 bytes totales (Cmd + Addr + Data). MPSSE usa (n-1), por lo que enviamos 0x04.
    const writeFrame = new Uint8Array([0x31, 0x04, 0x00, 0x02, addrH, addrM, addrL, value]);
    await device.transferOut(OUT_EP, writeFrame);
    
    await FLASH_cs_deassert(device);
    await FLASH_wait(device);


    // 3. Esperar a que termine (Polling)
    //let busy = true;
    //while (busy) {
    //    const status = await readStatus(device);
    //    busy = (status & 0x01) !== 0; 
    //}
}