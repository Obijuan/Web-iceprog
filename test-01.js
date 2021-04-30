// FTDI USB identifiers
const usbVendor = 0x0403;
const usbProduct = 0x6010;
const BITMODE_MPSSE  = 0x02;
const INTERFACE_A   = 1;


//-- Important information
// ftdi->interface = 0;
// ftdi->index     = INTERFACE_A;
// ftdi->in_ep     = 0x02; //-- Endpoint!
// ftdi->out_ep    = 0x81; //-- Endpoint!

const btn_usb = document.getElementById('btn_usb');
const display = document.getElementById('display');
const btn_list = document.getElementById('btn_list');
const btn_close = document.getElementById('btn_close');

if ('usb' in navigator == false) {
    console.log("WEB-USB NO SOPORTADO!")
}

let device;

const LIBUSB_REQUEST_TYPE_VENDOR = (0x02 << 5);
const LIBUSB_RECIPIENT_DEVICE = 0X00;
const LIBUSB_ENDPOINT_OUT =  0x00;
const LIBUSB_ENDPOINT_IN = 0x80;
const FTDI_DEVICE_OUT_REQTYPE = LIBUSB_REQUEST_TYPE_VENDOR |
                                LIBUSB_RECIPIENT_DEVICE |
                                LIBUSB_ENDPOINT_OUT; 
const SIO_RESET_REQUEST = 0;  //-- Reset the port
const SIO_RESET_SIO = 0;

btn_usb.onclick = () => {
    console.log("Connect to USB");

    navigator.usb.requestDevice({ filters: [{ vendorId: 0x0403 }] })
    .then(sel_device => {
       device = sel_device;
       display.innerHTML = device.productName + " " + device.manufacturerName;
       return device.open();
       })
    .then ( () => device.controlTransferOut({
          requestType: 'vendor',
          recipient: 'device',
          request: SIO_RESET_REQUEST,
          value: SIO_RESET_SIO,
          index: INTERFACE_A
        }))
    .then ( status => {
        console.log("Control transfer out...");
        console.log("Promise: ");
        console.log(status);
        console.log("Ya...");
    })
//  if (libusb_control_transfer(ftdi->usb_dev, FTDI_DEVICE_OUT_REQTYPE,
//      SIO_RESET_REQUEST, SIO_RESET_SIO,
//      ftdi->index, NULL, 0, ftdi->usb_write_timeout) < 0)
//    ftdi_error_return(-1,"FTDI reset failed");

        
    .catch(error => { 
        console.error(error); 
    });

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

