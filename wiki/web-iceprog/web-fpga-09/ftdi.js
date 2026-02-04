//-- Constantes para el FTDI
const INTERFACE_A   = 1;


//-- Comandos para el FTDI
const FTDI_COMMANDS = {
    SIO_RESET: 0x00,   //-- Resetear el dispositivo (SIO_RESET_REQUEST)
    SET_BITMODE: 0x0B, //-- Configurar el modo de funcionamiento del MPSSE
};

// ----------------------------------------
//  Reseteo del dispositivo FTDI
// ----------------------------------------
export async function reset(device) {
    
    await device.controlTransferOut({
        requestType: 'vendor',
        recipient: 'device',
        request: FTDI_COMMANDS.SIO_RESET,
        value: 0x00,  //-- SIO_RESET_SIO (0)
        index: INTERFACE_A
    });
}

// -----------------------------------------------
//  Habilitar modo MPSSE
//  (Se habilita el SPI entre el FTDI y la FPGA)
// -----------------------------------------------
export async function enableMPSSE(device) {
    console.log("FTDI: Activando modo MPSSE...");
    
    // Primero reseteamos el bitmode a 0 (Bitbang)
    await device.controlTransferOut({
        requestType: 'vendor', recipient: 'device',
        request: FTDI_COMMANDS.SET_BITMODE,
        value: 0x0000, // Modo 0 y Bitmask 0
        index: INTERFACE_A
    });

    // Ahora activamos el modo MPSSE (0x02)
    await device.controlTransferOut({
        requestType: 'vendor', recipient: 'device',
        request: FTDI_COMMANDS.SET_BITMODE,
        value: 0x0200, //-- Modo 2, mascara 0
        index: INTERFACE_A
    });
}

export async function setClock(device, divisor = 0x0001) {
    // Divisor 0x0001 suele dar ~6MHz. 
    // Comando 0x86: Set TCK/SK divisor
    const data = new Uint8Array([0x86, divisor & 0xFF, (divisor >> 8) & 0xFF]);
    await device.transferOut(2, data); // Endpoint 2 es el habitual para salida en FTDI
}

export async function setLowPins(device, value, direction) {
    // Comando 0x80: Configura pines ADBUS0-7
    // value: qué pines están en 1 o 0
    // direction: 1 para salida, 0 para entrada
    const data = new Uint8Array([0x80, value, direction]);
    await device.transferOut(2, data);
}


export async function sendBitstream(device, data, onProgress) {
    console.log("FTDI: Iniciando transferencia de bitstream...");
    
    const CHUNK_SIZE = 4096; // 4KB por bloque es eficiente para WebUSB
    let offset = 0;

    while (offset < data.length) {
        const chunk = data.slice(offset, offset + CHUNK_SIZE);
        
        // Comando MPSSE 0x11: Clock out bytes MSB first
        // Estructura: [Comando, Longitud_Baja, Longitud_Alta, ...Datos]
        // La longitud es (n-1), por eso restamos 1
        const len = chunk.length - 1;
        const header = new Uint8Array([
            0x11, 
            len & 0xFF, 
            (len >> 8) & 0xFF
        ]);

        // Combinamos cabecera y datos
        const packet = new Uint8Array(header.length + chunk.length);
        packet.set(header);
        packet.set(chunk, header.length);

        // Envío al Endpoint 2 (Out)
        await device.transferOut(2, packet);

        offset += chunk.length;
        
        // Callback para actualizar la barra de progreso en la UI
        if (onProgress) {
            onProgress(Math.round((offset / data.length) * 100));
        }
    }
    
    // Al terminar, enviamos unos ciclos de reloj extra para que la FPGA procese todo
    await device.transferOut(2, new Uint8Array([0x8F])); // Comando MPSSE para enviar pulsos extra
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
  **/

/*-- FTDI: Set Bitmode
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

  //console.log("Set Bitmode: " + result.status + 
  //            " -> Written: " + usb_val.toString(16));
  console.assert (result.status == "ok", "Error setting bitmode");
}
  */ 

