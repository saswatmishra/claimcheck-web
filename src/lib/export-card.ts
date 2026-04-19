import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";

export async function elementToPngBlob(el: HTMLElement): Promise<Blob> {
  const dataUrl = await toPng(el, {
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: "#ffffff",
  });
  const res = await fetch(dataUrl);
  return res.blob();
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadPng(el: HTMLElement, filename: string) {
  const blob = await elementToPngBlob(el);
  triggerDownload(blob, filename);
}

export async function downloadPdf(el: HTMLElement, filename: string) {
  const blob = await elementToPdfBlob(el);
  triggerDownload(blob, filename);
}

export async function elementToPdfBlob(el: HTMLElement): Promise<Blob> {
  const dataUrl = await toPng(el, {
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: "#ffffff",
  });

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load image data"));
    img.src = dataUrl;
  });

  const pdfWidth = 210;
  const ratio = img.height / img.width;
  const pdfHeight = pdfWidth * ratio;

  const pdf = new jsPDF({
    orientation: pdfHeight > pdfWidth ? "portrait" : "landscape",
    unit: "mm",
    format: [pdfWidth, pdfHeight],
  });

  pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, pdfHeight);
  return pdf.output("blob");
}

export function shareOnWhatsApp(text: string) {
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
