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
import { supabase } from "../lib/supabase";
import type { Session } from "@supabase/supabase-js";

type Tab = "input" | "browse";

function userFromSession(session: Session): User {
  const email = session.user.email ?? "";
  const name = email.split("@")[0];
  return {
    name: name.charAt(0).toUpperCase() + name.slice(1),
    email,
    avatar: name.slice(0, 2).toUpperCase(),
  };
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [entries, setEntries] = useState<PriceEntry[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("browse");
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(userFromSession(session));
        fetchEntries();
      }
      setBooting(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(userFromSession(session));
        fetchEntries();
      } else {
        setUser(null);
        setEntries([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchEntries() {
    const { data } = await supabase
      .from("price_entries")
      .select("id, name, price, date, store")
      .order("date", { ascending: false });
    if (data) setEntries(data as PriceEntry[]);
  }

  async function handleAdd(entry: PriceEntry) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from("price_entries").insert({
      ...entry,
      user_id: session.user.id,
    });
    setEntries((prev) => [entry, ...prev]);
  }

  async function handleDelete(id: string) {
    await supabase.from("price_entries").delete().eq("id", id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  async function handleImportCSV(imported: PriceEntry[]) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const existingIds = new Set(entries.map((e) => e.id));
    const newOnes = imported.filter((e) => !existingIds.has(e.id));
    if (newOnes.length === 0) return;
    await supabase.from("price_entries").insert(
      newOnes.map((e) => ({ ...e, user_id: session.user.id }))
    );
    setEntries((prev) => [...newOnes, ...prev]);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  if (booting) return null;

  if (!user) {
    return (
      <>
        <LoginPage />
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
