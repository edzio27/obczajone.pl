'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';
import { CircleCheck as CheckCircle2, Circle as XCircle } from 'lucide-react';

type AuthDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, resetPassword } = useAuth();
  const { toast } = useToast();

  const passwordValidation = {
    minLength: password.length >= 8,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  };

  const isPasswordValid = Object.values(passwordValidation).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'register' && !isPasswordValid) {
      toast({
        title: 'Hasło za słabe',
        description: 'Hasło musi spełniać wszystkie wymagania',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        await signIn(email, password);
        toast({
          title: 'Zalogowano pomyślnie',
          description: 'Witaj ponownie!',
        });
        onOpenChange(false);
        setEmail('');
        setPassword('');
      } else if (mode === 'register') {
        await signUp(email, password);
        toast({
          title: 'Konto utworzone',
          description: 'Możesz się teraz zalogować',
        });
        onOpenChange(false);
        setEmail('');
        setPassword('');
      } else {
        await resetPassword(email);
        toast({
          title: 'Link wysłany',
          description: 'Sprawdź swoją skrzynkę e-mail, aby zresetować hasło',
        });
        setMode('login');
        setEmail('');
      }
    } catch (error: any) {
      toast({
        title: 'Błąd',
        description: error.message || 'Coś poszło nie tak',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'login' ? 'Zaloguj się' : mode === 'register' ? 'Utwórz konto' : 'Zresetuj hasło'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'login'
              ? 'Zaloguj się, aby dodać opinię'
              : mode === 'register'
              ? 'Utwórz konto, aby móc dodawać opinie'
              : 'Podaj swój e-mail, wyślemy link do ustawienia nowego hasła'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="twoj@email.pl"
                required
              />
            </div>

            {mode !== 'reset' && (
            <div className="space-y-2">
              <Label htmlFor="password">Hasło</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={mode === 'register' ? 8 : 6}
              />
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => setMode('reset')}
                  className="text-sm text-primary hover:underline"
                >
                  Nie pamiętasz hasła?
                </button>
              )}
              {mode === 'register' && password && (
                <div className="text-sm space-y-1 mt-2">
                  <div className={`flex items-center gap-1 ${passwordValidation.minLength ? 'text-green-600' : 'text-gray-500'}`}>
                    {passwordValidation.minLength ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    Co najmniej 8 znaków
                  </div>
                  <div className={`flex items-center gap-1 ${passwordValidation.hasUpperCase ? 'text-green-600' : 'text-gray-500'}`}>
                    {passwordValidation.hasUpperCase ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    Wielka litera
                  </div>
                  <div className={`flex items-center gap-1 ${passwordValidation.hasLowerCase ? 'text-green-600' : 'text-gray-500'}`}>
                    {passwordValidation.hasLowerCase ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    Mała litera
                  </div>
                  <div className={`flex items-center gap-1 ${passwordValidation.hasNumber ? 'text-green-600' : 'text-gray-500'}`}>
                    {passwordValidation.hasNumber ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    Cyfra
                  </div>
                </div>
              )}
            </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? 'Ładowanie...'
                : mode === 'login'
                ? 'Zaloguj'
                : mode === 'register'
                ? 'Zarejestruj'
                : 'Wyślij link resetujący'}
            </Button>

            <div className="text-center text-sm">
              {mode === 'login' ? (
                <>
                  Nie masz konta?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('register')}
                    className="text-primary hover:underline"
                  >
                    Zarejestruj się
                  </button>
                </>
              ) : mode === 'register' ? (
                <>
                  Masz już konto?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="text-primary hover:underline"
                  >
                    Zaloguj się
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-primary hover:underline"
                >
                  Powrót do logowania
                </button>
              )}
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
