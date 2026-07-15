import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// -------- Extract data from attendance images --------
const ExtractInput = z.object({ attendanceId: z.string().uuid() });

export const extractAttendanceData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => ExtractInput.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Load attendance
    const { data: att, error: attErr } = await supabase
      .from("attendances")
      .select("id, process, subprocess, subprocess_details")
      .eq("id", data.attendanceId)
      .single();
    if (attErr || !att) throw new Error("Atendimento não encontrado");

    // Load images
    const { data: imgs, error: imgErr } = await supabase
      .from("attendance_images")
      .select("storage_path, mime_type")
      .eq("attendance_id", data.attendanceId);
    if (imgErr) throw new Error(imgErr.message);
    if (!imgs?.length) throw new Error("Nenhuma imagem enviada");

    // Load user templates for this process to collect placeholders
    const { data: tpls } = await supabase
      .from("document_templates")
      .select("placeholders, process")
      .eq("user_id", userId);
    const fieldSet = new Set<string>();
    for (const t of tpls ?? []) {
      if (!t.process || t.process === att.process) {
        for (const p of (t.placeholders as string[]) ?? []) fieldSet.add(p);
      }
    }
    // Always include common fallback fields
    for (const f of [
      "nome_falecido",
      "cpf_falecido",
      "data_nascimento",
      "data_falecimento",
      "data_sepultamento",
      "local_sepultamento",
      "nome_responsavel",
      "cpf_responsavel",
      "endereco",
      "telefone",
    ])
      fieldSet.add(f);

    // Download each image and convert to data URL
    const imageDataUrls: string[] = [];
    for (const img of imgs) {
      const { data: blob, error } = await supabase.storage
        .from("attendance-images")
        .download(img.storage_path);
      if (error || !blob) continue;
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      const b64 = btoa(bin);
      const mime = img.mime_type || "image/jpeg";
      imageDataUrls.push(`data:${mime};base64,${b64}`);
    }

    const { extractFromImages } = await import("./ai-extract.server");
    const extracted = await extractFromImages({
      imageDataUrls,
      fields: Array.from(fieldSet),
      processLabel: att.process,
      contextHints: `Subprocesso: ${att.subprocess ?? "-"}. Detalhes: ${JSON.stringify(att.subprocess_details)}`,
    });

    await supabase
      .from("attendances")
      .update({ extracted_data: extracted, status: "reviewing" })
      .eq("id", data.attendanceId);

    return { data: extracted };
  });

// -------- Generate a filled document --------
const GenerateInput = z.object({
  attendanceId: z.string().uuid(),
  templateId: z.string().uuid(),
});

export const generateDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => GenerateInput.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: att } = await supabase
      .from("attendances")
      .select("id, extracted_data, process")
      .eq("id", data.attendanceId)
      .single();
    if (!att) throw new Error("Atendimento não encontrado");

    const { data: tpl } = await supabase
      .from("document_templates")
      .select("id, name, storage_path")
      .eq("id", data.templateId)
      .single();
    if (!tpl) throw new Error("Modelo não encontrado");

    const { data: blob, error: dlErr } = await supabase.storage
      .from("document-templates")
      .download(tpl.storage_path);
    if (dlErr || !blob) throw new Error("Falha ao baixar modelo");

    const buf = await blob.arrayBuffer();
    const { fillDocx } = await import("./docx.server");
    const filled = fillDocx(buf, (att.extracted_data as Record<string, string>) ?? {});

    const safeName = tpl.name.replace(/[^\w.-]+/g, "_");
    const outPath = `${userId}/${data.attendanceId}/${Date.now()}_${safeName}.docx`;
    const { error: upErr } = await supabase.storage
      .from("generated-documents")
      .upload(outPath, filled, {
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: false,
      });
    if (upErr) throw new Error(upErr.message);

    const { data: rec, error: recErr } = await supabase
      .from("generated_documents")
      .insert({
        attendance_id: data.attendanceId,
        template_id: data.templateId,
        user_id: userId,
        name: tpl.name,
        storage_path: outPath,
      })
      .select("id, name, storage_path, created_at")
      .single();
    if (recErr) throw new Error(recErr.message);

    return rec;
  });

// -------- Detect template placeholders on upload --------
const TplInput = z.object({ storagePath: z.string() });

export const analyzeTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => TplInput.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: blob, error } = await supabase.storage
      .from("document-templates")
      .download(data.storagePath);
    if (error || !blob) throw new Error("Não foi possível ler o modelo");
    const buf = await blob.arrayBuffer();
    const { detectPlaceholders } = await import("./docx.server");
    const placeholders = detectPlaceholders(buf);
    return { placeholders };
  });

// -------- Signed URL for generated document download --------
const SignedInput = z.object({ bucket: z.string(), path: z.string() });

export const getSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => SignedInput.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: signed, error } = await supabase.storage
      .from(data.bucket)
      .createSignedUrl(data.path, 300);
    if (error || !signed) throw new Error(error?.message || "Falha ao gerar URL");
    return { url: signed.signedUrl };
  });
