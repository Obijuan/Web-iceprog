// FTDI USB identifiers
const usbVendor = 0x0403;
const usbProduct = 0x6010;
const BITMODE_MPSSE  = 0x02;
const INTERFACE_A   = 1;

const SIO_RESET_REQUEST = 0;  //-- Reset the port
const SIO_RESET_SIO = 0;
const SIO_RESET_PURGE_RX = 1;
const SIO_RESET_PURGE_TX = 2;

//-- Important information
// ftdi->interface = 0;
// ftdi->index     = INTERFACE_A;
// ftdi->in_ep     = 0x02; //-- Endpoint!
// ftdi->out_ep    = 0x81; //-- Endpoint!

const btn_usb = document.getElementById('btn_usb');
const display = document.getElementById('display');
const btn_list = document.getElementById('btn_list');
const btn_close = document.getElementById('btn_close');

//-- FTDI: Reset cmd
async function ftdi_reset(device) {

  let result = await device.controlTransferOut({
    requestType: 'vendor',
    recipient: 'device',
    request: SIO_RESET_REQUEST,
    value: SIO_RESET_SIO,
    index: INTERFACE_A
  });
  
  console.log("Reset: " + result.status);
}

//-- FTDI: Purge RX buffer
async function ftdi_purge_rx_buffer(device) {

  let result = await device.controlTransferOut({
    requestType: 'vendor',
    recipient: 'device',
    request: SIO_RESET_REQUEST,
    value: SIO_RESET_PURGE_RX,
    index: INTERFACE_A
  });

  console.log("Purge RX: " + result.status);
}

//-- FTDI: Purge TX Buffer
async function ftdi_usb_purge_tx_buffer(device) {

  let result = await device.controlTransferOut({
    requestType: 'vendor',
    recipient: 'device',
    request: SIO_RESET_REQUEST,
    value: SIO_RESET_PURGE_TX,
    index: INTERFACE_A
  });

  console.log("Purge TX: " + result.status);
}

//-- FTDI: Purge Buffers
async function ftdi_usb_purge_buffers(device) {
  await ftdi_purge_rx_buffer(device);
  await ftdi_usb_purge_tx_buffer(device);
}


if ('usb' in navigator == false) {
    console.log("WEB-USB NO SOPORTADO!")
}

let device;

btn_usb.onclick = async () => {
  console.log("Connect to USB");

  //-- filters: [{ vendorId: 0x0403 }]
  device = await  navigator.usb.requestDevice({ filters: [] });
  await device.open();
   
  //-- Show the device on the screen
  display.innerHTML = device.productName + " " + device.manufacturerName;

  //-- Todo..
  //await device.selectConfiguration(1);
  //await device.claimInterface(0);
   
  //-- Initialization commands
  ftdi_reset(device);
  ftdi_usb_purge_buffers(device);
}

btn_list.onclick = async () => {
    let devices = await navigator.usb.getDevices();
    devices.forEach(device => {
      console.log(device.productName);
    });
}

btn_close.onclick = () => {
    device.close();
    display.innerHTML = "Close!";
}

navigator.usb.addEventListener('connect', event => {
  console.log("Conectado!!!");
});

navigator.usb.addEventListener('disconnect', event => {
    console.log("DESCONECTADO!!!");
    display.innerHTML = "";
})

