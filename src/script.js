const filePicker = getElementByIdOrThrow("filePicker", HTMLInputElement);
const filePickerButton = getElementByIdOrThrow("filePickerButton", HTMLButtonElement);
const widthInput = getElementByIdOrThrow("width", HTMLInputElement);
const heightInput = getElementByIdOrThrow("height", HTMLInputElement);
const imageContainer = getElementByIdOrThrow("images", HTMLDivElement);

/** @type {Record<string, CanvasData>} */
const canvasRecord = {};

const CFG = /** @type {Config} */ ({});

setDim("width");
setDim("height");

/**
  * @param {"width" | "height"} dim - Dimension to set
  */
function setDim(dim) {
  CFG[dim] = Math.abs(parseInt((dim === "width" ? widthInput : heightInput).value) || 1);
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
      updateCanvasData(file, /** @type {ArrayBuffer} */(reader.result));
      res();
    });
    reader.readAsArrayBuffer(file);
  }))));
});

/**
  * Updates canvas data, creates it if it doesn't exist
  * @param {File} file - Image file to render
  * @param {ArrayBuffer} data - The file binary data
  */
function updateCanvasData(file, data) {
  if (!(file.name in canvasRecord)) {
    const template = getElementByIdOrThrow("canvas", HTMLTemplateElement).content.cloneNode(true);

    if (!(template instanceof DocumentFragment && template.firstElementChild)) {
      throw new Error("Canvas template is not a valid element");
    }

    const canvasContainer = template.firstElementChild;

    const button = canvasContainer.querySelector("button");
    const canvas = canvasContainer.querySelector("canvas");
    const caption = canvasContainer.querySelector("figcaption");

    if (!(button && canvas && caption)) {
      throw new Error("Canvas template is missing content");
    }

    caption.textContent = file.name;
    canvas.dataset.filename = file.name;
    button.addEventListener("click", () => {
      canvasContainer.remove();
      delete canvasRecord[file.name];
    });

    const canvasData = {
      canvas,
      name: file.name,
      data: new Uint8Array(data),
    };

    imageContainer.append(canvasContainer);
    canvasRecord[file.name] = canvasData;
  }

  renderYUV420pImage(canvasRecord[file.name]);
}

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
