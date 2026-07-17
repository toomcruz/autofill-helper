def remove_numbering(paragraph):
    p_pr = paragraph._p.get_or_add_pPr()
    num_pr = p_pr.find(qn('w:numPr'))
    if num_pr is not None:
        p_pr.remove(num_pr)

for filename in ['ordem-sepultamento.docx', 'ordem-sepultamento-jazigo.docx']:
    path = outdir / filename
    doc = Document(path)
    table = doc.tables[0]
    table.cell(6, 0).vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.TOP
    set_row_height(table.rows[6], 7.5, exact=False)
    doc.save(path)

path = outdir / 'atualizacao-cadastral.docx'
doc = Document(path)
for index in (33, 34, 35):
    remove_numbering(doc.paragraphs[index])
doc.save(path)

for filename in ['aquisicao-renovacao-ossuario.docx', 'renovacao-ossuario.docx']:
    path = outdir / filename
    doc = Document(path)
    nested_tables = doc.tables[0].cell(0, 0).tables
    set_row_height(nested_tables[1].rows[0], 0.55, False)
    set_row_height(nested_tables[2].rows[0], 0.5, False)
    doc.save(path)
