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

async function ofl_exec(args, div_log, fileIn={}, with_usb=true, verbose=true) {
	let lines   = [];
	let success = true;

	if (!device && with_usb) {
		if (verbose)
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
	}

	if (div_log)
		div_log.innerHTML = "openFPGALoader " + args.join(' ') + "</br>\n";

	/* Get current time to compute duration */
	const startTime = performance.now();

	try {
		const response = await runOpenFPGALoader(args, fileIn, {
			stdout: lineBuffered(line => {
				lines.push(line);
				if (verbose)
					console.log(line);
				if (div_log)
					update_ofl_log(div_log, line);
			}),
			stderr: lineBuffered(line => {
				lines.push(line)
				if (verbose)
					console.log(line);
				if (div_log)
					update_ofl_log(div_log, line);
			}),
			decodeASCII: true
		});

		/* Compute and display execution duration */
		const endTime  = performance.now();
		const duration = Math.round(endTime - startTime);

		if (verbose)
			console.log(`Execution time: ${duration} milliseconds`);
		if (div_log)
			div_log.innerHTML += `<div class="timing"><span class="span-success">Execution completed in ${duration}ms</span></div><br>\n`;

	} catch(error) {
		console.error("openFPGALoader execution error:", error);
		success = false;
		if (div_log)
			div_log.innerHTML += `<span class="span-error">Error: ${error.message} </span><br>\n`;
	} finally {
		if (div_log)
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

	// Detect if command if to flash a bitstream
	// if so, detectSpiOverJtagName will return spiOverJtag bitstream
	// name, otherwise ""
	const ret      = await detectSpiOverJtagName(cmd_line);
	const soj_name = ret[1]; // spiOverJtag bitstream name

	var span_soj_dl = document.createElement("span_soj_dl");
	oflOpStatus.appendChild(span_soj_dl);
	span_soj_dl.innerHTML = 'Fetch SpiOverJtag Bridge: <span class="span-info">Not required</span>';
	oflOpStatus.innerHTML += "</br>";

	/* Get Bitstream from host computer */
	var span_bit_dl = document.createElement("span_bit_dl");
	oflOpStatus.appendChild(span_bit_dl);
	if (file) {
		console.log(file.name);
		filename = file.name;
		span_bit_dl.innerHTML = 'Fetch ' + filename + " Bitstream:";
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
	} else {
		span_bit_dl.innerHTML = 'Fetch Bitstream: <span class="span-info">Not required</span>';
	}
	oflOpStatus.innerHTML += "</br>";

	/* Prepare openFPGALoader call/cmd line */
	const fileData = {};

	if (soj_name && soj_fileContent) {
		fileData[soj_name] = soj_fileContent;
		cmd_line.push("--bridge", soj_name);
	}
	if (filename && fileContent) {
		fileData[filename] = fileContent;
		cmd_line.push(filename);
	}

	/* openFPGALoader run */
	const span_ofl_exec = document.createElement("div");
	oflOpStatus.appendChild(span_ofl_exec);
	span_ofl_exec.innerHTML = 'Execute openFPGALoader:';
	document.getElementById("oflCmdManual").textContent = "openFPGALoader " + cmd_line.join(" ");

	const ret_ofl = await ofl_exec(cmd_line, oflStatus, fileData, true, true);
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


// Try to detect FPGA Vendor/Model
// cmd_line must be a list
// return a list with the first argument is a status and second the
// FPGA code.
// -3: no device found.
// -2: generic error.
// -1: No full part_part for a non Xilinx Artix or Spartan7
// 0: Not flash action
// 1: fpga_part found by option
// 2: fpga_part found by board entry
// 3: fpga_part found via --detect
async function detectSpiOverJtagName(cmd_line)
{
	var ret_status = 0;
	var soj_name   = "";
	console.log(cmd_line);

	// search If the command contains flash argument (-f or --flash).
	if (!(cmd_line.includes("-f") || cmd_line.includes("--flash"))) {
		return [ret_status, ""];
	}

	// command to send if it's not possible to deduces part from
	// the command line.
	var search_cmd = ["--detect"];

	// First quick try: user has provided part
	const fpga_part_idx = cmd_line.findIndex(val => val.includes("--fpga-part"));
	if (fpga_part_idx != -1) {
		let part;
		// --fpga-part=xxxx
		if (cmd_line[fpga_part_idx].includes("="))
			part = cmd_line[fpga_part_idx].split('=')[1];
		else // --fpga-part xxxx
			part = cmd_line[fpga_part_idx + 1];
		ret_status = 1;
		soj_name   = part;
		return [ret_status, "spiOverJtag_" + part + ".bit.gz"];
	}

	// For Xilinx, altera and efinix the board entry MUST
	// provides fpga_part

	var board_index = cmd_line.indexOf("-b");
	if (board_index == -1)
		board_index = cmd_line.indexOf("--board");
	if (board_index != -1) {
		const board_name = cmd_line[board_index + 1];
		const fpga_part  = list_boards[board_name]["fpga_part"];
		search_cmd.push("-b");
		search_cmd.push(board_name);
		if (fpga_part != "Undefined")
			return [2, "spiOverJtag_" + fpga_part + ".bit.gz"];
	}

	// No --fpga_part option nor board or board without
	// fpga_part section: extract information from
	// openFPGALoader with --detect option
	// FIXME: more than one device is not supported.

	// Search for short/long cable argument
	var cable_index = cmd_line.indexOf("-c");
	if (cable_index == -1)
		cable_index = cmd_line.indexOf("--cable");
	if (cable_index != -1) {
		search_cmd.push("-c");
		search_cmd.push(cmd_line[cable_index + 1]);
	}

	if (ret_status != 1 && ret_status != 2) {
		// Executes --detect command to have manufacturer name and
		// FPGA Model
		const ret   = await ofl_exec(search_cmd, oflStatus, [], true, false);
		const lines = ret.lines;

		// Extracts vendor and Model
		const vendor_index = lines.findIndex(findManufacturer);
		const model_index  = lines.findIndex(findModel);

		// No device found
		if (vendor_index == -1)
			return [-3, ""];

		const t = lines[vendor_index].replace(/  +/g, ' ').split(" ")[1].toLowerCase();
		if (t == "xilinx") {
			if (ret_status == 0) {
				var tt       = lines[model_index].replace(/  +/g, ' ').split(" ")[1];
				// Only Xilinx Artix7 and Spartan7 have a generic spiOverJtag bitstream
				// per size.
				if (!(tt.includes("xc7a") || tt.includes("xc7s")))
					return [-1, ""];
				if (tt == "xc7a35")
					tt = "xc7a35t";
				soj_name   = "spiOverJtag_" + tt + ".bit.gz";
				ret_status = 3;
				console.log(tt);
				console.log("requires spiOverJtag: "+ soj_name);
			}
		// For Efinix & Altera FPGA model must be fully provided
		} else if (t == "efinix" || t == "altera") {
			console.log("Error: spiOverJtag bitstream must be specified");
			return [-1, ""];
		}
		// Nothing to do for FPGA with internal SPI Flash access logic.
	}

	return [ret_status, soj_name]
}
function findManufacturer(l) {
	return l.includes("manufacturer");
}
function findModel(l) {
	return l.includes("model");
}
// ------------------ Helpers ------------------ //

// Fetch spiOverJtag bitstream from the server
async function readBinaryFileFromUrl(url) {
	try {
		const response = await fetch(url);
		if (!response.ok)
			throw new Error(`HTTP error! status: ${response.status}`);
		const arrayBuffer = await response.arrayBuffer();
		const uint8Array = new Uint8Array(arrayBuffer);
		return uint8Array;
	} catch (error) {
		console.error('Error reading file:', error);
		return null;
	}
}

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
