import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileSpreadsheet, Code2, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/use-is-admin";
import vbsScript from "@/lib/sap/iw31-t001.vbs.txt?raw";

const FILE_NAME = "IW31-Creat_Employee_Trip_Order-T001.xlsx";
const SCRIPT_NAME = "Script1_IW31-Creat_Employee_Trip_Order-T001.vbs";

const SHEETS: { name: string; headers: string[]; widths: number[] }[] = [
  {
    name: "T001",
    headers: [
      "Order Type",
      "Equipment",
      "Order Description",
      "Planner Grp",
      "Mn.wk.ctr",
      "Person Respons",
      "PMActType",
      "Bsc Start",
      "Basic Fin.",
      "Operation Short Text",
      "Mn.wk.ctr/Plnt",
      "Acty Type",
      "Work durtn",
      "Unit for work",
      "Number",
      "duration/unit",
      "Sort Field",
    ],
    widths: [6.7, 10.3, 20.9, 7.7, 9.9, 9.6, 13, 9.9, 13, 21.9, 10.9, 9, 6.9, 7.4, 7.9, 9, 11.4],
  },
  {
    name: "تجهيز",
    headers: [
      "Order Type",
      "Equipment",
      "Order Description",
      "Planner Grp",
      "Mn.wk.ctr\nالمسئول",
      "Person Respons\nساب الطالب",
      "PMActType",
      "Bsc Start",
      "Basic Fin.",
      "Operation Short Text",
      "Mn.wk.ctr/Plnt\nالسائق",
      "Acty Type",
      "Work durtn",
      "Unit for work",
      "Number",
      "duration/unit",
      "Sort Field\nرقم الطلب",
    ],
    widths: [6.7, 10.3, 20.9, 7.7, 14.4, 18.7, 9.6, 9.9, 13, 19.4, 10.9, 9, 13, 13, 7.9, 9, 11.4],
  },
];

async function downloadEmptyTemplate() {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "خطوط السير";
  wb.created = new Date();

  for (const s of SHEETS) {
    const ws = wb.addWorksheet(s.name, {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    const row = ws.getRow(1);
    s.headers.forEach((h, i) => {
      const c = row.getCell(i + 1);
      c.value = h;
      c.font = { name: "Calibri", size: 11, bold: true };
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      c.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
      ws.getColumn(i + 1).width = s.widths[i];
    });
    row.height = 30;
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: s.headers.length } };
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = FILE_NAME;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast.success("تم تنزيل الشيت الفارغ");
}

function downloadScript() {
  const blob = new Blob(["\ufeff" + vbsScript], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = SCRIPT_NAME;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function SapT001Export() {
  const { isAdmin } = useIsAdmin();
  const [open, setOpen] = useState(false);
  if (!isAdmin) return null;

  return (
    <>
      <Button variant="outline" size="sm" onClick={downloadEmptyTemplate} className="gap-1">
        <FileSpreadsheet className="size-4" /> SAP T001
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            <Code2 className="size-4" /> السكربت
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{SCRIPT_NAME}</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => {
                navigator.clipboard.writeText(vbsScript);
                toast.success("تم نسخ السكربت");
              }}
            >
              <Copy className="size-4" /> نسخ
            </Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={downloadScript}>
              <Download className="size-4" /> تنزيل
            </Button>
          </div>
          <pre
            dir="ltr"
            className="max-h-[60vh] overflow-auto rounded-md bg-muted p-3 text-left text-xs leading-relaxed"
          >
            {vbsScript}
          </pre>
        </DialogContent>
      </Dialog>
    </>
  );
}
