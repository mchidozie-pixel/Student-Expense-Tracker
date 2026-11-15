import React, { useRef } from 'react';
import { X, Download, Printer, FileText } from 'lucide-react';
import { Transaction, UserProfile, BudgetConfig } from '../types';
import { formatCurrency, downloadCSV } from '../utils/storage';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  profile: UserProfile;
  budget: BudgetConfig;
  currency: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  transactions,
  profile,
  budget,
  currency,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const totalSpent = transactions.reduce((acc, t) => acc + t.amount, 0);

  const handlePrint = () => {
    // Copy the statement into a print-only portal on <body> so the app chrome,
    // buttons and modal backdrop are never printed (just clean white pages).
    const statementHtml = printRef.current?.innerHTML;
    if (!statementHtml) return;
    let portal = document.getElementById('statement-print-portal');
    if (!portal) {
      portal = document.createElement('div');
      portal.id = 'statement-print-portal';
      document.body.appendChild(portal);
    }
    portal.innerHTML = statementHtml;
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div 
        className="modal-enter w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#e8f5f0] text-[#0f4c3a] flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-gray-900 tracking-tight">
              Export Statement (FR 10.1)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action bar */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-500 font-mono">
            {transactions.length} transactions included
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadCSV(transactions, currency)}
              className="btn-pill-subtle inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-gray-500" />
              <span>Download CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="btn-pine inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>
          </div>
        </div>

        {/* Formatted Printable Preview */}
        <div className="p-6 overflow-y-auto space-y-5 text-gray-900 bg-white" ref={printRef}>
          
          <div className="border-b border-gray-200 pb-4">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-lg font-bold text-gray-900">
                  Student Expense Statement
                </h1>
                <p className="text-xs text-gray-500 mt-0.5">
                  African Leadership University (ALU) · Kigali Innovation City, Rwanda
                </p>
              </div>
              <div className="text-right text-xs">
                <div className="font-semibold text-gray-900">{profile.name}</div>
                <div className="text-gray-500">{profile.email}</div>
                <div className="font-mono text-gray-400">{profile.studentId}</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 pt-3 border-t border-gray-100 text-xs font-mono">
              <div>
                <span className="text-gray-400 block text-[10px]">Date:</span>
                <span className="font-semibold">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px]">Monthly Cap:</span>
                <span className="font-semibold">{formatCurrency(budget.monthlyCap, currency)}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px]">Total Outflow:</span>
                <span className="font-semibold text-[#0f4c3a]">{formatCurrency(totalSpent, currency)}</span>
              </div>
            </div>
          </div>

          {/* Table */}
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200 font-semibold text-gray-500 font-mono">
                <th className="py-2">Date</th>
                <th className="py-2">Item</th>
                <th className="py-2">Category</th>
                <th className="py-2">Merchant</th>
                <th className="py-2 text-right">Amount ({currency})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map((tx) => (
                <tr key={tx.id} className="py-1.5">
                  <td className="py-2 font-mono text-gray-500 tabular-nums">{tx.date}</td>
                  <td className="py-2 font-medium text-gray-900">{tx.note}</td>
                  <td className="py-2 text-gray-600">{tx.category}</td>
                  <td className="py-2 text-gray-500">{tx.recipient || '—'}</td>
                  <td className="py-2 text-right font-mono font-bold text-gray-900 tabular-nums">
                    {formatCurrency(tx.amount, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-900 font-bold text-gray-900">
                <td colSpan={4} className="py-2.5 text-right">
                  Total Recorded Outflow:
                </td>
                <td className="py-2.5 text-right font-mono text-sm tabular-nums text-[#0f4c3a]">
                  {formatCurrency(totalSpent, currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="btn-pill-subtle px-4 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
