import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { detectPlaceholders, fillDocx } from "../docx.server";

const OFFICIAL_TEMPLATES_DIR = "public/templates/official";

function readTemplate(path: string): ArrayBuffer {
  const buffer = readFileSync(path);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function findDocxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return findDocxFiles(path);
      return entry.isFile() && entry.name.endsWith(".docx") ? [path] : [];
    })
    .sort();
}

function fakeValuesFor(placeholders: string[]): Record<string, string> {
  return Object.fromEntries(
    placeholders.map((placeholder) => [placeholder, `valor ficticio para ${placeholder}`]),
  );
}

describe("docx official templates", () => {
  it("detects double-brace placeholders without inner brace duplicates", () => {
    const template = readTemplate("public/templates/official/velorio/condolencias.docx");

    expect(detectPlaceholders(template)).toEqual(["data", "nomeFal", "sala"]);
  });

  it("fills official double-brace templates without Docxtemplater Multi error", () => {
    const template = readTemplate("public/templates/official/velorio/condolencias.docx");

    expect(() =>
      fillDocx(template, {
        data: "16/07/2026",
        nomeFal: "Maria Silva",
        sala: "Sala 1",
      }),
    ).not.toThrow();
  });

  it("detects and fills every official DOCX template without Multi error", () => {
    const templatePaths = findDocxFiles(OFFICIAL_TEMPLATES_DIR);

    expect(templatePaths.length).toBeGreaterThan(0);

    for (const templatePath of templatePaths) {
      const template = readTemplate(templatePath);
      const placeholders = detectPlaceholders(template);
      expect(
        placeholders.length,
        `${templatePath} should have detected placeholders`,
      ).toBeGreaterThan(0);
      const values = fakeValuesFor(placeholders);

      try {
        fillDocx(template, values);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        expect(message, `${templatePath} should not throw Multi error`).not.toMatch(/multi error/i);
        throw error;
      }
    }
  });
});
