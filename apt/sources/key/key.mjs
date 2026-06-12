import { writeFile } from 'node:fs/promises';
import { text } from 'node:stream/consumers';

const crc24 = function() {
	const table = new Int32Array(256);
	for (let ii = 0; ii < 256; ++ii) {
		let crc = ii << 16;
		for (let jj = 0; jj < 8; ++jj) {
			crc <<= 1;
			if (crc & 0x1000000) {
				crc ^= 0x1864cfb;
			}
		}
		table[ii] = crc;
	}

	return data => {
		let crc = 0xb704ce;
		for (let ii = 0; ii < data.length; ++ii) {
			crc ^= data[ii] << 16;
			crc = (table[(crc >> 16) & 0xff] ^ (crc << 8)) & 0xffffff;
		}
		return crc;
	}
}();

function dearmor(input) {
	const lines = input.split('\n').map(line => line.replace(/\r$/, ''));
	let start = lines.findIndex(line => line.startsWith('-----BEGIN')) + 1;
	if (lines[start] === '') {
		++start;
	}
	const end = lines.findIndex(line => line.startsWith('-----END '));
	if (start === -1 || end === -1) {
		throw new Error('Unexpected end of armored data');
	}
	const body = lines.slice(start, end);
	const crcText = body.find(line => line.startsWith('='));
	const binary =
		Buffer.concat(body.filter(line => !line.startsWith('=')).map(line => Buffer.from(line, 'base64')));
	if (crcText !== undefined) {
		const buffer = Buffer.from(crcText.slice(1), 'base64');
		const crcInt24 = (buffer[0] << 16) | (buffer[1] << 8) | buffer[2];
		const computed = crc24(binary);
		if (computed !== crcInt24) {
			throw new Error(`CRC mismatch: expected ${crcInt24.toString(16)}, got ${computed.toString(16)}`);
		}
	}
	return binary;
}

const key = await fetch(process.env['INPUT_URL']);
const result = dearmor(await key.text());
await writeFile(process.env['GITHUB_OUTPUT'], `key=${result.toString('base64')}\n`, { flag: 'a' });
