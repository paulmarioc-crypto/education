import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import JSZip from "jszip";
import { stripXmlTags } from "../lib/xml.js";

/** Caps how much extracted text gets sent to the generator — generous enough
 * for a full slide deck or chapter, just a guard against pathological input. */
const MAX_EXTRACTED_CHARS = 200_000;

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text.slice(0, MAX_EXTRACTED_CHARS);
  } finally {
    await parser.destroy();
  }
}

export async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value.slice(0, MAX_EXTRACTED_CHARS);
}

export async function extractPptxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      const nb = Number(b.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      return na - nb;
    });

  const slideTexts: string[] = [];
  for (const name of slideFiles) {
    const xml = await zip.file(name)?.async("string");
    if (!xml) continue;
    const runs = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => stripXmlTags(m[1]));
    if (runs.length > 0) slideTexts.push(runs.join(" "));
  }

  return slideTexts.map((text, i) => `[Slide ${i + 1}] ${text}`).join("\n\n").slice(0, MAX_EXTRACTED_CHARS);
}

export type SupportedUploadKind = "pdf" | "docx" | "pptx" | "image";

export function detectUploadKind(mimeType: string, filename: string): SupportedUploadKind | null {
  if (mimeType === "application/pdf" || filename.endsWith(".pdf")) return "pdf";
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || filename.endsWith(".docx")) return "docx";
  if (mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" || filename.endsWith(".pptx")) return "pptx";
  if (mimeType.startsWith("image/")) return "image";
  return null;
}

/** Extracts plain text from a text-based upload. Images are handled separately (sent to Claude vision directly). */
export async function extractText(kind: "pdf" | "docx" | "pptx", buffer: Buffer): Promise<string> {
  if (kind === "pdf") return extractPdfText(buffer);
  if (kind === "docx") return extractDocxText(buffer);
  return extractPptxText(buffer);
}
