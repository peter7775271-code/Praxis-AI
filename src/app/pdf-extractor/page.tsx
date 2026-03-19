import { PdfImageExtractor } from '@/components/PdfImageExtractor';

export const metadata = {
  title: 'PDF Image Extractor',
  description: 'Extract images from PDF files'
};

export default function PdfExtractorPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <PdfImageExtractor />
    </div>
  );
}
