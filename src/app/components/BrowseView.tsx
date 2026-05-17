import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { TrendingDown, TrendingUp, Minus, ShoppingBasket } from "lucide-react";
import type { PriceEntry } from "../types";
import { BRAND_ACCENT, BRAND_SOFT, BRAND_WASH } from "../theme";

interface BrowseViewProps {
  entries: PriceEntry[];
}


function getTrend(prices: number[]) {
  if (prices.length < 2) return "neutral";
  const delta = prices[prices.length - 1] - prices[prices.length - 2];
  if (delta > 0.005) return "up";
  if (delta < -0.005) return "down";
  return "neutral";
}

function getStoreTrends(entries: PriceEntry[]) {
  const byStore = new Map<string, number[]>();
  for (const e of [...entries].sort((a, b) => a.date.localeCompare(b.date))) {
    if (!byStore.has(e.store)) byStore.set(e.store, []);
    byStore.get(e.store)!.push(e.price);
  }
  return Array.from(byStore.entries()).map(([store, prices]) => ({
    store,
    latest: prices[prices.length - 1],
    trend: getTrend(prices),
  }));
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

export function BrowseView({ entries }: BrowseViewProps) {
  const items = useMemo(() => {
    const map = new Map<string, PriceEntry[]>();
    for (const e of entries) {
      const key = e.name.toLowerCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries())
      .map(([, list]) => ({
        name: list[0].name,
        entries: list.sort((a, b) => a.date.localeCompare(b.date)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entries]);

  const [selectedItem, setSelectedItem] = useState<string>("__all__");

  const filteredItems = useMemo(() => {
    if (selectedItem === "__all__") return items;
    return items.filter((i) => i.name === selectedItem);
  }, [items, selectedItem]);

  const chartData = useMemo(() => {
    if (filteredItems.length === 0) return [];
    const allDates = Array.from(
      new Set(filteredItems.flatMap((i) => i.entries.map((e) => e.date)))
    ).sort();
    return allDates.map((date) => {
      const row: Record<string, string | number> = { date };
      for (const item of filteredItems) {
        const match = item.entries.find((e) => e.date === date);
        if (match) row[item.name] = match.price;
      }
      return row;
    });
  }, [filteredItems]);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-300">
        <ShoppingBasket size={44} />
        <p className="text-sm">No price data yet — add entries in the Add tab.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-gray-700 font-medium">Price Trends</p>
        <Select value={selectedItem} onValueChange={setSelectedItem}>
          <SelectTrigger className="w-48 border-gray-200 bg-white text-sm rounded-xl">
            <SelectValue placeholder="All items" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All items</SelectItem>
            {items.map((item) => (
              <SelectItem key={item.name} value={item.name}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        {chartData.length < 2 ? (
          <p className="text-gray-300 text-sm py-8 text-center">
            Add at least 2 dated entries to see a trend line 📈
          </p>
        ) : (
          <div className="h-48 sm:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 20, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#aaa" }} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={(v) => `$${v.toFixed(2)}`}
                tick={{ fontSize: 11, fill: "#aaa" }}
                width={54}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value: number) => [`$${value.toFixed(2)}`, ""]}
                labelStyle={{ fontWeight: 600, color: "#555" }}
                contentStyle={{ borderRadius: 12, border: "1px solid #f0f0f0", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: "#888" }} />
              {(() => {
                const colors = getChartColors(filteredItems.length);
                return filteredItems.map((item, idx) => (
                  <Line
                    key={item.name}
                    type="monotone"
                    dataKey={item.name}
                    stroke={colors[idx]}
                    strokeWidth={2.5}
                    dot={{ r: 4, strokeWidth: 0, fill: colors[idx] }}
                    activeDot={{ r: 6 }}
                    connectNulls
                  />
                ));
              })()}
            </LineChart>
          </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredItems.map((item) => {
          const prices = item.entries.map((e) => e.price);
          const min = Math.min(...prices);
          const max = Math.max(...prices);
          const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
          const storeTrends = getStoreTrends(item.entries);

          return (
            <div key={item.name} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-gray-800 text-sm leading-snug">{item.name}</p>
                <span
                  className="text-xs px-2 py-0.5 rounded-full shrink-0"
                  style={{ backgroundColor: BRAND_WASH, color: BRAND_ACCENT }}
                >
                  {item.entries.length} records
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-y border-gray-50">
                <div className="text-center">
                  <p className="text-gray-400 text-xs mb-0.5">Min</p>
                  <p className="font-mono text-sm" style={{ color: BRAND_SOFT }}>${min.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-400 text-xs mb-0.5">Avg</p>
                  <p className="font-mono text-gray-600 text-sm">${avg.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-400 text-xs mb-0.5">Max</p>
                  <p className="font-mono text-sm" style={{ color: BRAND_ACCENT }}>${max.toFixed(2)}</p>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 pt-1">
                {storeTrends.map(({ store, latest, trend }) => {
                  const Icon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
                  const color = trend === "up" ? BRAND_ACCENT : trend === "down" ? BRAND_SOFT : "#d1d5db";
                  return (
                    <div key={store} className="flex items-center justify-between">
                      <span className="bg-gray-50 text-gray-400 text-xs px-2 py-0.5 rounded-full">{store}</span>
                      <div className="flex items-center gap-1.5">
                        <Icon size={12} style={{ color }} />
                        <span className="font-mono text-gray-800 text-sm">${latest.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
