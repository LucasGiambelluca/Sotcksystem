import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FileSpreadsheet, FileText } from 'lucide-react';

interface ExportButtonsProps<T> {
  data: T[];
  filename: string;
  columns: { header: string; key: keyof T }[];
}

export default function ExportButtons<T extends object>({ data, filename, columns }: ExportButtonsProps<T>) {
  
  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      data.map(item => {
        const row: any = {};
        columns.forEach(col => {
          row[col.header] = item[col.key];
        });
        return row;
      })
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    const tableData = data.map(item => columns.map(col => String(item[col.key] || '-')));
    const headers = columns.map(col => col.header);

    autoTable(doc, {
      head: [headers],
      body: tableData,
    });

    doc.save(`${filename}.pdf`);
  };

  return (
    <div className="flex space-x-2">
      <button
        onClick={exportToExcel}
        className="flex items-center space-x-2 px-4 py-2.5 bg-green-50 text-green-700 rounded-xl hover:bg-green-100 transition-colors text-sm font-medium border border-green-200"
        title="Exportar a Excel"
      >
        <FileSpreadsheet size={18} />
        <span>Excel</span>
      </button>
      <button
        onClick={exportToPDF}
        className="flex items-center space-x-2 px-4 py-2.5 bg-red-50 text-red-700 rounded-xl hover:bg-red-100 transition-colors text-sm font-medium border border-red-200"
        title="Exportar a PDF"
      >
        <FileText size={18} />
        <span>PDF</span>
      </button>
    </div>
  );
}
