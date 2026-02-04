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
