import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { detectPlaceholders, fillDocx } from "../docx.server";

function readTemplate(path: string): ArrayBuffer {
  const buffer = readFileSync(path);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
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
});
