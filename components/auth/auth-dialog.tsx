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
  const [oauthLoading, setOauthLoading] = useState<'google' | 'facebook' | null>(null);
  const { signIn, signUp, resetPassword, signInWithGoogle, signInWithFacebook } = useAuth();
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

  /**
   * Google i Facebook są włączone po stronie Supabase, a `signInWithGoogle` /
   * `signInWithFacebook` istniały w kontekście od początku - brakowało wyłącznie
   * miejsca, z którego można je wywołać. Bez tego konto założone przez Google nie
   * miało żadnej drogi wejścia: hasła nie ma, więc logowanie zwraca "Invalid login
   * credentials", a reset hasła nie ma czego zresetować.
   */
  const handleOAuth = async (provider: 'google' | 'facebook') => {
    setOauthLoading(provider);
    try {
      if (provider === 'google') {
        await signInWithGoogle();
      } else {
        await signInWithFacebook();
      }
      // Przy powodzeniu przeglądarka wychodzi na stronę dostawcy, więc tutaj
      // nie wracamy - stan ładowania zdejmujemy tylko przy błędzie.
    } catch (error: any) {
      setOauthLoading(null);
      toast({
        title: 'Nie udało się zalogować',
        description: error?.message ?? 'Spróbuj ponownie za chwilę.',
        variant: 'destructive',
      });
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
          {mode !== 'reset' && (
            <>
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => handleOAuth('google')}
                  disabled={loading || oauthLoading !== null}
                >
                  <GoogleIcon />
                  {oauthLoading === 'google' ? 'Przekierowanie...' : 'Kontynuuj z Google'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => handleOAuth('facebook')}
                  disabled={loading || oauthLoading !== null}
                >
                  <FacebookIcon />
                  {oauthLoading === 'facebook' ? 'Przekierowanie...' : 'Kontynuuj z Facebookiem'}
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-background px-2 text-xs uppercase tracking-wide text-muted-foreground">
                    albo e-mailem
                  </span>
                </div>
              </div>
            </>
          )}

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

/* Znaki firmowe dostawców - oficjalne kolory, bo obie marki tego wymagają w wytycznych. */
function GoogleIcon() {
  return (
    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3a7.2 7.2 0 0 1-10.7-3.8h-4v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.4 14.3a7.1 7.1 0 0 1 0-4.6v-3.1h-4a12 12 0 0 0 0 10.8l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.5-3.5A12 12 0 0 0 1.4 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#1877F2"
        d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.6 4.5-4.6 1.3 0 2.6.2 2.6.2v2.9h-1.5c-1.5 0-1.9.9-1.9 1.8V12h3.3l-.5 3.5h-2.8v8.4A12 12 0 0 0 24 12z"
      />
    </svg>
  );
}
