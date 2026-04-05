import vision from "@google-cloud/vision";

const visionClient = new vision.ImageAnnotatorClient();

export async function ocrBuffer(buffer) {
  const [result] = await visionClient.textDetection({
    image: { content: buffer.toString("base64") },
  });

  const text = result?.fullTextAnnotation?.text ?? "";
  return text;
}
