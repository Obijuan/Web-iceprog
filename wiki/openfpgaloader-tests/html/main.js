import { runOpenFPGALoader     } from './bundle.js';
import { lineBuffered, chunked } from './util.js';

// Supported boards storage
const list_boards = {};

// DOM references
const USBStatus     = document.getElementById('USBStatus');
const oflOpStatus   = document.getElementById('oflOpStatus');
const oflStatus     = document.getElementById('OFLStatus');

// USB device object
let device = null;

function update_ofl_log(div_log, message) {
	div_log.innerHTML += message.replace(/ /g, "&nbsp") + "</br>\n";
	div_log.scrollTop = div_log.scrollHeight;
}

async function ofl_exec(args, div_log, fileIn={}) {
	let lines   = [];
	let success = true;

	
	console.log("device null");
	await navigator.usb.requestDevice({ filters: [] })
		.then((usbDevice) => {
			device = usbDevice;
			USBStatus.innerHTML = "USB Status: <font color='green'>Connected</font>";
		})
		.catch((e) => {
			device = null;
			USBStatus.innerHTML = `USB Status: <font color='red'>Error ${e}</font>`;
		});
	
	div_log.innerHTML = "openFPGALoader " + args.join(' ') + "</br>\n";

	/* Get current time to compute duration */
	const startTime = performance.now();

	try {
		const response = await runOpenFPGALoader(args, fileIn, {
			stdout: lineBuffered(line => {
				lines.push(line);
				console.log(line);
				update_ofl_log(div_log, line);
			}),
			stderr: lineBuffered(line => {
				lines.push(line)
				console.log(line);
				update_ofl_log(div_log, line);
			}),
			decodeASCII: true
		});

		/* Compute and display execution duration */
		const endTime  = performance.now();
		const duration = Math.round(endTime - startTime);

		console.log(`Execution time: ${duration} milliseconds`);
		div_log.innerHTML += `<div class="timing"><span class="span-success">Execution completed in ${duration}ms</span></div><br>\n`;

	} catch(error) {
		console.error("openFPGALoader execution error:", error);
		success = false;
		div_log.innerHTML += `<span class="span-error">Error: ${error.message} </span><br>\n`;
	} finally {
		div_log.scrollTop = div_log.scrollHeight;
	}
	return {success, lines};
}

// ------------------ Init Selectors ------------------ //

async function perform_operation(file, cmd_line) {
	var filename  = null;
	// spiOverJtag and User bitstream content.
	var soj_fileContent = null;   // SpiOverJtag bitstream content
	var fileContent     = null;   // user bitstream content

	// Clear status area.
	oflOpStatus.innerHTML = "";
	const soj_name = "";

	/* Get Bitstream from host computer */
	var span_bit_dl = document.createElement("span_bit_dl");
	oflOpStatus.appendChild(span_bit_dl);

	filename = file.name;
	span_bit_dl.innerHTML = 'Fetch ' + file.name + " Bitstream:";
	await readBinaryFileFromHost(file).then(uint8Array => {
		if (uint8Array) {
			span_bit_dl.innerHTML += ' <span class="span-success">Done</span>';
			fileContent = uint8Array;
		} else {
			console.log("error");
			span_bit_dl.innerHTML += ' <span class="span-error">Fail</span>';
			return;
		}
	});

	oflOpStatus.innerHTML += "</br>";

	/* Prepare openFPGALoader call/cmd line */
	const fileData = {};
	fileData[filename] = fileContent;
	cmd_line.push(filename);


	/* openFPGALoader run */
	const span_ofl_exec = document.createElement("div");
	oflOpStatus.appendChild(span_ofl_exec);
	span_ofl_exec.innerHTML = 'Execute openFPGALoader:';

	const ret_ofl = await ofl_exec(cmd_line, oflStatus, fileData);
	span_ofl_exec.innerHTML = ret_ofl.success
		? 'Execute openFPGALoader: <span class="span-success">Done</span>'
		: 'Execute openFPGALoader: <span class="span-error">Fail</span>';
}

// ------------------ Program Manual ------------------ //

document.getElementById('programButtonManual').addEventListener('click', async function () {
	// User bitstream file and name
	var file    = document.getElementById("fileInput").files[0];
	// openFPGALoader command line
	const ofl_cmd = ['-b', 'ice40_generic'];//document.getElementById("ofl_cmd").value.split(' ');
	perform_operation(file, ofl_cmd);
});

// ------------------ Helpers ------------------ //

// Fetch the bitstream from the host
function readBinaryFileFromHost(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();

		reader.onload = evt => resolve(new Uint8Array(evt.target.result));
		reader.onerror = () => reject("File reading failed");
		try {
			reader.readAsArrayBuffer(file);
		} catch (error) {
			console.error('Error reading file:', error);
			resolve(null);
		}
	});
}

/* -------------------------------------- */
/* USB Aspect (connect/disconnect events) */
/* -------------------------------------- */

// Handle device disconnection
navigator.usb.addEventListener('disconnect', event => {
	console.log("disconnect");
	if (event.device === device) {
		USBStatus.innerHTML = 'USB Status: <font color="blue">Device disconnected</font>';
	}
});

navigator.usb.addEventListener('connect', event => {
	console.log("connect");
	USBStatus.innerHTML = 'USB Status: <font color="green">connected</font>';
});
