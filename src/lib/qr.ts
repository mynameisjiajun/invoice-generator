import QRCode from "qrcode";

// Styled like https://github.com/xkjyeah/paynow-qr-generator: PayNow purple
// modules with the PayNow logo on a white patch in the centre.
const PAYNOW_PURPLE = "#941c80";
const LOGO_SRC = "/paynow-logo.png";
const LOGO_W = 1323;
const LOGO_H = 894;
const SIZE = 1024;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function qrDataUrl(payload: string): Promise<string> {
  const options = {
    errorCorrectionLevel: "M" as const,
    margin: 1,
    width: SIZE,
    color: { dark: PAYNOW_PURPLE },
  };
  // No DOM (e.g. scripts run under Node): plain purple QR without the logo.
  if (typeof document === "undefined") return QRCode.toDataURL(payload, options);

  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, payload, options);
  try {
    const logo = await loadImage(LOGO_SRC);
    const ctx = canvas.getContext("2d")!;
    const targetWidth = SIZE / 4;
    const targetHeight = (LOGO_H / LOGO_W) * targetWidth;
    const mid = SIZE / 2;
    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = "white";
    ctx.fillRect(mid - targetWidth / 2, mid - targetHeight / 2, targetWidth, targetHeight);
    ctx.drawImage(logo, mid - targetWidth / 2, mid - targetHeight / 2, targetWidth, targetHeight);
  } catch {
    // Logo failed to load — the QR still scans fine without it.
  }
  return canvas.toDataURL("image/png");
}
