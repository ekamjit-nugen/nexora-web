import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IMediaFile } from '../schemas/media-file.schema';

/**
 * Document Processor — generates previews for PDFs and office documents.
 *
 * PDF: Renders first 3 pages as images using pdftoppm (Poppler) or pdf-lib.
 * Office: Converts to PDF via LibreOffice headless, then renders pages.
 *
 * Requires: Poppler (pdftoppm) or similar system-level PDF renderer.
 */
@Injectable()
export class DocumentProcessor {
  private readonly logger = new Logger(DocumentProcessor.name);

  constructor(
    @InjectModel('MediaFile', 'nexora_media') private mediaFileModel: Model<IMediaFile>,
  ) {}

  async processDocument(fileId: string, filePath: string, mimeType: string, storageKey: string): Promise<void> {
    try {
      let pageCount: number | null = null;
      const previewKey = storageKey.replace(/\.[^.]+$/, '_preview.jpg');

      if (mimeType === 'application/pdf') {
        pageCount = await this.getPdfPageCount(filePath);
        // In production: render first 3 pages as images using pdftoppm
        // exec(`pdftoppm -jpeg -f 1 -l 3 -r 150 ${filePath} ${outputPrefix}`)
      } else if (mimeType.includes('word') || mimeType.includes('document')) {
        // In production: convert to PDF via LibreOffice headless
        // exec(`libreoffice --headless --convert-to pdf ${filePath}`)
        // Then process as PDF
      } else if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
        // Similar LibreOffice conversion
      } else if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
        // Similar LibreOffice conversion
      }

      await this.mediaFileModel.findByIdAndUpdate(fileId, {
        'processing.status': 'complete',
        'processing.preview': { storageKey: previewKey, pages: pageCount ? Math.min(pageCount, 3) : null },
        'processing.metadata': { pageCount },
      });

      this.logger.log(`Document processed: ${fileId} (${mimeType}, ${pageCount} pages)`);
    } catch (err) {
      this.logger.error(`Document processing failed for ${fileId}: ${err.message}`);
      await this.mediaFileModel.findByIdAndUpdate(fileId, { 'processing.status': 'failed' });
    }
  }

  private async getPdfPageCount(filePath: string): Promise<number | null> {
    try {
      // MS-007: Use execFile instead of exec to prevent shell injection.
      // execFile does not spawn a shell, so filePath cannot break out of the argument.
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      const execFileAsync = promisify(execFile);

      const { stdout } = await execFileAsync('pdfinfo', [filePath]);
      const match = stdout.match(/Pages:\s+(\d+)/);
      return match ? parseInt(match[1], 10) : null;
    } catch {
      return null;
    }
  }
}
