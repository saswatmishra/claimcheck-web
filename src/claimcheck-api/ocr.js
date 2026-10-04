import vision from "@google-cloud/vision";

let visionClient;

export async function ocrBuffer(buffer) {
  visionClient ??= new vision.ImageAnnotatorClient(
    process.env.GOOGLE_CREDENTIALS_JSON
      ? { credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON) }
      : {},
  );
  const [result] = await visionClient.textDetection({
    image: { content: buffer.toString("base64") },
  }, { timeout: 20000 });

  if (result.error?.message) throw new Error("Image text extraction failed.");

  const text = result?.fullTextAnnotation?.text ?? "";
  return text;
}
