const fs = require('fs');
const steggy = require('steggy');
const path = require('path');
const mime = require('mime-types');
const crypto = require('crypto');
const readline = require('readline');
const sharp = require('sharp');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Supported image formats
const SUPPORTED_FORMATS = ['jpeg', 'jpg', 'png', 'webp', 'tiff', 'bmp'];

// Helper function to normalize dashes
function normalizeDashes(str) {
    return str.replace(/–/g, '-');
}

// Helper function to check if file is supported
function isSupportedImage(filename) {
    const ext = path.extname(filename).toLowerCase().slice(1);
    return SUPPORTED_FORMATS.includes(ext);
}

// Create a promise-based question function
function askQuestion(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

// Function to convert image to PNG if needed
async function ensurePNG(inputPath) {
    const { dir, name, ext } = path.parse(inputPath);
    const normalizedName = normalizeDashes(name);
    
    // If already PNG, just return the path
    if (ext.toLowerCase() === '.png') {
        return inputPath;
    }

    // Create converted filename
    const convertedPath = path.join(dir, `${normalizedName}_converted.png`);

    try {
        await sharp(inputPath)
            .png()
            .toFile(convertedPath);
        
        return convertedPath;
    } catch (error) {
        throw new Error(`Image conversion failed: ${error.message}`);
    }
}

// Function to generate SHA-256 hash of a file
function generateFileHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

// Function to convert image to Data URI and return both base64 and hex versions
function imageToDataUri(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error('File does not exist');
    }

    const mimeType = mime.lookup(filePath);
    if (!mimeType) {
        throw new Error('Unsupported file type');
    }

    const fileContent = fs.readFileSync(filePath);
    const base64Content = Buffer.from(fileContent).toString('base64');
    const uri = `data:${mimeType};base64,${base64Content}`;
    const hexUri = '0x' + Buffer.from(uri).toString('hex');
    
    return {
        base64Uri: uri,
        hexUri: hexUri
    };
}

// Function to extract number from filename
function extractNumber(filename) {
    const match = filename.match(/#(\d+)/);
    return match ? parseInt(match[1]) : Infinity;
}

// Function to parse filename for metadata
function parseFilename(filename) {
    // Get just the filename without path and extension
    const { name } = path.parse(filename);
    
    // Replace en-dash with hyphen
    const normalizedName = normalizeDashes(name);
    
    const match = normalizedName.match(/(.+)/);
    if (match) {
        return {
            fullName: normalizedName,
            number: extractNumber(normalizedName)
        };
    }
    throw new Error(`Invalid filename format: ${filename}`);
}

// Function to update both JSON files
function updateJsonFiles(filename, uris, hash, parsedFile, stats) {
    const metadataDir = path.join(__dirname, 'metadata');
    
    // Ensure metadata directory exists
    if (!fs.existsSync(metadataDir)) {
        fs.mkdirSync(metadataDir, { recursive: true });
    }
    
    const urihexPath = path.join(metadataDir, 'URIHEX.json');
    const metadataPath = path.join(metadataDir, 'metadata.json');
    
    // Handle metadata.json first
    let metadataArray = [];
    if (fs.existsSync(metadataPath)) {
        const fileContent = fs.readFileSync(metadataPath, 'utf8');
        metadataArray = JSON.parse(fileContent);
    }

    // Create new metadata entry
    const newMetadataEntry = {
        id: "",
        index: 0, // Will be updated after sorting
        sha: hash,
        name: parsedFile.fullName,
        description: "",
        ethscription_number: "",
        attributes: [
            {
                "trait_type": "Notable",
                "value": normalizeDashes(parsedFile.fullName.split('-').pop().trim())
            },
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
        ]
    };

    // Add or update metadata entry
    const existingIndex = metadataArray.findIndex(item => 
        item.name === newMetadataEntry.name
    );

    if (existingIndex !== -1) {
        metadataArray[existingIndex] = newMetadataEntry;
    } else {
        metadataArray.push(newMetadataEntry);
    }

    // Sort metadata array by the number in the name
    metadataArray.sort((a, b) => {
        const numA = extractNumber(a.name);
        const numB = extractNumber(b.name);
        return numA - numB;
    });

    // Update IDs based on position
    metadataArray = metadataArray.map((item, index) => ({
        ...item,
        index: index
    }));

    // Handle URIHEX.json
    let urihexData = {};
    if (fs.existsSync(urihexPath)) {
        const fileContent = fs.readFileSync(urihexPath, 'utf8');
        urihexData = JSON.parse(fileContent);
    }

    // Find the corresponding ID from metadata for this file
    const metadataEntry = metadataArray.find(item => 
        item.name === parsedFile.fullName
    );

    // Update URIHEX data with ID
    const normalizedFilename = normalizeDashes(path.basename(filename));
    urihexData[normalizedFilename] = {
        index: metadataEntry.index,
        uri: uris.base64Uri,
        uri_hex: uris.hexUri
    };

    // Sort URIHEX entries
    const sortedUrihexData = Object.fromEntries(
        Object.entries(urihexData)
            .sort(([filenameA], [filenameB]) => {
                const numA = extractNumber(filenameA);
                const numB = extractNumber(filenameB);
                return numA - numB;
            })
    );

    // Write both files
    fs.writeFileSync(urihexPath, JSON.stringify(sortedUrihexData, null, 2));
    fs.writeFileSync(metadataPath, JSON.stringify(metadataArray, null, 2));

    return {
        urihexPath,
        metadataPath
    };
}

// Main async function to handle the process
async function main() {
    try {
        // Get image path from user
        const originalImagePath = await askQuestion('Enter the path to your image file: ');

        if (!fs.existsSync(originalImagePath)) {
            throw new Error('File does not exist');
        }

        if (!isSupportedImage(originalImagePath)) {
            throw new Error(`Unsupported image format. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`);
        }

        // Convert to PNG if needed and get the working path
        const workingImagePath = await ensurePNG(originalImagePath);

        // Get filename without extension for the final steggy output
        const { name } = path.parse(workingImagePath);
        const normalizedName = normalizeDashes(name);
        
        // Create images directory if it doesn't exist
        const imagesDir = path.join(__dirname, 'images');
        if (!fs.existsSync(imagesDir)) {
            fs.mkdirSync(imagesDir, { recursive: true });
        }
        
        // Create the output path in images directory with "_steggy" appended to the filename
        const imageOutputPath = path.join(imagesDir, `${normalizedName}_steggy.png`);

        // Parse filename for metadata (using original filename to maintain naming convention)
        const parsedFile = parseFilename(originalImagePath);

        // Prompt for stats range
        const statsRangeInput = await askQuestion('Enter stats range (min-max, or press Enter for default 1-99): ');
        
        let minStat = 1;
        let maxStat = 99;
        let useDefaultRange = false;
        
        if (statsRangeInput.trim()) {
            const rangeMatch = statsRangeInput.trim().match(/^(-?\d+)-(-?\d+)$/);
            if (rangeMatch) {
                minStat = parseInt(rangeMatch[1]);
                maxStat = parseInt(rangeMatch[2]);
                
                if (minStat >= maxStat) {
                    throw new Error('Minimum value must be less than maximum value');
                }
            } else {
                throw new Error('Invalid range format. Use format: min-max (e.g., 1-99 or -45-4839)');
            }
        } else {
            useDefaultRange = true;
        }

        let stats;
        
        // If using default range, offer manual stat entry
        if (useDefaultRange) {
            const manualEntry = await askQuestion('Enter stats manually? (y/n, or press Enter for random): ');
            
            if (manualEntry.trim().toLowerCase() === 'y') {
                const powerInput = await askQuestion('Enter Power/Strength value: ');
                const speedInput = await askQuestion('Enter Speed/Agility value: ');
                const wisdomInput = await askQuestion('Enter Wisdom/Magic value: ');
                
                const power = parseInt(powerInput.trim());
                const speed = parseInt(speedInput.trim());
                const wisdom = parseInt(wisdomInput.trim());
                
                if (isNaN(power) || isNaN(speed) || isNaN(wisdom)) {
                    throw new Error('All stat values must be valid integers');
                }
                
                stats = { power, speed, wisdom };
            } else {
                // Generate random stats within the default range
                const range = maxStat - minStat;
                stats = {
                    power: Math.floor(Math.random() * (range + 1)) + minStat,
                    speed: Math.floor(Math.random() * (range + 1)) + minStat,
                    wisdom: Math.floor(Math.random() * (range + 1)) + minStat
                };
            }
        } else {
            // Generate random stats within the specified range
            const range = maxStat - minStat;
            stats = {
                power: Math.floor(Math.random() * (range + 1)) + minStat,
                speed: Math.floor(Math.random() * (range + 1)) + minStat,
                wisdom: Math.floor(Math.random() * (range + 1)) + minStat
            };
        }

        // Process image with compression before steganography
        const rawBuffer = fs.readFileSync(workingImagePath);
        const workingImageBuffer = await sharp(rawBuffer)
            .png({
                compressionLevel: 9,
                adaptiveFiltering: true,
                force: true
            })
            .toBuffer();

        const fileContent = Buffer.from(JSON.stringify({
            [parsedFile.fullName]: normalizeDashes(parsedFile.fullName.split('-').pop().trim()),
            Stats: [{ "P/S": stats.power }, { "S/A": stats.speed }, { "W/M": stats.wisdom }]
        }));

        // Embed data in image
        const embeddedBuffer = steggy.conceal()(workingImageBuffer, fileContent);
        fs.writeFileSync(imageOutputPath, embeddedBuffer);

        // Clean up converted file if it was created
        if (workingImagePath !== originalImagePath) {
            fs.unlinkSync(workingImagePath);
        }

        // Generate URI and hash
        const uris = imageToDataUri(imageOutputPath);
        const hash = generateFileHash(imageOutputPath);

        // Update JSON files
        const { urihexPath, metadataPath } = updateJsonFiles(
            imageOutputPath,
            uris,
            hash,
            parsedFile,
            stats
        );

        console.log('Processing complete:');
        console.log('- Original image:', originalImagePath);
        console.log('- Steganography image saved to:', imageOutputPath);
        console.log('- URIHEX data saved to:', urihexPath);
        console.log('- Metadata saved to:', metadataPath);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        rl.close();
    }
}

// Run the main function
main();