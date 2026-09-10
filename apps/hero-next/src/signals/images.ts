// Reuse loaded semantic images in the face atlas; no second image loader.
const images = new Map<string, HTMLImageElement>();
let revision = 0;

export function setSignalImage(src: string, image: HTMLImageElement) {
  if (!image.complete || !image.naturalWidth || images.get(src) === image)
    return;
  images.set(src, image);
  revision += 1;
}

export function removeSignalImage(src: string, image: HTMLImageElement) {
  if (images.get(src) !== image) return;
  images.delete(src);
  revision += 1;
}

export function getSignalImage(src: string) {
  return images.get(src);
}

export function getSignalImageRevision() {
  return revision;
}
