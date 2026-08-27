'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Lock, Mail } from 'lucide-react';

interface LoginFormProps {
  onLogin: (user: { id: string; name: string; email: string; role: string; orderBookerId: string | null }) => void;
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      onLogin(data.user);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-gradient-to-br from-[#eef0ff] via-[#f2ebff] to-[#e8edff] dark:from-[#0e1020] dark:via-[#12102c] dark:to-[#16123a] p-4 overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-20 left-20 w-32 h-32 bg-indigo-300/30 dark:bg-indigo-600/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-20 w-40 h-40 bg-violet-300/25 dark:bg-violet-600/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] h-[560px] bg-gradient-to-br from-indigo-200/20 to-violet-200/20 dark:from-indigo-500/10 dark:to-violet-500/10 rounded-full blur-3xl" />

      <Card className="w-full max-w-md shadow-[0_18px_60px_rgba(25,26,62,0.16)] border-border/60 animate-scale-in relative z-10 rounded-2xl">
        <CardHeader className="text-center pb-2 pt-8">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center mb-4 shadow-[0_10px_28px_rgba(79,70,229,0.45)] animate-pulse-glow">
            <span className="text-white font-extrabold text-xl tracking-wide">AF</span>
          </div>
          <CardTitle className="text-2xl font-extrabold tracking-tight text-foreground">AL FALAH TRADERS</CardTitle>
          <CardDescription className="text-muted-foreground font-medium">Claim Management System</CardDescription>
        </CardHeader>
        <CardContent className="pb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 h-11 rounded-xl border-input focus:border-primary focus:ring-primary/20 transition-colors"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10 h-11 rounded-xl border-input focus:border-primary focus:ring-primary/20 transition-colors"
                />
              </div>
            </div>
            {error && (
              <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950/40 p-3 rounded-lg border border-red-200 dark:border-red-900 animate-scale-in">
                {error}
              </div>
            )}
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-[0_8px_24px_rgba(79,70,229,0.35)] btn-enhanced btn-ripple py-5 text-base font-semibold rounded-xl"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
