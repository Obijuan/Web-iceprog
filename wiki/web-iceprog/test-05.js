import * as ftdi from './ftdi.js';

const btn_usb = document.getElementById('btn_usb');


// 🚧 DEBUG 🚧  
const display = document.getElementById('display');
const btn_list = document.getElementById('btn_list');
const btn_close = document.getElementById('btn_close');
const bitstream = document.getElementById('bitstream');


/* Mode commands */
const	MC_SETB_LOW = 0x80;    // Set Data bits LowByte
const MC_READB_LOW = 0x81;   // Read Data bits LowByte

const MC_DATA_IN  =  0x20 // When set read data (Data IN)
const MC_DATA_OUT =  0x10 // When set write data (Data OUT)
const MC_DATA_OCN = 0x01  // When set update data on negative clock edge
const MC_DATA_BITS = 0x02 // When set count bits not bytes

// ---------------------------------------------------------
// FLASH definitions
// ---------------------------------------------------------

// Flash command definitions
// This command list is based on the Winbond W25Q128JV Datasheet

const FC_RPD = 0xAB; // Release Power-Down, returns Device ID
const FC_JEDECID = 0x9F; // Read JEDEC ID
const FC_PP = 0x02; // Page Program
const FC_RD = 0x03; // Read Data
const FC_PD = 0xB9; // Power-down

//-- Important information
// ftdi->interface = 0;
// ftdi->index     = INTERFACE_A;
const IN_EP = 0x02; //-- Endpoint for transfering data from host to device
const OUT_EP = 0x01; //-- Endpoint!  0x81

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

function mpsse_error(ret, msg) {
  console.log(msg);
  //console.log("Error: xxx");
  //console.log("Operation code: " + ret);
  //console.log("Abort!!!!!!!!.");
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


//-------- MPSSE: readb_low()
async function mpsse_readb_low(device) 
{
  await mpsse_send_byte(MC_READB_LOW);
  let data = await mpsse_recv_byte(device);
  //console.log("MPSSE: readb_low(): 0x" + data.toString(16));
}

//-------- MPSSE: set_gpio()
async function mpsse_set_gpio(gpio, direction)
{
	await mpsse_send_byte(MC_SETB_LOW);
	await mpsse_send_byte(gpio); // Value
	await mpsse_send_byte(direction); // Direction

  //console.log("MPSSE: set_gpio: " + gpio.toString(16) + 
  //            ", Dir: " + direction.toString(16));
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
  //console.log("MPSSE: xfer_spi_bits. Received: 0x" + rcv.toString(16));
  return rcv;
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

//------ MPSSE: send_spi
async function mpsse_send_spi(buff)
{
  //console.log("MPSSE: send_spi. START!---------")
  if (buff.byteLength < 1)
    return;

  // Output only, update data on negative clock edge.
  await mpsse_send_byte(MC_DATA_OUT | MC_DATA_OCN);
  await mpsse_send_byte(buff.byteLength - 1);
  await mpsse_send_byte((buff.byteLength - 1) >> 8);

  let rc = await ftdi_write_data(device, buff);
  //-- Todo! Check the correct number of bytes has been written....
  //console.log("MPSSE: send_spi. STOP!---------")
}

// ---------------------------------------------------------
// Hardware specific CS, CReset, CDone functions
// ---------------------------------------------------------


async function get_cdone()
{
  let data = await mpsse_readb_low(device);
  let cdone = (data & 0x40) != 0;

  //console.log("MPSSE: get_cdone(): " + cdone);
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

   //console.log("MPSEE: set_cs_creset: cs_b: " + cs_b.toString(16) + 
   //            ", creset_b: " + creset_b.toString(16));
 }

// ---------------------------------------------------------
// FLASH function implementations
// ---------------------------------------------------------
// the FPGA reset is released so also FLASH chip select should be deasserted
async function flash_release_reset()
{
  //console.log("FLASH: release_reset() START!");
  await set_cs_creset(1, 1);

  //console.log("FLASH: release_reset() STOP!");
}

// FLASH chip select deassert
async function flash_chip_deselect()
{
  //console.log("FLASH: chip_deselect() START!");
	await set_cs_creset(1, 0);
  //console.log("FLASH: chip_deselect() STOP!");
}

// FLASH chip select assert
// should only happen while FPGA reset is asserted
async function flash_chip_select()
{
  //console.log("FLASH: chip_select() START!");
	await set_cs_creset(0, 0);
  //console.log("FLASH: chip_select() STOP!");
}

async function flash_reset()
   {
     //console.log("FLASH: Reset. START!");
     await flash_chip_select();
     await mpsse_xfer_spi_bits(device, 0xFF, 8);
     await flash_chip_deselect();
     await flash_chip_select();
     await mpsse_xfer_spi_bits(device, 0xFF, 2);
     await flash_chip_deselect();
     //console.log("FLASH: Reset. STOP!");
   }


async function flash_power_up()
{
  //console.log("FLASH: Power UP. START!");
  let buff = new Uint8Array(1);
  buff[0] = FC_RPD;
  await flash_chip_select();
  await mpsse_xfer_spi(buff);
  await flash_chip_deselect();
  //console.log("FLASH: Power UP. START!");
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
  await mpsse_xfer_spi(buff);

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

//---------------------
//-- UTILS
//---------------------
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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


async function test_mode(device) 
{
  await ftdi.FLASH_cs_deassert(device);
  await sleep(250);
  let cdone = await ftdi.FPGA_get_cdone(device);
  await ftdi.FLASH_release_power_down(device);

  const buffer_id = await ftdi.FLASH_read_id(device)
  let flash_id_str = id_to_string(buffer_id);
  console.log("✅FLASH-ID: " + flash_id_str);

  ftdi.FLASH_power_down(device);
  await ftdi.FPGA_reset_deassert(device)
  await sleep(250);
  cdone = await ftdi.FPGA_get_cdone(device);  
}


//-------------------------------------------------------------
//-- Convertir un array con los bytes de identificacion de
//-- la flash en una cadena
//-------------------------------------------------------------
function id_to_string(id)
{
  let cad = ""

  for (const byte of id)
    cad += " 0x" + byte.toString(16);

  return cad
}


//-------------------------------------
//-- arr1: Bytes en flash
//-- arr2: Bytes en fichero
//-------------------------------------
function array_equal2(arr1, arr2, size) {

    for (let i = 0; i < size; i++) {
        if (arr1[i] !== arr2[i]) {
          console.log("❌ Offset: " + i);
          console.log("❌ Flash:  " + arr1[i]);
          console.log("❌ Fichero: " + arr2[i]);
          return false;
        }
    }
    return true;
}


//-------------------------------------
//-- arr1: Bytes en flash
//-- arr2: Bytes en fichero
//-------------------------------------
function array_equal(arr1, arr2) {
    //-- Si tienen tamaños diferentes, los arrays son distintos
    //if (arr1.length !== arr2.length) {
    //  console.log("❌ ERROR: Los arrays tienen DISTINTO TAMAÑO!");
    //  console.log("  -Flash: " + arr1.length);
    //  console.log("  -Fich: " + arr2.length);
    //  return false;
    //}

    for (let i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) {
          console.log("❌ Offset: " + i);
          console.log("❌ Flash:  " + arr1[i]);
          console.log("❌ Fichero: " + arr2[i]);
          return false;
        }
    }
    return true;
}

//----------------------------------------------------
//-- Leer de la flash un bloque exacto del tamaño
//-- Indicado
//----------------------------------------------------
async function FLASH_read_exact(device, addr, size) {

  let remainder = size;
  let offset = 0;
  let buf_flash = new Uint8Array(size);

  do {

    //-- Leer bloque de bytes de la flash
    let chunk = await ftdi.FLASH_read(device, addr, remainder);

    buf_flash.set(chunk, offset);
    offset = offset + chunk.byteLength;
    
    //console.log("Leidos en flash: " + chunk.byteLength);

    remainder = remainder - chunk.byteLength;
    addr = addr + chunk.byteLength;

  } while (remainder > 0);

  return buf_flash;
}






async function preludio()
{
  //-- Pedir permiso explicito al usuario para
  //-- conectarse
  let device = await ftdi.connect();

  //-- Abrir dispositivo
  await ftdi.initialize(device);

  console.log("USB abierto") 

  //-- Show the device on the screen
  display.innerHTML = device.productName + " " + device.manufacturerName;

  //-- Init the FTDI
  await ftdi.spi_init(device);
  console.log("✅ MPSSE: INIT: OK!")

    //-- Para enviar cualquier comando a la flash
  //-- la FPGA debe estar en estado de reset
  await ftdi.FPGA_reset_assert(device);

  //-- Sacar la flash del modo sleep (de bajo consumo
  //-- Es obligatorio hacerlo, o de lo contrario NO
  //-- se podra leer nada de ella
  await ftdi.FLASH_release_power_down(device);

  let buffer_id = await ftdi.FLASH_read_id(device)

  //-- Obtener una cadena con el identificador
  let flash_id_str = id_to_string(buffer_id);

  console.log("✅FLASH-ID: " + flash_id_str);
  
  //-- Quitar el Reset de la FPGA (opcional)
  await ftdi.FPGA_reset_deassert(device)

  let cdone = await ftdi.FPGA_get_cdone(device);
  console.log("Cdone: " + (cdone ? "high" : "low"));

  await sleep(100);

  return device;
}

//--------------------------------------------
//---   MAIN 
//--------------------------------------------
let device;

//-- Buffer for storing incomming data from usb
let queue = [];

btn_usb.onclick = async () => {

  //-- Initial operations
  device = await preludio();

  //-- Test Mode
  await test_mode(device);

  //--------- Open the bitstream file
  const filename = bitstream.files[0];
  console.log("File: " + bitstream.value);

  let reader = new FileReader();
  reader.readAsArrayBuffer(filename);

  //-- Fichero LEIDO
  reader.onload = async (e) => {

    //-- Obtener contenidos del fichero
    let contents = e.target.result;

    //-- Borrar la flash 
    //await erase(device, contents);

    //-- Programar el bitstream!
    //await load_bitstream(device, contents);

    //-- Verificar!
    await verification2(device, contents);

    //-- Hemos terminado: Quitar el reset
    await ftdi.FPGA_reset_deassert(device);
    console.log('Fin!');
  }
}

//------------------------------------------
//-- Borrar la flash
//------------------------------------------
async function erase(device, contents)
{
  console.log("reset..");
  await ftdi.FLASH_cs_deassert(device);
  await sleep(250);

  let cdone = await ftdi.FPGA_get_cdone(device);
  console.log("Cdone: " + (cdone ? "high" : "low"));
  console.log("**************************** TEST1 *******");
  
  await ftdi.FLASH_release_power_down(device);
  let buffer_id = await ftdi.FLASH_read_id(device)
  let flash_id_str = id_to_string(buffer_id);
  console.log("✅FLASH-ID: " + flash_id_str);

  let file_size = contents.byteLength;
  console.log("Length: " + file_size)


  let rw_offset = 0;

  let begin_addr = rw_offset & ~0xffff;
  let end_addr = (rw_offset + file_size + 0xffff) & ~0xffff;

  for (let addr = begin_addr; addr < end_addr; addr += 0x10000) {
     await ftdi.FLASH_write_enable(device); 
     await ftdi.FLASH_block_64kB_erase(device, addr);
     await ftdi.FLASH_wait(device);
  }
  console.log("✅Erase");

  cdone = await ftdi.FPGA_get_cdone(device);
  console.log("Cdone: " + (cdone ? "high" : "low"));
  console.log("**************************** TEST1 *******");
}

async function load_bitstream(device, contents)
{

  await ftdi.FLASH_release_power_down(device);

  let buffer_id = await ftdi.FLASH_read_id(device)
  let flash_id_str = id_to_string(buffer_id);
  console.log("✅FLASH-ID: " + flash_id_str);

  // ---------------------------------------------------------
  // Program
  // ---------------------------------------------------------
  let file_size = contents.byteLength;
  console.log("Length: " + file_size)

  let rw_offset = 0;

  let caddr = 0;
  
  let total_blocks = Math.trunc(file_size / 256);
  let remaining = Math.trunc(file_size % 256);

  console.log("Total 256 bytes blocks: " + total_blocks)

  //-- Write complete blocks
  for (let b = 0; b < total_blocks; b++) {
      let buf = contents.slice(caddr, caddr + 256);
      await ftdi.FLASH_write_enable(device); 
      await ftdi.FLASH_prog_page(device, rw_offset + caddr, buf);
      await ftdi.FLASH_wait(device);

      caddr += 256;
      if (b % 50 == 0) 
        console.log(b + " ");
  }


  //-- Write the remaining not full block
  if (remaining > 0) {
      let buf = contents.slice(caddr, caddr + remaining);
      await ftdi.FLASH_write_enable(device); 
      await ftdi.FLASH_prog_page(device, rw_offset + caddr, buf);
      await ftdi.FLASH_wait(device);
  }
  console.log("✅Program");


  let cdone = await ftdi.FPGA_get_cdone(device);
  console.log("Cdone: " + (cdone ? "high" : "low"));
  console.log("**************************** TEST3 *******");
}


async function verification2 (device, contents)
{
  //-----------------------------------------------------------
  //   VERYFICATION
  //-----------------------------------------------------------
  await ftdi.FPGA_reset_assert(device);
  await ftdi.FLASH_release_power_down(device);

  //-- Direccion donde comenzar la veriricacion
  let addr = 0;
  let size = 64;
  let offset = 0;

  //-- Leer bloque de 256 bytes del bitstream
  let buf_file = new Uint8Array(contents);
  let buf_flash = new Uint8Array(buf_file.byteLength);

  let remainder = buf_file.byteLength;
  
  console.log("* Leyendo bitstream de la flash...");

  while (remainder > 0) {

    //-- Borrar buffers: TEST
    await ftdi.purge_buffers(device);

    //-- Leer bloque de bytes de la flash
    let n = (remainder < size) ? remainder : size;
    let chunk = await ftdi.FLASH_read(device, offset, n);
  
    //-- Añadir bloque leido al buffer de la flash
    buf_flash.set(chunk, offset);
    offset = offset + chunk.byteLength;

    //console.log("* Tamano: " + offset);

    remainder = buf_file.byteLength - offset;
  }

  //console.log("* Tamano: " + offset);
  //console.log("* Remainder: " + remainder);
  console.log("* Verificando...");

  if (!array_equal2(buf_flash, buf_file, offset)) {
    console.log("❌ Error en verificación!");
  } else {
    console.log("✅Verify: OK!");
  }

}


async function verification (device, contents)
{
  //-----------------------------------------------------------
  //   VERYFICATION
  //-----------------------------------------------------------
  await ftdi.FPGA_reset_assert(device);
  await ftdi.FLASH_release_power_down(device);

  let buffer_id = await ftdi.FLASH_read_id(device)
  let flash_id_str = id_to_string(buffer_id);
  console.log("✅FLASH-ID: " + flash_id_str);

  console.log("->Reading.. for verification!!!!!!!!!!!!!!");
  await ftdi.purge_buffers(device);
  
  let file_size = contents.byteLength;
  console.log("Length: " + file_size)
  
  let total_blocks = Math.trunc(file_size / 256);
  let remaining = Math.trunc(file_size % 256);

  //-- Direccion donde comenzar la veriricacion
  let addr = 0;

  //-- Verify complete blocks
  for (let b = 0; b < total_blocks; b++) {

    //-- Leer bloque de 256 bytes del bitstream
    let buf_file = new Uint8Array(contents.slice(addr, addr + 256));

    //-- Leer bloque de 256 bytes de la flash
    let buf_flash = await FLASH_read_exact(device, addr, 256);

    //-- Si los buffers son diferentes, hay un error de verificación
    //-- Lo que hay en flash difiere de lo que tiene el fichero
    if (!array_equal(buf_flash, buf_file)) {
      console.log("❌ Error en bloque " + b)
      //return
    }

    //-- Pasar al siguiente bloque
    //addr += 256;
    if (b % 50 == 0) 
      console.log(b + " ");
  }

  //-- Verify the remaining block
  if (remaining > 0) {
    let buf_file = new Uint8Array(contents.slice(addr, addr + remaining));
    let buf_flash = await FLASH_read_exact(device, addr, remaining);
  
    if (!array_equal(buf_flash, buf_file)) {
      console.log("❌ Bloque " + total_blocks + " incorrecto!!!");
      console.log("❌ ERROR en Verificación!");
      return
    }
  }

  console.log("✅Verify: OK!");


  await ftdi.FPGA_reset_deassert(device);
}

async function todo() {

  //-- Verify the remaining block
  if (remaining > 0) {
    let buf_file = contents.slice(addr, addr + remaining);
    let buf_flash = new ArrayBuffer(remaining)    
    //flash_read(rw_offset + addr, buf_flash, remaining, false);
    //if (!array_equals(buf_flash, buf_file))
    //    mpsse_error(3, "Found difference between flash and file!")
  }
  console.log("✅Verify: OK!");



  let cdone = await get_cdone();
  console.log("cdone: " + (cdone ? "high" : "low"))
  console.log("**************************** TEST4 *******");

  await flash_reset();
  await flash_power_up();
  await flash_read_id(); 



  //-- RESET
  console.log("Hay que hacer reset!")

  

  // ---------------------------------------------------------
  // Reset
  // ---------------------------------------------------------
  console.log("Llamando a Power down...");
  await flash_power_down();
  console.log("Llega bien aquí tras power_down....")
  await flash_release_reset();
  await sleep(250);
  cdone = await get_cdone()



  //--set_cs_creset(1, 1);
  //--sleep.usleep(250000);

  console.log("cdone: " + (cdone ? "high" : "low"))
  console.log("Bye.")
  //--mpsse_close(ctx)
}





function flash_read(addr, data, n, verbose)
{
 	  if (verbose)
       console.log("read 0x" + addr.toString(16) + " 0x" + n.toString(16));

    let command = new Uint8Array(4);  //new Buffer.alloc(4);
    command[0] = FC_RD;
    command[1] = (addr >> 16);
    command[2] = (addr >> 8);
    command[3] = addr;

 	  flash_chip_select();
 	  mpsse_send_spi(command, 4);
 	  //memset(data, 0, n);
 	  mpsse_xfer_spi(data, n);
 	  flash_chip_deselect();

    if (verbose) {
      let str = ""
 		  for (let i = 0; i < n; i++)
 			  str += data[i].toString(16) + (i == n - 1 || i % 32 == 31 ? '\n' : ' ');
        console.log(str);
    }
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
