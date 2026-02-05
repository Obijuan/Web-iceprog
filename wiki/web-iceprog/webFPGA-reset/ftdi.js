//------------------------------------------
// Comunicación a bajo nivel con el FTDI
//------------------------------------------

//-------------------------- Constantes
const FTDI_VID = 0x0403;  //-- Vendor ID de FTDI
const INTERFACE_A   = 1;  //-- Interfaz A (SPI)
const SIO_RESET_SIO = 0;


//--- COMANDOS del FTDI
const SIO_RESET_REQUEST = 0;  //-- RESET


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

    // Comando de reset del chip FTDI para limpiar buffers
    await device.controlTransferOut({
        requestType: 'vendor',
        recipient: 'device',
        request: SIO_RESET_REQUEST, 
        value: SIO_RESET_SIO,
        index: INTERFACE_A
    });

    // Activar modo MPSSE (necesario para controlar pines individuales)
    // El valor 0x0200 activa el Bit-Bang/MPSSE en el FT2232H
    await device.controlTransferOut({
        requestType: 'vendor', 
        recipient: 'device',
        request: 0x0B, 
        value: 0x0200, 
        index: 0x01
    });
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
