/**
 * Server function que executa a nova extração por imagem para um atendimento.
 *
 * - Baixa imagens do Storage, converte para dataURL.
 * - Chama o pipeline por imagem com concorrência limitada.
 * - Reduz no estado da sessão de visão (preservando confirmações anteriores).
 * - Persiste o estado em `attendances.extracted_data._vision`.
 * - NÃO altera as chaves planas de `extracted_data` mantidas pelo fluxo antigo,
 *   preservando geração de DOCX e sincronização de agenda existentes.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  attendanceId: z.string().uuid(),
});

export const extractAttendanceVision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => Input.parse(value))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: attendance, error: attendanceError } = await supabase
      .from("attendances")
      .select("id, process, subprocess, subprocess_details, extracted_data")
      .eq("id", data.attendanceId)
      .single();
    if (attendanceError || !attendance) throw new Error("Atendimento não encontrado");

    const { data: images, error: imageError } = await supabase
      .from("attendance_images")
      .select("id, storage_path, mime_type, original_name")
      .eq("attendance_id", data.attendanceId);
    if (imageError) throw new Error(imageError.message);
    if (!images?.length) throw new Error("Nenhuma imagem enviada");

    const { extractAttendanceVisionCore } = await import("./extract-attendance.core");

    // Prepara imagens em dataURL.
    const prepared: Array<{
      imageId: string;
      fileName: string;
      mimeType: string;
      size: number;
      hash: string;
      imageUrl: string;
    }> = [];
    for (const image of images) {
      const { data: blob, error } = await supabase.storage
        .from("attendance-images")
        .download(image.storage_path);
      if (error || !blob) continue;
      const buffer = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      for (let i = 0; i < buffer.length; i += 1) binary += String.fromCharCode(buffer[i]);
      const base64 = btoa(binary);
      const mime = image.mime_type || "image/jpeg";
      prepared.push({
        imageId: image.id,
        fileName: image.original_name ?? image.id,
        mimeType: mime,
        size: buffer.length,
        hash: "",
        imageUrl: `data:${mime};base64,${base64}`,
      });
    }
    if (!prepared.length) throw new Error("Não foi possível ler as imagens enviadas");

    // Estado anterior (preserva confirmações do usuário).
    const rawExtracted = (attendance.extracted_data ?? {}) as Record<string, unknown>;
    const previousState =
      rawExtracted && typeof rawExtracted === "object" && "_vision" in rawExtracted
        ? ((rawExtracted as { _vision?: unknown })._vision as
            Awaited<ReturnType<typeof extractAttendanceVisionCore>>["state"] | undefined)
        : undefined;

    const { state, errors } = await extractAttendanceVisionCore({
      images: prepared,
      processLabel: attendance.process,
      contextHints: `Subprocesso: ${attendance.subprocess ?? "-"}. Detalhes: ${JSON.stringify(
        attendance.subprocess_details ?? {},
      )}`,
      previousState,
    });

    const nextExtracted = {
      ...(rawExtracted as Record<string, unknown>),
      _vision: state,
    };

    const { error: saveError } = await supabase
      .from("attendances")
      .update({ extracted_data: nextExtracted, status: "reviewing" })
      .eq("id", data.attendanceId);
    if (saveError) throw new Error(saveError.message);

    return { state, errors };
  });
