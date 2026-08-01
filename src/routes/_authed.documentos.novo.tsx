import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage } from "@/lib/error-message";

type DocumentOption = {
  key: string;
  label: string;
  description: string;
  process: "sepultamento" | "exumacao" | "ossario" | "translado" | "atualizacao_cadastral";
  subprocess?: string;
};

const DOCUMENTS: DocumentOption[] = [
  {
    key: "ordem_exumacao",
    label: "Ordem de Exumação",
    description: "Extrai os dados e prepara a ordem para conferência e geração.",
    process: "exumacao",
    subprocess: "jazigo",
  },
  {
    key: "termo_compromisso",
    label: "Termo de Compromisso",
    description: "Prepara o termo vinculado ao atendimento de exumação ou sepultamento.",
    process: "exumacao",
    subprocess: "jazigo",
  },
  {
    key: "identificacao_velorio",
    label: "Identificação de Velório",
    description: "Organiza os dados do falecido, sala, datas e horários do velório.",
    process: "sepultamento",
    subprocess: "jazigo",
  },
  {
    key: "mesa_condolencias",
    label: "Mesa de Condolências",
    description: "Gera a identificação usada na mesa de condolências.",
    process: "sepultamento",
    subprocess: "jazigo",
  },
  {
    key: "carta_concessao",
    label: "Carta de Concessão",
    description: "Prepara os dados cadastrais e do jazigo para a concessão.",
    process: "atualizacao_cadastral",
  },
  {
    key: "ossario_aquisicao",
    label: "Aquisição de Ossuário",
    description: "Prepara o documento de aquisição de ossuário.",
    process: "ossario",
    subprocess: "aquisicao",
  },
  {
    key: "ossario_renovacao",
    label: "Renovação de Ossuário",
    description: "Prepara o documento de renovação e mantém os dados editáveis.",
    process: "ossario",
    subprocess: "renovacao",
  },
];

const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_FILES = 20;
const MAX_FILE_SIZE = 15 * 1024 * 1024;

export const Route = createFileRoute("/_authed/documentos/novo")({
  component: NewDocument,
});

function NewDocument() {
  const navigate = useNavigate();
  const [documentKey, setDocumentKey] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selected = useMemo(
    () => DOCUMENTS.find((document) => document.key === documentKey),
    [documentKey],
  );

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;

    const accepted: File[] = [];
    for (const file of Array.from(fileList)) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: formato não aceito. Use PDF, JPG, PNG ou WEBP.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: o arquivo ultrapassa 15 MB.`);
        continue;
      }
      accepted.push(file);
    }

    setFiles((current) => [...current, ...accepted].slice(0, MAX_FILES));
  }

  async function submit() {
    if (!selected) return toast.error("Escolha o documento que será gerado.");
    if (!files.length) return toast.error("Envie pelo menos um arquivo.");

    setSubmitting(true);
    try {
      const { data: userResult } = await supabase.auth.getUser();
      const userId = userResult.user?.id;
      if (!userId) throw new Error("Sessão expirada");

      const { data: attendance, error: attendanceError } = await supabase
        .from("attendances")
        .insert({
          user_id: userId,
          process: selected.process,
          subprocess: selected.subprocess ?? null,
          subprocess_details: {
            document_key: selected.key,
            document_label: selected.label,
            source: "documentos_inteligentes",
          },
          notes: notes || null,
          status: "extracting",
        })
        .select("id")
        .single();

      if (attendanceError) throw attendanceError;

      for (const file of files) {
        const extension = file.name.split(".").pop()?.toLowerCase() || (file.type === "application/pdf" ? "pdf" : "jpg");
        const storagePath = `${userId}/${attendance.id}/${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("attendance-images")
          .upload(storagePath, file, { contentType: file.type });
        if (uploadError) throw uploadError;

        const { error: imageRowError } = await supabase.from("attendance_images").insert({
          attendance_id: attendance.id,
          user_id: userId,
          storage_path: storagePath,
          original_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
        });
        if (imageRowError) throw imageRowError;
      }

      toast.success("Arquivos enviados. Revise os dados extraídos antes de gerar o documento.");
      navigate({ to: "/atendimento/$id", params: { id: attendance.id } });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Não foi possível iniciar o documento"));
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Documentos inteligentes</p>
        <h1 className="text-2xl font-semibold tracking-tight">Novo documento</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha o modelo, envie fotos ou PDFs e confira os dados antes da geração.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Escolha o documento</CardTitle>
          <CardDescription>O tipo escolhido define quais dados e regras serão aplicados.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DOCUMENTS.map((document) => (
            <button
              key={document.key}
              type="button"
              onClick={() => setDocumentKey(document.key)}
              className={cn(
                "rounded-lg border p-4 text-left transition-colors hover:border-primary hover:bg-accent/50",
                documentKey === document.key && "border-primary bg-accent",
              )}
            >
              <FileText className="mb-3 h-5 w-5 text-muted-foreground" />
              <div className="font-medium">{document.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">{document.description}</div>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Envie os documentos de origem</CardTitle>
          <CardDescription>
            Aceita PDF, JPG, PNG e WEBP. Até {MAX_FILES} arquivos de 15 MB cada.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label
            htmlFor="document-files"
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors hover:border-primary"
          >
            <Upload className="mb-2 h-7 w-7 text-muted-foreground" />
            <span className="text-sm font-medium">Clique para escolher fotos ou PDFs</span>
            <span className="text-xs text-muted-foreground">Também é possível selecionar vários arquivos</span>
            <input
              id="document-files"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(event) => addFiles(event.target.files)}
            />
          </label>

          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((file, index) => (
                <div key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center gap-3 rounded-md border p-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{file.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {file.type === "application/pdf" ? "PDF" : "Imagem"} · {(file.size / 1024 / 1024).toFixed(1)} MB
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setFiles((current) => current.filter((_, position) => position !== index))}
                    aria-label={`Remover ${file.name}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="document-notes">Observações</Label>
            <Textarea
              id="document-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Informações que não aparecem nos arquivos ou orientações para o preenchimento"
              rows={3}
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={submit} disabled={submitting || !selected || !files.length}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar, extrair e conferir
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
