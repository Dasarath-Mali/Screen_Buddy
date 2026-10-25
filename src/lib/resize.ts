/**
 * Client-side image resize and compression
 * Keeps long edge <= 1024px, JPEG quality 0.8, strips EXIF.
 */

export interface ResizedImageResult {
  base64: string;      // pure base64 without data: prefix
  dataUrl: string;     // data:image/jpeg;base64,...
  width: number;
  height: number;
  sizeBytes: number;
}

export async function resizeImageClient(
  fileOrDataUrl: File | string,
  maxLongEdge = 1024,
  quality = 0.8
): Promise<ResizedImageResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      let { width, height } = img;

      // Calculate new dimensions preserving aspect ratio
      if (width > height) {
        if (width > maxLongEdge) {
          height = Math.round((height * maxLongEdge) / width);
          width = maxLongEdge;
        }
      } else {
        if (height > maxLongEdge) {
          width = Math.round((width * maxLongEdge) / height);
          height = maxLongEdge;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      // Draw resized image
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      const base64 = dataUrl.split(',')[1] || '';
      const sizeBytes = Math.round((base64.length * 3) / 4);

      resolve({
        base64,
        dataUrl,
        width,
        height,
        sizeBytes,
      });
    };

    img.onerror = (err) => reject(new Error('Failed to load image for resizing'));

    if (typeof fileOrDataUrl === 'string') {
      img.src = fileOrDataUrl;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(fileOrDataUrl);
    }
  });
}
