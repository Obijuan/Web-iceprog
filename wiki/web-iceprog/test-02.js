import * as ftdi from './ftdi.js';


/* Mode commands */
const MC_DATA_IN  = 0x20 // When set read data (Data IN)
const MC_DATA_OUT = 0x10 // When set write data (Data OUT)
const MC_DATA_OCN = 0x01  // When set update data on negative clock edge

// ---------------------------------------------------------
// FLASH definitions
// ---------------------------------------------------------
const FC_JEDECID = 0x9F; // Read JEDEC ID

//-- Important information
// ftdi->interface = 0;
// ftdi->index     = INTERFACE_A;
const IN_EP = 0x02; //-- Endpoint for transfering data from host to device
const OUT_EP = 0x01; //-- Endpoint!  0x81

const btn_usb = document.getElementById('btn_usb');


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

  let data = new Uint8Array([MC_DATA_IN | MC_DATA_OUT | MC_DATA_OCN, 4, 0, FC_JEDECID]);
  data = new Uint8Array([...data, 0, 0, 0, 0]);
  await device.transferOut(IN_EP, data);

  let result = await device.transferIn(OUT_EP, 10);

  await flash_chip_deselect();

  // TODO: Add full decode of the JEDEC ID.
  let flash_id_str = "flash ID: ";
  for (let i = 3; i < result.data.byteLength; i++)
    flash_id_str += " 0x" + result.data.getUint8(i).toString(16);

  console.log("✅FLASH-ID: " + flash_id_str);
  //console.log("FLASH: READ-ID. STOP!");
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

  
  await flash_read_id();

  //-- Hemos terminado con la Flash
  //-- Quitar el Reset de la FPGA (opcional)
  await ftdi.FPGA_reset_deassert(device)
}

