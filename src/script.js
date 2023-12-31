const filePicker = getElementByIdOrThrow("filePicker", HTMLInputElement);
const filePickerButton = getElementByIdOrThrow("filePickerButton", HTMLButtonElement);
const widthInput = getElementByIdOrThrow("width", HTMLInputElement);
const heightInput = getElementByIdOrThrow("height", HTMLInputElement);
const imageContainer = getElementByIdOrThrow("images", HTMLDivElement);
const zoomContainer = getElementByIdOrThrow("zoomContainer", HTMLDivElement);
const zoomCanvas = getElementByIdOrThrow("zoom", HTMLCanvasElement);
const zoomInput = getElementByIdOrThrow("zoomLevel", HTMLInputElement);

const zoomCtx = /** @type {CanvasRenderingContext2D} */(zoomCanvas.getContext("2d"));

if (!zoomCtx) {
  throw new Error("Failed to get zoom canvas context");
}

/** @type {Record<string, CanvasData>} */
const canvasRecord = {};

const CFG = /** @type {Config} */ ({});

setDim("width");
setDim("height");
updateZoom();

/**
  * @param {ConfigKey} dim - Dimension to set
  * @param {number} [val] - Value to set
  */
function setDim(dim, val) {
  if (val === undefined) {
    CFG[dim] = Math.abs(parseInt((dim === "width" ? widthInput : heightInput).value) || 1);
  } else {
    CFG[dim] = val;
  }

  document.documentElement.style.setProperty(`--img-${dim}`, `${CFG[dim]}px`);
  for (const name in canvasRecord) {
    renderYUV420pImage(canvasRecord[name]);
  }
}

/** Updates zoom */
function updateZoom() {
  CFG.zoom = Math.abs(parseInt(zoomInput.value) || 1);
}

widthInput.addEventListener("input", () => setDim("width"));
heightInput.addEventListener("input", () => setDim("height"));
zoomInput.addEventListener("input", updateZoom);

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

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Failed to create canvas 2d context");
    }

    caption.textContent = file.name;
    canvas.dataset.filename = file.name;

    button.addEventListener("click", () => {
      canvasContainer.remove();
      delete canvasRecord[file.name];
    });

    canvas.addEventListener("mouseleave", () => setZoomVisibility("hidden"));
    canvas.addEventListener("touchend", () => setZoomVisibility("hidden"));

    canvas.addEventListener("mousemove", renderZoom.bind(canvas));
    canvas.addEventListener("touchmove", renderZoom.bind(canvas));

    canvas.addEventListener("mouseenter", () => setZoomVisibility("visible"));
    canvas.addEventListener("touchstart", () => setZoomVisibility("visible"));

    imageContainer.append(canvasContainer);

    const canvasData = {
      canvas,
      name: file.name,
      data: new Uint8Array(),
      ctx,
    };
    canvasRecord[file.name] = canvasData;
  }
  const canvasData = canvasRecord[file.name];
  canvasData.data = new Uint8Array(data);

  if (file.type.includes("image/")) {
    renderImage(canvasRecord[file.name], file.type);
  } else {
    renderYUV420pImage(canvasRecord[file.name]);
  }
}

/**
  * @param {string} visibility - Zoom visibility
  */
function setZoomVisibility(visibility) {
  document.documentElement.style.setProperty("--zoom-visibility", visibility);
}

/**
  * @this {HTMLCanvasElement}
  * @param {MouseTouchEvent} e - The event
  */
function renderZoom(e) {
  const cursor = getCursorPosition(e);
  const zoomLevel = CFG.zoom;

  zoomContainer.style.left = `${cursor.browser.x}px`;
  zoomContainer.style.top = `${cursor.browser.y}px`;

  zoomCtx.clearRect(0, 0, zoomCanvas.width, zoomCanvas.height);
  zoomCtx.save();

  const gradient = zoomCtx.createRadialGradient(
    zoomCanvas.width / 2, zoomCanvas.height / 2, 0,
    zoomCanvas.width / 2, zoomCanvas.height / 2, zoomCanvas.width / (2 * zoomLevel),
  );

  gradient.addColorStop(0, "transparent");
  gradient.addColorStop(0.8, "transparent");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0.3)");

  zoomCtx.fillStyle = gradient;
  zoomCtx.arc(zoomCanvas.width / 2, zoomCanvas.height / 2, zoomCanvas.width / (2 * zoomLevel), 0, 2 * Math.PI);
  zoomCtx.fill();

  zoomCtx.closePath();
  zoomCtx.clip();

  zoomCtx.drawImage(
    this,
    cursor.element.x - zoomCanvas.width / (2 * zoomLevel),
    cursor.element.y - zoomCanvas.height / (2 * zoomLevel),
    zoomCanvas.width / zoomLevel,
    zoomCanvas.height / zoomLevel,
    0,
    0,
    zoomCanvas.width,
    zoomCanvas.height,
  );

  zoomCtx.restore();
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
  const { canvas, data: yuvData, ctx } = canvasData;
  const { width, height } = CFG;
  canvas.width = width;
  canvas.height = height;

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
 * @param {CanvasData} canvasData - The canvas data.
 * @param {string} fileType - File type.
 */
function renderImage(canvasData, fileType) {
  const { canvas, ctx } = canvasData;

  const blob = new Blob([canvasData.data], { type: fileType });
  const url = URL.createObjectURL(blob);

  const image = new Image();
  image.src = url;

  image.onload = function() {
    const { width, height } = image;
    canvas.width = width;
    canvas.height = height;
    setDim("width", width);
    setDim("height", height);

    ctx.drawImage(image, 0, 0, width, height);
    URL.revokeObjectURL(url);
  };
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

/**
  * @param {MouseTouchEvent} e - The event
  * @returns {CursorPosition} The cursor position
  */
function getCursorPosition(e) {
  if (window.TouchEvent && e instanceof TouchEvent) {
    const touch = e.touches[0];
    const target = e.target;

    if (!(target instanceof HTMLElement)) {
      throw new Error("Cursor position invoked on an invalid element");
    }

    return {
      screen: {
        x: touch.screenX,
        y: touch.screenY,
      },
      browser: {
        x: touch.clientX,
        y: touch.clientY,
      },
      element: {
        x: touch.pageX - target.offsetLeft,
        y: touch.pageY - target.offsetTop,
      },
    };
  }

  const mouse_event = /** @type {MouseEvent} */(e);

  return {
    screen: {
      x: mouse_event.screenX,
      y: mouse_event.screenY,
    },
    browser: {
      x: mouse_event.clientX,
      y: mouse_event.clientY,
    },
    element: {
      x: mouse_event.offsetX,
      y: mouse_event.offsetY,
    },
  };
}
