// FTDI USB identifiers
const usbVendor = 0x0403;
const usbProduct = 0x6010;
const BITMODE_MPSSE  = 0x02;
const INTERFACE_A   = 1;

//-- Request
const SIO_RESET_REQUEST = 0;  //-- Reset the port
// #define SIO_SET_BAUDRATE_REQUEST      SIO_SET_BAUD_RATE
// #define SIO_SET_DATA_REQUEST          SIO_SET_DATA
// #define SIO_SET_FLOW_CTRL_REQUEST     SIO_SET_FLOW_CTRL
// #define SIO_SET_MODEM_CTRL_REQUEST    SIO_MODEM_CTRL
// #define SIO_POLL_MODEM_STATUS_REQUEST 0x05
// #define SIO_SET_EVENT_CHAR_REQUEST    0x06
// #define SIO_SET_ERROR_CHAR_REQUEST    0x07
const SIO_SET_LATENCY_TIMER_REQUEST = 0x09;
const SIO_GET_LATENCY_TIMER_REQUEST = 0x0A;
// #define SIO_SET_BITMODE_REQUEST       0x0B
// #define SIO_READ_PINS_REQUEST         0x0C
// #define SIO_READ_EEPROM_REQUEST       0x90
// #define SIO_WRITE_EEPROM_REQUEST      0x91
// #define SIO_ERASE_EEPROM_REQUEST      0x92


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

//-- FTDI: Get latency timer
async function ftdi_get_latency_timer(device) {

  //-- Read 1 byte from the FTDI
  let result = await device.controlTransferIn({
    requestType: 'vendor',
    recipient: 'device',
    request: SIO_GET_LATENCY_TIMER_REQUEST,
    value: 0,
    index: INTERFACE_A
  }, 1);

  console.log("Get Latency: " + result.status +
              " -> Bytes: " + result.data.byteLength +
              ", Value: " + result.data.getUint8(0)
              );

  return result.data.getUint8(0);
}

//-- FTDI: Set latency timer
async function ftdi_set_latency_timer(device, latency) {

  let result = await device.controlTransferOut({
    requestType: 'vendor',
    recipient: 'device',
    request: SIO_SET_LATENCY_TIMER_REQUEST,
    value: latency,
    index: INTERFACE_A
  });

  console.log("Set Latency: " + result.status);
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
  await ftdi_reset(device);
  await ftdi_usb_purge_buffers(device);

  let latency = await ftdi_get_latency_timer(device);
  console.log("Latency: " + latency);

  //-- Set latency to 1 (fastest)
  //-- 1 is the fastest polling, it means 1 kHz polling
  await ftdi_set_latency_timer(device, 1);

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

