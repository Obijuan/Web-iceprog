//------------------------------------------
// Comunicación a bajo nivel con el FTDI
//------------------------------------------

//-- Constantes
const FTDI_VID = 0x0403;  //-- Vendor ID de FTDI

export async function connect() {
    const device = await navigator.usb.requestDevice({
        filters: [{ vendorId: FTDI_VID }]
    });
    return device;
}

export async function initialize(device) {
    await device.open();
    await device.selectConfiguration(1);
    await device.claimInterface(0);
    // Comando de reset del chip FTDI para limpiar buffers
    await device.controlTransferOut({
        requestType: 'vendor',
        recipient: 'device',
        request: 0x00, 
        value: 0x00,
        index: 0x01
    });
}
