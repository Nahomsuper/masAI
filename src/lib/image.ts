const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_DIMENSION = 1400;

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('That photo could not be read. Try another file.'));
    reader.readAsDataURL(file);
  });

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('That file is not a readable image.'));
    image.src = src;
  });

/** Reads and lightly compresses a photo so it fits the API upload limit. */
export async function fileToDataUrl(file: File): Promise<string> {
  if (!ALLOWED.includes(file.type)) {
    throw new Error('Choose a JPEG, PNG or WebP photo.');
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error('That photo is too large. Choose one under 12 MB.');
  }

  const original = await readAsDataUrl(file);
  const image = await loadImage(original);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height));
  if (scale === 1 && original.length < 4 * 1024 * 1024) return original;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser could not prepare the photo.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.82);
}
