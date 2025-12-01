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
7. Embeds JSON metadata into the image using steganography
8. Creates an optimized PNG with `_steggy` suffix
9. Generates SHA-256 hash of the output image
10. Creates Data URIs in both base64 and hexadecimal formats
11. Generates SHA-256 hash of the base64 Data URI
12. Updates `metadata.json` and `URIHEXSHA.json` files

**File Naming Convention:**
- Images should include `#N` in the filename (e.g., `Character Name #42.png`)
- En-dashes (–) are automatically normalized to hyphens (-)

**Output Files:**
- `images/[filename]_steggy.png`: Image with embedded metadata (saved in images/ directory)
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

The tool will automatically detect the input type and extract the embedded JSON data.

## Project Structure

```
steggy-metadata-injector/
├── imgInjector.js          # Main injection script
├── imgRevealer.js          # Data extraction script
├── package.json            # Project dependencies
├── images/                 # Directory for processed images
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
    "sha": "sha256-hash-of-image",
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
    "sha": "sha256-hash-of-image",
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
Enter stats range (min-max, or press Enter for default 1-99): 50-150

Processing complete:
- Original image: ./images/Dragon #1.png
- Steganography image saved to: ./images/Dragon #1_steggy.png
- URIHEXSHA data saved to: ./metadata/URIHEXSHA.json
- Metadata saved to: ./metadata/metadata.json
```

### Revealing Metadata

```bash
$ yarn reveal
Enter your input (file path, data URI, or hex): ./images/Dragon #1_steggy.png

{"Dragon #1":"Dragon","Stats":[{"P/S":85},{"S/A":92},{"W/M":78}]}
```

## Notes

- The injector automatically handles dash normalization (en-dash → hyphen)
- Stats can be entered manually or generated randomly
- For random stats, range is fully customizable (default: 1-99)
  - Supports any integer range including negative values
  - Format: `min-max` (e.g., `1-99`, `-45-4839`, `50-150`)
- Manual stat entry accepts any integer value (including negatives)
- Files are automatically sorted by their number (#N) in the filename
- Converted images are cleaned up after processing
- Original files are never modified

## License

See LICENSE.txt for details.
