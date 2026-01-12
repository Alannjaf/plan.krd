/**
 * PDF Text Extraction Utility
 * Extracts text content from PDF files for AI processing
 */

import { PDFParse } from "pdf-parse";

const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10MB limit for PDFs

export type PDFExtractionResult = {
  success: boolean;
  text?: string;
  pageCount?: number;
  error?: string;
};

/**
 * Extract text content from a PDF buffer
 */
export async function extractTextFromPDF(
  pdfBuffer: Buffer | Uint8Array
): Promise<PDFExtractionResult> {
  let parser: PDFParse | null = null;
  
  try {
    // Check file size
    if (pdfBuffer.length > MAX_PDF_SIZE) {
      return {
        success: false,
        error: "PDF file is too large. Maximum size is 10MB.",
      };
    }

    // Convert Buffer to Uint8Array if needed
    const data = pdfBuffer instanceof Uint8Array ? pdfBuffer : new Uint8Array(pdfBuffer);
    
    parser = new PDFParse({ data });
    const textResult = await parser.getText();

    if (!textResult.text || textResult.text.trim().length === 0) {
      return {
        success: false,
        error: "Could not extract text from PDF. The document may be image-based or encrypted.",
      };
    }

    // Clean up the extracted text
    const cleanedText = cleanExtractedText(textResult.text);

    return {
      success: true,
      text: cleanedText,
      pageCount: textResult.pages.length,
    };
  } catch (error) {
    console.error("PDF extraction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to parse PDF",
    };
  } finally {
    // Clean up parser resources
    if (parser) {
      try {
        await parser.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Extract text from a PDF URL (downloads and parses)
 */
export async function extractTextFromPDFUrl(
  url: string
): Promise<PDFExtractionResult> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to download PDF: ${response.status}`,
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return extractTextFromPDF(buffer);
  } catch (error) {
    console.error("PDF download error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to download PDF",
    };
  }
}

/**
 * Clean up extracted PDF text
 * - Normalizes whitespace
 * - Removes excessive blank lines
 * - Fixes common PDF extraction issues
 */
function cleanExtractedText(text: string): string {
  return (
    text
      // Normalize line endings
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      // Remove excessive whitespace within lines
      .replace(/[ \t]+/g, " ")
      // Remove excessive blank lines (more than 2)
      .replace(/\n{4,}/g, "\n\n\n")
      // Trim each line
      .split("\n")
      .map((line) => line.trim())
      .join("\n")
      // Final trim
      .trim()
  );
}

/**
 * Truncate text to a maximum length while preserving word boundaries
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  // Find the last space before maxLength
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > maxLength * 0.8) {
    return truncated.slice(0, lastSpace) + "...";
  }

  return truncated + "...";
}
