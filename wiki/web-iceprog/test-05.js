import * as ftdi from './ftdi.js';

const btn_usb = document.getElementById('btn_usb');
const display = document.getElementById('display');
const btn_list = document.getElementById('btn_list');
const btn_close = document.getElementById('btn_close');
const bitstream = document.getElementById('bitstream');


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


//---------------------
//-- UTILS
//---------------------
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

  let cdone = await ftdi.FPGA_get_cdone(device);
  console.log("Cdone: " + (cdone ? "high" : "low"));

  await sleep(100);

  return device;
}

//--------------------------------------------
//---   MAIN 
//--------------------------------------------
let device;

btn_usb.onclick = async () => {

  //-- Initial operations
  device = await preludio();

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
    console.log("FLASH: Power down...");
    await ftdi.FLASH_power_down(device);
    
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
}

async function load_bitstream(device, contents)
{
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
  
  console.log("* Leyendo bitstream de la flash..." + total_size + " bytes");

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


