ex_src=repo_root / 'public/templates/official/exumacao/ordem-exumacao.docx'
def make_exumacao(kind):
    doc=Document(ex_src)
    set_doc_defaults(doc,"Arial",9)
    t=doc.tables[0]
    vals={"quadra":("□ SIM      ■ NÃO","■ SIM      □ NÃO","□ SIM      □ NÃO"),"jazigo":("■ SIM      □ NÃO","□ SIM      ■ NÃO","□ SIM      □ NÃO")}[kind]
    for cell,label,box in [(t.cell(1,0),"Concessão:",vals[0]),(t.cell(1,2),"Quadra geral c/gaveta:",vals[1]),(t.cell(1,7),"Columbário:",vals[2])]:
        p=clear_cell(cell)
        set_para(p,[{"text":label,"size":9}],align=WD_ALIGN_PARAGRAPH.CENTER)
        set_para(cell.add_paragraph(),[{"text":box,"size":10}],align=WD_ALIGN_PARAGRAPH.CENTER)
    for cell,label,ph in [(t.cell(2,0),"N° de Inscrição (GSCEMI):","{inscrGS}"),(t.cell(2,3),"Nº da DO:","{numDO}"),(t.cell(2,6),"Nº Placa de Identificação:","{placa}")]:
        p=clear_cell(cell)
        set_para(p,[{"text":label,"size":8.5}],align=WD_ALIGN_PARAGRAPH.CENTER)
        set_para(cell.add_paragraph(),[{"text":ph,"size":10,"bold":True}],align=WD_ALIGN_PARAGRAPH.CENTER)
    c=t.cell(3,0); p=clear_cell(c)
    set_para(p,[{"text":"NOME DA PESSOA FALECIDA:","size":9,"bold":True}],align=WD_ALIGN_PARAGRAPH.CENTER)
    set_para(c.add_paragraph(),[{"text":"{nomeFal}","size":14,"bold":True}],align=WD_ALIGN_PARAGRAPH.CENTER)
    c=t.cell(4,0); p=clear_cell(c)
    set_para(p,[{"text":"AGENDAMENTO DA EXUMAÇÃO:","size":9}],align=WD_ALIGN_PARAGRAPH.CENTER)
    set_para(c.add_paragraph(),[{"text":"{dataAg}  {horaAg}","size":10,"bold":True}],align=WD_ALIGN_PARAGRAPH.CENTER)
    c=t.cell(4,5); p=clear_cell(c)
    set_para(p,[{"text":"Família Presente:","size":9}],align=WD_ALIGN_PARAGRAPH.CENTER)
    set_para(c.add_paragraph(),[{"text":"□ Sim      □ Não","size":9}],align=WD_ALIGN_PARAGRAPH.CENTER)
    set_para(t.cell(5,0).paragraphs[0],[{"text":"AUTORIZAÇÃO DE EXUMAÇÃO","size":10,"bold":True}],align=WD_ALIGN_PARAGRAPH.CENTER)
    c=t.cell(6,0); clear_cell(c); c.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.TOP
    set_para(c.paragraphs[0],[{"text":"Eu, ","size":9},{"text":"{nomeResp}","size":9,"bold":True},{"text":" CPF: ","size":9},{"text":"{cpfResp}","size":9,"bold":True}],after=3)
    set_para(c.add_paragraph(),[{"text":"Profissão: ____________________","size":9}],after=3)
    set_para(c.add_paragraph(),[{"text":"Endereço: ","size":9},{"text":"{endResp}","size":9,"bold":True}],after=3)
    set_para(c.add_paragraph(),[{"text":"Telefone: ","size":9},{"text":"{telResp}","size":9,"bold":True}],after=5)
    set_para(c.add_paragraph(),[{"text":"Na qualidade de ","size":9},{"text":"{parent}","size":9,"bold":True},{"text":" autorizo a exumação junto à administração do Cemitério Santana, nesta data.","size":9}],after=8)
    set_para(c.add_paragraph(),[{"text":"Assinatura do Responsável pela Autorização: _________________________________________________","size":9}],after=8)
    set_para(c.add_paragraph(),[{"text":"São Paulo, {dataExt}.","size":9}],align=WD_ALIGN_PARAGRAPH.CENTER)
    set_para(t.cell(7,0).paragraphs[0],[{"text":"LOCALIZAÇÃO DA EXUMAÇÃO","size":9,"bold":True}],align=WD_ALIGN_PARAGRAPH.CENTER)
    for cell,label,ph in [(t.cell(8,0),"RUA / QUADRA","{quadraRua}"),(t.cell(8,1),"Nº Sepultura","{sepultura}"),(t.cell(8,2),"Nº gaveta","{gaveta}")]:
        p=clear_cell(cell)
        set_para(p,[{"text":label,"size":8.5}],align=WD_ALIGN_PARAGRAPH.CENTER)
        set_para(cell.add_paragraph(),[{"text":ph,"size":10.5,"bold":True}],align=WD_ALIGN_PARAGRAPH.CENTER)
    c=t.cell(8,4); clear_cell(c)
    nt=c.add_table(rows=3,cols=2); nt.autofit=False; set_no_borders(nt)
    for i,(a,b) in enumerate([("ÓBITO","CONCESSÃO"),("LIVRO: ","LIVRO: "),("FOLHA: ","FOLHA: ")]):
        add_text(nt.cell(i,0),a,8.5,True)
        add_text(nt.cell(i,1),b,8.5,True)
    set_para(t.cell(9,0).paragraphs[0],[{"text":"EXUMAÇÃO","size":9,"bold":True}],align=WD_ALIGN_PARAGRAPH.CENTER)
    set_para(clear_cell(t.cell(10,0)),[{"text":"Responsável pela Exumação:","size":8.5}])
    set_para(clear_cell(t.cell(11,0)),[{"text":"Supervisor (resp.): ____________________    Matrícula: ________________    Data da Exumação: ____/____/______","size":8.5}])
    set_para(t.cell(12,0).paragraphs[0],[{"text":"DESTINO DOS DESPOJOS","size":9,"bold":True}],align=WD_ALIGN_PARAGRAPH.CENTER)
    c=t.cell(13,0); clear_cell(c); c.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.TOP
    set_para(c.paragraphs[0],[{"text":"□ MESMO LOCAL      □ OSSUÁRIO INDIVIDUAL      □ OSSUÁRIO GERAL      □ CREMATÓRIO","size":8.5}],align=WD_ALIGN_PARAGRAPH.CENTER,after=4)
    set_para(c.add_paragraph(),[{"text":"□ TRANSLADADO    Local: ______________________________________________","size":8.5}],align=WD_ALIGN_PARAGRAPH.CENTER,after=4)
    set_para(c.add_paragraph(),[{"text":"Obs.: __________________________________________________________________________________","size":8.5}],after=2)
    set_para(c.add_paragraph(),[{"text":"_______________________________________________________________________________________","size":8.5}])
    set_para(t.cell(14,0).paragraphs[0],[{"text":"ADMINISTRAÇÃO","size":9,"bold":True}],align=WD_ALIGN_PARAGRAPH.CENTER)
    set_para(clear_cell(t.cell(15,0)),[{"text":"Assinatura da Administração: __________________________    Data: ","size":8.5},{"text":"{dataAtual}","size":8.5,"bold":True}],align=WD_ALIGN_PARAGRAPH.CENTER)
    style_all_table_runs(doc,"Arial",8.5)
    set_run_font(t.cell(0,0).paragraphs[0].runs[0],"Arial",12,True)
    for idx,h in {0:0.45,1:0.95,2:0.75,3:0.75,4:0.85,5:0.4,6:3.9,7:0.4,8:1.1,9:0.4,10:0.55,11:0.75,12:0.4,13:1.25,14:0.4,15:0.7}.items():
        set_row_height(t.rows[idx],h,exact=False)
    sanitize_props(doc,f"Ordem de Exumação - {'Quadra Geral' if kind=='quadra' else 'Jazigo'}")
    out=outdir/f"ordem-exumacao{'-jazigo' if kind=='jazigo' else ''}.docx"
    doc.save(out)

make_exumacao('quadra')
make_exumacao('jazigo')
