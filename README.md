# Steggy Metadata Injector

A Node.js toolkit for embedding and extracting metadata in images using steganography. This tool processes collection images with embedded JSON metadata, generates Data URIs (both base64 and hex formats), and reveals hidden data from steganography-encoded images.

## Features

- **Steganographic Data Embedding**: Embed JSON metadata invisibly into PNG images
- **Multi-Format Support**: Automatically converts JPEG, WebP, TIFF, and BMP to PNG
- **Data URI Generation**: Creates both base64 and hexadecimal Data URIs
- **Metadata Management**: Automatically manages collection metadata and URI tracking
- **File Hash Generation**: SHA-256 hashing for data integrity
- **Data Extraction**: Reveal embedded JSON data from images, Data URIs, or hex strings
- **Automatic Sorting**: Maintains numerical order in metadata collections

## Requirements

- Node.js >= 20.18.0
- Yarn or npm

## Installation

```bash
yarn install
```

or

```bash
npm install
```

## Dependencies

- **steggy**: Steganography library for embedding/extracting data
- **sharp**: High-performance image processing
- **mime-types**: MIME type detection for Data URI generation

## Usage

### Injecting Metadata into Images

Process an image and embed metadata:

```bash
yarn inject
```

or

```bash
npm run inject
```

**What it does:**
1. Prompts for an image file path
2. Converts the image to PNG if necessary (supports JPEG, WebP, TIFF, BMP)
3. Asks whether to enter stats manually or generate randomly
4. If random: prompts for a stats range (default: 1-99, supports any range including negative values)
5. If manual: prompts for exact values for Power/Strength, Speed/Agility, and Wisdom/Magic
6. Prompts whether this is an honorary (affects embedded data format)
7. Embeds JSON metadata into the image using steganography
8. Creates an optimized PNG with `_steggy` suffix in `images/steggy/` directory
9. Creates Data URIs in both base64 and hexadecimal formats
10. Generates SHA-256 hash of the base64 Data URI
11. **Checks for duplicate SHA**: Warns if already exists and asks to replace
12. Updates `metadata.json` and `URIHEXSHA.json` files (preserves index on replacement)

**File Naming Convention:**
- Images should include `#N` in the filename (e.g., `Character Name #42.png`)
- En-dashes (–) are automatically normalized to hyphens (-)

**Output Files:**
- `images/steggy/[filename]_steggy.png`: Image with embedded metadata (saved in images/steggy/ directory)
- `metadata/metadata.json`: Collection metadata with traits and stats
- `metadata/URIHEXSHA.json`: Data URIs, hex URIs, and SHA-256 hashes for each processed image

### Revealing Hidden Metadata

Extract embedded data from various sources:

```bash
yarn reveal
```

or

```bash
npm run reveal
```

**Supported Input Types:**
- **File Path**: Path to a steganography-encoded image
- **Data URI**: `data:image/png;base64,iVBORw0KG...`
- **Hex String**: `0x646174613a696d6167...`

**What it does:**
1. Prompts for input (file path, Data URI, or hex string)
2. Extracts and displays the embedded JSON data
3. Asks if you want to save the data to metadata files
4. If yes:
   - Converts input to Data URI format (if not already)
   - Generates SHA-256 hash of the Data URI
   - **If input is a file**: Copies the existing file directly to preserve quality
   - **If input is Data URI/hex**: Decodes and saves as new PNG file
   - Saves to `images/steggy/[SHA]_steggy.png`
   - Auto-detects honorary vs non-honorary format from revealed data
   - **If file input**: Extracts name from filename
   - **If Data URI/hex input**: Prompts for name (or leaves empty)
   - **Checks for duplicate SHA**: Warns if already exists and asks to replace
   - Shows a preview of what will be added/replaced
   - Asks for confirmation before updating files
   - Updates `metadata.json` and `URIHEXSHA.json` with sorted entries (by index)

## Project Structure

```
steggy-metadata-injector/
├── imgInjector.js          # Main injection script
├── imgRevealer.js          # Data extraction script
├── package.json            # Project dependencies
├── images/                 # Directory for processed images
│   └── steggy/             # Steganography-encoded images
└── metadata/               # Metadata output directory
    ├── metadata.json       # Collection metadata
    └── URIHEXSHA.json      # Data URI mappings with SHA hashes
```

## Metadata Format

### metadata.json Structure

**For honoraries:**
```json
[
  {
    "id": "",
    "index": 0,
    "sha": "sha256-hash-of-base64-data-uri",
    "name": "Character Name #1",
    "description": "",
    "ethscription_number": "",
    "attributes": [
      {
        "trait_type": "Notable",
        "value": "Character Trait"
      },
      {
        "trait_type": "Power/Strength",
        "value": 85
      },
      {
        "trait_type": "Speed/Agility",
        "value": 92
      },
      {
        "trait_type": "Wisdom/Magic",
        "value": 78
      }
    ]
  }
]
```

**For non-honoraries:**
```json
[
  {
    "id": "",
    "index": 0,
    "sha": "sha256-hash-of-base64-data-uri",
    "name": "Character Name #1",
    "description": "",
    "ethscription_number": "",
    "attributes": [
      {
        "trait_type": "Power/Strength",
        "value": 85
      },
      {
        "trait_type": "Speed/Agility",
        "value": 92
      },
      {
        "trait_type": "Wisdom/Magic",
        "value": 78
      }
    ]
  }
]
```

### URIHEXSHA.json Structure

```json
{
  "Character Name #1.png": {
    "index": 0,
    "uri": "data:image/png;base64,...",
    "uri_hex": "0x646174613a696d616765...",
    "sha": "sha256-hash-of-base64-uri"
  }
}
```

## Embedded Data Format

Data embedded in images has two formats depending on whether it's an honorary:

**Honorary format:**
```json
{
  "Character Name #1": "Notable Trait",
  "Stats": [
    { "P/S": 85 },
    { "S/A": 92 },
    { "W/M": 78 }
  ]
}
```

**Non-honorary format:**
```json
[
  { "P/S": 41 },
  { "S/A": 84 },
  { "W/M": 45 }
]
```

## Supported Image Formats

- PNG (preferred, no conversion needed)
- JPEG/JPG (auto-converted to PNG)
- WebP (auto-converted to PNG)
- TIFF (auto-converted to PNG)
- BMP (auto-converted to PNG)

## How It Works

### Injection Process

1. **Image Loading**: Reads the source image
2. **Format Conversion**: Converts non-PNG images to PNG format
3. **Compression**: Applies PNG compression (level 9) for optimization
4. **Metadata Generation**: Creates JSON with name, traits, and random stats
5. **Steganography**: Embeds JSON data invisibly into image pixels
6. **URI Generation**: Creates base64 and hex Data URIs
7. **Hash Calculation**: Generates SHA-256 hash for integrity
8. **File Management**: Saves output and updates tracking files

### Revelation Process

1. **Input Detection**: Identifies input type (file, Data URI, or hex)
2. **Buffer Conversion**: Converts input to appropriate buffer format
3. **Data Extraction**: Uses steggy to reveal embedded JSON
4. **Output**: Displays extracted metadata

## Examples

### Injecting Metadata

```bash
$ yarn inject
Enter the path to your image file: ./images/Dragon #1.png
Would you like to enter stats manually? (yes/no): no
Enter stats range (min-max, or press Enter for default 1-99): 50-150
Is this an honorary? (yes/no): no

Processing complete:
- Original image: ./images/Dragon #1.png
- Steganography image saved to: ./images/steggy/Dragon #1_steggy.png
- URIHEXSHA data saved to: ./metadata/URIHEXSHA.json
- Metadata saved to: ./metadata/metadata.json
```

**Duplicate Detection Example:**

```bash
$ yarn inject
Enter the path to your image file: ./images/Dragon #1.png
Would you like to enter stats manually? (yes/no): no
Enter stats range (min-max, or press Enter for default 1-99): 

⚠️  Warning: This SHA already exists in the metadata!
Existing entry:
  Name: Dragon #1
  Index: 1

Do you want to replace the existing entry? (yes/no): yes
✅ Entry replaced successfully!
```

### Revealing Metadata

```bash
$ yarn reveal
Enter your input (file path, data URI, or hex): ./images/steggy/Dragon #1_steggy.png

=== Revealed Data ===
{"Dragon #1":"Dragon","Stats":[{"P/S":85},{"S/A":92},{"W/M":78}]}
====================

Save this data to metadata files? (y/n): y

✓ Image copied to: /path/to/images/steggy/abc123.._steggy.png

=== Data to be added ===

Metadata entry:
{
  "id": "",
  "index": 1,
  "sha": "abc123...",
  "name": "Dragon #1",
  ...
}

URIHEXSHA entry:
{
  "Dragon #1.png": {
    "index": 1,
    "uri": "data:image/png;base64,...",
    ...
  }
}

Add this data to metadata files? (y/n): y

✓ Successfully updated metadata files!
  - /path/to/metadata/metadata.json
  - /path/to/metadata/URIHEXSHA.json
```

**Revealer with Data URI/Hex Input:**

```bash
$ yarn reveal
Enter your input (file path, data URI, or hex): data:image/png;base64,iVBORw0KG...

=== Revealed Data ===
{"Notable":{"Category":"Dragon","Type":"Fire"},"Stats":[{"P/S":85},{"S/A":92},{"W/M":78}]}
====================

Save this data to metadata files? (y/n): y
Enter a name for this (or press Enter to leave empty): Fire Dragon #5

✓ Image decoded and saved to: /path/to/images/steggy/def456.._steggy.png

[Preview and confirmation prompts...]

✓ Successfully updated metadata files!
```

**Duplicate Detection in Revealer:**

```bash
$ yarn reveal
Enter your input (file path, data URI, or hex): ./images/steggy/Dragon #1_steggy.png

=== Revealed Data ===
[...]

Save this data to metadata files? (y/n): y

⚠️  Warning: This SHA already exists in the metadata!
Existing entry:
  Name: Dragon #1
  Index: 1

Do you want to replace the existing entry? (yes/no): no
Operation cancelled.
```
  - /path/to/metadata/URIHEXSHA.json
```

## Notes

- **Duplicate Prevention**: Both injector and revealer check SHA-256 hashes to prevent duplicate entries
  - SHA is calculated from the base64 Data URI (not file hash)
  - Warns when duplicate detected and asks to replace or cancel
  - Replacing an entry preserves the original index number
- **File Quality**: Revealer preserves image quality by copying file directly when input is a file path
  - Only decodes Data URI/hex strings to PNG files
- **Stats Flexibility**: Stats can be entered manually or generated randomly
  - For random: range is fully customizable (default: 1-99)
  - Supports any integer range including negative values
  - Format: `min-max` (e.g., `1-99`, `-45-4839`, `50-150`)
  - Manual entry accepts any integer value (including negatives)
- **Honorary Format**: The "Notable" trait category is only included for honorary entries
- **Name Detection**: Revealer extracts name from filename when input is a file, or prompts for name when input is Data URI/hex
- **File Organization**: 
  - Processed images saved to `images/steggy/` directory
  - Metadata files saved to `metadata/` directory
- **Automatic Features**:
  - Dash normalization (en-dash → hyphen)
  - Files sorted by their number (#N) in filename
  - Converted images cleaned up after processing
  - Original files never modified

## License

See LICENSE.txt for details.
