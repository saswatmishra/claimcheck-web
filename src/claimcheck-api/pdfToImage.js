import fs from "fs";
import path from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import pdf from "pdf-poppler";

export async function pdfBufferToPng(buffer) {
  const id = randomUUID();

  const dir = tmpdir();
  const pdfPath = path.join(dir, `${id}.pdf`);

  fs.writeFileSync(pdfPath, buffer);

  // Convert FIRST PAGE only (MVP)
  await pdf.convert(pdfPath, {
    format: "png",
    out_dir: dir,
    out_prefix: id,
    page: 1,
  });

  // IMPORTANT: pdf-poppler output path format is: out_dir/out_prefix-1.png
  const pngPath = path.join(dir, `${id}-1.png`);

  if (!fs.existsSync(pngPath)) {
    // cleanup
    try {
      fs.unlinkSync(pdfPath);
    } catch {}
    throw new Error(`PDF->PNG failed. Expected output not found: ${pngPath}`);
  }

  const pngBuffer = fs.readFileSync(pngPath);

  // cleanup
  try {
    fs.unlinkSync(pdfPath);
  } catch {}
  try {
    fs.unlinkSync(pngPath);
  } catch {}

  return pngBuffer;
}
