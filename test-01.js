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
const IN_EP = 0x02; //-- Endpoint for transfering data from host to device
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

  //-- Select the configuration (the FTDI chip only have 1, which value is 1)
  //--- (given by bConfigurationValue)
  await device.selectConfiguration(1);
  console.log("Configuration value: " + device.configuration.configurationValue);

  //--- TODO
  //-- Pendign to FIX BUG. Error:  'Unable to claim interface' 
  //-- It works!!! It should be checked again....
  await device.claimInterface(0);
   

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
	//mpsse_send_byte(MC_TCK_D5);

  let data = new Uint8Array(1);
  data[0] = MC_TCK_D5;
  let result = await device.transferOut(2, data);  //-- IN_EP
  console.log(result);


  function mpsse_send_byte(data)
  {
    let buf = new Buffer.alloc(1);
    buf[0] = data;
    var rc = libftdi.ftdi_write_data(ctx, buf, 1)
    if (rc != 1) {
      mpsse_error(rc, "Write error (single byte, rc=" + rc + "expected 1)");
    }
  }

//   int ftdi_write_data(struct ftdi_context *ftdi, const unsigned char *buf, int size)
// {
//     int offset = 0;
//     int actual_length;

//     if (ftdi == NULL || ftdi->usb_dev == NULL)
//         ftdi_error_return(-666, "USB device unavailable");

//     while (offset < size)
//     {
//         int write_size = ftdi->writebuffer_chunksize;

//         if (offset+write_size > size)
//             write_size = size-offset;

//         if (libusb_bulk_transfer(ftdi->usb_dev, ftdi->in_ep, (unsigned char *)buf+offset, write_size, &actual_length, ftdi->usb_write_timeout) < 0)
//             ftdi_error_return(-1, "usb bulk write failed");

//         offset += actual_length;
//     }

//     return offset;
// }


  // ftdi_write_data(ctx, buf, 1)

  
  // if (libusb_bulk_transfer(
  //       ftdi->usb_dev, 
  //       ftdi->in_ep, 
  //       (unsigned char *)buf+offset, 
  //       write_size, 
  //       &actual_length, 
  //       ftdi->usb_write_timeout) < 0)
  // ftdi_error_return(-1, "usb bulk write failed");


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

