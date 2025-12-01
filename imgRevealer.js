const fs = require('fs');
const steggy = require('steggy');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Function to handle user input as a Promise
function askQuestion(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

// Function to generate a unique file name
function generateFileName(baseName, dir, ext, count = 0) {
    const suffix = count ? `_${count}` : '';
    const fileName = `${baseName}${suffix}${ext}`;
    const fullPath = path.join(dir, fileName);

    if (fs.existsSync(fullPath)) {
        return generateFileName(baseName, dir, ext, count + 1);
    }

    return fullPath;
}

function isDataUri(data) {
    return data.startsWith('data:');
}

function isHexString(data) {
    return data.startsWith('0x');
}

function dataUriToBuffer(dataUri) {
    const base64String = dataUri.split(',')[1];
    const buffer = Buffer.from(base64String, 'base64');
    return buffer;
}

function hexToBuffer(hexString) {
    // Remove '0x' prefix and convert to buffer
    const hex = hexString.slice(2);
    const buffer = Buffer.from(hex, 'hex');
    return buffer;
}

function hexToDataUri(hexString) {
    // Convert hex to buffer, then to string to get the data URI
    const buffer = hexToBuffer(hexString);
    return buffer.toString();
}

function revealData(input) {
    let buffer;
    
    if (isHexString(input)) {
        const dataUri = hexToDataUri(input);
        if (!isDataUri(dataUri)) {
            throw new Error('Invalid hex data: Does not convert to a valid data URI');
        }
        buffer = dataUriToBuffer(dataUri);
    } else if (isDataUri(input)) {
        buffer = dataUriToBuffer(input);
    } else {
        buffer = fs.readFileSync(input);
    }

    const outputPath = path.join(__dirname, 'EmbeddedOutput', 'RevealedJSONData');
    const dataOutputPath = generateFileName('revealedJson', outputPath, '.json');

    const originalJSONBuffer = steggy.reveal()(buffer);
    const originalJSONData = originalJSONBuffer.toString();
    console.log(originalJSONData);
}

// Main async function to handle the process
async function main() {
    try {
        const input = await askQuestion(
            'Enter your input (file path, data URI, or hex): '
        );

        if (!input) {
            throw new Error('No input provided');
        }

        revealData(input.trim());
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        rl.close();
    }
}

// Run the script
main();