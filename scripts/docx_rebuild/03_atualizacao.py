from docx.enum.text import WD_TAB_ALIGNMENT

at_src = repo_root / 'public/templates/official/atualizacao-cadastral/atualizacao-cadastral.docx'

def set_tabs(paragraph, positions):
    paragraph.paragraph_format.tab_stops.clear_all()
    for position in positions:
        paragraph.paragraph_format.tab_stops.add_tab_stop(Cm(position), WD_TAB_ALIGNMENT.LEFT)

def add_cadastral_paragraph(cell, segments, after=4, align=None, tabs=None):
    paragraph = cell.add_paragraph()
    set_para(
        paragraph,
        [dict(segment, font="Times New Roman") for segment in segments],
        align=align,
        after=after,
        line=1.0,
    )
    if tabs:
        set_tabs(paragraph, tabs)
    return paragraph

def make_atualizacao():
    doc = Document(at_src)
    set_doc_defaults(doc, "Times New Roman", 11)
    remove_all_body_except_sectpr(doc)

    section = doc.sections[0]
    section.top_margin = Cm(2.3)
    section.bottom_margin = Cm(1.5)
    section.left_margin = Cm(1.0)
    section.right_margin = Cm(1.0)

    outer = doc.add_table(rows=1, cols=1)
    outer.autofit = False
    outer.columns[0].width = Cm(18.8)
    set_table_borders(outer, "single", 6, "444444")
    cell = outer.cell(0, 0)
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.TOP
    set_cell_margins(cell, 120, 170, 90, 170)
    clear_cell(cell)

    set_para(
        cell.paragraphs[0],
        [{"text": "CEMITÉRIO SANTANA", "size": 12, "bold": True, "font": "Times New Roman"}],
        align=WD_ALIGN_PARAGRAPH.CENTER,
        after=8,
    )
    add_cadastral_paragraph(
        cell,
        [
            {"text": "Concessionário: ", "size": 11},
            {"text": "{nomeConc}", "size": 11, "bold": True},
        ],
        after=7,
    )

    grid = cell.add_table(rows=2, cols=4)
    grid.autofit = False
    set_no_borders(grid)
    headings = ["Data de Contratação", "Quadra / Rua", "Terreno", "Metragem"]
    values = ["{dataContr}", "{quadra}", "{terreno}", "{metragem}"]
    widths = [3.8, 7.0, 3.2, 3.8]
    for index, width in enumerate(widths):
        grid.columns[index].width = Cm(width)
        set_cell_text(grid.cell(0, index), headings[index], None, 10.5, 10.5, "Times New Roman")
        set_cell_text(grid.cell(1, index), "", values[index], 1, 11, "Times New Roman")
        for row in grid.rows:
            set_cell_margins(row.cells[index], 15, 20, 15, 20)
    set_row_height(grid.rows[0], 0.45, False)
    set_row_height(grid.rows[1], 0.5, False)

    add_cadastral_paragraph(
        cell,
        [
            {"text": "Sucessor ou Procurador (ou ADM Provisório):\n", "size": 11},
            {"text": "{nomeSuc}", "size": 11, "bold": True},
            {"text": "\tParentesco: ", "size": 11},
            {"text": "{parent}", "size": 11, "bold": True},
        ],
        after=5,
        tabs=[13.0],
    )
    add_cadastral_paragraph(
        cell,
        [
            {"text": "CPF: ", "size": 11},
            {"text": "{cpf}", "size": 11, "bold": True},
            {"text": "\tRG: ", "size": 11},
            {"text": "{rg}", "size": 11, "bold": True},
            {"text": "\tData de nascimento: ", "size": 11},
            {"text": "{nasc}", "size": 11, "bold": True},
        ],
        after=5,
        tabs=[5.2, 10.8],
    )
    add_cadastral_paragraph(
        cell,
        [
            {"text": "End.: ", "size": 11},
            {"text": "{endereco}", "size": 11, "bold": True},
        ],
        after=5,
    )
    add_cadastral_paragraph(
        cell,
        [
            {"text": "Tel. 1: ", "size": 11},
            {"text": "{telefone}", "size": 11, "bold": True},
            {"text": "   E-mail: ", "size": 11},
            {"text": "{email}", "size": 11},
        ],
        after=5,
    )
    add_cadastral_paragraph(
        cell,
        [
            {"text": "Inscrição GS: ", "size": 11},
            {"text": "{inscrGS}", "size": 11, "bold": True},
            {"text": "\tAnotado no LIVRO nº ", "size": 11},
            {"text": "{livro}", "size": 11, "bold": True},
            {"text": "   Folha: ", "size": 11},
            {"text": "{folha}", "size": 11, "bold": True},
        ],
        after=9,
        tabs=[7.5],
    )
    add_cadastral_paragraph(
        cell,
        [
            {"text": "Assinatura: ____________________________\tSão Paulo, ", "size": 11},
            {"text": "{dataAt}", "size": 11, "bold": True},
        ],
        after=9,
        tabs=[11.0],
    )
    add_cadastral_paragraph(
        cell,
        [{"text": "Assinatura e carimbo do Coordenador(a)/Administração: __________________________________________", "size": 11}],
        after=12,
    )
    add_cadastral_paragraph(
        cell,
        [{"text": "- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -", "size": 8}],
        after=5,
    )
    add_cadastral_paragraph(
        cell,
        [{"text": "RECIBO DE ATUALIZAÇÃO CADASTRAL DE CONCESSÕES (Via do Munícipe)", "size": 10, "bold": True}],
        after=0,
        align=WD_ALIGN_PARAGRAPH.CENTER,
    )
    add_cadastral_paragraph(
        cell,
        [{"text": "CEMITÉRIO SANTANA", "size": 11, "bold": True}],
        after=6,
        align=WD_ALIGN_PARAGRAPH.CENTER,
    )
    add_cadastral_paragraph(
        cell,
        [
            {"text": "Quadra/Rua: ", "size": 11},
            {"text": "{quadraRec}", "size": 11, "bold": True},
            {"text": "\tTerreno: ", "size": 11},
            {"text": "{terrRec}", "size": 11, "bold": True},
            {"text": "\tLivro: ", "size": 11},
            {"text": "{livroRec}", "size": 11, "bold": True},
            {"text": "  Folha: ", "size": 11},
            {"text": "{folhaRec}", "size": 11, "bold": True},
        ],
        after=4,
        tabs=[5.0, 11.0],
    )
    add_cadastral_paragraph(
        cell,
        [
            {"text": "São Paulo, ", "size": 11},
            {"text": "{dataRec}", "size": 11, "bold": True},
        ],
        after=5,
    )
    add_cadastral_paragraph(
        cell,
        [{"text": "Assinatura e carimbo do Coordenador(a)/Administração: _________________________________________", "size": 11}],
        after=5,
    )
    add_cadastral_paragraph(
        cell,
        [{"text": "OBSERVAÇÕES", "size": 11, "bold": True}],
        after=2,
        align=WD_ALIGN_PARAGRAPH.CENTER,
    )
    add_cadastral_paragraph(
        cell,
        [{"text": "1. Nos termos da legislação vigente, o usuário que mantém sua concessão em bom estado de conservação, não corre o risco de perdê-la;", "size": 10.5}],
        after=2,
    )
    add_cadastral_paragraph(
        cell,
        [
            {"text": "2. O recadastramento tem validade de 01 (hum) ano, a contar da data acima, sendo necessária renovação em ", "size": 10.5},
            {"text": "{proxRen}", "size": 10.5, "bold": True},
            {"text": ".", "size": 10.5},
        ],
        after=2,
    )
    add_cadastral_paragraph(
        cell,
        [{"text": "3. Telefone Consolare – 0800 0800 190.", "size": 10.5}],
        after=0,
    )

    sanitize_props(doc, "Atualização Cadastral de Concessões")
    doc.save(outdir / 'atualizacao-cadastral.docx')

make_atualizacao()
