from pathlib import Path

path = Path("src/routes/_authed.modelos.tsx")
text = path.read_text(encoding="utf-8")

start_marker = "      const existingPaths = new Set((templates ?? []).map((template) => template.storage_path));"
end_marker = "    } catch (error: unknown) {"
start = text.index(start_marker)
end = text.index(end_marker, start)

replacement = '''      const existingByPath = new Map(
        (templates ?? []).flatMap((template) =>
          template.storage_path ? ([[template.storage_path, template]] as const) : [],
        ),
      );
      const fileCache = new Map<string, Blob>();
      let installed = 0;
      let updated = 0;

      for (const variant of officialVariants) {
        const storagePath = officialStoragePath(userId, variant.storageId);
        const existingTemplate = existingByPath.get(storagePath);

        let blob = fileCache.get(variant.file);
        if (!blob) {
          const response = await fetch(`/templates/official/${variant.file}`);
          if (!response.ok) {
            throw new Error(`Arquivo oficial ausente: ${variant.file}`);
          }
          blob = await response.blob();
          fileCache.set(variant.file, blob);
        }

        const { error: uploadError } = await supabase.storage
          .from("document-templates")
          .upload(storagePath, blob, {
            contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            upsert: true,
          });
        if (uploadError) throw uploadError;

        if (existingTemplate) {
          const { error: updateError } = await supabase
            .from("document_templates")
            .update({
              name: variant.name,
              process: variant.process,
              placeholders: variant.placeholders,
            })
            .eq("id", existingTemplate.id);
          if (updateError) throw updateError;
          updated += 1;
          continue;
        }

        const { error: insertError } = await supabase.from("document_templates").insert({
          user_id: userId,
          name: variant.name,
          process: variant.process,
          storage_path: storagePath,
          placeholders: variant.placeholders,
        });

        if (insertError) {
          await supabase.storage.from("document-templates").remove([storagePath]);
          throw insertError;
        }

        installed += 1;
      }

      await qc.invalidateQueries({ queryKey: ["templates-all"] });
      const result = [
        installed ? `${installed} modelo(s) instalado(s)` : "",
        updated ? `${updated} modelo(s) atualizado(s)` : "",
      ].filter(Boolean);
      toast.success(
        result.length ? `${result.join(" · ")}.` : "Os modelos oficiais já estavam atualizados.",
      );
'''

text = text[:start] + replacement + text[end:]
text = text.replace('? "Modelos instalados"', '? "Atualizar modelos oficiais"')
path.write_text(text, encoding="utf-8")
