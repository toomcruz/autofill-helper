import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CalendarIcon, Loader2, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  applyLocalSepultamento,
  computeQuickDate,
  formatIsoToBr,
  HORARIOS_SEPULTAMENTO,
  SALAS_VELORIO,
  type TriagemSepultamentoState,
} from "@/lib/triagem-sepultamento";
import { readPlacaFromImage } from "@/lib/vision/read-placa.functions";
import { getErrorMessage } from "@/lib/error-message";

interface TriagemSepultamentoProps {
  subprocess: string;
  extras: Record<string, string>;
  onSubprocessChange: (value: string) => void;
  onExtrasChange: (patch: Record<string, string>) => void;
}

function BtnChip({
  selected,
  onClick,
  children,
  className,
  type = "button",
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={cn(
        "px-4 py-3 rounded-md border text-sm font-medium transition-colors",
        "hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-input bg-background hover:bg-accent",
        className,
      )}
      aria-pressed={selected}
    >
      {children}
    </button>
  );
}

export function TriagemSepultamento({
  subprocess,
  extras,
  onSubprocessChange,
  onExtrasChange,
}: TriagemSepultamentoProps) {
  const state: TriagemSepultamentoState = {
    subprocess,
    data_agendada: extras.data_agendada,
    hora_sepultamento: extras.hora_sepultamento,
    sala_velorio: extras.sala_velorio,
    sem_velorio: (extras.sem_velorio as "SIM" | "") || "",
    placa_identificacao: extras.placa_identificacao,
    placa_confirmada: (extras.placa_confirmada as "SIM" | "") || "",
  };

  const readPlaca = useServerFn(readPlacaFromImage);
  const fileRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [placaEncontrada, setPlacaEncontrada] = useState<string | null>(null);

  function pickLocal(local: "quadra_geral" | "jazigo") {
    onSubprocessChange(local);
    const derived = applyLocalSepultamento(local);
    onExtrasChange({ concessao: derived.concessao, quadra_geral_gaveta: derived.quadra_geral_gaveta });
  }

  function pickQuickDate(choice: "hoje" | "amanha" | "mais2") {
    onExtrasChange({ data_agendada: computeQuickDate(choice) });
  }

  function pickCalendarDate(date: Date | undefined) {
    if (!date) return;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    onExtrasChange({ data_agendada: `${y}-${m}-${d}` });
  }

  function pickHorario(horario: string) {
    onExtrasChange({ hora_sepultamento: horario });
  }

  function pickSala(letra: string) {
    onExtrasChange({ sala_velorio: letra, sem_velorio: "" });
  }

  function pickSemVelorio() {
    onExtrasChange({ sala_velorio: "", sem_velorio: "SIM" });
  }

  function updatePlacaText(value: string) {
    // Se editar manualmente, a placa deixa de estar "confirmada".
    onExtrasChange({ placa_identificacao: value, placa_confirmada: "" });
    setPlacaEncontrada(null);
  }

  async function handleReadPlaca(file: File) {
    setReading(true);
    setPlacaEncontrada(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler arquivo"));
        reader.readAsDataURL(file);
      });
      const { placa } = await readPlaca({ data: { imageDataUrl: dataUrl } });
      if (!placa) {
        toast.error("Não foi possível identificar a placa. Preencha manualmente.");
        return;
      }
      setPlacaEncontrada(placa);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Falha ao ler a placa"));
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function confirmarPlaca() {
    if (!placaEncontrada) return;
    onExtrasChange({ placa_identificacao: placaEncontrada, placa_confirmada: "SIM" });
    setPlacaEncontrada(null);
    toast.success("Placa confirmada");
  }

  function corrigirPlaca() {
    if (!placaEncontrada) return;
    onExtrasChange({ placa_identificacao: placaEncontrada, placa_confirmada: "" });
    setPlacaEncontrada(null);
  }

  return (
    <div className="space-y-6">
      {/* 1. Local do sepultamento */}
      <section className="space-y-2">
        <Label className="uppercase text-xs tracking-wide text-muted-foreground">
          Local do sepultamento
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <BtnChip selected={state.subprocess === "quadra_geral"} onClick={() => pickLocal("quadra_geral")}>
            QUADRA GERAL
          </BtnChip>
          <BtnChip selected={state.subprocess === "jazigo"} onClick={() => pickLocal("jazigo")}>
            JAZIGO
          </BtnChip>
        </div>
      </section>

      {/* 2. Data */}
      <section className="space-y-2">
        <Label className="uppercase text-xs tracking-wide text-muted-foreground">Data</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <BtnChip
            selected={state.data_agendada === computeQuickDate("hoje")}
            onClick={() => pickQuickDate("hoje")}
          >
            HOJE
          </BtnChip>
          <BtnChip
            selected={state.data_agendada === computeQuickDate("amanha")}
            onClick={() => pickQuickDate("amanha")}
          >
            AMANHÃ
          </BtnChip>
          <BtnChip
            selected={state.data_agendada === computeQuickDate("mais2")}
            onClick={() => pickQuickDate("mais2")}
          >
            +2 DIAS
          </BtnChip>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "px-4 py-3 rounded-md border text-sm font-medium transition-colors inline-flex items-center justify-center gap-2",
                  "hover:border-primary border-input bg-background hover:bg-accent",
                )}
              >
                <CalendarIcon className="h-4 w-4" /> OUTRA DATA
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={state.data_agendada ? new Date(`${state.data_agendada}T00:00`) : undefined}
                onSelect={pickCalendarDate}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
        {state.data_agendada && (
          <p className="text-sm text-muted-foreground">
            Data escolhida: <span className="font-medium text-foreground">{formatIsoToBr(state.data_agendada)}</span>
          </p>
        )}
      </section>

      {/* 3. Horário */}
      <section className="space-y-2">
        <Label className="uppercase text-xs tracking-wide text-muted-foreground">Horário</Label>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {HORARIOS_SEPULTAMENTO.map((h) => (
            <BtnChip key={h} selected={state.hora_sepultamento === h} onClick={() => pickHorario(h)}>
              {h}
            </BtnChip>
          ))}
        </div>
      </section>

      {/* 4. Sala */}
      <section className="space-y-2">
        <Label className="uppercase text-xs tracking-wide text-muted-foreground">Sala</Label>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {SALAS_VELORIO.map((s) => (
            <BtnChip
              key={s}
              selected={state.sem_velorio !== "SIM" && state.sala_velorio === s}
              onClick={() => pickSala(s)}
            >
              {s}
            </BtnChip>
          ))}
        </div>
        <BtnChip
          selected={state.sem_velorio === "SIM"}
          onClick={pickSemVelorio}
          className="w-full"
        >
          SEM VELÓRIO
        </BtnChip>
      </section>

      {/* 5. Placa */}
      <section className="space-y-2">
        <Label className="uppercase text-xs tracking-wide text-muted-foreground">
          Placa de identificação
        </Label>
        <div className="flex gap-2">
          <Input
            value={state.placa_identificacao ?? ""}
            onChange={(e) => updatePlacaText(e.target.value)}
            placeholder="Digite ou leia do print"
            aria-label="Placa de identificação"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={reading}
            className="gap-2 shrink-0"
          >
            {reading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            LER DO PRINT
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleReadPlaca(file);
            }}
          />
        </div>
        {placaEncontrada && (
          <div className="rounded-md border bg-muted/40 p-3 space-y-2">
            <div className="text-sm">
              Placa encontrada: <span className="font-semibold">{placaEncontrada}</span>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={confirmarPlaca}>
                CONFIRMAR
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={corrigirPlaca}>
                CORRIGIR
              </Button>
            </div>
          </div>
        )}
        {state.placa_confirmada === "SIM" && state.placa_identificacao && !placaEncontrada && (
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Upload className="h-3 w-3" /> Placa confirmada — será usada no documento.
          </p>
        )}
      </section>
    </div>
  );
}
