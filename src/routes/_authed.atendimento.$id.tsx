import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, CheckCircle2, FileDown, FileText, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { getProcess } from "@/lib/processes";
import { getErrorMessage } from "@/lib/error-message";
import { extractAttendanceData, generateDocument, getSignedUrl } from "@/lib/attendances.functions";
import { extractAttendanceVision } from "@/lib/vision/extract-attendance.functions";
import { flattenVisionState } from "@/lib/vision/flatten-vision";
import type { VisionState } from "@/lib/vision/attendance-vision-store";
import type { FlatFieldMeta } from "@/lib/vision/flatten-vision";
import { isTemplateApplicable } from "@/lib/official-templates";

export const Route = createFileRoute("/_authed/atendimento/$id")({
  component: AttendanceDetail,
});

function AttendanceDetail() {
  const { id } = useParams({ from: "/_authed/atendimento/$id" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const extractFn = useServerFn(extractAttendanceData);
  const extractVisionFn = useServerFn(extractAttendanceVision);
  const generateFn = useServerFn(generateDocument);
  const signFn = useServerFn(getSignedUrl);

  const { data: att, isLoading } = useQuery({
    queryKey: ["attendance", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("attendances").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
    refetchInterval: (query) => {
      const status = (query.state.data as { status?: string } | undefined)?.status;
      return status === "extracting" ? 2000 : false;
    },
  });

  const { data: images } = useQuery({
    queryKey: ["attendance-images", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_images")
        .select("id, storage_path, original_name")
        .eq("attendance_id", id);
      if (error) throw error;
      return data;
    },
  });

  const { data: templates } = useQuery({
    queryKey: ["templates", att?.process, att?.subprocess],
    enabled: !!att,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_templates")
        .select("id, name, process, placeholders, storage_path")
        .or(`process.eq.${att!.process},process.is.null`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: generated } = useQuery({
    queryKey: ["generated", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_documents")
        .select("id, name, storage_path, created_at, template_id")
        .eq("attendance_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [fields, setFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  useEffect(() => {
    if (att?.extracted_data) setFields(att.extracted_data as Record<string, string>);
  }, [att?.extracted_data]);

  const applicableTemplates = useMemo(() => {
    if (!att) return [];
    return (templates ?? []).filter((template) =>
      isTemplateApplicable(template, {
        process: att.process,
        subprocess: att.subprocess,
        subprocessDetails: (att.subprocess_details as Record<string, unknown>) ?? {},
        extractedData: (att.extracted_data as Record<string, unknown>) ?? {},
      }),
    );
  }, [att, templates]);

  const allFields = useMemo(() => {
    const fieldsSet = new Set<string>();
    for (const key of Object.keys(fields)) fieldsSet.add(key);
    for (const template of applicableTemplates) {
      for (const placeholder of (template.placeholders as string[]) ?? []) {
        fieldsSet.add(placeholder);
      }
    }
    return Array.from(fieldsSet).sort();
  }, [fields, applicableTemplates]);

  async function triggerExtract(autoGenerate = false) {
    setExtracting(true);
    try {
      const result = await extractFn({ data: { attendanceId: id } });
      await qc.invalidateQueries({ queryKey: ["attendance", id] });
      toast.success("Dados extraídos");
      const extracted = (result?.data ?? {}) as Record<string, string>;
      setFields(extracted);
      if (autoGenerate && att) {
        const applicable = (templates ?? []).filter((template) =>
          isTemplateApplicable(template, {
            process: att.process,
            subprocess: att.subprocess,
            subprocessDetails: (att.subprocess_details as Record<string, unknown>) ?? {},
            extractedData: extracted,
          }),
        );
        if (applicable.length) {
          for (const template of applicable) {
            setGeneratingId(template.id);
            try {
              await generateFn({ data: { attendanceId: id, templateId: template.id } });
            } catch (error: unknown) {
              toast.error(`${template.name}: ${getErrorMessage(error, "Falha ao gerar")}`);
            }
          }
          setGeneratingId(null);
          await supabase.from("attendances").update({ status: "done" }).eq("id", id);
          await qc.invalidateQueries({ queryKey: ["generated", id] });
          await qc.invalidateQueries({ queryKey: ["attendance", id] });
          toast.success("Pacote gerado");
        }
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Falha na extração"));
    } finally {
      setExtracting(false);
    }
  }

  useEffect(() => {
    if (
      att?.status === "extracting" &&
      !Object.keys(att.extracted_data ?? {}).length &&
      !extracting
    ) {
      triggerExtract(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [att?.status]);

  async function saveFields() {
    setSaving(true);
    const { error } = await supabase
      .from("attendances")
      .update({ extracted_data: fields, status: "reviewing" })
      .eq("id", id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Dados salvos");
    qc.invalidateQueries({ queryKey: ["attendance", id] });
  }

  async function handleGenerate(templateId: string) {
    await supabase.from("attendances").update({ extracted_data: fields }).eq("id", id);
    setGeneratingId(templateId);
    try {
      await generateFn({ data: { attendanceId: id, templateId } });
      toast.success("Documento gerado");
      qc.invalidateQueries({ queryKey: ["generated", id] });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Falha ao gerar"));
    } finally {
      setGeneratingId(null);
    }
  }

  async function handleGenerateAll() {
    if (!applicableTemplates.length) {
      return toast.error("Nenhum modelo aplicável a este atendimento.");
    }
    await supabase.from("attendances").update({ extracted_data: fields }).eq("id", id);
    for (const template of applicableTemplates) {
      setGeneratingId(template.id);
      try {
        await generateFn({ data: { attendanceId: id, templateId: template.id } });
      } catch (error: unknown) {
        toast.error(`${template.name}: ${getErrorMessage(error, "Falha ao gerar")}`);
      }
    }
    setGeneratingId(null);
    await supabase.from("attendances").update({ status: "done" }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["generated", id] });
    qc.invalidateQueries({ queryKey: ["attendance", id] });
    toast.success("Pacote gerado");
  }

  async function download(bucket: string, path: string) {
    try {
      const { url } = await signFn({ data: { bucket, path } });
      window.open(url, "_blank");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Falha ao baixar documento"));
    }
  }

  async function deleteAttendance() {
    if (!confirm("Excluir este atendimento e todos os documentos?")) return;
    await supabase.from("attendances").delete().eq("id", id);
    toast.success("Atendimento excluído");
    navigate({ to: "/dashboard" });
  }

  if (isLoading || !att) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const proc = getProcess(att.process);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            onClick={() => navigate({ to: "/dashboard" })}
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-3 w-3" /> Voltar
          </button>
          <h1 className="text-2xl font-semibold tracking-tight mt-2">
            {proc?.label ?? att.process}
          </h1>
          <div className="text-sm text-muted-foreground">
            {att.subprocess ? (
              <Badge variant="outline" className="mr-2">
                {att.subprocess}
              </Badge>
            ) : null}
            Status: <span className="font-medium">{att.status}</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={deleteAttendance}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid lg:grid-cols-[1fr,320px] gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle>Dados extraídos</CardTitle>
                <CardDescription>Revise e corrija antes de gerar os documentos.</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => triggerExtract(false)}
                disabled={extracting}
                className="gap-2"
              >
                {extracting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                Re-extrair
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {extracting && !Object.keys(fields).length && (
                <div className="text-sm text-muted-foreground flex items-center gap-2 py-4">
                  <Loader2 className="h-4 w-4 animate-spin" /> Analisando imagens com IA…
                </div>
              )}
              {allFields.length === 0 && !extracting && (
                <p className="text-sm text-muted-foreground">
                  Nenhum dado ainda. Instale os modelos oficiais ou adicione modelos com
                  placeholders {"{campo}"} em{" "}
                  <a className="underline" href="/modelos">
                    Modelos
                  </a>
                  , depois clique em Re-extrair.
                </p>
              )}
              <div className="grid sm:grid-cols-2 gap-3">
                {allFields.map((key) => (
                  <div key={key} className="space-y-1">
                    <Label htmlFor={key} className="text-xs">
                      {key}
                    </Label>
                    <Input
                      id={key}
                      value={fields[key] ?? ""}
                      onChange={(event) => setFields({ ...fields, [key]: event.target.value })}
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const fieldName = prompt("Nome do campo (ex: nome_falecido)");
                    if (fieldName) setFields({ ...fields, [fieldName.trim()]: "" });
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" /> Adicionar campo
                </Button>
                <Button size="sm" onClick={saveFields} disabled={saving}>
                  {saving && <Loader2 className="h-3 w-3 animate-spin mr-1" />} Salvar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Documentos</CardTitle>
                <CardDescription>
                  Modelos aplicáveis ao processo e à modalidade escolhida.
                </CardDescription>
              </div>
              {!!applicableTemplates.length && (
                <Button
                  size="sm"
                  onClick={handleGenerateAll}
                  disabled={!!generatingId}
                  className="gap-2"
                >
                  <FileDown className="h-3 w-3" /> Gerar todos
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {!applicableTemplates.length && (
                <div className="text-sm text-muted-foreground">
                  Nenhum modelo aplicável. Instale os modelos oficiais em{" "}
                  <a className="underline" href="/modelos">
                    Modelos
                  </a>
                  .
                </div>
              )}
              {applicableTemplates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between border rounded-md px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">{template.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {(template.placeholders as string[])?.length ?? 0} campos
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleGenerate(template.id)}
                    disabled={generatingId === template.id}
                  >
                    {generatingId === template.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Gerar"
                    )}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {!!generated?.length && (
            <Card>
              <CardHeader>
                <CardTitle>Documentos gerados</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {generated.map((document) => (
                  <div
                    key={document.id}
                    className="flex items-center justify-between border rounded-md px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{document.name}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => download("generated-documents", document.storage_path)}
                      className="gap-1"
                    >
                      <FileDown className="h-3 w-3" /> Baixar
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-3">
          <div className="text-sm font-medium">Imagens ({images?.length ?? 0})</div>
          <div className="grid grid-cols-2 gap-2">
            {images?.map((image) => (
              <ImageThumb key={image.id} path={image.storage_path} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ImageThumb({ path }: { path: string }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    supabase.storage
      .from("attendance-images")
      .createSignedUrl(path, 600)
      .then(({ data }) => {
        if (data?.signedUrl) setUrl(data.signedUrl);
      });
  }, [path]);
  return (
    <div className="aspect-square rounded-md overflow-hidden border bg-muted">
      {url && <img src={url} alt="" className="w-full h-full object-cover" />}
    </div>
  );
}
