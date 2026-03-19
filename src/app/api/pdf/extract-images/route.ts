import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { spawn } from 'child_process';

export const runtime = 'nodejs';

type ExtractionResult = {
  pageNumber: number;
  imageIndex: number;
  width: number;
  height: number;
  filename: string;
  base64: string;
};

async function runExtractScript(tempPdfPath: string, outputDir: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['scripts/extract-pdf-images.js', tempPdfPath, outputDir], {
      cwd: process.cwd(),
      stdio: 'inherit',
    });

    child.on('error', (err) => reject(err));
    child.on('exit', (code) => {
      if (code === 0) {
        resolve([]);
      } else {
        reject(new Error(`extract-pdf-images.js exited with code ${code}`));
      }
    });
  });
}

async function extractImagesWithScript(buffer: Buffer, maxImages?: number): Promise<ExtractionResult[]> {
  const tmpRoot = path.join(process.cwd(), '.tmp-pdf-images');
  const id = randomUUID();
  const pdfPath = path.join(tmpRoot, `${id}.pdf`);
  const outDir = path.join(tmpRoot, `${id}-images`);

  await fs.mkdir(outDir, { recursive: true });
  await fs.mkdir(tmpRoot, { recursive: true });
  await fs.writeFile(pdfPath, buffer);

  await runExtractScript(pdfPath, outDir);

  const files = await fs.readdir(outDir);
  const imageFiles = files.filter((f) => f.toLowerCase().endsWith('.jpeg') || f.toLowerCase().endsWith('.jpg'));

  const limitedFiles = typeof maxImages === 'number' ? imageFiles.slice(0, maxImages) : imageFiles;

  const results: ExtractionResult[] = [];

  for (let index = 0; index < limitedFiles.length; index += 1) {
    const filename = limitedFiles[index];
    const fullPath = path.join(outDir, filename);
    const data = await fs.readFile(fullPath);
    const meta = await sharp(data).metadata();

    const match = filename.match(/page_(\d+)_img_(\d+)/);
    const pageNumber = match ? parseInt(match[1], 10) : 0;
    const imageIndex = match ? parseInt(match[2], 10) - 1 : index;

    results.push({
      pageNumber,
      imageIndex,
      width: meta.width || 0,
      height: meta.height || 0,
      filename,
      base64: data.toString('base64'),
    });
  }

  // Best-effort cleanup; ignore errors
  try {
    await fs.unlink(pdfPath).catch(() => {});
  } catch {}

  return results;
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type');

    if (!contentType?.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Request must be multipart/form-data' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const pdfFile = formData.get('pdf') as File | null;
    const maxImagesParam = formData.get('maxImages') as string | null;

    if (!pdfFile) {
      return NextResponse.json(
        { error: 'PDF file is required' },
        { status: 400 }
      );
    }

    if (!pdfFile.type.includes('pdf')) {
      return NextResponse.json(
        { error: 'File must be a PDF' },
        { status: 400 }
      );
    }

    const maxImages = maxImagesParam ? parseInt(maxImagesParam, 10) : undefined;

    // Read PDF into buffer
    const arrayBuffer = await pdfFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract images
    const images = await extractImagesWithScript(buffer, maxImages);

    if (images.length === 0) {
      return NextResponse.json(
        {
          success: true,
          message: 'No extractable images found in PDF',
          images: [],
          count: 0
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: `Extracted ${images.length} image(s) from PDF`,
        images: images.map(img => ({
          filename: img.filename,
          pageNumber: img.pageNumber,
          width: img.width,
          height: img.height,
          base64: img.base64,
          contentType: 'image/jpeg'
        })),
        count: images.length
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('PDF extraction error:', error);

    const baseMessage = error instanceof Error ? error.message : 'Failed to extract images from PDF';
    const debugInfo =
      process.env.NODE_ENV !== 'production' && error instanceof Error
        ? { name: error.name, stack: error.stack }
        : undefined;

    return NextResponse.json(
      {
        error: baseMessage,
        ...(debugInfo ? { debug: debugInfo } : {}),
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      message: 'PDF Image Extraction API',
      usage: {
        method: 'POST',
        endpoint: '/api/pdf/extract-images',
        contentType: 'multipart/form-data',
        parameters: {
          pdf: 'Required. PDF file to extract images from',
          maxImages: 'Optional. Maximum number of images to extract (default: all)'
        },
        example: {
          curl: 'curl -X POST -F "pdf=@exam.pdf" -F "maxImages=10" http://localhost:3000/api/pdf/extract-images'
        }
      }
    },
    { status: 200 }
  );
}
