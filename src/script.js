const filePicker = getElementByIdOrThrow("filePicker", HTMLInputElement);
const filePickerButton = getElementByIdOrThrow("filePickerButton", HTMLButtonElement);
const widthInput = getElementByIdOrThrow("width", HTMLInputElement);
const heightInput = getElementByIdOrThrow("height", HTMLInputElement);
const imageContainer = getElementByIdOrThrow("images", HTMLDivElement);

/** @type {Record<string, CanvasData>} */
const canvasRecord = {};

const CFG = /** @type {Config} */ ({});

setDim("width", 240);
setDim("height", 480);

/**
 * @param {"width" | "height"} dim - Dimension to set
 * @param {number} def - Default value if input is NaN
 */
function setDim(dim, def = NaN) {
  CFG[dim] = parseInt((dim === "width" ? widthInput : heightInput).value) || def;
  document.documentElement.style.setProperty(`--img-${dim}`, `${CFG[dim]}px`);
  for (const name in canvasRecord) {
    renderYUV420pImage(canvasRecord[name]);
  }
}

widthInput.addEventListener("input", () => setDim("width"));
heightInput.addEventListener("input", () => setDim("height"));

filePickerButton.addEventListener("click", () => filePicker.click());
filePicker.addEventListener("change", async () => {
  if (!filePicker.files) {
    return;
  }

  await Promise.all(/** @type {Promise<void>[]} */([...filePicker.files].map((file) => new Promise((res) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const canvasData = {
        canvas: /** @type {HTMLCanvasElement} */(document.querySelector(`canvas[data-filename="${file.name}"]`)) ||
          document.createElement("canvas"),
        name: file.name,
        data: new Uint8Array(/** @type {ArrayBuffer} */(reader.result)),
      };
      canvasData.canvas.dataset.filename = file.name;
      renderYUV420pImage(canvasData);
      imageContainer.append(canvasData.canvas);
      canvasRecord[file.name] = canvasData;
      res();
    });
    reader.readAsArrayBuffer(file);
  }))));
});

/**
 * @template {Element} E
 * @template {Class<E>} T
 * @param {string} id - Element data-id
 * @param {T} instance - Instance to type check the element against
 * @returns {ExtractInstance<T>} The Element
 */
function getElementByIdOrThrow(id, instance) {
  const element = document.querySelector(`[data-id=${id}]`);
  if (!element) {
    throw new Error(`Could not find element with id ${id}`);
  }
  if (typeof instance !== "function" || !(element instanceof instance)) {
    throw new Error(`Element #${id} is not an instance of ${instance}`);
  }
  return /** @type {ExtractInstance<T>} */(element);
}

/**
 * Render YUV420p image data on a canvas.
 * @param {CanvasData} canvasData - The canvas data.
 */
function renderYUV420pImage(canvasData) {
  const { canvas, data: yuvData } = canvasData;
  const { width, height } = CFG;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Failed to create canvas 2d context");
  }

  const imageData = ctx.createImageData(width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const yOffset = y * width + x;
      const uvOffset = Math.floor(y / 2) * Math.floor(width / 2) + Math.floor(x / 2);

      const Y = yuvData[yOffset];
      const U = yuvData[width * height + uvOffset];
      const V = yuvData[width * height * 5 / 4 + uvOffset];

      const index = (y * width + x) * 4;

      const R = Y + 1.402 * (V - 128);
      const G = Y - 0.344136 * (U - 128) - 0.714136 * (V - 128);
      const B = Y + 1.772 * (U - 128);

      imageData.data[index] = clamp(R, 0, 255);
      imageData.data[index + 1] = clamp(G, 0, 255);
      imageData.data[index + 2] = clamp(B, 0, 255);
      imageData.data[index + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Clamp a value between a minimum and maximum.
 * @param {number} value - The value to clamp.
 * @param {number} min - The minimum allowed value.
 * @param {number} max - The maximum allowed value.
 * @returns {number} - The clamped value.
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
