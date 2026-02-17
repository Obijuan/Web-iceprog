import * as ftdi from './ftdi.js';

const btn_usb = document.getElementById('btn_usb');


// 🚧 DEBUG 🚧  
const display = document.getElementById('display');
const btn_list = document.getElementById('btn_list');
const btn_close = document.getElementById('btn_close');
const bitstream = document.getElementById('bitstream');

const MC_DATA_IN  =  0x20 // When set read data (Data IN)
const MC_DATA_OUT =  0x10 // When set write data (Data OUT)
const MC_DATA_OCN = 0x01  // When set update data on negative clock edge

// ---------------------------------------------------------
// FLASH definitions
// ---------------------------------------------------------

// Flash command definitions
// This command list is based on the Winbond W25Q128JV Datasheet
const FC_PD = 0xB9; // Power-down

//-- Important information
// ftdi->interface = 0;
// ftdi->index     = INTERFACE_A;
const IN_EP = 0x02; //-- Endpoint for transfering data from host to device
const OUT_EP = 0x01; //-- Endpoint!  0x81

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


// ---------------------------------------------------------
// FLASH function implementations
// ---------------------------------------------------------

async function flash_power_down()
{
  let buff = new Uint8Array(1);
  buff[0] = FC_PD;
  await ftdi.FLASH_cs_assert(device);
  await mpsse_xfer_spi(buff);
  await ftdi.FLASH_cs_deassert(device);
}

//---------------------
//-- UTILS
//---------------------
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
//-- size: Tamaño a comprobar 
//-------------------------------------
function array_equal(arr1, arr2, size) {

    for (let i = 0; i < size; i++) {
        if (arr1[i] !== arr2[i]) {
          console.log("  🔴 Direccion: " + i);
          console.log("  🔴 Flash:  " + arr1[i]);
          console.log("  🔴 Fichero: " + arr2[i]);
          return false;
        }
    }
    return true;
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
    await erase(device, contents);

    //-- Programar el bitstream!
    await load_bitstream(device, contents);

    //-- Verificar!
    await verification(device, contents);

    let cdone = await ftdi.FPGA_get_cdone(device);
    console.log("Cdone: " + (cdone ? "high" : "low"));

    //-- Poner la flash en bajo consumo
    console.log("FLASH: Power down...")
    await flash_power_down();
    
    //-- Hemos terminado: Quitar el reset
    await ftdi.FPGA_reset_deassert(device);

    //-- Esperar a que la FPGA se configure
    console.log("Configurando FPGA...");
    do {

      //-- Leer estado de la FPGA
      cdone = await ftdi.FPGA_get_cdone(device);
      //console.log("Cdone: " + (cdone ? "high" : "low"));

      //-- Esperar
      await sleep(100);
    } while (cdone == false);

    console.log("cdone: " + (cdone ? "high" : "low"));
    console.log("✅FPGA Lista!");
    console.log("Bye.");
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

async function verification (device, contents)
{
  //-----------------------------------------------------------
  //   VERYFICATION
  //-----------------------------------------------------------
  await ftdi.FPGA_reset_assert(device);
  await ftdi.FLASH_release_power_down(device);

  //-- Array con el bitstream leido del fichero
  let buf_file = new Uint8Array(contents);

  //-- Tamaño del bloque a leer cada vez
  let size = 64;

  //-- Tamano total del bitstream
  let total_size = buf_file.byteLength;

  //-- Buffer donde almacenar los bytes leidos de la flash
  let buf_flash = new Uint8Array(total_size);

  //-- Posicion actual del buffer de lectura de flash
  //-- Comenzamos por el principio
  let offset = 0;

  //-- Bytes pendientes de leer de la flash
  let remainder = total_size;
  
  console.log("* Leyendo bitstream de la flash...");

  //-- Numero de bloques leidos
  let blocks = 0;

  //-- Repetir hasta que no queden más bytes a leer en la flash
  while (remainder > 0) {

    //-- Dar feedback
    if (blocks % 200 == 0) 
      console.log("  -Leidos: " + offset);

    //-- Borrar buffers: TEST
    await ftdi.purge_buffers(device);

    //-- Leer bloque de bytes de la flash
    let n = (remainder < size) ? remainder : size;
    let chunk = await ftdi.FLASH_read(device, offset, n);
  
    //-- Añadir bloque leido al buffer de la flash
    buf_flash.set(chunk, offset);
    offset = offset + chunk.byteLength;

    //console.log("* Tamano: " + offset);

    //-- Calcular los bytes restantes
    remainder = buf_file.byteLength - offset;

    //-- Un bloque mas leido
    blocks = blocks + 1;
  }

  //-- Dar feedback
  console.log("  -Leidos: " + offset);

  //console.log("* Tamano: " + offset);
  //console.log("* Remainder: " + remainder);
  console.log("* Verificando...");

  if (!array_equal(buf_flash, buf_file, offset)) {
    console.log("❌ Error en verificación!");
  } else {
    console.log("✅Verify: OK!");
  }
}


