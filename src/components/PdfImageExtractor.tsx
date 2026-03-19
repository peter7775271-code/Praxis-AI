'use client';

import { useState, ChangeEvent, FormEvent } from 'react';
import Image from 'next/image';

interface ExtractedImage {
  filename: string;
  pageNumber: number;
  width: number;
  height: number;
  base64: string;
  contentType: string;
}

interface ExtractionResponse {
  success: boolean;
  message: string;
  images: ExtractedImage[];
  count: number;
}

export function PdfImageExtractor() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedImages, setExtractedImages] = useState<ExtractedImage[]>([]);
  const [maxImages, setMaxImages] = useState<string>('');

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const selectedFile = files[0];
      if (selectedFile.type === 'application/pdf') {
        setFile(selectedFile);
        setError(null);
      } else {
        setError('Please select a valid PDF file');
        setFile(null);
      }
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!file) {
      setError('Please select a PDF file');
      return;
    }

    setLoading(true);
    setError(null);
    setExtractedImages([]);

    try {
      const formData = new FormData();
      formData.append('pdf', file);
      if (maxImages) {
        formData.append('maxImages', maxImages);
      }

      const response = await fetch('/api/pdf/extract-images', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to extract images');
      }

      const data: ExtractionResponse = await response.json();

      if (data.success && data.images.length > 0) {
        setExtractedImages(data.images);
      } else {
        setError(data.message || 'No images were extracted from the PDF');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const downloadImage = (image: ExtractedImage) => {
    const link = document.createElement('a');
    link.href = `data:${image.contentType};base64,${image.base64}`;
    link.download = image.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAllAsZip = async () => {
    if (extractedImages.length === 0) return;

    // Simple implementation: create blob URLs for each image
    console.log('Download all feature would require jszip library');
    extractedImages.forEach(img => downloadImage(img));
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">📄 PDF Image Extractor</h1>
        <p className="text-gray-600">Upload a PDF to extract all images as JPEGs</p>
      </div>

      {/* Upload Section */}
      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <div className="space-y-2">
          <label htmlFor="pdf-input" className="block text-sm font-medium">
            Select PDF File
          </label>
          <input
            id="pdf-input"
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            disabled={loading}
            className="block w-full text-sm border border-gray-300 rounded-lg p-3 cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
          />
          {file && (
            <p className="text-sm text-green-600 flex items-center gap-2">
              ✓ {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="max-images" className="block text-sm font-medium">
            Max Images to Extract (Optional)
          </label>
          <input
            id="max-images"
            type="number"
            min="1"
            max="1000"
            value={maxImages}
            onChange={(e) => setMaxImages(e.target.value)}
            disabled={loading}
            placeholder="Leave empty for all images"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={!file || loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:cursor-not-allowed"
        >
          {loading ? '⏳ Extracting Images...' : '🚀 Extract Images'}
        </button>
      </form>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          <p className="font-medium">Error</p>
          <p>{error}</p>
        </div>
      )}

      {/* Results Section */}
      {extractedImages.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">
              ✓ Extracted {extractedImages.length} Image{extractedImages.length !== 1 ? 's' : ''}
            </h2>
            <button
              onClick={downloadAllAsZip}
              className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              ⬇️ Download All
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {extractedImages.map((image, idx) => (
              <div
                key={idx}
                className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Image Preview */}
                <div className="relative bg-gray-100 aspect-square flex items-center justify-center overflow-hidden">
                  <img
                    src={`data:${image.contentType};base64,${image.base64}`}
                    alt={image.filename}
                    className="w-full h-full object-contain"
                  />
                </div>

                {/* Metadata */}
                <div className="p-3 space-y-2">
                  <p className="text-xs text-gray-500 truncate font-mono">
                    {image.filename}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>Page {image.pageNumber}</span>
                    <span>{image.width}×{image.height}px</span>
                  </div>

                  {/* Download Button */}
                  <button
                    onClick={() => downloadImage(image)}
                    className="w-full mt-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 px-2 rounded transition-colors"
                  >
                    ⬇️ Download
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Preview All */}
          <details className="bg-white border border-gray-200 rounded-lg p-4">
            <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
              👀 Full-Size Previews
            </summary>
            <div className="mt-4 space-y-4">
              {extractedImages.map((image, idx) => (
                <div key={idx} className="border-t pt-4">
                  <p className="text-sm font-medium mb-2">{image.filename}</p>
                  <img
                    src={`data:${image.contentType};base64,${image.base64}`}
                    alt={image.filename}
                    className="max-w-full h-auto border border-gray-200 rounded"
                  />
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {/* Empty State */}
      {!loading && extractedImages.length === 0 && !error && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">📤 Upload a PDF to get started</p>
          <p className="text-sm">Select a PDF file and click "Extract Images" to begin</p>
        </div>
      )}
    </div>
  );
}
