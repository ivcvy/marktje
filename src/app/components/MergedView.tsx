import { useState, useMemo, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { PlusCircle, Trash2, Upload, Download, Pencil, Check, X, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { toast } from "sonner";
import type { PriceEntry } from "../types";
import { BRAND_ACCENT, BRAND_WASH } from "../theme";

interface Props {
  entries: PriceEntry[];
  onAdd: (entry: PriceEntry) => void;
  onDelete: (id: string) => void;
  onUpdate: (entry: PriceEntry) => void;
  onImportCSV: (entries: PriceEntry[]) => void;
}

function getTrend(prices: number[]) {
  if (prices.length < 2) return "neutral";
  const delta = prices[prices.length - 1] - prices[prices.length - 2];
  if (delta > 0.005) return "up";
  if (delta < -0.005) return "down";
  return "neutral";
}

function getChartColors(count: number): string[] {
  const style = getComputedStyle(document.documentElement);
  const a = style.getPropertyValue("--brand-accent").trim();
  const b = style.getPropertyValue("--brand-soft").trim();
  const parse = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
  const fmt = (c: number[]) => "#" + c.map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  return Array.from({ length: count }, (_, i) => {
    const t = count < 2 ? 0 : i / (count - 1);
    return fmt([ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t]);
  });
}

export function MergedView({ entries, onAdd, onDelete, onUpdate, onImportCSV }: Props) {
  const [filter, setFilter] = useState("__all__");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<PriceEntry>>({});
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [newStore, setNewStore] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const filteredEntries = useMemo(() => {
    const base = filter === "__all__" ? entries : entries.filter(e => e.name.toLowerCase().includes(filter.toLowerCase()));
    return [...base].sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, filter]);

  const chartItems = useMemo(() => {
    const map = new Map<string, PriceEntry[]>();
    const base = filter === "__all__" ? entries : entries.filter(e => e.name.toLowerCase().includes(filter.toLowerCase()));
    for (const e of base) {
      if (!map.has(e.name)) map.set(e.name, []);
      map.get(e.name)!.push(e);
    }
    return Array.from(map.entries())
      .map(([name, list]) => ({ name, entries: list.sort((a, b) => a.date.localeCompare(b.date)) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entries, filter]);

  const chartData = useMemo(() => {
    const allDates = Array.from(new Set(chartItems.flatMap(i => i.entries.map(e => e.date)))).sort();
    return allDates.map(date => {
      const row: Record<string, string | number> = { date };
      for (const item of chartItems) {
        const match = item.entries.find(e => e.date === date);
        if (match) row[item.name] = match.price;
      }
      return row;
    });
  }, [chartItems]);

  const summaryStats = useMemo(() => {
    if (filter === "__all__" || chartItems.length === 0) return null;
    const item = chartItems[0];
    const prices = item.entries.map(e => e.price);
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg: prices.reduce((a, b) => a + b, 0) / prices.length,
      latest: prices[prices.length - 1],
      trend: getTrend(prices),
    };
  }, [filter, chartItems]);

  const colors = useMemo(() => getChartColors(chartItems.length), [chartItems.length]);

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const priceNum = parseFloat(newPrice);
    if (!newName.trim() || isNaN(priceNum) || priceNum <= 0 || !newDate) {
      toast.error("Fill in name, price, and date.");
      return;
    }
    onAdd({ id: crypto.randomUUID(), name: newName.trim(), price: priceNum, date: newDate, store: newStore.trim() || "Unknown" });
    toast.success(`Added ${newName.trim()}`);
    setNewName(""); setNewPrice(""); setNewStore("");
    setNewDate(new Date().toISOString().slice(0, 10));
  }

  function startEdit(entry: PriceEntry) {
    setEditingId(entry.id);
    setEditDraft({ name: entry.name, price: entry.price, date: entry.date, store: entry.store });
  }

  function saveEdit(entry: PriceEntry) {
    const priceNum = parseFloat(String(editDraft.price));
    if (!editDraft.name?.trim() || isNaN(priceNum) || !editDraft.date) {
      toast.error("Invalid values.");
      return;
    }
    onUpdate({ ...entry, name: editDraft.name.trim(), price: priceNum, date: editDraft.date, store: editDraft.store || "Unknown" });
    setEditingId(null);
  }

  function handleExportCSV() {
    const header = "id,name,price,date,store";
    const rows = entries.map(e => `${e.id},"${e.name}",${e.price},${e.date},"${e.store}"`);
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "marktje.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported.");
  }

  function handleImportCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.trim().split("\n");
      const isHeader = lines[0].toLowerCase().startsWith("id,name");
      const imported: PriceEntry[] = [];
      for (const line of isHeader ? lines.slice(1) : lines) {
        const parts = line.match(/(".*?"|[^,]+)(?=,|$)/g);
        if (!parts || parts.length < 4) continue;
        const c = parts.map(p => p.replace(/^"|"$/g, "").trim());
        const priceNum = parseFloat(c[2]);
        if (!c[1] || isNaN(priceNum)) continue;
        imported.push({ id: c[0] || crypto.randomUUID(), name: c[1], price: priceNum, date: c[3], store: c[4] || "Unknown" });
      }
      imported.length ? (onImportCSV(imported), toast.success(`Imported ${imported.length} entries.`)) : toast.error("No valid rows found.");
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  const TrendIcon = summaryStats?.trend === "up" ? TrendingUp : summaryStats?.trend === "down" ? TrendingDown : Minus;

  return (
    <div className="flex flex-col gap-6">
      {/* Chart */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4 gap-3">
          <p className="text-gray-700 font-medium">Price trends</p>
          <div className="relative">
            <input
              placeholder="search item…"
              value={filter === "__all__" ? "" : filter}
              onChange={e => setFilter(e.target.value === "" ? "__all__" : e.target.value)}
              className="text-sm rounded-xl px-3 py-1.5 outline-none placeholder:text-gray-300 text-gray-600 w-40 border"
              style={{ backgroundColor: BRAND_WASH, borderColor: "color-mix(in srgb, var(--brand-accent) 30%, transparent)" }}
            />
            {filter !== "__all__" && (
              <button onClick={() => setFilter("__all__")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {summaryStats && (
          <div className="flex gap-4 mb-4 px-1">
            {[
              { label: "min", value: summaryStats.min, color: "text-green-400" },
              { label: "avg", value: summaryStats.avg, color: "text-gray-500" },
              { label: "max", value: summaryStats.max, color: "text-red-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex flex-col items-center flex-1 bg-gray-50 rounded-xl py-2">
                <span className="text-gray-400 text-xs mb-0.5">{label}</span>
                <span className={`font-mono text-sm ${color}`}>${value.toFixed(2)}</span>
              </div>
            ))}
            <div className="flex flex-col items-center flex-1 bg-gray-50 rounded-xl py-2">
              <span className="text-gray-400 text-xs mb-0.5">latest</span>
              <span className="font-mono text-sm text-gray-700 flex items-center gap-0.5">
                ${summaryStats.latest.toFixed(2)}
                <TrendIcon size={11} className={summaryStats.trend === "up" ? "text-red-400" : summaryStats.trend === "down" ? "text-orange-400" : "text-gray-300"} />
              </span>
            </div>
          </div>
        )}

        {chartData.length < 2 ? (
          <p className="text-gray-300 text-sm py-10 text-center">add at least 2 dated entries to see a chart 📈</p>
        ) : (
          <div className="h-48 sm:h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f3f3" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#bbb" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `$${(v as number).toFixed(2)}`} tick={{ fontSize: 11, fill: "#bbb" }} width={52} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value: number) => [`$${value.toFixed(2)}`, ""]}
                  labelStyle={{ fontWeight: 600, color: "#555" }}
                  contentStyle={{ borderRadius: 12, border: "1px solid #f0f0f0", boxShadow: "0 4px 12px rgba(0,0,0,0.06)", fontSize: 13 }}
                />
                {chartItems.map((item, idx) => {
                  const color = colors[idx] ?? BRAND_ACCENT;
                  const dimmed = filter !== "__all__" && !item.name.toLowerCase().includes(filter.toLowerCase());
                  return (
                    <Line
                      key={item.name}
                      type="monotone"
                      dataKey={item.name}
                      stroke={color}
                      strokeWidth={dimmed ? 1 : 2.5}
                      strokeOpacity={dimmed ? 0.2 : 1}
                      dot={{ r: dimmed ? 2 : 4, strokeWidth: 0, fill: color, fillOpacity: dimmed ? 0.2 : 1 }}
                      activeDot={{ r: 7, strokeWidth: 0, fill: color }}
                      connectNulls
                      style={{ cursor: "pointer" }}
                      onClick={() => setFilter(filter.toLowerCase() === item.name.toLowerCase() ? "__all__" : item.name)}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
          <p className="text-gray-700 font-medium text-sm">Entries</p>
          <div className="flex gap-2">
            <button
              onClick={handleExportCSV}
              disabled={entries.length === 0}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-30 px-2 py-1 rounded-lg hover:bg-gray-50"
            >
              <Download size={13} /> Export
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-1 rounded-lg hover:bg-gray-50"
            >
              <Upload size={13} /> Import
            </button>
            <input ref={fileRef} type="file" accept=".csv" className="sr-only" onChange={handleImportCSV} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="text-left text-xs text-gray-400 font-medium px-2 sm:px-5 py-2.5">Item</th>
                <th className="text-left text-xs text-gray-400 font-medium px-2 sm:px-3 py-2.5">Store</th>
                <th className="text-left text-xs text-gray-400 font-medium px-2 sm:px-3 py-2.5 hidden sm:table-cell">Date</th>
                <th className="text-right text-xs text-gray-400 font-medium px-2 sm:px-3 py-2.5">Price</th>
                <th className="w-12 sm:w-16 px-1 sm:px-3"></th>
              </tr>
            </thead>
            <tbody>
              {/* Add row */}
              <tr className="border-b border-gray-50" style={{ backgroundColor: `color-mix(in srgb, var(--brand-wash) 60%, white)` }}>
                <td className="px-2 sm:px-4 py-2">
                  <input
                    placeholder="item name"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="w-full bg-transparent outline-none text-sm text-gray-700 placeholder:text-gray-300"
                  />
                </td>
                <td className="px-2 sm:px-3 py-2">
                  <input
                    placeholder="store"
                    value={newStore}
                    onChange={e => setNewStore(e.target.value)}
                    className="w-full bg-transparent outline-none text-sm text-gray-700 placeholder:text-gray-300"
                  />
                </td>
                <td className="px-2 sm:px-3 py-2 hidden sm:table-cell">
                  <input
                    type="date"
                    value={newDate}
                    onChange={e => setNewDate(e.target.value)}
                    className="w-full bg-transparent outline-none text-sm text-gray-700"
                  />
                </td>
                <td className="px-2 sm:px-3 py-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={newPrice}
                    onChange={e => setNewPrice(e.target.value)}
                    className="w-full bg-transparent outline-none text-sm text-right font-mono text-gray-700 placeholder:text-gray-300"
                    onKeyDown={e => e.key === "Enter" && handleAdd(e as unknown as React.FormEvent<HTMLFormElement>)}
                  />
                </td>
                <td className="px-1 sm:px-3 py-2 text-right">
                  <button
                    onClick={handleAdd as unknown as React.MouseEventHandler}
                    className="text-white rounded-lg px-2.5 py-1 text-xs flex items-center gap-1 ml-auto"
                    style={{ backgroundColor: BRAND_ACCENT }}
                  >
                    <PlusCircle size={12} /> add
                  </button>
                </td>
              </tr>

              {filteredEntries.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-gray-300 py-10 text-sm">
                    no entries yet ✨
                  </td>
                </tr>
              )}

              {filteredEntries.map(entry => {
                const isEditing = editingId === entry.id;
                return (
                  <tr key={entry.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40 group">
                    <td className="px-2 sm:px-4 py-2.5 max-w-[120px] sm:max-w-none">
                      {isEditing ? (
                        <input
                          value={editDraft.name ?? ""}
                          onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))}
                          className="w-full bg-gray-50 rounded-lg px-2 py-0.5 outline-none text-sm border border-gray-200"
                        />
                      ) : (
                        <span className="text-gray-800 font-medium truncate block">{entry.name}</span>
                      )}
                    </td>
                    <td className="px-2 sm:px-3 py-2.5">
                      {isEditing ? (
                        <input
                          value={editDraft.store ?? ""}
                          onChange={e => setEditDraft(d => ({ ...d, store: e.target.value }))}
                          className="w-full bg-gray-50 rounded-lg px-2 py-0.5 outline-none text-sm border border-gray-200"
                        />
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: BRAND_WASH, color: BRAND_ACCENT }}>
                          {entry.store}
                        </span>
                      )}
                    </td>
                    <td className="px-2 sm:px-3 py-2.5 text-gray-400 text-sm hidden sm:table-cell">
                      {isEditing ? (
                        <input
                          type="date"
                          value={editDraft.date ?? ""}
                          onChange={e => setEditDraft(d => ({ ...d, date: e.target.value }))}
                          className="bg-gray-50 rounded-lg px-2 py-0.5 outline-none text-sm border border-gray-200"
                        />
                      ) : entry.date}
                    </td>
                    <td className="px-2 sm:px-3 py-2.5 text-right font-mono text-gray-800 text-sm">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editDraft.price ?? ""}
                          onChange={e => setEditDraft(d => ({ ...d, price: parseFloat(e.target.value) }))}
                          className="w-20 bg-gray-50 rounded-lg px-2 py-0.5 outline-none text-sm border border-gray-200 text-right font-mono ml-auto block"
                        />
                      ) : `$${entry.price.toFixed(2)}`}
                    </td>
                    <td className="px-1 sm:px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {isEditing ? (
                          <>
                            <button onClick={() => saveEdit(entry)} className="p-1" style={{ color: BRAND_ACCENT }}><Check size={13} /></button>
                            <button onClick={() => setEditingId(null)} className="text-gray-300 hover:text-gray-500 p-1"><X size={13} /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(entry)} className="text-gray-200 hover:text-gray-400 p-1 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity"><Pencil size={12} /></button>
                            <button onClick={() => onDelete(entry.id)} className="text-gray-200 hover:text-red-300 p-1 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity"><Trash2 size={12} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
