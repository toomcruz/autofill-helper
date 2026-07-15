// Server-only DOCX helpers using docxtemplater + pizzip.
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

export function detectPlaceholders(docxBuffer: ArrayBuffer): string[] {
  const zip = new PizZip(docxBuffer);
  const clean = new Set<string>();
  // Scan main document and headers/footers
  const candidates = Object.keys((zip as any).files ?? {}).filter(
    (n) => n.startsWith("word/") && n.endsWith(".xml"),
  );
  for (const name of candidates) {
    const xml = zip.file(name)?.asText() ?? "";
    // Strip XML tags so placeholders split across runs still match
    const stripped = xml.replace(/<[^>]+>/g, "");
    const matches = stripped.match(/\{([a-zA-Z0-9_]+)\}/g) ?? [];
    for (const m of matches) clean.add(m.slice(1, -1));
  }
  return Array.from(clean).sort();
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
  return doc.getZip().generate({ type: "uint8array" });
}
