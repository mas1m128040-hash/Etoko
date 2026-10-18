import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Utensils, Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ThemeToggle } from '../../components/layout/ThemeToggle';
import { audioEngine } from '../../lib/audioEngine';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { signIn, loading: authLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Buka kunci AudioContext & Web Speech browser pada klik pengguna sebelum login
    try {
      void audioEngine.resume();
    } catch {}

    setError(null);
    setSubmitting(true);

    try {
      await signIn(email, password);
      navigate('/admin');
    } catch (err: any) {
      setError(err?.message || 'Gagal masuk. Periksa kembali email dan kata sandi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-[#0D0D0D] text-stone-900 dark:text-stone-100 flex flex-col justify-center items-center p-4 selection:bg-orange-500 selection:text-white relative">
      {/* Theme Toggle Top Right */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-3xl bg-[#FF6B1A] flex items-center justify-center text-white mx-auto shadow-xl shadow-orange-500/20">
            <Utensils className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-stone-900 dark:text-white">
            SMART RESTAURANT POS
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Masuk Administrator & Pengelolaan Restoran
          </p>
        </div>

        {/* Login Form Card */}
        <Card className="p-6 sm:p-8 bg-white dark:bg-[#181818] border border-stone-200 dark:border-stone-800 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3.5 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-2xl flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500 dark:text-red-400 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                Email Akun Admin
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@resto.com"
                  className="w-full pl-10 pr-4 py-3 bg-stone-50 dark:bg-stone-900 rounded-xl text-sm border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#FF6B1A]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                Kata Sandi
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-stone-50 dark:bg-stone-900 rounded-xl text-sm border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#FF6B1A]"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={submitting || authLoading}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Masuk ke Sistem
            </Button>
          </form>
        </Card>

        {/* Customer Link Shortcut */}
        <div className="text-center">
          <Link
            to="/menu?table=1"
            className="text-xs text-stone-500 dark:text-stone-400 hover:text-[#FF6B1A] dark:hover:text-white underline font-medium"
          >
            ← Kembali ke Menu Pelanggan (Meja 1)
          </Link>
        </div>
      </div>
    </div>
  );
};
