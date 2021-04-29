console.log("Holiii");

const btn_usb = document.getElementById('btn_usb');
const display = document.getElementById('display');
const btn_list = document.getElementById('btn_list');
const btn_close = document.getElementById('btn_close');

if ('usb' in navigator == false) {
    console.log("WEB-USB NO SOPORTADO!")
}

let device;

btn_usb.onclick = () => {
    console.log("Connect to USB");

    navigator.usb.requestDevice({ filters: [{ vendorId: 0x0403 }] })
    .then(sel_device => {
       device = sel_device;
       display.innerHTML = device.productName + " " + device.manufacturerName;
       return device.open();
     })
    .then ( () => {
        console.log("El programa sigue por aquí...");
    })
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

