import { createWorker, Worker } from 'tesseract.js';

export interface DetectedElement {
  id: number;
  text: string;
  box: [number, number, number, number]; // [x, y, width, height]
  confidence: number;
}

export interface OCRResult {
  fullText: string;
  elements: DetectedElement[];
}

let clientWorkerPromise: Promise<Worker> | null = null;

export async function getClientWorker(): Promise<Worker> {
  if (!clientWorkerPromise) {
    clientWorkerPromise = (async () => {
      // Use 'eng' for fast, reliable character recognition in the browser
      const worker = await createWorker('eng');
      return worker;
    })();
  }
  return clientWorkerPromise;
}

// Warm up worker in background on page load
if (typeof window !== 'undefined') {
  getClientWorker().catch((e) => console.warn('Background OCR worker warm-up:', e));
}

export async function detectElementsClient(
  imageSource: string | File,
  _lang: string = 'eng'
): Promise<OCRResult> {
  // Allow 25 seconds for first-time WASM / traineddata download on slow networks
  const timeoutPromise = new Promise<OCRResult>((resolve) => {
    setTimeout(() => {
      console.warn('Browser OCR timed out, delegating to backend or local rule engine');
      resolve({ fullText: '', elements: [] });
    }, 25000);
  });

  const recognizePromise = (async (): Promise<OCRResult> => {
    try {
      const worker = await getClientWorker();
      const ret = await worker.recognize(imageSource);

      const fullText = ret.data.text || '';
      const elements: DetectedElement[] = [];
      let idCounter = 1;

      // Extract lines that look like interactive buttons or key text
      if (ret.data.lines && ret.data.lines.length > 0) {
        for (const line of ret.data.lines) {
          const text = line.text.trim();
          if (text.length >= 2 && line.confidence > 35) {
            const { x0, y0, x1, y1 } = line.bbox;
            elements.push({
              id: idCounter++,
              text,
              box: [x0, y0, Math.max(20, x1 - x0), Math.max(20, y1 - y0)],
              confidence: line.confidence / 100,
            });
          }
        }
      }

      // If lines didn't yield enough, check words
      if (elements.length === 0 && ret.data.words) {
        for (const word of ret.data.words) {
          const text = word.text.trim();
          if (text.length >= 2 && word.confidence > 45) {
            const { x0, y0, x1, y1 } = word.bbox;
            elements.push({
              id: idCounter++,
              text,
              box: [x0, y0, Math.max(20, x1 - x0), Math.max(20, y1 - y0)],
              confidence: word.confidence / 100,
            });
          }
        }
      }

      return {
        fullText,
        elements: elements.slice(0, 15),
      };
    } catch (err) {
      console.warn('In-browser OCR issue, delegating to backend OCR fallback:', err);
      return {
        fullText: '',
        elements: [],
      };
    }
  })();

  return Promise.race([recognizePromise, timeoutPromise]);
}
