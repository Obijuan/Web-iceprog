import * as ftdi from './ftdi.js';


/* Mode commands */
const	MC_SETB_LOW = 0x80;    // Set Data bits LowByte
const MC_DATA_IN  = 0x20 // When set read data (Data IN)
const MC_DATA_OUT = 0x10 // When set write data (Data OUT)
const MC_DATA_OCN = 0x01  // When set update data on negative clock edge

// ---------------------------------------------------------
// FLASH definitions
// ---------------------------------------------------------

// Flash command definitions
// This command list is based on the Winbond W25Q128JV Datasheet

const FC_RPD = 0xAB; // Release Power-Down, returns Device ID
const FC_JEDECID = 0x9F; // Read JEDEC ID

//-- Important information
// ftdi->interface = 0;
// ftdi->index     = INTERFACE_A;
const IN_EP = 0x02; //-- Endpoint for transfering data from host to device
const OUT_EP = 0x01; //-- Endpoint!  0x81

const btn_usb = document.getElementById('btn_usb');

//----- FTDI: Write_data
//-- Escribir un buffer en el FTDI
//-- Tamaño máximo buffer: 4096
async function ftdi_write_data(device, buff)
{
  let result = await device.transferOut(IN_EP, buff); 

  //console.log("FTDI_WRITE: Buffer written: " + result.status);
  //console.log("  -> Written: " + result.bytesWritten + " byte(s)");

  return result.bytesWritten;
}

//-- MPSSE: Send one byte
async function mpsse_send_byte(b) {

  let data = new Uint8Array(1);
  data[0] = b;
  let result = await device.transferOut(IN_EP, data); 

  //console.log("MPSSE: Send_byte: " + result.status);
  //console.log("  -> Written: " + result.bytesWritten + ", Value: 0x" + b.toString(16));
}



//-------- MPSSE: mpsse_recv_byte()
async function mpsse_recv_byte(device) {

  //console.log("queue length: " + queue.length);

  //-- Byte to read
  let data;

  //-- There at least 1 byte in the buffer. There is no need to
  //-- access the USB
  if (queue.length >= 1) {

    //-- Read the first element in the buffer
    data = queue.shift();

    //console.log("MPSSE: recv_byte. Byte in buffer: " + data.toString(16));
    return data;
  }

  //-- Buffer is empty. Read data from the USB
  let result = await device.transferIn(OUT_EP, 4096);

  // console.log("TransferIn: " + result.status +
  // " -> Bytes: " + result.data.byteLength);

  let cad = "";

  //-- The first two bytes received are the modem status bytes
  //-- Insert the data in the queue
  for (let i = 2; i < result.data.byteLength; i = i + 1) {
    queue.push(result.data.getUint8(i));
    cad = cad + "0x" + result.data.getUint8(i).toString(16) + " ";
  }

  //console.log("QUEUE: [ " + cad + "]");

  //-- Read the first element in the queue
  if (queue.length > 0) {
    data = queue.shift();
    //console.log("MPSEE: recv_byte. Read: " + data.toString(16) + 
    //            "Buffer size: " + queue.length);
    return data;
  }

  //console.log("MPSSE: recv_byte. NO DATA READ! (EMPTY)");

  //return -1;
}







// ---------------------------------------------------------
// FLASH function implementations
// ---------------------------------------------------------

// FLASH chip select deassert
async function flash_chip_deselect()
{
  //console.log("FLASH: chip_deselect() START!");
	await set_cs_creset(1, 0);
  //console.log("FLASH: chip_deselect() STOP!");
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

  //console.log("FLASH: READ-ID. START!");

  let buff = new Uint8Array(5); //-- command + 4 response bytes
  buff[0] = FC_JEDECID;

  await flash_chip_select();

  // Write command and read first 4 bytes
  await mpsse_xfer_spi2(buff);

  if (buff[4] == 0xFF)
      //console.log("Extended Device String Length is 0xFF, " +
      //            "this is likely a read error. Ignorig...");

  await flash_chip_deselect();

  // TODO: Add full decode of the JEDEC ID.
  let flash_id_str = "flash ID: ";
  for (let i = 1; i < buff.byteLength; i++)
    flash_id_str += " 0x" + buff[i].toString(16);

  console.log("✅FLASH-ID: " + flash_id_str);
  //console.log("FLASH: READ-ID. STOP!");
}

// ---------------------------------------------------------
// Hardware specific CS, CReset, CDone functions
// --------------------------------------------------------
 async function set_cs_creset(cs_b)
 {
   let gpio = 0;
   const direction = 0x93;  //-- 0x93
 
   if (cs_b) {
     // ADBUS4 (GPIOL0)
     gpio |= 0x10;
   }
 
   await ftdi.set_gpio(device, gpio, direction);
 }


// FLASH chip select assert
// should only happen while FPGA reset is asserted
async function flash_chip_select()
{
	await set_cs_creset(0);
}


//------ MPSSE: xfer_spi()
async function mpsse_xfer_spi(buff)
{
  //console.log("MPSSE: xfer_spi. START!---------")
   if (buff.byteLength < 1)
     return;

  /* Input and output, update data on negative edge read on positive. */
  await mpsse_send_byte(MC_DATA_IN | MC_DATA_OUT | MC_DATA_OCN);
  await mpsse_send_byte(buff.byteLength - 1);
  await mpsse_send_byte((buff.byteLength - 1) >> 8);

  let rc = await ftdi_write_data(device, buff);
  //-- Todo! Check the correct number of bytes has been written....

  //console.log("Rc: " + rc + ", Buff lenth: " + buff.byteLength);

  for (let i = 0; i < buff.byteLength; i++)
    buff[i] = await mpsse_recv_byte(device);

  //console.log("MPSSE: xfer_spi. Written: " + rc + " byte(s)!");
  //console.log("MPSSE: xfer_spio. STOP!----------------")
}

//------ MPSSE: xfer_spi()
async function mpsse_xfer_spi2(buff)
{
  
  let data = new Uint8Array([MC_DATA_IN | MC_DATA_OUT | MC_DATA_OCN, 4, 0, FC_JEDECID]);
  data = new Uint8Array([...data, 0, 0, 0, 0]);
  await device.transferOut(IN_EP, data);

  for (let i = 0; i < buff.byteLength; i++)
    buff[i] = await mpsse_recv_byte(device);

  console.log("Test...")

  //console.log("MPSSE: xfer_spi. Written: " + rc + " byte(s)!");
  //console.log("MPSSE: xfer_spio. STOP!----------------")
}





//----------------- Main ---------------------

let device;
let queue = [];

btn_usb.onclick = async () => {

  //-- Pedir permiso explicito al usuario para
  //-- conectarse
  device = await ftdi.connect();
  
  //-- Abrir dispositivo
  await ftdi.initialize(device);

  //-- Configurar para trabajar con el SPI
  await ftdi.spi_init(device);

  //-- Para enviar cualquier comando a la flash
  //-- la FPGA debe estar en estado de reset
  await ftdi.FPGA_reset_assert(device);

  //-- Sacar la flash del modo sleep (de bajo consumo
  //-- Es obligatorio hacerlo, o de lo contrario NO
  //-- se podra leer nada de ella
  await ftdi.FLASH_release_power_down(device);

  
  await flash_read_id();

  //-- Hemos terminado con la Flash
  //-- Quitar el Reset de la FPGA (opcional)
  await ftdi.FPGA_reset_deassert(device)
}

