# PDF Image Extraction Guide

I've created a complete solution for extracting images from PDF files and viewing them as JPEGs. Here are all the options available:

## 🎯 Quick Start

### Option 1: Web UI (Easiest)
1. Start your dev server: `npm run dev`
2. Go to `http://localhost:3000/pdf-extractor`
3. Upload a PDF and view/download extracted images

### Option 2: Command-Line Script
```bash
node scripts/extract-pdf-images.js <pdf-file> [output-dir]
```

**Examples:**
```bash
# Extract to default directory (./extracted-images)
node scripts/extract-pdf-images.js exam.pdf

# Extract to custom directory
node scripts/extract-pdf-images.js exam.pdf ./my-images

# Extract exam images from pdf-ingest uploads
node scripts/extract-pdf-images.js ~/Downloads/paper.pdf ./public/extracted-images
```

### Option 3: API Endpoint
```bash
curl -X POST -F "pdf=@exam.pdf" http://localhost:3000/api/pdf/extract-images
```

**With limits:**
```bash
curl -X POST -F "pdf=@exam.pdf" -F "maxImages=10" http://localhost:3000/api/pdf/extract-images
```

---

## 📋 What Each Component Does

### 1. **Frontend Component** (`src/components/PdfImageExtractor.tsx`)
- ✅ Drag-and-drop PDF upload
- ✅ Extract specific number of images (optional limit)
- ✅ Preview extracted images in grid view
- ✅ Download individual images or view full-size
- ✅ Shows image dimensions and page numbers

**Access at:** `/pdf-extractor` page

---

### 2. **API Route** (`src/app/api/pdf/extract-images/route.ts`)
- ✅ POST endpoint to extract images from PDFs
- ✅ Returns base64-encoded JPEG images
- ✅ Supports `maxImages` parameter to limit extraction
- ✅ JSON response with image metadata

**Endpoint:** `POST /api/pdf/extract-images`

**Example Response:**
```json
{
  "success": true,
  "message": "Extracted 3 image(s) from PDF",
  "images": [
    {
      "filename": "page_1_img_1.jpeg",
      "pageNumber": 1,
      "width": 800,
      "height": 600,
      "base64": "...",
      "contentType": "image/jpeg"
    }
  ],
  "count": 3
}
```

---

### 3. **Node.js Script** (`scripts/extract-pdf-images.js`)
- ✅ Standalone command-line tool
- ✅ Saves extracted images to disk as JPEGs
- ✅ Detailed extraction statistics
- ✅ Error handling and reporting

**Output:**
```
📄 Loading PDF: exam.pdf
✓ PDF loaded - 5 pages
✓ Extracted: page_001_img_1.jpeg (800x600)
✓ Extracted: page_001_img_2.jpeg (400x300)
...
📊 EXTRACTION SUMMARY
==================================================
Pages processed: 5
Images extracted: 8
Output directory: /home/peter/project/extracted-images
```

---

## 🔧 Integration with pdf-ingest Route

To use image extraction with the existing pdf-ingest route:

1. **Extract images first:**
   ```bash
   node scripts/extract-pdf-images.js exam.pdf ./pdf-images
   ```

2. **Then upload to pdf-ingest with images:**
   - Go to the HSC ingest dashboard
   - Upload the PDF
   - Also upload the extracted JPEG images
   - The route will process both the text and images together

---

## 📊 Features & Limitations

### ✅ What Works
- PDFs with embedded images (diagrams, photos, graphs)
- Automatic JPEG compression (quality: 85)
- Preserves original dimensions
- Multiple images per page
- Error handling and reporting

### ⚠️ Limitations
- **Scanned PDFs**: If your PDF is a scanned document (image-based), this tool may not work. Use alternatives like:
  - `pdfimages` command-line tool
  - `ghostscript` (gs command)
  - Online tools like ilovepdf.com

- **Text-only PDFs**: PDFs with only text and no images will return empty results

- **PDF Security**: Password-protected or encrypted PDFs won't work

- **Complex Layouts**: PDFs with complex multi-layer content may have issues

---

## 🖼️ Supported PDF Types

| PDF Type | Supported | Notes |
|----------|-----------|-------|
| Embedded images | ✅ Yes | Direct extraction |
| Charts/Graphs | ✅ Yes | As drawn vector objects |
| Text-only | ❌ No | No images to extract |
| Scanned documents | ⚠️ Limited | Use alternative tools |
| Password-protected | ❌ No | Remove protection first |

---

## 💡 Usage Examples

### Example 1: Extract First 10 Images from an Exam Paper
```bash
node scripts/extract-pdf-images.js "2024 HSC Paper.pdf" ./extracted
```

### Example 2: Using the Web UI
1. Navigate to http://localhost:3000/pdf-extractor
2. Click "Select PDF File"
3. Choose your PDF
4. (Optional) Set "Max Images to Extract" to 10
5. Click "Extract Images"
6. Download individual images or click "Download All"

### Example 3: Batch Processing Multiple PDFs
```bash
for pdf in *.pdf; do
  node scripts/extract-pdf-images.js "$pdf" "./extracted/${pdf%.*}"
done
```

### Example 4: API Usage with JavaScript
```javascript
const formData = new FormData();
formData.append('pdf', pdfFile);
formData.append('maxImages', '5');

const response = await fetch('/api/pdf/extract-images', {
  method: 'POST',
  body: formData
});

const data = await response.json();
console.log(`Extracted ${data.count} images`);

// Use the images
data.images.forEach(img => {
  const imgElement = document.createElement('img');
  imgElement.src = `data:${img.contentType};base64,${img.base64}`;
  document.body.appendChild(imgElement);
});
```

---

## 🚀 Troubleshooting

### "No extractable images found"
- The PDF might be text-only or scanned
- Try: `pdfimages exam.pdf output`

### "PDF parsing failed"
- File might be corrupted or encrypted
- Try opening it in a PDF reader first

### "Out of memory"
- PDF might be very large
- Limit extraction: `maxImages=5`

### Images look low quality
- Quality is set to 85 (good balance of size/quality)
- Edit `/src/app/api/pdf/extract-images/route.ts` line 62 to adjust

---

## 📚 Additional Commands

### Check PDF info before extraction
```bash
pdfinfo exam.pdf
```

### Alternative extraction tools
```bash
# Using pdfimages (if installed)
pdfimages exam.pdf output

# Using ghostscript
gs -q -dBATCH -dNOPAUSE -sDEVICE=jpeg -sOutputFile=page_%d.jpg exam.pdf
```

### View extracted images
```bash
# Open folder
open ./extracted-images  # macOS
explorer ./extracted-images  # Windows
```

---

## 🔌 Technical Details

- **Library**: pdf.js-dist for PDF parsing
- **Image Processing**: Sharp for JPEG encoding
- **Format**: Base64-encoded JPEGs returned via API
- **Worker**: Configured with disable-worker for Node.js
- **Quality**: 85% JPEG quality (configurable)

All dependencies are already in your `package.json`:
- `pdfjs-dist`: ^5.4.530
- `sharp`: ^0.34.5
