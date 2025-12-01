const fs = require('fs');
const steggy = require('steggy');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');
const mime = require('mime-types');

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

// Function to generate SHA-256 hash from a string
function generateStringHash(str) {
    const hashSum = crypto.createHash('sha256');
    hashSum.update(str);
    return hashSum.digest('hex');
}

// Helper function to normalize dashes
function normalizeDashes(str) {
    return str.replace(/–/g, '-');
}

// Function to extract number from filename
function extractNumber(filename) {
    const match = filename.match(/#(\d+)/);
    return match ? parseInt(match[1]) : Infinity;
}

// Function to save image and update JSON files
async function saveAndUpdateMetadata(input, dataUri, revealedData, isInputFile) {
    const imagesDir = path.join(__dirname, 'images');
    const steggyDir = path.join(imagesDir, 'steggy');
    const metadataDir = path.join(__dirname, 'metadata');
    
    // Ensure directories exist
    if (!fs.existsSync(steggyDir)) {
        fs.mkdirSync(steggyDir, { recursive: true });
    }
    if (!fs.existsSync(metadataDir)) {
        fs.mkdirSync(metadataDir, { recursive: true });
    }

    // Generate SHA and URIs
    const uriSha = generateStringHash(dataUri);
    const hexUri = '0x' + Buffer.from(dataUri).toString('hex');
    
    // Save image in images/steggy directory
    const imageFilename = `${uriSha}_steggy.png`;
    const imagePath = path.join(steggyDir, imageFilename);
    
    // If input is a file, copy it directly. Otherwise, decode from Data URI
    if (isInputFile) {
        // Copy the existing file to preserve quality
        fs.copyFileSync(input, imagePath);
    } else {
        // Decode from Data URI and save
        const imageBuffer = dataUriToBuffer(dataUri);
        fs.writeFileSync(imagePath, imageBuffer);
    }
    
    // Parse revealed data to determine if honorary and extract stats
    let isHonorary = false;
    let stats;
    let notableTrait = '';
    
    if (Array.isArray(revealedData)) {
        // Non-honorary format: [{"P/S":41},{"S/A":84},{"W/M":45}]
        isHonorary = false;
        stats = {
            power: revealedData[0]["P/S"],
            speed: revealedData[1]["S/A"],
            wisdom: revealedData[2]["W/M"]
        };
    } else {
        // Honorary format: {"Name": "Trait", "Stats": [...]}
        isHonorary = true;
        const keys = Object.keys(revealedData);
        const nameFromData = keys.find(k => k !== 'Stats') || '';
        notableTrait = revealedData[nameFromData] || '';
        stats = {
            power: revealedData.Stats[0]["P/S"],
            speed: revealedData.Stats[1]["S/A"],
            wisdom: revealedData.Stats[2]["W/M"]
        };
    }
    
    // Determine the name based on input type
    let metadataName = "";
    
    if (isInputFile) {
        // Extract name from original file path
        const originalFilename = path.basename(input);
        const nameWithoutExt = path.parse(originalFilename).name;
        metadataName = normalizeDashes(nameWithoutExt);
    } else {
        // Prompt for name when input is Data URI or hex
        const nameInput = await askQuestion('Enter name for metadata (or press Enter to leave empty): ');
        metadataName = nameInput.trim();
    }
    
    // Use the saved image filename for URIHEXSHA
    const normalizedFilename = normalizeDashes(imageFilename);
    
    // Load existing metadata
    const metadataPath = path.join(metadataDir, 'metadata.json');
    const urihexshaPath = path.join(metadataDir, 'URIHEXSHA.json');
    
    let metadataArray = [];
    if (fs.existsSync(metadataPath)) {
        const fileContent = fs.readFileSync(metadataPath, 'utf8');
        metadataArray = JSON.parse(fileContent);
    }
    
    let urihexshaData = {};
    if (fs.existsSync(urihexshaPath)) {
        const fileContent = fs.readFileSync(urihexshaPath, 'utf8');
        urihexshaData = JSON.parse(fileContent);
    }
    
    // Determine the next index based on current metadata
    const nextIndex = metadataArray.length > 0 
        ? Math.max(...metadataArray.map(item => item.index)) + 1 
        : 0;
    
    // Build attributes array
    const attributes = [];
    if (isHonorary) {
        attributes.push({
            "trait_type": "Notable",
            "value": notableTrait
        });
    }
    attributes.push(
        {
            "trait_type": "Power/Strength",
            "value": stats.power
        },
        {
            "trait_type": "Speed/Agility",
            "value": stats.speed
        },
        {
            "trait_type": "Wisdom/Magic",
            "value": stats.wisdom
        }
    );
    
    // Check if this SHA already exists
    const existingEntryIndex = metadataArray.findIndex(item => item.sha === uriSha);
    let willReplace = false;
    let existingEntry = null;
    
    if (existingEntryIndex !== -1) {
        existingEntry = metadataArray[existingEntryIndex];
        console.log('\n⚠️  WARNING: This SHA already exists in metadata!');
        console.log('\nExisting entry:');
        console.log(JSON.stringify(existingEntry, null, 2));
        
        const replaceConfirm = await askQuestion('\nReplace existing entry? (y/n): ');
        if (replaceConfirm.trim().toLowerCase() !== 'y') {
            console.log('Cancelled. No files were updated.');
            return;
        }
        willReplace = true;
    }
    
    // Create metadata entry
    const newMetadataEntry = {
        id: "",
        index: willReplace ? existingEntry.index : nextIndex,
        sha: uriSha,
        name: metadataName,
        description: "",
        ethscription_number: "",
        attributes: attributes
    };
    
    // Display what will be added/replaced
    console.log(willReplace ? '\n=== Data to replace existing entry ===' : '\n=== Data to be added ===');
    console.log('\nImage:');
    console.log(`  Saved to: ${imagePath}`);
    console.log('\nMetadata entry:');
    console.log(JSON.stringify(newMetadataEntry, null, 2));
    console.log('\nURIHEXSHA entry:');
    const urihexshaEntry = {
        index: newMetadataEntry.index,
        uri: dataUri.substring(0, 100) + '...', // Show truncated for display
        uri_hex: hexUri.substring(0, 100) + '...',
        sha: uriSha
    };
    console.log(JSON.stringify({ [normalizedFilename]: urihexshaEntry }, null, 2));
    
    // Confirm
    const confirmMessage = willReplace 
        ? '\nConfirm replacement? (y/n): ' 
        : '\nAdd this data to metadata files? (y/n): ';
    const confirm = await askQuestion(confirmMessage);
    if (confirm.trim().toLowerCase() !== 'y') {
        console.log('Cancelled. No files were updated.');
        return;
    }
    
    // Update or add metadata entry
    if (willReplace) {
        // Replace existing entry, preserving its index
        metadataArray[existingEntryIndex] = newMetadataEntry;
    } else {
        metadataArray.push(newMetadataEntry);
    }
    
    // Sort by index and update indices
    metadataArray.sort((a, b) => a.index - b.index);
    
    metadataArray = metadataArray.map((item, index) => ({
        ...item,
        index: index
    }));
    
    // Find updated entry for URIHEXSHA
    const metadataEntry = metadataArray.find(item => item.sha === uriSha);
    
    // Update URIHEXSHA
    urihexshaData[normalizedFilename] = {
        index: metadataEntry.index,
        uri: dataUri,
        uri_hex: hexUri,
        sha: uriSha
    };
    
    // Sort URIHEXSHA entries by index
    const sortedUrihexshaData = Object.fromEntries(
        Object.entries(urihexshaData)
            .sort(([, a], [, b]) => a.index - b.index)
    );
    
    // Write files
    fs.writeFileSync(metadataPath, JSON.stringify(metadataArray, null, 2));
    fs.writeFileSync(urihexshaPath, JSON.stringify(sortedUrihexshaData, null, 2));
    
    console.log('\n✓ Successfully updated metadata files!');
    console.log(`  - ${metadataPath}`);
    console.log(`  - ${urihexshaPath}`);
}

async function revealData(input) {
    let buffer;
    let dataUri;
    let isInputFile = false;
    
    if (isHexString(input)) {
        dataUri = hexToDataUri(input);
        if (!isDataUri(dataUri)) {
            throw new Error('Invalid hex data: Does not convert to a valid data URI');
        }
        buffer = dataUriToBuffer(dataUri);
    } else if (isDataUri(input)) {
        dataUri = input;
        buffer = dataUriToBuffer(input);
    } else {
        // It's a file path
        isInputFile = true;
        buffer = fs.readFileSync(input);
        
        // Generate Data URI from file
        const mimeType = mime.lookup(input) || 'image/png';
        const base64Content = buffer.toString('base64');
        dataUri = `data:${mimeType};base64,${base64Content}`;
    }

    const originalJSONBuffer = steggy.reveal()(buffer);
    const originalJSONData = originalJSONBuffer.toString();
    const revealedData = JSON.parse(originalJSONData);
    
    console.log('\n=== Revealed Data ===');
    console.log(originalJSONData);
    console.log('====================\n');
    
    // Ask if user wants to save to metadata
    const shouldSave = await askQuestion('Save this data to metadata files? (y/n): ');
    
    if (shouldSave.trim().toLowerCase() === 'y') {
        await saveAndUpdateMetadata(input, dataUri, revealedData, isInputFile);
    } else {
        console.log('Data revealed but not saved to metadata files.');
    }
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

        await revealData(input.trim());
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        rl.close();
    }
}

// Run the script
main();