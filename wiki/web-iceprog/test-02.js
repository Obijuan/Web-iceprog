import * as ftdi from './ftdi.js';

const btn_usb = document.getElementById('btn_usb');

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


//----------------- Main ---------------------

let device;

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

  //-- Obtener la identificacion de la flash!
  //const buffer_id = await flash_read_id();

  const buffer_id = await ftdi.FLASH_read_id(device)

  //-- Obtener una cadena con el identificador
  let flash_id_str = id_to_string(buffer_id);

  console.log("✅FLASH-ID: " + flash_id_str);
  
  //-- Quitar el Reset de la FPGA (opcional)
  await ftdi.FPGA_reset_deassert(device)
}

