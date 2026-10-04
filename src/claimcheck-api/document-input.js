import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { ocrBuffer } from "./ocr.js";
import { validateDocumentFile } from "../shared/documents.js";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const standardFontDataUrl = path.join(path.dirname(require.resolve("pdfjs-dist/package.json")), "standard_fonts", path.sep);

export class DocumentInputError extends Error {
  constructor(message, status = 422) {
    super(message);
    this.status = status;
  }
}

function hasExpectedSignature(file) {
  const buffer = file.buffer;
  if (file.mimetype === "application/pdf") return buffer.subarray(0, 1024).includes(Buffer.from("%PDF-"));
  if (file.mimetype === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (file.mimetype === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP";
}

export async function fileToText(file) {
  const label = { rc: "RC", policy: "Insurance policy", dl: "Driving license" }[file.fieldname] ?? "Document";
  const problem = validateDocumentFile(file);
  if (problem) throw new DocumentInputError(`${label}: ${problem}`, 400);
  if (!hasExpectedSignature(file)) {
    throw new DocumentInputError(`${label}: The file contents don’t match its type. Choose the original PDF or image.`, 400);
  }
  if (file.mimetype.startsWith("image/")) return ocrBuffer(file.buffer);

  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(file.buffer), isEvalSupported: false, standardFontDataUrl });
  try {
    const doc = await loadingTask.promise;
    if (doc.numPages > 30) {
      throw new DocumentInputError(`${label}: Use a PDF of up to 30 pages, or upload the document’s summary page as a clear photo.`);
    }
    const pages = [];
    for (let i = 1; i <= doc.numPages; i += 1) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => (item.str ?? "") + (item.hasEOL ? "\n" : " ")).join(""));
      page.cleanup();
    }
    const text = pages.join("\n").trim();
    if (text.length <= 10) {
      throw new DocumentInputError(`${label}: We couldn’t read text in this PDF. Upload a clear JPG or PNG photo of the document, or a PDF with selectable text.`);
    }
    return text;
  } catch (error) {
    if (error instanceof DocumentInputError) throw error;
    if (error.name === "PasswordException") {
      throw new DocumentInputError(`${label}: This PDF is password-protected. Upload an unlocked copy or a clear photo.`);
    }
    throw new DocumentInputError(`${label}: We couldn’t open this PDF. Try downloading it again or upload a clear photo.`);
  } finally {
    await loadingTask.destroy();
  }
}
