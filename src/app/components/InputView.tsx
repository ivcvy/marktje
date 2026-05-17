import { useState, useMemo, useRef } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { PlusCircle, Trash2, Upload, Download, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import type { PriceEntry } from "../types";
import { BRAND_ACCENT, BRAND_WASH } from "../theme";

interface InputViewProps {
  entries: PriceEntry[];
  onAdd: (entry: PriceEntry) => void;
  onDelete: (id: string) => void;
  onImportCSV: (entries: PriceEntry[]) => void;
}

export function InputView({ entries, onAdd, onDelete, onImportCSV }: InputViewProps) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [store, setStore] = useState("");
  const [sortCol, setSortCol] = useState<"name" | "store" | "date" | "price">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    const all = Array.from(new Set(entries.map(e => e.name))).sort();
    if (!name.trim()) return all;
    return all.filter(n => n.toLowerCase().includes(name.toLowerCase()));
  }, [entries, name]);

  function handleSort(col: typeof sortCol) {
    if (col === sortCol) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const priceNum = parseFloat(price);
    if (!name.trim() || isNaN(priceNum) || priceNum <= 0 || !date) {
      toast.error("Please fill in all required fields with valid values.");
      return;
    }
    onAdd({
      id: crypto.randomUUID(),
      name: name.trim(),
      price: priceNum,
      date,
      store: store.trim() || "Unknown",
    });
    toast.success(`Added ${name.trim()} at $${priceNum.toFixed(2)}`);
    setName("");
    setPrice("");
    setStore("");
    setDate(new Date().toISOString().slice(0, 10));
  }

  function handleExportCSV() {
    const header = "id,name,price,date,store";
    const rows = entries.map(
      (e) => `${e.id},"${e.name}",${e.price},${e.date},"${e.store}"`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "grocery-prices.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported successfully.");
  }

  function handleImportCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.trim().split("\n");
      const isHeader = lines[0].toLowerCase().startsWith("id,name");
      const dataLines = isHeader ? lines.slice(1) : lines;
      const imported: PriceEntry[] = [];
      for (const line of dataLines) {
        const parts = line.match(/(".*?"|[^,]+)(?=,|$)/g);
        if (!parts || parts.length < 4) continue;
        const clean = parts.map((p) => p.replace(/^"|"$/g, "").trim());
        const priceNum = parseFloat(clean[2]);
        if (!clean[1] || isNaN(priceNum)) continue;
        imported.push({
          id: clean[0] || crypto.randomUUID(),
          name: clean[1],
          price: priceNum,
          date: clean[3],
          store: clean[4] || "Unknown",
        });
      }
      if (imported.length === 0) {
        toast.error("No valid rows found in CSV.");
      } else {
        onImportCSV(imported);
        toast.success(`Imported ${imported.length} entries.`);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  const sorted = [...entries].sort((a, b) => {
    const cmp =
      sortCol === "name"  ? a.name.localeCompare(b.name) :
      sortCol === "store" ? a.store.localeCompare(b.store) :
      sortCol === "price" ? a.price - b.price :
      a.date.localeCompare(b.date);
    return sortDir === "asc" ? cmp : -cmp;
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <p className="text-gray-500 text-sm mb-4">Fill in what you bought and where 🧺</p>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5 relative">
            <Label htmlFor="item-name" className="text-gray-600 text-sm">Item Name *</Label>
            <Input
              id="item-name"
              ref={nameInputRef}
              placeholder="e.g. Whole Milk 1 Gal"
              value={name}
              autoComplete="off"
              onChange={(e) => { setName(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              className="bg-gray-50 border-brand-soft focus:border-brand-accent rounded-xl"
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-gray-100 rounded-xl shadow-md overflow-hidden max-h-48 overflow-y-auto">
                {suggestions.map(s => (
                  <li
                    key={s}
                    onMouseDown={() => { setName(s); setShowSuggestions(false); }}
                    className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-price" className="text-gray-600 text-sm">Price ($) *</Label>
            <Input
              id="item-price"
              type="number"
              step="0.01"
              min="0"
              placeholder="3.49"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="bg-gray-50 border-brand-soft focus:border-brand-accent rounded-xl"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-date" className="text-gray-600 text-sm">Date *</Label>
            <Input
              id="item-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-gray-50 border-brand-soft focus:border-brand-accent rounded-xl"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-store" className="text-gray-600 text-sm">Store</Label>
            <Input
              id="item-store"
              placeholder="Whole Foods, Aldi…"
              value={store}
              onChange={(e) => setStore(e.target.value)}
              className="bg-gray-50 border-brand-soft focus:border-brand-accent rounded-xl"
            />
          </div>
          <div className="sm:col-span-2 pt-1">
            <button type="submit" className="gap-2 text-white rounded-xl px-6 py-2 text-sm font-medium flex items-center transition-opacity hover:opacity-90" style={{ backgroundColor: BRAND_ACCENT }}>
              <PlusCircle size={15} />
              Add Entry
            </button>
          </div>
        </form>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-gray-700 font-medium">Recent entries</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-gray-500 border-gray-200 hover:border-gray-300 rounded-lg text-xs" onClick={handleExportCSV} disabled={entries.length === 0}>
            <Download size={13} />
            Export
          </Button>
          <Label htmlFor="csv-import" className="cursor-pointer">
            <Button variant="outline" size="sm" className="gap-1.5 text-gray-500 border-gray-200 hover:border-gray-300 rounded-lg text-xs pointer-events-none">
              <Upload size={13} />
              Import
            </Button>
            <input
              id="csv-import"
              type="file"
              accept=".csv"
              className="sr-only"
              onChange={handleImportCSV}
            />
          </Label>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-16 text-gray-300 border border-dashed border-gray-200 rounded-2xl">
          No entries yet — add your first price above ✨
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/60 hover:bg-gray-50/60">
                  {(["name", "store", "date", "price"] as const).map((col) => {
                    const Icon = sortCol !== col ? ChevronsUpDown : sortDir === "asc" ? ChevronUp : ChevronDown;
                    const active = sortCol === col;
                    return (
                      <TableHead
                        key={col}
                        className={`text-xs font-medium cursor-pointer select-none ${active ? "text-gray-600" : "text-gray-400"} ${col === "price" ? "text-right" : ""}`}
                        onClick={() => handleSort(col)}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col === "name" ? "Item" : col.charAt(0).toUpperCase() + col.slice(1)}
                          <Icon size={11} className={active ? "opacity-80" : "opacity-30"} />
                        </span>
                      </TableHead>
                    );
                  })}
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((entry) => (
                  <TableRow key={entry.id} className="hover:bg-gray-50/50 border-gray-50">
                    <TableCell className="font-medium text-gray-800 text-sm">{entry.name}</TableCell>
                    <TableCell>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: BRAND_WASH, color: BRAND_ACCENT }}>
                        {entry.store}
                      </span>
                    </TableCell>
                    <TableCell className="text-gray-400 text-sm">{entry.date}</TableCell>
                    <TableCell className="text-right font-mono text-gray-800 text-sm">
                      ${entry.price.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <button
                        className="text-gray-300 hover:text-red-400 transition-colors p-1"
                        onClick={() => onDelete(entry.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
