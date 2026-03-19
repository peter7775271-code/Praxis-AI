#!/usr/bin/env node

/**
 * Extract images from PDF files and save them as JPEGs.
 * 
 * Usage:
 *   node scripts/extract-pdf-images.js <pdf-file> [output-dir]
 * 
 * Example:
 *   node scripts/extract-pdf-images.js exam.pdf ./extracted-images
 */

const fs = require('fs');
const path = require('path');
const pdfjs = require('pdfjs-dist/legacy/build/pdf.mjs');
const sharp = require('sharp');

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = path.join(
  __dirname,
  '../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'
);

async function extractImagesFromPdf(pdfPath, outputDir = './extracted-images') {
  try {
    // Validate input file
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF file not found: ${pdfPath}`);
    }

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`📄 Loading PDF: ${pdfPath}`);

    // Read PDF file
    const pdfBuffer = fs.readFileSync(pdfPath);
    const data = new Uint8Array(pdfBuffer);

    // Load PDF document
    const doc = await pdfjs.getDocument({ data, disableWorker: true }).promise;
    console.log(`✓ PDF loaded - ${doc.numPages} pages`);

    let totalImagesExtracted = 0;
    const stats = {
      pagesProcessed: 0,
      imagesExtracted: 0,
      errors: []
    };

    // Process each page
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      try {
        const page = await doc.getPage(pageNum);
        const operatorList = await page.getOperatorList();
        const fnArray = operatorList.fnArray;
        const argsArray = operatorList.argsArray;

        stats.pagesProcessed++;

        // Look for image operators (PAINT_IMAGE_X_AT_Y_WITH_WIDTH_AND_HEIGHT)
        for (let i = 0; i < fnArray.length; i++) {
          const fn = fnArray[i];
          
          // Check if this is an image operation (code 92 = PAINT_INLINE_IMAGE_RGB)
          if (fn === 92 || fn === 93 || fn === 94) {
            try {
              const args = argsArray[i];
              const [imgData, width, height] = args;

              if (!imgData) continue;

              // Create image filename
              const imageName = `page_${pageNum.toString().padStart(3, '0')}_img_${stats.imagesExtracted + 1}.jpeg`;
              const imagePath = path.join(outputDir, imageName);

              // Convert PDF image data to buffer and save as JPEG
              const buffer = Buffer.from(imgData);
              
              // Use sharp to convert to JPEG
              await sharp(buffer, {
                raw: {
                  width: Math.round(width),
                  height: Math.round(height),
                  channels: 3
                }
              })
                .jpeg({ quality: 85 })
                .toFile(imagePath);

              console.log(`✓ Extracted: ${imageName} (${width}x${height})`);
              stats.imagesExtracted++;
              totalImagesExtracted++;
            } catch (err) {
              stats.errors.push(`Page ${pageNum}: ${err.message}`);
              continue;
            }
          }
        }

        // Also try extracting via drawImage operations
        const images = await page.getAnnotations();
        if (images && images.length > 0) {
          for (const ann of images) {
            if (ann.subtype === 'Image') {
              try {
                const imageName = `page_${pageNum.toString().padStart(3, '0')}_annotation_${stats.imagesExtracted + 1}.jpeg`;
                const imagePath = path.join(outputDir, imageName);
                console.log(`✓ Found annotation image: ${imageName}`);
              } catch (err) {
                // Skip annotation processing errors
              }
            }
          }
        }
      } catch (err) {
        stats.errors.push(`Page ${pageNum}: ${err.message}`);
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 EXTRACTION SUMMARY');
    console.log('='.repeat(50));
    console.log(`Pages processed: ${stats.pagesProcessed}`);
    console.log(`Images extracted: ${stats.imagesExtracted}`);
    console.log(`Output directory: ${path.resolve(outputDir)}`);
    
    if (stats.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered: ${stats.errors.length}`);
      stats.errors.slice(0, 5).forEach(err => console.log(`  - ${err}`));
      if (stats.errors.length > 5) {
        console.log(`  ... and ${stats.errors.length - 5} more`);
      }
    }

    if (stats.imagesExtracted === 0) {
      console.log('\n⚠️  No images found in PDF. The PDF may use scanned images or embedded content.');
      console.log('Alternative: Use a tool like `pdfimages` or `ghostscript` for PDFs with scanned images.');
    }

    console.log('='.repeat(50) + '\n');

    return stats;
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: node scripts/extract-pdf-images.js <pdf-file> [output-dir]');
  console.log('\nExample:');
  console.log('  node scripts/extract-pdf-images.js exam.pdf ./extracted-images');
  process.exit(1);
}

const pdfFile = args[0];
const outputDir = args[1] || path.join(path.dirname(pdfFile), 'extracted-images');

extractImagesFromPdf(pdfFile, outputDir).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
