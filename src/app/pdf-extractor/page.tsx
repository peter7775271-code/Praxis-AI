import { PdfImageExtractor } from '@/components/PdfImageExtractor';

export const metadata = {
  title: 'PDF to JPG Converter',
  description: 'Convert PDF pages to JPG files and preview them'
};

export default function PdfExtractorPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <PdfImageExtractor />
    </div>
  );
}
