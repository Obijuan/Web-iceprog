// FTDI USB identifiers
const usbVendor = 0x0403;
const usbProduct = 0x6010;
const BITMODE_MPSSE  = 0x02;
const INTERFACE_A   = 1;

/* Mode commands */
const	MC_SETB_LOW = 0x80;    // Set Data bits LowByte
const MC_READB_LOW = 0x81;   // Read Data bits LowByte
const MC_TCK_D5 = 0x8B;      // Enable /5 div, backward compat to FT2232D
const MC_SET_CLK_DIV = 0x86; // Set clock divisor

const MC_DATA_IN  =  0x20 // When set read data (Data IN)
const MC_DATA_OUT =  0x10 // When set write data (Data OUT)
const MC_DATA_OCN = 0x01  // When set update data on negative clock edge
const MC_DATA_BITS = 0x02 // When set count bits not bytes

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
const SIO_SET_BITMODE_REQUEST = 0x0B;
// #define SIO_READ_PINS_REQUEST         0x0C
const SIO_READ_EEPROM_REQUEST = 0x90
// #define SIO_WRITE_EEPROM_REQUEST      0x91
// #define SIO_ERASE_EEPROM_REQUEST      0x92


const SIO_RESET_SIO = 0;
const SIO_RESET_PURGE_RX = 1;
const SIO_RESET_PURGE_TX = 2;

//-- Important information
// ftdi->interface = 0;
// ftdi->index     = INTERFACE_A;
const IN_EP = 0x02; //-- Endpoint for transfering data from host to device
const OUT_EP = 0x01; //-- Endpoint!  0x81

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

//-- FTDI: Set Bitmode
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

  console.log("Set Bitmode: " + result.status + 
              " -> Written: " + usb_val.toString(16));
}

function ftdi_read_chipid_shift(value)
{
    return ((value & 1) << 1) |
           ((value & 2) << 5) |
           ((value & 4) >> 2) |
           ((value & 8) << 4) |
           ((value & 16) >> 1) |
           ((value & 32) >> 1) |
           ((value & 64) >> 4) |
           ((value & 128) >> 2);
}

//-- FTDI: Read Chip ID
async function ftdi_read_chipid(device) {

  let result = await device.controlTransferIn({
    requestType: 'vendor',
    recipient: 'device',
    request: SIO_READ_EEPROM_REQUEST,
    value: 0,
    index: 0x43
  }, 2);

  console.log("Read: " + result.status +
  " -> Bytes: " + result.data.byteLength +
  ", Value: " + result.data.getUint16(0)
  );

  let a = result.data.getUint16(0);
  console.log("a: " + a.toString(16));

  a = a << 8 | a >> 8;

  result = await device.controlTransferIn({
    requestType: 'vendor',
    recipient: 'device',
    request: SIO_READ_EEPROM_REQUEST,
    value: 0,
    index: 0x44
  }, 2);

  console.log("Read: " + result.status +
  " -> Bytes: " + result.data.byteLength +
  ", Value: " + result.data.getUint16(0)
  );

  let b = result.data.getUint16(0);
  console.log("b: " + b.toString(16));

  b = b << 8 | b >> 8;
  a = (a << 16) | (b & 0xFFFF);

  a = ftdi_read_chipid_shift(a) | ftdi_read_chipid_shift(a>>8)<<8
      ftdi_read_chipid_shift(a>>16)<<16 | ftdi_read_chipid_shift(a>>24)<<24;

  let chipid = a ^ 0xa5f0f7d1;

  console.log("Chipid: " + chipid.toString(16));
}

//-- MPSSE: Send one byte
async function mpsse_send_byte(b) {

  let data = new Uint8Array(1);
  data[0] = b;
  let result = await device.transferOut(IN_EP, data); 

  console.log("MPSSE: Send_byte: " + result.status);
  console.log("  -> Written: " + result.bytesWritten + ", Value: " + b.toString(16));
}

//-- MPSSE: Init
async function mpsse_init(device) {
  //-- Initialization commands
  await ftdi_reset(device);
  await ftdi_usb_purge_buffers(device);

  let latency = await ftdi_get_latency_timer(device);
  console.log("Latency: " + latency);

  //-- Set latency to 1 (fastest)
  //-- 1 is the fastest polling, it means 1 kHz polling
  await ftdi_set_latency_timer(device, 1);

  // Enter MPSSE (Multi-Protocol Synchronous Serial Engine) mode.
  // Set all pins to output
  await ftdi_set_bitmode(device, 0xFF, BITMODE_MPSSE);

  // enable clock divide by 5
  await mpsse_send_byte(MC_TCK_D5);

  // set 6 MHz clock
  await mpsse_send_byte(MC_SET_CLK_DIV);
  await mpsse_send_byte(0x00);
  await mpsse_send_byte(0x00);

  console.log("MPSSE: INIT: OK!")
}

//-------- MPSSE: mpsse_recv_byte()
async function mpsse_recv_byte(device) {

  console.log("queue length: " + queue.length);

  //-- Byte to read
  let data;

  //-- There at least 1 byte in the buffer. There is no need to
  //-- access the USB
  if (queue.length >= 1) {

    //-- Read the first element in the buffer
    data = queue.shift();

    console.log("MPSSE: recv_byte. Byte in buffer: " + data.toString(16));
    return data;
  }

  //-- Buffer is empty. Read data from the USB
  let result = await device.transferIn(OUT_EP, 4096);

  console.log("TransferIn: " + result.status +
  " -> Bytes: " + result.data.byteLength);

  let cad = "";

  //-- Insert the data in the queue
  for (let i = 0; i < result.data.byteLength; i = i + 1) {
    queue.push(result.data.getUint8(i));
    cad = cad + "0x" + result.data.getUint8(i).toString(16) + " ";
  }

  console.log("QUEUE: [ " + cad + "]");

  //-- Read the first element in the queue
  data = queue.shift();

  console.log("MPSSE: recv_byte. Read: " + data.toString(16) + 
              ", Buffer size: " + queue.length);

  return data;
}


//-------- MPSSE: readb_low()
async function mpsse_readb_low(device) 
{
  await mpsse_send_byte(MC_READB_LOW);
  let data = await mpsse_recv_byte(device);
  console.log("MPSSE: readb_low(): 0x" + data.toString(16));
}

//-------- MPSSE: set_gpio()
async function mpsse_set_gpio(gpio, direction)
{
	await mpsse_send_byte(MC_SETB_LOW);
	await mpsse_send_byte(gpio); // Value
	await mpsse_send_byte(direction); // Direction

  console.log("MPSSE: set_gpio: " + gpio.toString(16) + 
              ", Dir: " + direction.toString(16));
}


// ---------------------------------------------------------
// Hardware specific CS, CReset, CDone functions
// ---------------------------------------------------------


async function get_cdone()
{
  let data = await mpsse_readb_low(device);
  let cdone = (data & 0x40) != 0;

  console.log("MPSSE: get_cdone(): " + cdone);
  return cdone;
 }

 async function set_cs_creset(cs_b, creset_b)
 {
   let gpio = 0;
   const direction = 0x93;
 
   if (cs_b) {
     // ADBUS4 (GPIOL0)
     gpio |= 0x10;
   }
 
   if (creset_b) {
     // ADBUS7 (GPIOL3)
     gpio |= 0x80;
   }
 
   await mpsse_set_gpio(gpio, direction);

   console.log("MPSEE: set_cs_creset: cs_b: " + cs_b.toString(16) + 
               ", creset_b: " + creset_b.toString(16));
 }

// ---------------------------------------------------------
// FLASH function implementations
// ---------------------------------------------------------
// the FPGA reset is released so also FLASH chip select should be deasserted
async function flash_release_reset()
{
  await set_cs_creset(1, 1);
}


//----------------- Main ---------------------


if ('usb' in navigator == false) {
    console.log("WEB-USB NO SOPORTADO!")
}

let device;

//-- Buffer for storing incomming data from usb
let queue = [];

btn_usb.onclick = async () => {
  console.log("Connect to USB");

  //-- filters: [{ vendorId: 0x0403 }]
  device = await  navigator.usb.requestDevice({ filters: [] });
  await device.open();
   
  //-- Show the device on the screen
  display.innerHTML = device.productName + " " + device.manufacturerName;

  //-- Select the configuration (the FTDI chip only have 1, which value is 1)
  //--- (given by bConfigurationValue)
  await device.selectConfiguration(1);
  console.log("Configuration value: " + device.configuration.configurationValue);

  //-- Claim the interface
  //-- NOTE: [LINUX]: Make sure the ftdi_sio modules has been unloaded previously!!!
  await device.claimInterface(0);
  
  //-- Init the FTDI
  await mpsse_init(device);

  //-- Test: Read FTDI chip id
  await ftdi_read_chipid(device);
  
  let cdone = await get_cdone();
  console.log("Cdone: " + (cdone ? "high" : "low"));

  flash_release_reset();
 

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

