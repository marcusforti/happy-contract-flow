import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Configure PDF.js worker using unpkg which has better compatibility
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export type DocumentType = 'pdf' | 'word' | 'unknown';

export function getDocumentType(file: File): DocumentType {
  const mimeType = file.type;
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (mimeType === 'application/pdf' || extension === 'pdf') {
    return 'pdf';
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword' ||
    extension === 'docx' ||
    extension === 'doc'
  ) {
    return 'word';
  }

  return 'unknown';
}

export function isValidDocumentType(file: File): boolean {
  return getDocumentType(file) !== 'unknown';
}

export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n\n';
  }
  
  return fullText.trim();
}

export async function extractTextFromWord(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  
  try {
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.trim();
  } catch (error) {
    console.error('Error extracting text from Word:', error);
    throw new Error('Não foi possível extrair texto do arquivo Word. Certifique-se de que é um arquivo .docx válido.');
  }
}

export async function extractTextFromDocument(file: File): Promise<string> {
  const docType = getDocumentType(file);

  switch (docType) {
    case 'pdf':
      return extractTextFromPDF(file);
    case 'word':
      return extractTextFromWord(file);
    default:
      throw new Error('Tipo de arquivo não suportado. Use PDF ou Word (.docx)');
  }
}
