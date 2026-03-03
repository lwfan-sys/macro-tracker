let fileInput = null;

export function initCamera() {
  fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.setAttribute('capture', 'environment');
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);
}

export function capturePhoto() {
  return new Promise((resolve, reject) => {
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }

      try {
        const dataUrl = await readFileAsDataUrl(file);
        const resized = await resizeImage(dataUrl);
        const base64 = resized.split(',')[1];
        const mimeType = 'image/jpeg';
        resolve({ base64, mimeType, dataUrl: resized });
      } catch (err) {
        reject(err);
      }
    };
    fileInput.value = '';
    fileInput.click();
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function resizeImage(dataUrl, maxSize = 512) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      if (width <= maxSize && height <= maxSize) {
        resolve(dataUrl);
        return;
      }

      if (width > height) {
        height = Math.round((height / width) * maxSize);
        width = maxSize;
      } else {
        width = Math.round((width / height) * maxSize);
        height = maxSize;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    img.src = dataUrl;
  });
}
