from docx.enum.text import WD_TAB_ALIGNMENT

at_src=repo_root / 'public/templates/official/atualizacao-cadastral/atualizacao-cadastral.docx'
def set_tabs(p, cms):
    p.paragraph_format.tab_stops.clear_all()
    for cm in cms:
        p.paragraph_format.tab_stops.add_tab_stop(Cm(cm), WD_TAB_ALIGNMENT.LEFT)

def make_atualizacao():
    doc=Document(at_src)
    set_doc_defaults(doc,"Times New Roman",11)
    ps=doc.paragraphs
    for i,p in enumerate(ps):
        if i in (41,42):
            continue
        for r in p.runs:
            if r.text:
                set_run_font(r,"Times New Roman",11,r.bold,r.italic)
        p.paragraph_format.space_before=Pt(0)
        p.paragraph_format.space_after=Pt(0)
        p.paragraph_format.line_spacing=1.0
    set_para(ps[0],[{"text":"CEMITÉRIO SANTANA","font":"Times New Roman","size":12,"bold":True}],align=WD_ALIGN_PARAGRAPH.CENTER,after=8)
    set_para(ps[2],[{"text":"Concessionário: ","font":"Times New Roman","size":11},{"text":"{nomeConc}","font":"Times New Roman","size":11,"bold":True}],after=6)
    set_para(ps[4],[{"text":"Data de Contratação\tQuadra / Rua\tTerreno\tMetragem","font":"Times New Roman","size":10.5}],after=1)
    set_tabs(ps[4],[4.2,10.4,15.0])
    set_para(ps[5],[{"text":"{dataContr}\t{quadra}\t{terreno}\t{metragem}","font":"Times New Roman","size":11,"bold":True}],after=7)
    set_tabs(ps[5],[4.2,10.4,15.0])
    set_para(ps[7],[{"text":"Sucessor ou Procurador (ou ADM Provisório):\n","font":"Times New Roman","size":11},{"text":"{nomeSuc}","font":"Times New Roman","size":11,"bold":True},{"text":"\tParentesco: ","font":"Times New Roman","size":11},{"text":"{parent}","font":"Times New Roman","size":11,"bold":True}],after=6)
    set_tabs(ps[7],[13.5])
    set_para(ps[8],[{"text":"CPF: ","font":"Times New Roman","size":11},{"text":"{cpf}","font":"Times New Roman","size":11,"bold":True},{"text":"\tRG: ","font":"Times New Roman","size":11},{"text":"{rg}","font":"Times New Roman","size":11,"bold":True},{"text":"\tData de nascimento: ","font":"Times New Roman","size":11},{"text":"{nasc}","font":"Times New Roman","size":11,"bold":True}],after=6)
    set_tabs(ps[8],[5.6,11.3])
    set_para(ps[10],[{"text":"End.: ","font":"Times New Roman","size":11},{"text":"{endereco}","font":"Times New Roman","size":11,"bold":True}],after=6)
    set_para(ps[12],[{"text":"Tel. 1: ","font":"Times New Roman","size":11},{"text":"{telefone}","font":"Times New Roman","size":11,"bold":True},{"text":"   E-mail: ","font":"Times New Roman","size":11},{"text":"{email}","font":"Times New Roman","size":11}],after=6)
    set_para(ps[14],[{"text":"Inscrição GS: ","font":"Times New Roman","size":11},{"text":"{inscrGS}","font":"Times New Roman","size":11,"bold":True},{"text":"\tAnotado no LIVRO nº ","font":"Times New Roman","size":11},{"text":"{livro}","font":"Times New Roman","size":11,"bold":True},{"text":"   Folha: ","font":"Times New Roman","size":11},{"text":"{folha}","font":"Times New Roman","size":11,"bold":True}],after=10)
    set_tabs(ps[14],[7.8])
    set_para(ps[17],[{"text":"Assinatura: ____________________________\tSão Paulo, ","font":"Times New Roman","size":11},{"text":"{dataAt}","font":"Times New Roman","size":11,"bold":True}],after=10)
    set_tabs(ps[17],[11.5])
    set_para(ps[19],[{"text":"Assinatura e carimbo do Coordenador(a)/Administração: __________________________________________","font":"Times New Roman","size":11}])
    set_para(ps[25],[{"text":"RECIBO DE ATUALIZAÇÃO CADASTRAL DE CONCESSÕES (Via do Munícipe)","font":"Times New Roman","size":10,"bold":True}],align=WD_ALIGN_PARAGRAPH.CENTER)
    set_para(ps[26],[{"text":"CEMITÉRIO SANTANA","font":"Times New Roman","size":11,"bold":True}],align=WD_ALIGN_PARAGRAPH.CENTER,after=7)
    set_para(ps[28],[{"text":"Quadra/Rua: ","font":"Times New Roman","size":11},{"text":"{quadraRec}","font":"Times New Roman","size":11,"bold":True},{"text":"\tTerreno: ","font":"Times New Roman","size":11},{"text":"{terrRec}","font":"Times New Roman","size":11,"bold":True},{"text":"\tLivro: ","font":"Times New Roman","size":11},{"text":"{livroRec}","font":"Times New Roman","size":11,"bold":True},{"text":"  Folha: ","font":"Times New Roman","size":11},{"text":"{folhaRec}","font":"Times New Roman","size":11,"bold":True}],after=4)
    set_tabs(ps[28],[5.0,11.0])
    set_para(ps[29],[{"text":"São Paulo, ","font":"Times New Roman","size":11},{"text":"{dataRec}","font":"Times New Roman","size":11,"bold":True}],after=6)
    set_para(ps[30],[{"text":"Assinatura e carimbo do Coordenador(a)/Administração: _________________________________________","font":"Times New Roman","size":11}],after=6)
    set_para(ps[32],[{"text":"OBSERVAÇÕES","font":"Times New Roman","size":11,"bold":True}],align=WD_ALIGN_PARAGRAPH.CENTER)
    set_para(ps[33],[{"text":"1. Nos termos da legislação vigente, o usuário que mantém sua concessão em bom estado de conservação, não corre o risco de perdê-la;","font":"Times New Roman","size":10.5}],after=2)
    set_para(ps[34],[{"text":"2. O recadastramento tem validade de 01 (hum) ano, a contar da data acima, sendo necessária renovação em ","font":"Times New Roman","size":10.5},{"text":"{proxRen}","font":"Times New Roman","size":10.5,"bold":True},{"text":".","font":"Times New Roman","size":10.5}],after=2)
    set_para(ps[35],[{"text":"3. Telefone Consolare – 0800 0800 190.","font":"Times New Roman","size":10.5}])
    for i in (41,42):
        for r in ps[i].runs:
            set_run_font(r,"Trebuchet MS",7,r.bold,r.italic)
    sanitize_props(doc,"Atualização Cadastral de Concessões")
    doc.save(outdir/'atualizacao-cadastral.docx')

make_atualizacao()
