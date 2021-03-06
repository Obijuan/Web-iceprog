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

// ---------------------------------------------------------
// FLASH definitions
// ---------------------------------------------------------

// Flash command definitions
// This command list is based on the Winbond W25Q128JV Datasheet

const FC_WE = 0x06;  // Write Enable
const FC_RPD = 0xAB; // Release Power-Down, returns Device ID
const FC_JEDECID = 0x9F; // Read JEDEC ID
const FC_PP = 0x02; // Page Program
const FC_RD = 0x03; // Read Data
const FC_PD = 0xB9; // Power-down
const FC_RSR1 = 0x05; // Read Status Register 1
const FC_BE64 = 0xD8; // Block Erase 64kb

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
const bitstream = document.getElementById('bitstream');

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

//----- FTDI: Write_data
//-- Escribir un buffer en el FTDI
//-- Tama??o m??ximo buffer: 4096
async function ftdi_write_data(device, buff)
{
  let result = await device.transferOut(IN_EP, buff); 

  console.log("FTDI_WRITE: Buffer written: " + result.status);
  console.log("  -> Written: " + result.bytesWritten + " byte(s)");

  return result.bytesWritten;
}

function mpsse_error(ret, msg) {
  console.log(msg);
  console.log("Error: xxx");
  console.log("Operation code: " + ret);
  console.log("Abort!!!!!!!!.");
}

//-- MPSSE: Send one byte
async function mpsse_send_byte(b) {

  let data = new Uint8Array(1);
  data[0] = b;
  let result = await device.transferOut(IN_EP, data); 

  console.log("MPSSE: Send_byte: " + result.status);
  console.log("  -> Written: " + result.bytesWritten + ", Value: 0x" + b.toString(16));
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

  //-- The first two bytes received are the modem status bytes
  //-- Insert the data in the queue
  for (let i = 2; i < result.data.byteLength; i = i + 1) {
    queue.push(result.data.getUint8(i));
    cad = cad + "0x" + result.data.getUint8(i).toString(16) + " ";
  }

  console.log("QUEUE: [ " + cad + "]");

  //-- Read the first element in the queue
  if (queue.length > 0) {
    data = queue.shift();
    console.log("MPSEE: recv_byte. Read: " + data.toString(16) + 
                "Buffer size: " + queue.length);
    return data;
  }

  console.log("MPSSE: recv_byte. NO DATA READ! (EMPTY)");

  return -1;
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

//--------- MPSSE: xfer_spi_bits()
async function mpsse_xfer_spi_bits(device, data, n)
{
  if (n < 1)
    return 0;

  // Input and output, update data on negative edge read on positive, bits.
  await mpsse_send_byte(MC_DATA_IN | MC_DATA_OUT | MC_DATA_OCN | MC_DATA_BITS);
  await mpsse_send_byte(n - 1);
  await mpsse_send_byte(data);

  let rcv = await mpsse_recv_byte(device);
  console.log("MPSSE: xfer_spi_bits. Received: 0x" + rcv.toString(16));
  return rcv;
}

//------ MPSSE: xfer_spi()
async function mpsse_xfer_spi(buff)
{
  console.log("MPSSE: xfer_spi. START!---------")
   if (buff.byteLength < 1)
     return;

  /* Input and output, update data on negative edge read on positive. */
  await mpsse_send_byte(MC_DATA_IN | MC_DATA_OUT | MC_DATA_OCN);
  await mpsse_send_byte(buff.byteLength - 1);
  await mpsse_send_byte((buff.byteLength - 1) >> 8);

  let rc = await ftdi_write_data(device, buff);
  //-- Todo! Check the correct number of bytes has been written....

  console.log("Rc: " + rc + ", Buff lenth: " + buff.byteLength);

  for (i = 0; i < buff.byteLength; i++)
    buff[i] = await mpsse_recv_byte(device);

  console.log("MPSSE: xfer_spi. Written: " + rc + " byte(s)!");
  console.log("MPSSE: xfer_spio. STOP!----------------")
}

//------ MPSSE: send_spi
async function mpsse_send_spi(buff)
{
  console.log("MPSSE: send_spi. START!---------")
  if (buff.byteLength < 1)
    return;

  // Output only, update data on negative clock edge.
  await mpsse_send_byte(MC_DATA_OUT | MC_DATA_OCN);
  await mpsse_send_byte(buff.byteLength - 1);
  await mpsse_send_byte((buff.byteLength - 1) >> 8);

  let rc = await ftdi_write_data(device, buff);
  //-- Todo! Check the correct number of bytes has been written....
  console.log("MPSSE: send_spi. STOP!---------")
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
  console.log("FLASH: release_reset() START!");
  await set_cs_creset(1, 1);

  console.log("FLASH: release_reset() STOP!");
}

// FLASH chip select deassert
async function flash_chip_deselect()
{
  console.log("FLASH: chip_deselect() START!");
	await set_cs_creset(1, 0);
  console.log("FLASH: chip_deselect() STOP!");
}

// FLASH chip select assert
// should only happen while FPGA reset is asserted
async function flash_chip_select()
{
  console.log("FLASH: chip_select() START!");
	await set_cs_creset(0, 0);
  console.log("FLASH: chip_select() STOP!");
}

async function flash_reset()
   {
     console.log("FLASH: Reset. START!");
     await flash_chip_select();
     await mpsse_xfer_spi_bits(device, 0xFF, 8);
     await flash_chip_deselect();
     await flash_chip_select();
     await mpsse_xfer_spi_bits(device, 0xFF, 2);
     await flash_chip_deselect();
     console.log("FLASH: Reset. STOP!");
   }


async function flash_power_up()
{
  console.log("FLASH: Power UP. START!");
  let buff = new Uint8Array(1);
  buff[0] = FC_RPD;
  await flash_chip_select();
  await mpsse_xfer_spi(buff);
  await flash_chip_deselect();
  console.log("FLASH: Power UP. START!");
}


async function flash_read_id()
{
  /* JEDEC ID structure:
  * Byte No. | Data Type
  * ---------+----------
  *        0 | FC_JEDECID Request Command
  *        1 | MFG ID
  *        2 | Dev ID 1
  *        3 | Dev ID 2
  *        4 | Ext Dev Str Len
  */

  console.log("FLASH: READ-ID. START!");

  let buff = new Uint8Array(5); //-- command + 4 response bytes
  buff[0] = FC_JEDECID;

  await flash_chip_select();

  // Write command and read first 4 bytes
  await mpsse_xfer_spi(buff);

  if (buff[4] == 0xFF)
      console.log("Extended Device String Length is 0xFF, " +
                  "this is likely a read error. Ignorig...");

  await flash_chip_deselect();

  // TODO: Add full decode of the JEDEC ID.
  let flash_id_str = "flash ID: ";
  for (let i = 1; i < buff.byteLength; i++)
    flash_id_str += " 0x" + buff[i].toString(16);

  console.log("--------------- FLASH-ID: " + flash_id_str);
  console.log("FLASH: READ-ID. STOP!");
}

async function flash_power_down()
{
  console.log("FLASH: Power Down. START!");
  let buff = new Uint8Array(1);
  buff[0] = FC_PD;
  await flash_chip_select();
  await mpsse_xfer_spi(buff);
  await flash_chip_deselect();
  console.log("FLASH: Power Down. STOP!");
}

async function flash_read_status()
  {
    console.log("FLASH: Read_status. START!");
    let buff = new Uint8Array(2);
    buff[0] = FC_RSR1;
    await flash_chip_select();
    await mpsse_xfer_spi(buff);
    await flash_chip_deselect();

    await sleep(1);

    let status = buff[1];
    console.log("Status: " + status.toString(16));
    console.log("FLASH: Read_status. STOP!");

    return status;
  }

  function flash_print_status(status)
  {
    console.log("SR1: 0x" + status.toString(16))
    console.log(" - SPRL: " + ((status & (1 << 7)) == 0 ? "unlocked" : "locked"));
    console.log(" -  SPM: " + (((status & (1 << 6)) == 0) ? "Byte/Page Prog Mode" : "Sequential Prog Mode"));
    console.log(" -  EPE: " + (((status & (1 << 5)) == 0) ? "Erase/Prog success" : "Erase/Prog error"));
    console.log("-  SPM: " +  (((status & (1 << 4)) == 0) ?  "~WP asserted" : "~WP deasserted"));
  
    var spm = "";
    switch((status >> 2) & 0x3) {
      case 0:
        spm = "All sectors unprotected";
        break;
      case 1:
        spm = "Some sectors protected";
        break;
      case 2:
        spm = "Reserved (xxxx 10xx)";
        break;
      case 3:
        spm = "All sectors protected";
        break;
    }
  
    console.log(" -  SWP: " + spm);
    console.log(" -  WEL: " + (((status & (1 << 1)) == 0) ? "Not write enabled" : "Write enabled"));
    console.log(" - ~RDY: " + (((status & 0x1) == 0) ? "Ready" : "Busy"));
  }

  async function flash_write_enable(verbose) 
  {
    console.log("FLASH: write_enable. START!");
    if (verbose) {
      console.log("status before enable:");
      let status = await flash_read_status();
      flash_print_status(status)
    }

    if (verbose)
      console.log("write enable..");

    let buff = new Uint8Array(1);
    buff[0] = FC_WE;

    await flash_chip_select();
    await mpsse_xfer_spi(buff);
    await flash_chip_deselect();

    if (verbose) {
      console.log("status after enable:");
      status = await flash_read_status();
      flash_print_status(status)
    }
    console.log("FLASH: write_enable. STOP!");
  }

  async function flash_64kB_sector_erase(addr)
  {
    console.log("erase 64kB sector at 0x" + addr.toString(16) + "..");
  
    const command = new  Uint8Array(4);
    command[0] = FC_BE64;
    command[1] = (addr >> 16);
    command[2] = (addr >> 8);
    command[3] = addr;
  
    await flash_chip_select();
    await mpsse_send_spi(command);
    await flash_chip_deselect();
  }

  async function flash_wait(verbose) {

    if (verbose)
        console.log("waiting..");
      let count = 0;
      
      while (1)
      {

        let data = new Uint8Array(2);
        data[0] = FC_RSR1;

        await flash_chip_select();
        await mpsse_xfer_spi(data);
        await flash_chip_deselect();

        if ((data[1] & 0x01) == 0) {
          if (count < 2) {
            count++;
            if (verbose) {
              console.log("r");
            }
          } else {
            if (verbose) {
              console.log("R");
            }
            break;
          }
        } else {
          if (verbose) {
            console.log(".");
          }
          count = 0;
        }

        console.log("Data[1]: " + data[1]);
        console.log("***************************************************************PAUSA!!!!!!")
        await sleep(10);
      }
  }

//-- Implement flash_prog...
async function flash_prog(addr, data, verbose)
{
  let n = data.byteLength;

 	if (verbose)
		console.log("prog 0x" + addr.toString(16) + " 0x" + n.toString(16));

  let command = new Uint8Array(4);
  command[0] = FC_PP;
  command[1] = (addr >> 16);
  command[2] = (addr >> 8);
  command[3] = addr;

	await flash_chip_select();
	await mpsse_send_spi(command);
	await mpsse_send_spi(data);
	await flash_chip_deselect();

	if (verbose) {
    let str = ""
		for (let i = 0; i < n; i++)
			str += data[i].toString(16) + (i == n - 1 || i % 32 == 31 ? '\n' : ' ');
    console.log(str);
  }
}


//---------------------
//-- UTILS
//---------------------
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function ReadFile(file) {
  return new Promise(resolve => {
    let reader = new FileReader();

    reader.onload = (e) => {
       let contents = e.target.result;
       console.log("Terminamos de leer");
       resolve(contents);
    };
    console.log("Vamos a comenzar a leer");
    reader.readAsArrayBuffer(file);
  });
}

async function ReadFile(file) {
    let reader = new FileReader();

    reader.onload = (e) => {
       let contents = e.target.result;
       console.log("Terminamos de leer");
       return contents;
    };
    console.log("Vamos a comenzar a leer");
    reader.readAsArrayBuffer(file);
}


function print_buffer(buff)
{
  let cad = "[ ";
  for (let i=0; i<buff.byteLength; i = i + 1) {
    cad += "0x" + buff.getUint8(i).toString(16) + " ";
  }
  cad += "]";
  console.log(cad);
}

async function test_mode() 
{
  console.log("---> TEST MODE")
  console.log("reset..")
  await flash_chip_deselect();
  await sleep(250);
  cdone = await get_cdone()
  console.log("cdone: " + (cdone ? "high" : "low"))
  await flash_reset();
  await flash_power_up();
  
  console.log("**************************** Read flash ID..");
  await flash_read_id();

  await flash_power_down();

  await flash_release_reset();
  await sleep(250);
  cdone = await get_cdone()
  console.log("cdone: " + (cdone ? "high" : "low"))
  console.log("------>OK !!!!! -------"); 
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

  await flash_release_reset();
  await sleep(100);

  //------- Test Mode
  //await test_mode();

  //--------- Programing the FPGA

  //-- Open the bitstream file
  const filename = bitstream.files[0];
  console.log("File: " + bitstream.value);

  let reader = new FileReader();

  reader.onload = (e) => {
    let contents = e.target.result;
    load_bitstream(contents);
  }

  reader.readAsArrayBuffer(filename);

}

async function load_bitstream(contents)
{
  console.log("-----> FUNCTION LOAD-BITSTREAM --- ");

  let file_size = contents.byteLength;
  console.log("Length: " + file_size);

  console.log("reset..");
  await flash_chip_deselect();
  await sleep(250);

  let cdone = await get_cdone();
  console.log("cdone: " + (cdone ? "high" : "low"))

  await flash_reset();
  await flash_power_up();
  await flash_read_id(); 


  // ---------------------------------------------------------
  // Program
  // ---------------------------------------------------------
  console.log("Length: " + file_size)

  // let rw_offset = 0;

  // //-- Flash erase
  // let verbose = true;

  // let begin_addr = rw_offset & ~0xffff;
  // let end_addr = (rw_offset + file_size + 0xffff) & ~0xffff;

  // for (let addr = begin_addr; addr < end_addr; addr += 0x10000) {
  //    await flash_write_enable(false);
  //    await flash_64kB_sector_erase(addr);
  //    if (verbose)
  //      console.log("************ Status after block erase:");
  //    let status = await flash_read_status()
  //    if (verbose)
  //      flash_print_status(status)
  //    await flash_wait(verbose);
  // }

  // console.log("programming..")

  // let addr = 0;
  // let total_blocks = Math.trunc(file_size / 256);
  // let remaining = Math.trunc(file_size % 256);

  // console.log("Total 256 bytes blocks: " + total_blocks)

  // //-- Write complete blocks
  //  for (let b = 0; b < total_blocks; b++) {
  //    let buf = contents.slice(addr, addr + 256);
  //    console.log("Bloque: " + b + ". Size: " + buf.byteLength);
  //    await flash_write_enable();
  //    await flash_write_enable();
  //    await flash_prog(rw_offset + addr, buf, false);
  //    await flash_wait();

  //    addr += 256;
  //  }

  // //-- Write the remaining not full block
  // if (remaining > 0) {
  //   let buf = contents.slice(addr, addr + remaining);
  //   await flash_write_enable();
  //   await flash_prog(rw_offset + addr, buf, false);
  //   await flash_wait();
  // }

//-----------------------------------------------------------
//   VERYFICATION
//-----------------------------------------------------------

  console.log("reading.. for verification");
  let addr = 0;
  let buf_flash = new Uint8Array(256);
  let buf_file = contents.slice(addr, addr + 256); 



  //-- Verify complete blocks
  // for (let b = 0; b < total_blocks; b++) {
  //   let buf_file = bitstream_data.slice(addr, addr + 256);
  //   flash_read(rw_offset + addr, buf_flash, 256, false);
  //   if (!buf_flash.equals(buf_file))
  //     mpsse_error(3, "Found difference between flash and file!")
  //   addr += 256;
  // }
  // //-- Verify the remaining block
  // if (remaining > 0) {
  //   let buf_file = bitstream_data.slice(addr, addr + remaining);
  //   let buf_flash = new Buffer.alloc(remaining);

  //   flash_read(rw_offset + addr, buf_flash, remaining, false);
  //   if (!buf_flash.equals(buf_file))
  //     mpsse_error(3, "Found difference between flash and file!")
  // }

  //-- Implementar flash_read

//   function flash_read(addr, data, n, verbose)
// {
// 	if (verbose)
//     console.log("read 0x" + addr.toString(16) + " 0x" + n.toString(16));

//   let command = new Buffer.alloc(4);
//   command[0] = FC_RD;
//   command[1] = (addr >> 16);
//   command[2] = (addr >> 8);
//   command[3] = addr;

// 	flash_chip_select();
// 	mpsse_send_spi(command, 4);
// 	//memset(data, 0, n);
// 	mpsse_xfer_spi(data, n);
// 	flash_chip_deselect();

//   if (verbose) {
//     let str = ""
// 		for (let i = 0; i < n; i++)
// 			str += data[i].toString(16) + (i == n - 1 || i % 32 == 31 ? '\n' : ' ');
//     console.log(str);
//   }
// }




  console.log("------------> OK!!");

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

// bitstream.onchange = (e) => {
//   console.log("File selected!");

//   let file = e.target.files[0];
 
//   const reader = new FileReader();

//   reader.onload = (e) => {
//     let contents = e.target.result;

//     let file_size = contents.byteLength;
//     console.log("Length: " + file_size);

//     let addr = 0;
//     let total_blocks = Math.trunc(file_size / 256);
//     let remaining = Math.trunc(file_size % 256);

//     console.log("Total 256 bytes blocks: " + total_blocks)

//     let buf = contents.slice(addr, addr + 256);
//     console.log(buf);

//     //-- Write complete blocks
//     for (let b = 0; b < total_blocks; b++) {
//       let buf = contents.slice(addr, addr + 256);
//       console.log("Bloque: " + b + ". Size: " + buf.byteLength);
//     }
//   };

//   reader.readAsArrayBuffer(file);
// }
