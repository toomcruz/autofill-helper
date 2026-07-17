def set_cell_text(cell, label, value=None, label_size=8.5, value_size=11, font="Arial", value_bold=True, align=WD_ALIGN_PARAGRAPH.CENTER):
    clear_cell(cell)
    set_para(
        cell.paragraphs[0],
        [{"text": label, "font": font, "size": label_size, "bold": True}],
        align=align,
    )
    if value is not None:
        set_para(
            cell.add_paragraph(),
            [{"text": value, "font": font, "size": value_size, "bold": value_bold}],
            align=align,
        )
