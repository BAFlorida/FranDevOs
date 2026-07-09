import type { Worksheet, Row, Cell, Border, Fill, Alignment, Font, ConditionalFormattingRule } from "exceljs";

export function dataBarRule(argb: string): ConditionalFormattingRule {
  return {
    type: "dataBar",
    priority: 1,
    cfvo: [
      { type: "num", value: 0 },
      { type: "num", value: 1 },
    ],
    color: { argb },
    showValue: true,
    gradient: true,
  } as unknown as ConditionalFormattingRule;
}

export const BRAND = {
  dark: "FF0F2238",
  darkAlt: "FF1B3A5C",
  light: "FFF5F7FA",
  border: "FFD6D3D1",
  muted: "FF6B7280",
  white: "FFFFFFFF",
};

export const STATUS_COLORS: Record<string, string> = {
  Complete: "FF6366F1",
  "In Progress": "FF10B981",
  "On Track": "FF10B981",
  "At Risk": "FFF59E0B",
  Blocked: "FFEF4444",
  "Not Started": "FF9CA3AF",
  "No Tasks": "FFE5E7EB",
  "Waiting on Someone": "FFA78BFA",
};

const thinBorder: Partial<Border> = { style: "thin", color: { argb: BRAND.border } };
export const BORDER_THIN = {
  top: thinBorder,
  left: thinBorder,
  bottom: thinBorder,
  right: thinBorder,
};

export function styleHeaderRow(ws: Worksheet, rowNumber = 1): void {
  const row = ws.getRow(rowNumber);
  row.height = 22;
  row.eachCell({ includeEmpty: true }, (cell: Cell) => {
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: BRAND.white } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: BRAND.dark },
    } as Fill;
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true } as Alignment;
    cell.border = BORDER_THIN;
  });
  ws.views = [{ state: "frozen", ySplit: rowNumber, xSplit: 0 }];
}

export function applyBodyStyle(ws: Worksheet, opts: { firstDataRow?: number } = {}): void {
  const first = opts.firstDataRow ?? 2;
  for (let r = first; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    row.eachCell({ includeEmpty: false }, (cell: Cell) => {
      if (!cell.font) cell.font = { name: "Calibri", size: 10 } as Font;
      else cell.font = { name: "Calibri", size: 10, ...cell.font };
      cell.border = BORDER_THIN;
      cell.alignment = { vertical: "middle", wrapText: true, ...cell.alignment } as Alignment;
    });
    if ((r - first) % 2 === 1) {
      row.eachCell({ includeEmpty: false }, (cell: Cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: BRAND.light },
        } as Fill;
      });
    }
  }
}

export function setLandscapePrint(ws: Worksheet, title?: string): void {
  ws.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.5, header: 0.3, footer: 0.3 },
  };
  ws.headerFooter = {
    oddHeader: title ? `&L&"Calibri,Bold"&14${title}&R&D` : "",
    oddFooter: '&LFranchise Development OS&CPage &P of &N&R&"Calibri,Italic"Confidential',
  };
}

export function autoWidthFromHeaders(ws: Worksheet, extra = 4): void {
  ws.columns.forEach((col) => {
    if (!col) return;
    let max = String(col.header ?? "").length;
    if (col.values) {
      for (let i = 1; i < col.values.length; i++) {
        const v = col.values[i];
        if (v == null) continue;
        const len = typeof v === "object" ? 20 : String(v).length;
        if (len > max) max = Math.min(60, len);
      }
    }
    col.width = Math.max(col.width ?? 10, max + extra);
  });
}

export function styleInitiativeBand(row: Row): void {
  row.height = 22;
  row.eachCell({ includeEmpty: true }, (cell: Cell) => {
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: BRAND.white } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: BRAND.dark },
    } as Fill;
    cell.border = BORDER_THIN;
    cell.alignment = { vertical: "middle", wrapText: true, ...cell.alignment } as Alignment;
  });
}

export function styleTacticBand(row: Row): void {
  row.height = 18;
  row.eachCell({ includeEmpty: true }, (cell: Cell) => {
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: BRAND.dark } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE8EDF4" },
    } as Fill;
    cell.border = BORDER_THIN;
    cell.alignment = { vertical: "middle", wrapText: true, ...cell.alignment } as Alignment;
  });
}

export function colorByStatus(cell: Cell, status: string | null | undefined): void {
  if (!status) return;
  const argb = STATUS_COLORS[status];
  if (!argb) return;
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb },
  } as Fill;
  // Light statuses get dark text, others white
  const lightStatuses = new Set(["No Tasks", "Not Started"]);
  cell.font = {
    name: "Calibri",
    size: 10,
    bold: true,
    color: { argb: lightStatuses.has(status) ? BRAND.dark : BRAND.white },
  };
  cell.alignment = { ...cell.alignment, horizontal: "center" } as Alignment;
}
