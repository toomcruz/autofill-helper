OUTPUTS = {
    "ordem-sepultamento.docx": "public/templates/official/sepultamento/ordem-sepultamento.docx",
    "ordem-sepultamento-jazigo.docx": "public/templates/official/sepultamento/ordem-sepultamento-jazigo.docx",
    "ordem-exumacao.docx": "public/templates/official/exumacao/ordem-exumacao.docx",
    "ordem-exumacao-jazigo.docx": "public/templates/official/exumacao/ordem-exumacao-jazigo.docx",
    "atualizacao-cadastral.docx": "public/templates/official/atualizacao-cadastral/atualizacao-cadastral.docx",
    "aquisicao-renovacao-ossuario.docx": "public/templates/official/ossuario/aquisicao-renovacao-ossuario.docx",
    "renovacao-ossuario.docx": "public/templates/official/ossuario/renovacao-ossuario.docx",
}

def scrub_docx_package(source: Path, destination: Path) -> None:
    temp = destination.with_suffix('.tmp.docx')
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(source, 'r') as zin, zipfile.ZipFile(temp, 'w', zipfile.ZIP_DEFLATED) as zout:
        removed_relationship_ids = set()
        removed_paths = set()
        entries = {item.filename: zin.read(item.filename) for item in zin.infolist()}
        document_name = 'word/document.xml'
        if document_name in entries:
            xml = entries[document_name].decode('utf-8')
            def remove_ink_paragraph(match):
                paragraph = match.group(0)
                if '<w14:contentPart' not in paragraph:
                    return paragraph
                extent = re.search(r'<wp:extent[^>]*cx="(\d+)"[^>]*cy="(\d+)"', paragraph)
                if extent and (int(extent.group(1)) > 1000 or int(extent.group(2)) > 1000):
                    return paragraph
                removed_relationship_ids.update(re.findall(r'r:id="([^"]+)"', paragraph))
                return ''
            entries[document_name] = re.sub(r'<w:p\b[\s\S]*?</w:p>', remove_ink_paragraph, xml).encode('utf-8')
        rels_name = 'word/_rels/document.xml.rels'
        if rels_name in entries and removed_relationship_ids:
            rels = entries[rels_name].decode('utf-8')
            def remove_relationship(match):
                relationship = match.group(0)
                rel_id = re.search(r'Id="([^"]+)"', relationship)
                if not rel_id or rel_id.group(1) not in removed_relationship_ids:
                    return relationship
                target = re.search(r'Target="([^"]+)"', relationship)
                if target:
                    target_value = target.group(1).replace('\\', '/')
                    while target_value.startswith('../'):
                        target_value = target_value[3:]
                    removed_paths.add('word/' + target_value.lstrip('/'))
                return ''
            entries[rels_name] = re.sub(r'<Relationship\b[^>]*/>', remove_relationship, rels).encode('utf-8')
        for name in list(entries):
            if name.startswith('word/ink/') or name.endswith('image1.emf'):
                removed_paths.add(name)
        content_types = '[Content_Types].xml'
        if content_types in entries:
            xml = entries[content_types].decode('utf-8')
            for name in removed_paths:
                xml = re.sub(rf'<Override\b[^>]*PartName="/{re.escape(name)}"[^>]*/>', '', xml)
            entries[content_types] = xml.encode('utf-8')
        app_name = 'docProps/app.xml'
        if app_name in entries:
            app_xml = entries[app_name].decode('utf-8')
            app_xml = re.sub(r'<Pages>\d+</Pages>', '<Pages>1</Pages>', app_xml)
            entries[app_name] = app_xml.encode('utf-8')
        core_name = 'docProps/core.xml'
        if core_name in entries:
            core = entries[core_name].decode('utf-8')
            core = re.sub(r'<dc:creator>.*?</dc:creator>', '<dc:creator>CONSOLARE</dc:creator>', core)
            core = re.sub(r'<cp:lastModifiedBy>.*?</cp:lastModifiedBy>', '<cp:lastModifiedBy>CONSOLARE</cp:lastModifiedBy>', core)
            entries[core_name] = core.encode('utf-8')
        for item in zin.infolist():
            if item.filename in removed_paths:
                continue
            data = entries.get(item.filename)
            if data is not None:
                zout.writestr(item, data)
    temp.replace(destination)

for filename, relative_path in OUTPUTS.items():
    scrub_docx_package(outdir / filename, repo_root / relative_path)

catalog_path = repo_root / 'public/templates/official/catalogo-modelos.json'
catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
base_files = {
    'ordem-sepultamento': repo_root / OUTPUTS['ordem-sepultamento.docx'],
    'ordem-exumacao': repo_root / OUTPUTS['ordem-exumacao.docx'],
    'aquisicao-renovacao-ossuario': repo_root / OUTPUTS['aquisicao-renovacao-ossuario.docx'],
    'atualizacao-cadastral': repo_root / OUTPUTS['atualizacao-cadastral.docx'],
}
for item in catalog:
    file_path = base_files.get(item.get('id'))
    if not file_path:
        continue
    item['tamanhoBytes'] = file_path.stat().st_size
    item['sha256'] = hashlib.sha256(file_path.read_bytes()).hexdigest()
    item['paginas'] = 1
catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
shutil.rmtree(outdir, ignore_errors=True)
print(f'Rebuilt {len(OUTPUTS)} official DOCX templates.')
