const $ = (id) => document.getElementById(id);
const welcome = $("welcome"), camera = $("camera"), result = $("result");
const video = $("video"), canvas = $("captureCanvas"), capturedPhoto = $("capturedPhoto"), message = $("message");
let stream = null, lastDataUrl = null, usingFrontCamera = true;

function show(screen) {
  [welcome, camera, result].forEach(s => s.classList.add("hidden"));
  screen.classList.remove("hidden");
}

function msg(t = "") { message.textContent = t; }
function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  video.srcObject = null;
}

async function startCamera() {
  msg("");
  if (!navigator.mediaDevices?.getUserMedia) {
    msg("Deze browser ondersteunt geen cameratoegang.");
    return;
  }
  try {
    if (stream) stopCamera();
    const facingMode = usingFrontCamera ? "user" : "environment";
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode,
        width: { ideal: 1080 },
        height: { ideal: 1440 }
      },
      audio: false
    });
    video.srcObject = stream;
    await video.play();
    show(camera);
  } catch (e) {
    console.error(e);
    stopCamera();
    msg("Geef Safari toestemming voor de camera en probeer het opnieuw.");
  }
}

async function takePhoto() {
  const b = $("take");
  if (b.disabled) return;
  b.disabled = true;
  msg("");

  for (const n of [3, 2, 1]) {
    $("countdown").textContent = n;
    await wait(650);
  }
  $("countdown").textContent = "";

  const w = video.videoWidth, h = video.videoHeight;
  if (!w || !h) {
    b.disabled = false;
    msg("De camera is nog niet klaar. Probeer opnieuw.");
    return;
  }

  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, w, h);
  ctx.restore();

  lastDataUrl = canvas.toDataURL("image/jpeg", 0.94);
  capturedPhoto.src = lastDataUrl;
  stopCamera();
  show(result);
  b.disabled = false;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Afbeelding niet geladen: " + src));
    i.src = src;
  });
}

function drawCover(ctx, img, dx, dy, dw, dh) {
  const sw = img.naturalWidth || img.width;
  const sh = img.naturalHeight || img.height;
  const s = Math.max(dw / sw, dh / sh);
  const rw = sw * s;
  const rh = sh * s;
  const tmp = document.createElement("canvas");
  tmp.width = Math.ceil(rw);
  tmp.height = Math.ceil(rh);
  tmp.getContext("2d").drawImage(img, 0, 0, tmp.width, tmp.height);
  ctx.drawImage(tmp, (rw - dw) / 2, (rh - dh) / 2, dw, dh, dx, dy, dw, dh);
}

/*
 * The on-screen result shows the photo behind the transparent result overlay.
 * Saving and sharing must use exactly the same layer order.
 */
async function buildOutput() {
  if (!lastDataUrl) throw new Error("Geen foto beschikbaar");

  const [overlay, photo, logo] = await Promise.all([
    loadImage("./assets/images/photo-booth-result-overlay.png"),
    loadImage(lastDataUrl),
    loadImage("./assets/images/cbm-logo-exact.png")
  ]);

  const out = document.createElement("canvas");
  out.width = overlay.naturalWidth;
  out.height = overlay.naturalHeight;
  const ctx = out.getContext("2d");

  // Photo window used by the current result screen artwork.
  const x = 139, y = 164, w = 778, h = 692;
  ctx.save();
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.clip();
  } else {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
  }
  drawCover(ctx, photo, x, y, w, h);
  ctx.restore();

  // Foreground artwork first, then the CBM logo on top.
  ctx.drawImage(overlay, 0, 0);
  ctx.drawImage(logo, 57, 42, 86, 86);

  return out;
}

async function canvasToJpegBlob(canvasEl) {
  return new Promise((resolve, reject) => {
    canvasEl.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Geen bestand"));
    }, "image/jpeg", 0.95);
  });
}

async function savePhoto() {
  try {
    msg("");
    const out = await buildOutput();
    const blob = await canvasToJpegBlob(out);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vidas-10th-birthday.jpg";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  } catch (e) {
    console.error(e);
    msg("Opslaan is niet gelukt. Probeer het opnieuw.");
  }
}

async function sharePhoto() {
  try {
    msg("");
    const out = await buildOutput();
    const blob = await canvasToJpegBlob(out);
    if (!navigator.share) {
      msg("Direct delen wordt niet ondersteund. Sla de foto op en deel hem vanuit Foto's.");
      return;
    }
    const file = new File([blob], "vidas-10th-birthday.jpg", { type: "image/jpeg" });
    if (navigator.canShare && !navigator.canShare({ files: [file] })) {
      msg("Direct delen wordt niet ondersteund. Sla de foto op en deel hem vanuit Foto's.");
      return;
    }
    await navigator.share({ title: "Vida's 10th Birthday", files: [file] });
  } catch (e) {
    if (e?.name !== "AbortError") {
      console.error(e);
      msg("Delen lukte niet. Sla de foto op en deel hem vanuit Foto's.");
    }
  }
}

$("start").addEventListener("click", startCamera);
$("take").addEventListener("click", takePhoto);
$("back").addEventListener("click", () => { stopCamera(); show(welcome); });
$("flip").addEventListener("click", () => {
  usingFrontCamera = !usingFrontCamera;
  startCamera();
});
$("again").addEventListener("click", startCamera);
$("save").addEventListener("click", savePhoto);
$("share").addEventListener("click", sharePhoto);
window.addEventListener("pagehide", stopCamera);
show(welcome);Unsupported Media Type
