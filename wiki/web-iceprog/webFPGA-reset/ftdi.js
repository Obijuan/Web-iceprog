//------------------------------------------
// Comunicación a bajo nivel con el FTDI
//------------------------------------------

//-------------------------- Constantes
const FTDI_VID = 0x0403;  //-- Vendor ID de FTDI
const INTERFACE_A   = 1;  //-- Interfaz A (SPI)
const SIO_RESET_SIO = 0;
const BITMODE_MPSSE  = 0x02;

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
const SIO_READ_EEPROM_REQUEST = 0x90


//-- Comandos FTDI del modo MPSSE
const MC_TCK_D5 = 0x8B;      // Enable /5 div, backward compat to FT2232D
const MC_SET_CLK_DIV = 0x86; // Set clock divisor
const MC_READB_LOW = 0x81;   // Read Data bits LowByte





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

    //-------- Inicializacion y configuracion del FTDI (MPSEE_INIT)
    await ftdi_sio_reset(device);
    await ftdi_purge_rx_buffer(device);
    await ftdi_purge_tx_buffer(device);

    //-- Set latency to 1 (fastest)
    //-- 1 is the fastest polling, it means 1 kHz polling
    await ftdi_set_latency_timer(device, 1);

    //-- DEBUG! Comprobar que la latencia es efectivameente 1
    let latency = await ftdi_get_latency_timer(device);
    console.assert(latency === 1, "Error al establecer latencia");

    //-- Configurar el modo Bit-Bang del FTDI (para controlar pines individuales)
    await ftdi_set_bitmode(device, 0xFF, BITMODE_MPSSE);

    //------ Enviar comandos al FTDI, por el canal de datos
    // enable clock divide by 5
    let data = new Uint8Array([MC_TCK_D5]);
    await device.transferOut(OUT_EP, data);

    // set 6 MHz clock
    data = new Uint8Array([MC_SET_CLK_DIV, 0x00, 0x00]);
    await device.transferOut(OUT_EP, data);

    //-- TEST
    //-- Enviar comando
    data = new Uint8Array([MC_READB_LOW]);
    await device.transferOut(OUT_EP, data);

    //-- Read data from the USB
    let result = await device.transferIn(IN_EP, 3);
    //console.log("pins: ", result.data.getUint8(2).toString(16));
}

//---------------------------------------------------
//-- Comando de reset del chip FTDI
//---------------------------------------------------
async function ftdi_sio_reset(device) {
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
async function ftdi_purge_rx_buffer(device) {

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
async function ftdi_purge_tx_buffer(device) {

  let result = await device.controlTransferOut({
    requestType: 'vendor',
    recipient: 'device',
    request: SIO_RESET_REQUEST,
    value: SIO_RESET_PURGE_TX,
    index: INTERFACE_A
  });
}

//----------------------------------------------------------
//-- FTDI: Get latency timer
//----------------------------------------------------------
async function ftdi_get_latency_timer(device) {

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
async function ftdi_set_latency_timer(device, latency) {

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
async function ftdi_set_bitmode(device, bitmask, mode) {

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




//----------------------------------------------------------
//-- Enviar un byte al FTDI (usado para comandos MPSSE)
//----------------------------------------------------------
async function ftdi_send_byte(b) {

  let data = new Uint8Array([b]);
  await device.transferOut(OUT_EP, data); 
}


export async function setResetPin(device, level) {
    // Bit 7 es 0x80 (10000000 en binario)
    const bit7 = 0x80;
    const direction = 0x80; // Queremos que el bit 7 sea SALIDA (1)
    const value = level ? 0x80 : 0x00; // Nivel alto (0x80) o bajo (0x00)

    // Comando 0x80: SET_BITS_LOW
    // Formato: [Comando, Valor, Dirección]
    const data = new Uint8Array([0x80, value, direction]);
    
    // Enviamos al Endpoint 2 (salida de datos en el FTDI)
    await device.transferOut(2, data);
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

/*-- FTDI: Reset cmd
async function ftdi_reset(device) {

  let result = await device.controlTransferOut({
    requestType: 'vendor',
    recipient: 'device',
    request: SIO_RESET_REQUEST,
    value: SIO_RESET_SIO,
    index: INTERFACE_A
  });
  
  //console.log("Reset: " + result.status);
  console.assert (result.status == "ok", "Error resetting the FTDI");
}
*/
