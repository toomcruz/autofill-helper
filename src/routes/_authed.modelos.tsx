import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, FileStack, Trash2, Loader2 } from "lucide-react";
import { PROCESSES } from "@/lib/processes";
import { analyzeTemplate } from "@/lib/attendances.functions";

export const Route = createFileRoute("/_authed/modelos")({
  component: Templates,
});

function Templates() {
  const qc = useQueryClient();
  const analyzeFn = useServerFn(analyzeTemplate);
  const [name, setName] = useState("");
  const [processKey, setProcessKey] = useState<string>("any");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["templates-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function upload() {
    if (!file || !name) return toast.error("Nome e arquivo obrigatórios");
    if (!file.name.toLowerCase().endsWith(".docx")) return toast.error("Envie um arquivo .docx");
    setSubmitting(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id!;
      const path = `${userId}/${crypto.randomUUID()}.docx`;
      const { error: upErr } = await supabase.storage
        .from("document-templates")
        .upload(path, file, {
          contentType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });
      if (upErr) throw upErr;

      const { placeholders } = await analyzeFn({ data: { storagePath: path } });

      const { error: insErr } = await supabase.from("document_templates").insert({
        user_id: userId,
        name,
        process: processKey === "any" ? null : processKey,
        storage_path: path,
        placeholders,
      });
      if (insErr) throw insErr;

      toast.success(`Modelo salvo. ${placeholders.length} campos detectados.`);
      setName("");
      setFile(null);
      setProcessKey("any");
      qc.invalidateQueries({ queryKey: ["templates-all"] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao enviar modelo");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string, path: string) {
    if (!confirm("Excluir modelo?")) return;
    await supabase.storage.from("document-templates").remove([path]);
    await supabase.from("document_templates").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["templates-all"] });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Modelos de documento</h1>
        <p className="text-sm text-muted-foreground">
          Envie arquivos .docx com placeholders como <code className="text-xs bg-muted px-1 rounded">{"{nome_falecido}"}</code>. O sistema detecta os campos automaticamente.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novo modelo</CardTitle>
          <CardDescription>Somente arquivos .docx são suportados.</CardDescription>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="tpl-name">Nome</Label>
            <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Autorização de sepultamento" />
          </div>
          <div className="space-y-2">
            <Label>Processo</Label>
            <Select value={processKey} onValueChange={setProcessKey}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Todos os processos</SelectItem>
                {PROCESSES.map((p) => (
                  <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="tpl-file">Arquivo</Label>
            <label htmlFor="tpl-file" className="flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer hover:bg-accent">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{file?.name ?? "Escolher .docx"}</span>
              <input id="tpl-file" type="file" accept=".docx" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <div className="sm:col-span-2">
            <Button onClick={upload} disabled={submitting || !file || !name}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Enviar modelo
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="font-medium">Modelos ({templates?.length ?? 0})</h2>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : !templates?.length ? (
          <Card className="border-dashed">
            <CardContent className="py-10 flex flex-col items-center text-center gap-2">
              <FileStack className="h-6 w-6 text-muted-foreground" />
              <div className="text-sm text-muted-foreground">Nenhum modelo cadastrado ainda.</div>
            </CardContent>
          </Card>
        ) : (
          templates.map((t) => (
            <Card key={t.id}>
              <CardContent className="py-4 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{t.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {t.process ? PROCESSES.find((p) => p.key === t.process)?.label ?? t.process : "Todos"}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {(t.placeholders as string[])?.length ?? 0} campos: {(t.placeholders as string[])?.slice(0, 8).join(", ")}
                    {(t.placeholders as string[])?.length > 8 ? "…" : ""}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => remove(t.id, t.storage_path)} className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
