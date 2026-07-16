// Server-only DOCX helpers using docxtemplater + pizzip.
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

type TemplateDelimiters = { start: string; end: string };

const SINGLE_BRACE_DELIMITERS: TemplateDelimiters = {
  start: "{",
  end: "}",
};
const DOUBLE_BRACE_DELIMITERS: TemplateDelimiters = {
  start: "{{",
  end: "}}",
};

function getTemplateXmlFiles(zip: PizZip): string[] {
  const zipWithFiles = zip as PizZip & { files?: Record<string, unknown> };
  return Object.keys(zipWithFiles.files ?? {}).filter(
    (name) => name.startsWith("word/") && name.endsWith(".xml"),
  );
}

function stripXmlTags(xml: string): string {
  return xml.replace(/<[^>]+>/g, "");
}

function detectDelimiters(zip: PizZip): TemplateDelimiters {
  for (const name of getTemplateXmlFiles(zip)) {
    const stripped = stripXmlTags(zip.file(name)?.asText() ?? "");
    if (/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/.test(stripped)) return DOUBLE_BRACE_DELIMITERS;
  }
  return SINGLE_BRACE_DELIMITERS;
}

function getDocxErrorMessage(error: unknown): string {
  const err = error as {
    properties?: {
      errors?: Array<{
        properties?: { explanation?: string; id?: string; xtag?: string };
      }>;
    };
    message?: string;
  };
  const details = err?.properties?.errors
    ?.map((e) => e?.properties?.explanation || e?.properties?.xtag || e?.properties?.id)
    .filter(Boolean)
    .join("; ");
  return details ? `Erro no modelo: ${details}` : err?.message || "Erro ao preencher o modelo";
}

export function detectPlaceholders(docxBuffer: ArrayBuffer): string[] {
  const zip = new PizZip(docxBuffer);
  const clean = new Set<string>();
  // Scan main document and headers/footers
  for (const name of getTemplateXmlFiles(zip)) {
    const xml = zip.file(name)?.asText() ?? "";
    // Strip XML tags so placeholders split across runs still match
    const stripped = stripXmlTags(xml);
    const doubleMatches = stripped.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g) ?? [];
    for (const match of doubleMatches) clean.add(match.replace(/[{}\s]/g, ""));

    const withoutDoubleBraceTags = stripped.replace(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g, "");
    const singleMatches = withoutDoubleBraceTags.match(/\{\s*([a-zA-Z0-9_]+)\s*\}/g) ?? [];
    for (const match of singleMatches) clean.add(match.replace(/[{}\s]/g, ""));
  }
  return Array.from(clean).sort();
}

export function fillDocx(docxBuffer: ArrayBuffer, data: Record<string, string>): Uint8Array {
  const zip = new PizZip(docxBuffer);
  try {
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: detectDelimiters(zip),
      nullGetter: () => "",
    });
    doc.render(data);
    return doc.getZip().generate({
      type: "uint8array",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
  } catch (error: unknown) {
    throw new Error(getDocxErrorMessage(error));
  }
}
