// Avatar helper & client-side image compression for uploaded participant photos

export const DEFAULT_PARTICIPANT_PHOTOS: string[] = [
  '/src/assets/images/avatar_portrait_1_1791630921947.jpg',
  '/src/assets/images/avatar_portrait_2_1791630937306.jpg',
  '/src/assets/images/avatar_portrait_3_1791630951601.jpg',
  '/src/assets/images/avatar_portrait_4_1791630966286.jpg',
  '/src/assets/images/avatar_portrait_5_1791630979292.jpg',
];

export function getDefaultPhotoForIndex(index: number): string {
  return DEFAULT_PARTICIPANT_PHOTOS[index % DEFAULT_PARTICIPANT_PHOTOS.length];
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Resizes and center-crops an uploaded image file into a compact 160x160 JPEG Data URL
 * so that uploaded photos persist reliably inside localStorage without exceeding quota.
 */
export function processUploadedPhotoFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selected file is not an image'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image'));
      img.onload = () => {
        const targetSize = 160;
        const canvas = document.createElement('canvas');
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }

        // Center-crop square
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;

        ctx.drawImage(
          img,
          sx,
          sy,
          minSide,
          minSide,
          0,
          0,
          targetSize,
          targetSize
        );

        const dataUrl = canvas.toDataURL('image/jpeg', 0.84);
        resolve(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
