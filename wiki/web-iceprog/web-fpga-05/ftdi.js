
//-- Comandos para el FTDI
const FTDI_COMMANDS = {
    SIO_RESET: 0x00,   //-- Resetear el dispositivo (SIO_RESET_REQUEST)
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
        index: 0x01   //-- Canal A (1)
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
  **/

