import { useState } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { ShoppingBasket, Eye, EyeOff } from "lucide-react";
import { BRAND_ACCENT } from "../theme";
import { supabase } from "../../lib/supabase";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please fill in both fields.");
      return;
    }
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError("Incorrect email or password.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10">
          <div className="rounded-2xl p-4 mb-5 shadow-sm" style={{ backgroundColor: BRAND_ACCENT }}>
            <ShoppingBasket size={32} className="text-white" />
          </div>
          <h1 className="text-gray-800 tracking-tight">marktje</h1>
          <p className="text-gray-400 mt-1 text-center text-sm">
            your little price diary 🍑
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email" className="text-gray-500">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              className="bg-gray-50 border-brand-soft focus:border-brand-accent rounded-xl"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password" className="text-gray-500">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
                className="bg-orange-50/50 border-orange-100 focus:border-orange-300 rounded-xl pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-1 py-2.5 rounded-xl text-white font-medium transition-opacity disabled:opacity-60"
            style={{ backgroundColor: BRAND_ACCENT }}
          >
            {loading ? "signing in…" : "sign in"}
          </button>
        </form>

        <p className="text-xs text-gray-300 text-center mt-8">
          personal use only
        </p>
      </div>
    </div>
  );
}
