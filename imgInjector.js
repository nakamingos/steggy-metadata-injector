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

// Function to generate SHA-256 hash from a string
function generateStringHash(str) {
    const hashSum = crypto.createHash('sha256');
    hashSum.update(str);
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
async function updateJsonFiles(filename, uris, hash, parsedFile, stats, isHonorary) {
    const metadataDir = path.join(__dirname, 'metadata');
    
    // Ensure metadata directory exists
    if (!fs.existsSync(metadataDir)) {
        fs.mkdirSync(metadataDir, { recursive: true });
    }
    
    const urihexPath = path.join(metadataDir, 'URIHEXSHA.json');
    const metadataPath = path.join(metadataDir, 'metadata.json');
    
    // Handle metadata.json first
    let metadataArray = [];
    if (fs.existsSync(metadataPath)) {
        const fileContent = fs.readFileSync(metadataPath, 'utf8');
        metadataArray = JSON.parse(fileContent);
    }

    // Create new metadata entry
    const attributes = [];
    
    // Only add Notable trait for honoraries
    if (isHonorary) {
        attributes.push({
            "trait_type": "Notable",
            "value": normalizeDashes(parsedFile.fullName.split('-').pop().trim())
        });
    }
    
    // Add stat attributes
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
    const existingBySha = metadataArray.find(item => item.sha === hash);
    
    if (existingBySha) {
        console.log('\n⚠️  WARNING: This SHA already exists in metadata!');
        console.log('\nExisting entry:');
        console.log(JSON.stringify(existingBySha, null, 2));
        console.log('\nThis means you\'re processing the same image data again.');
        
        const replaceConfirm = await askQuestion('\nReplace existing entry and keep its index? (y/n): ');
        if (replaceConfirm.trim().toLowerCase() !== 'y') {
            console.log('Cancelled. No files were updated.');
            rl.close();
            return { cancelled: true };
        }
    }
    
    const newMetadataEntry = {
        id: "",
        index: existingBySha ? existingBySha.index : 0, // Will be updated after sorting if new
        sha: hash,
        name: parsedFile.fullName,
        description: "",
        ethscription_number: "",
        attributes: attributes
    };

    // Add or update metadata entry
    const existingIndex = metadataArray.findIndex(item => 
        item.sha === hash
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

    // Handle URIHEXSHA.json
    let urihexData = {};
    if (fs.existsSync(urihexPath)) {
        const fileContent = fs.readFileSync(urihexPath, 'utf8');
        urihexData = JSON.parse(fileContent);
    }

    // Find the corresponding ID from metadata for this file
    const metadataEntry = metadataArray.find(item => 
        item.name === parsedFile.fullName
    );

    // Generate SHA-256 hash of the base64 Data URI
    const uriSha = generateStringHash(uris.base64Uri);

    // Update URIHEXSHA data with ID, URIs, and SHA
    const normalizedFilename = normalizeDashes(path.basename(filename));
    urihexData[normalizedFilename] = {
        index: metadataEntry.index,
        uri: uris.base64Uri,
        uri_hex: uris.hexUri,
        sha: uriSha,
        owner: ""
    };

    // Sort URIHEXSHA entries
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
// Function to process a single image
async function processImage(originalImagePath, stats, isHonorary) {
    if (!isSupportedImage(originalImagePath)) {
        console.error(`⚠️  Skipping ${path.basename(originalImagePath)}: Unsupported format`);
        return false;
    }

    // Convert to PNG if needed and get the working path
    const workingImagePath = await ensurePNG(originalImagePath);

    // Get filename without extension for the final steggy output
    const { name } = path.parse(workingImagePath);
    const normalizedName = normalizeDashes(name);
    
    // Create images/steggy directory if it doesn't exist
    const imagesDir = path.join(__dirname, 'images');
    const steggyDir = path.join(imagesDir, 'steggy');
    if (!fs.existsSync(steggyDir)) {
        fs.mkdirSync(steggyDir, { recursive: true });
    }
    
    // Create the output path in images/steggy directory with "_steggy" appended to the filename
    const imageOutputPath = path.join(steggyDir, `${normalizedName}_steggy.png`);

    // Parse filename for metadata (using original filename to maintain naming convention)
    const parsedFile = parseFilename(originalImagePath);

    // Process image with compression before steganography
    const rawBuffer = fs.readFileSync(workingImagePath);
    const workingImageBuffer = await sharp(rawBuffer)
        .png({
            compressionLevel: 9,
            adaptiveFiltering: true,
            force: true
        })
        .toBuffer();

    let embeddedData;
    if (isHonorary) {
        // Honorary format: includes name and trait
        embeddedData = {
            [parsedFile.fullName]: normalizeDashes(parsedFile.fullName.split('-').pop().trim()),
            Stats: [{ "P/S": stats.power }, { "S/A": stats.speed }, { "W/M": stats.wisdom }]
        };
    } else {
        // Non-honorary format: stats only
        embeddedData = [
            { "P/S": stats.power }, 
            { "S/A": stats.speed }, 
            { "W/M": stats.wisdom }
        ];
    }

    const fileContent = Buffer.from(JSON.stringify(embeddedData));

    // Embed data in image
    const embeddedBuffer = steggy.conceal()(workingImageBuffer, fileContent);
    fs.writeFileSync(imageOutputPath, embeddedBuffer);

    // Clean up converted file if it was created
    if (workingImagePath !== originalImagePath) {
        fs.unlinkSync(workingImagePath);
    }

    // Generate URI and hash
    const uris = imageToDataUri(imageOutputPath);
    const hash = generateStringHash(uris.base64Uri);

    // Update JSON files
    const result = await updateJsonFiles(
        imageOutputPath,
        uris,
        hash,
        parsedFile,
        stats,
        isHonorary
    );
    
    // Check if operation was cancelled
    if (result && result.cancelled) {
        return false;
    }
    
    console.log(`✓ Processed: ${parsedFile.fullName}`);
    return true;
}

async function main() {
    try {
        // Get image path from user
        const inputPath = await askQuestion('Enter the path to your image file or directory: ');
        const resolvedPath = path.resolve(inputPath.trim());

        if (!fs.existsSync(resolvedPath)) {
            throw new Error('Path does not exist');
        }

        const pathStats = fs.statSync(resolvedPath);
        let imagePaths = [];

        if (pathStats.isDirectory()) {
            // Read directory and filter for image files (non-recursive)
            const files = fs.readdirSync(resolvedPath);
            imagePaths = files
                .filter(file => isSupportedImage(file))
                .map(file => path.join(resolvedPath, file));
            
            if (imagePaths.length === 0) {
                throw new Error('No supported image files found in directory');
            }
            
            console.log(`\n✓ Found ${imagePaths.length} image(s) to process\n`);
        } else {
            // Single file
            if (!isSupportedImage(resolvedPath)) {
                throw new Error(`Unsupported image format. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`);
            }
            imagePaths = [resolvedPath];
        }

        // Ask if user wants to enter stats manually
        const manualEntry = await askQuestion('Enter stats manually? (y/n, or press Enter for random): ');
        
        let stats;
        
        if (manualEntry.trim().toLowerCase() === 'y') {
            // Manual stat entry
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
            // Prompt for stats range for random generation
            const statsRangeInput = await askQuestion('Enter stats range (min-max, or press Enter for default 1-99): ');
            
            let minStat = 1;
            let maxStat = 99;
            
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
            }
            
            // Generate random stats within the specified range
            const range = maxStat - minStat;
            stats = {
                power: Math.floor(Math.random() * (range + 1)) + minStat,
                speed: Math.floor(Math.random() * (range + 1)) + minStat,
                wisdom: Math.floor(Math.random() * (range + 1)) + minStat
            };
        }

        // Prompt for honorary status
        const isHonoraryInput = await askQuestion('Is this an honorary? (y/n): ');
        const isHonorary = isHonoraryInput.trim().toLowerCase() === 'y';

        // Process all images
        let successCount = 0;
        let failCount = 0;

        for (const imagePath of imagePaths) {
            const success = await processImage(imagePath, stats, isHonorary);
            if (success) {
                successCount++;
            } else {
                failCount++;
            }
        }

        console.log('\n=== Processing Complete ===');
        console.log(`✓ Successfully processed: ${successCount}`);
        if (failCount > 0) {
            console.log(`✗ Failed/Skipped: ${failCount}`);
        }
        console.log(`- Steganography images saved to: ${path.join(__dirname, 'images', 'steggy')}`);
        console.log(`- URIHEXSHA data saved to: ${path.join(__dirname, 'metadata', 'URIHEXSHA.json')}`);
        console.log(`- Metadata saved to: ${path.join(__dirname, 'metadata', 'metadata.json')}`);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        rl.close();
    }
}

// Run the main function
main();