import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface InvoiceDetails {
  invoiceNumber: string;
  date: string;
  customerName: string;
  customerEmail: string;
  planName: string;
  /** GST-inclusive total charged to the customer. */
  amount: number;
  currency: string;
  /** Indian GST rate (e.g. 18). When set, a CGST/SGST breakdown is rendered. */
  gstRate?: number;
}

/** Round to 2 decimals without floating point drift. */
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const generateInvoicePDF = (details: InvoiceDetails) => {
  const doc = new jsPDF();

  // Company Info
  doc.setFontSize(22);
  doc.setTextColor(40);
  doc.text("Vanitra AI Resume", 14, 22);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("GSTIN: 27AAAAA0000A1Z5 (Placeholder)", 14, 30);
  doc.text("Email: support@vanitra.ai", 14, 36);

  // Invoice Details
  doc.setFontSize(16);
  doc.setTextColor(40);
  doc.text("INVOICE", 140, 22);

  doc.setFontSize(10);
  doc.text(`Invoice Number: ${details.invoiceNumber}`, 140, 30);
  doc.text(`Date: ${new Date(details.date).toLocaleDateString()}`, 140, 36);

  // Bill To
  doc.setFontSize(12);
  doc.setTextColor(40);
  doc.text("Bill To:", 14, 50);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(details.customerName, 14, 56);
  doc.text(details.customerEmail, 14, 62);

  const gstRate = details.gstRate && details.currency === "INR" ? details.gstRate : 0;
  const taxable = gstRate > 0 ? round2(details.amount / (1 + gstRate / 100)) : details.amount;
  const gst = gstRate > 0 ? round2(details.amount - taxable) : 0;
  const halfGst = gstRate > 0 ? round2(gst / 2) : 0;
  const fmt = (n: number) =>
    `${details.currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const body: [string, string][] = [[`${details.planName} Subscription`, fmt(taxable)]];
  if (gstRate > 0) {
    body.push([`CGST @ ${gstRate / 2}%`, fmt(halfGst)]);
    body.push([`SGST @ ${gstRate / 2}%`, fmt(halfGst)]);
  }
  const foot: [string, string][] = [["Total", fmt(details.amount)]];

  // Table
  autoTable(doc, {
    startY: 75,
    head: [["Description", "Amount"]],
    body,
    foot,
    theme: "striped",
    headStyles: { fillColor: [63, 100, 255] },
  });

  // Footer
  const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
  doc.setFontSize(10);
  doc.setTextColor(150);
  doc.text("Thank you for your business!", 14, pageHeight - 20);

  doc.save(`Invoice_${details.invoiceNumber}.pdf`);
};
