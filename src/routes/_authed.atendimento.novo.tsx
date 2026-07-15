import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PROCESSES, getProcess } from "@/lib/processes";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Loader2, Upload, X } from "lucide-react";

export const Route = createFileRoute("/_authed/atendimento/novo")({
  component: NewAttendance,
});

type Step = "process" | "details" | "upload";

function NewAttendance() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("process");
  const [processKey, setProcessKey] = useState<string>("");
  const [subprocess, setSubprocess] = useState<string>("");
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const proc = getProcess(processKey);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const arr = Array.from(list).filter((f) => f.type.startsWith("image/"));
    setFiles((prev) => [...prev, ...arr].slice(0, 20));
  }

  async function submit() {
    if (!proc) return;
    if (!files.length) return toast.error("Envie pelo menos uma imagem");
    setSubmitting(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId) throw new Error("Sessão expirada");

      const { data: att, error: attErr } = await supabase
        .from("attendances")
        .insert({
          user_id: userId,
          process: proc.key,
          subprocess: subprocess || null,
          subprocess_details: extras,
          notes: notes || null,
          status: "extracting",
        })
        .select("id")
        .single();
      if (attErr) throw attErr;

      for (const f of files) {
        const ext = f.name.split(".").pop() ?? "jpg";
        const path = `${userId}/${att.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("attendance-images")
          .upload(path, f, { contentType: f.type });
        if (upErr) throw upErr;
        const { error: rowErr } = await supabase.from("attendance_images").insert({
          attendance_id: att.id,
          user_id: userId,
          storage_path: path,
          original_name: f.name,
          mime_type: f.type,
          size_bytes: f.size,
        });
        if (rowErr) throw rowErr;
      }

      navigate({ to: "/atendimento/$id", params: { id: att.id } });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao criar atendimento");
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <button onClick={() => navigate({ to: "/dashboard" })} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Voltar
        </button>
        <h1 className="text-2xl font-semibold tracking-tight mt-2">Novo atendimento</h1>
      </div>

      <Stepper current={step} />

      {step === "process" && (
        <Card>
          <CardHeader>
            <CardTitle>Qual o processo?</CardTitle>
            <CardDescription>Escolha o tipo de atendimento.</CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3">
            {PROCESSES.map((p) => (
              <button
                key={p.key}
                onClick={() => {
                  setProcessKey(p.key);
                  setSubprocess("");
                  setExtras({});
                  setStep("details");
                }}
                className={cn(
                  "text-left p-4 rounded-lg border transition-colors hover:border-primary hover:bg-accent/50",
                  processKey === p.key && "border-primary bg-accent/50",
                )}
              >
                <div className="font-medium">{p.label}</div>
                <div className="text-xs text-muted-foreground mt-1">{p.description}</div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {step === "details" && proc && (
        <Card>
          <CardHeader>
            <CardTitle>{proc.label}</CardTitle>
            <CardDescription>Defina os detalhes do atendimento.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {proc.subprocessOptions && (
              <div className="space-y-2">
                <Label>{proc.subprocessLabel}</Label>
                <div className="grid sm:grid-cols-3 gap-2">
                  {proc.subprocessOptions.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setSubprocess(o.value)}
                      className={cn(
                        "p-3 rounded-md border text-sm text-center transition-colors hover:border-primary",
                        subprocess === o.value && "border-primary bg-accent",
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {proc.extraFields?.map((f) => (
              <div key={f.name} className="space-y-2">
                <Label htmlFor={f.name}>{f.label}</Label>
                <Input
                  id={f.name}
                  value={extras[f.name] ?? ""}
                  onChange={(e) => setExtras({ ...extras, [f.name]: e.target.value })}
                />
              </div>
            ))}
            <div className="space-y-2">
              <Label htmlFor="notes">Observações (opcional)</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep("process")}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <Button
                onClick={() => setStep("upload")}
                disabled={!!proc.subprocessOptions && !subprocess}
              >
                Continuar <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>Envie prints e fotos</CardTitle>
            <CardDescription>A IA extrai os dados automaticamente.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label
              htmlFor="files"
              className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer hover:border-primary transition-colors"
            >
              <Upload className="h-6 w-6 text-muted-foreground mb-2" />
              <span className="text-sm font-medium">Clique para escolher imagens</span>
              <span className="text-xs text-muted-foreground">PNG, JPG · até 20 arquivos</span>
              <input
                id="files"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
            </label>

            {files.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {files.map((f, i) => (
                  <div key={i} className="relative group aspect-square rounded-md overflow-hidden border bg-muted">
                    <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setFiles(files.filter((_, j) => j !== i))}
                      className="absolute top-1 right-1 p-1 rounded-full bg-background/90 opacity-0 group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep("details")} disabled={submitting}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <Button onClick={submit} disabled={submitting || !files.length}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Enviar e extrair
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stepper({ current }: { current: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "process", label: "Processo" },
    { key: "details", label: "Detalhes" },
    { key: "upload", label: "Imagens" },
  ];
  const idx = steps.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2 flex-1">
          <div
            className={cn(
              "h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium border",
              i <= idx ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground",
            )}
          >
            {i + 1}
          </div>
          <span className={cn("text-xs", i === idx ? "font-medium" : "text-muted-foreground")}>{s.label}</span>
          {i < steps.length - 1 && <div className="flex-1 h-px bg-border" />}
        </div>
      ))}
    </div>
  );
}
