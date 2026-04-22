import fs from 'fs';
import { SPONSOR_IMAGE_BASE64 } from './src/assets-base64.js';

// Extract the raw base64 data
const base64Data = SPONSOR_IMAGE_BASE64.replace(/^data:image\/jpeg;base64,/, "");

// Write to /public/sponsor.jpg
if (!fs.existsSync('./public')) {
    fs.mkdirSync('./public');
}

fs.writeFileSync('./public/sponsor.jpg', base64Data, 'base64');
console.log('Restored sponsor.jpg to /public/sponsor.jpg');
