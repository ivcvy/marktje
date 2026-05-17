import { useState, useEffect } from "react";
import { Toaster } from "./components/ui/sonner";
import { LoginPage } from "./components/LoginPage";
import { InputView } from "./components/InputView";
import { BrowseView } from "./components/BrowseView";
import { Avatar, AvatarFallback } from "./components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./components/ui/dropdown-menu";
import { ShoppingCart, PlusCircle, BarChart2, LogOut } from "lucide-react";
import type { PriceEntry, User } from "./types";
import { BRAND_ACCENT } from "./theme";

const STORAGE_KEY = "grocerytrack-entries";
const USER_KEY = "grocerytrack-user";

function loadEntries(): PriceEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
}

function saveEntries(entries: PriceEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function loadUser(): User | null {
  try {
    const stored = localStorage.getItem(USER_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return null;
}

function saveUser(user: User | null) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

type Tab = "input" | "browse";

export default function App() {
  const [user, setUser] = useState<User | null>(() => loadUser());
  const [entries, setEntries] = useState<PriceEntry[]>(() => loadEntries());
  const [activeTab, setActiveTab] = useState<Tab>("browse");

  useEffect(() => {
    saveEntries(entries);
  }, [entries]);

  function handleLogin(u: User) {
    setUser(u);
    saveUser(u);
  }

  function handleLogout() {
    setUser(null);
    saveUser(null);
  }

  function handleAdd(entry: PriceEntry) {
    setEntries((prev) => [...prev, entry]);
  }

  function handleDelete(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function handleImportCSV(imported: PriceEntry[]) {
    setEntries((prev) => {
      const existingIds = new Set(prev.map((e) => e.id));
      const newOnes = imported.filter((e) => !existingIds.has(e.id));
      return [...prev, ...newOnes];
    });
  }

  if (!user) {
    return (
      <>
        <LoginPage onLogin={handleLogin} />
        <Toaster />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Toaster />
      <header className="border-b border-gray-100 bg-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="text-white rounded-xl p-1.5" style={{ backgroundColor: BRAND_ACCENT }}>
              <ShoppingCart size={17} />
            </div>
            <span className="font-semibold text-gray-700 tracking-tight">marktje</span>
          </div>

          <nav className="flex items-center bg-gray-100 rounded-xl p-1 gap-0.5">
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
                activeTab === "browse"
                  ? "bg-white shadow-sm text-gray-800 font-medium"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setActiveTab("browse")}
            >
              <BarChart2 size={14} />
              <span className="hidden sm:inline">Browse</span>
            </button>
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
                activeTab === "input"
                  ? "bg-white shadow-sm text-gray-800 font-medium"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setActiveTab("input")}
            >
              <PlusCircle size={14} />
              <span className="hidden sm:inline">Add</span>
            </button>
          </nav>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-full focus:outline-none focus:ring-2 focus:ring-orange-200">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-white text-xs font-semibold" style={{ backgroundColor: BRAND_ACCENT }}>
                    {user.avatar}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 bg-white">
              <div className="px-3 py-2">
                <p className="font-medium text-sm text-gray-800">{user.name}</p>
                <p className="text-xs text-gray-400">{user.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive gap-2 cursor-pointer" onClick={handleLogout}>
                <LogOut size={14} />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-7">
        {activeTab === "input" ? (
          <InputView
            entries={entries}
            onAdd={handleAdd}
            onDelete={handleDelete}
            onImportCSV={handleImportCSV}
          />
        ) : (
          <BrowseView entries={entries} />
        )}
      </main>
    </div>
  );
}
