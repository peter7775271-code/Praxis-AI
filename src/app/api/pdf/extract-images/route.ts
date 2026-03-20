import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { execFile } from 'child_process';
import { constants } from 'fs';
import { promisify } from 'util';

export const runtime = 'nodejs';

const execFileAsync = promisify(execFile);
const PDFTOCAIRO_PATH = process.env.PDFTOCAIRO_PATH ?? '/usr/bin/pdftocairo';

type ExtractionResult = {
  pageNumber: number;
  width: number;
  height: number;
  filename: string;
  base64: string;
};

function parsePageFromFilename(filename: string): number {
  const match = filename.match(/(?:page-|page_)(\d+)\.jpe?g$/i);
  if (!match) {
    return 0;
  }
  return parseInt(match[1], 10) || 0;
}

async function convertPdfPagesToJpg(buffer: Buffer, maxPages?: number): Promise<ExtractionResult[]> {
  const tmpRoot = path.join(process.cwd(), '.tmp-pdf-images');
  const id = randomUUID();
  const pdfPath = path.join(tmpRoot, `${id}.pdf`);
  const outDir = path.join(tmpRoot, `${id}-images`);
  const outputPrefix = path.join(outDir, 'page');

  await fs.mkdir(tmpRoot, { recursive: true });
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(pdfPath, buffer);

  try {
    await fs.access(PDFTOCAIRO_PATH, constants.X_OK);
  } catch {
    throw new Error(`pdftocairo is not executable at ${PDFTOCAIRO_PATH}`);
  }

  const args = ['-jpeg', '-r', '180'];
  if (typeof maxPages === 'number' && maxPages > 0) {
    args.push('-f', '1', '-l', String(maxPages));
  }
  args.push(pdfPath, outputPrefix);

  try {
    await execFileAsync(PDFTOCAIRO_PATH, args);
  } catch (err) {
    const stderr = err && typeof err === 'object' && 'stderr' in err ? String((err as { stderr?: unknown }).stderr ?? '') : '';
    const message = stderr.trim() || 'Failed to convert PDF pages to JPG';
    throw new Error(message);
  }

  const files = await fs.readdir(outDir);
  const imageFiles = files
    .filter((f) => f.toLowerCase().endsWith('.jpeg') || f.toLowerCase().endsWith('.jpg'))
    .sort((a, b) => parsePageFromFilename(a) - parsePageFromFilename(b));

  const limitedFiles = typeof maxPages === 'number' ? imageFiles.slice(0, maxPages) : imageFiles;

  const results: ExtractionResult[] = [];

  for (const filename of limitedFiles) {
    const fullPath = path.join(outDir, filename);
    const data = await fs.readFile(fullPath);
    const meta = await sharp(data).metadata();

    results.push({
      pageNumber: parsePageFromFilename(filename),
      width: meta.width || 0,
      height: meta.height || 0,
      filename,
      base64: data.toString('base64'),
    });
  }

  try {
    await fs.rm(outDir, { recursive: true, force: true });
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
    const maxPagesParam = formData.get('maxPages') as string | null;

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

    const maxPages = maxPagesParam ? parseInt(maxPagesParam, 10) : undefined;

    const arrayBuffer = await pdfFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const images = await convertPdfPagesToJpg(buffer, maxPages);

    if (images.length === 0) {
      return NextResponse.json(
        {
          success: true,
          message: 'No pages were converted from the PDF',
          images: [],
          count: 0
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: `Converted ${images.length} PDF page(s) to JPG`,
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
      message: 'PDF to JPG Conversion API',
      usage: {
        method: 'POST',
        endpoint: '/api/pdf/extract-images',
        contentType: 'multipart/form-data',
        parameters: {
          pdf: 'Required. PDF file to convert',
          maxPages: 'Optional. Maximum number of pages to convert (default: all)'
        },
        example: {
          curl: 'curl -X POST -F "pdf=@exam.pdf" -F "maxPages=10" http://localhost:3000/api/pdf/extract-images'
        }
      }
    },
    { status: 200 }
  );
}
