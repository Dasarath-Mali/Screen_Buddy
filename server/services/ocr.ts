import { createWorker } from 'tesseract.js';
import { BoundingBox } from './rules';

let cachedWorker: any = null;

async function getWorker() {
  if (!cachedWorker) {
    cachedWorker = await createWorker('eng');
  }
  return cachedWorker;
}

export interface ServerOCRResult {
  fullText: string;
  elements: BoundingBox[];
}

export async function runServerOCR(imageBase64: string): Promise<ServerOCRResult> {
  try {
    // Strip data URI prefix if present
    const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const worker = await getWorker();
    const ret = await worker.recognize(buffer);

    const fullText = ret.data.text || '';
    const elements: BoundingBox[] = [];
    let idCounter = 1;

    if (ret.data.lines && ret.data.lines.length > 0) {
      for (const line of ret.data.lines) {
        const text = line.text.trim();
        if (text.length >= 2 && line.confidence > 35) {
          const { x0, y0, x1, y1 } = line.bbox;
          elements.push({
            id: idCounter++,
            text,
            box: [x0, y0, Math.max(20, x1 - x0), Math.max(20, y1 - y0)],
          });
        }
      }
    }

    return {
      fullText,
      elements: elements.slice(0, 15),
    };
  } catch (err) {
    console.warn('Server-side OCR failed:', err);
    return {
      fullText: '',
      elements: [],
    };
  }
}
