// Server-only DOCX helpers using docxtemplater + pizzip.
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

export function detectPlaceholders(docxBuffer: ArrayBuffer): string[] {
  const zip = new PizZip(docxBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{", end: "}" },
  });
  const tags = doc.getFullText().match(/\{([^{}]+)\}/g) ?? [];
  const clean = new Set<string>();
  for (const t of tags) {
    const name = t.slice(1, -1).trim();
    if (name && !name.includes(" ")) clean.add(name);
  }
  // Also inspect internal template tags via getFullText – but safer: use parser
  // Second pass: docxtemplater parses tags — use `postparse` via renderAsync could work.
  // For robustness, also match tags inside the xml directly:
  try {
    const contentXml = zip.file("word/document.xml")?.asText() ?? "";
    const xmlTags = contentXml.match(/\{([a-zA-Z0-9_]+)\}/g) ?? [];
    for (const t of xmlTags) clean.add(t.slice(1, -1));
  } catch {}
  return Array.from(clean);
}

export function fillDocx(docxBuffer: ArrayBuffer, data: Record<string, string>): Uint8Array {
  const zip = new PizZip(docxBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{", end: "}" },
    nullGetter: () => "",
  });
  doc.render(data);
  const out = doc.getZip().generate({ type: "uint8array" });
  return out;
}
