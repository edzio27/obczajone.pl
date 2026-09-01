'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogoMark } from '@/components/brand/logo-mark';
import { useAuth } from '@/lib/auth-context';
import { AuthDialog } from '@/components/auth/auth-dialog';
import { LogOut, CircleUser as UserCircle, Menu, MapPin, ShieldCheck, Store, ChevronDown } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// Katalog partnerów świadomie nie ma tu własnej pozycji: prowadzi do niego
// pomarańczowy przycisk obok, a dwa linki do /partnerzy w jednym pasku różniły
// się tylko etykietą. Zostaje to, czego przycisk nie obsługuje - mapa
// pośredników dla kupujących i strona współpracy dla firm.
const NAV_ITEMS = [
  {
    href: '/posrednicy',
    label: 'Pośrednicy',
    icon: MapPin,
    activePrefixes: ['/posrednicy', '/seller', '/listing'],
  },
  {
    href: '/dla-firm',
    label: 'Dla firm',
    icon: Store,
    activePrefixes: ['/dla-firm', '/panel-partnera'],
  },
];

function isActive(pathname: string | null, prefixes: string[]) {
  if (!pathname) return false;
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function Header() {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Pasek na samej górze jest przezroczysty i wtapia się w ciemny hero;
  // dopiero po odjechaniu strony dostaje szkło i cień, żeby oddzielić się
  // od przewijanej treści.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const email = user?.email ?? '';
  const avatarUrl = (user?.user_metadata?.avatar_url as string | undefined) ?? undefined;
  const initial = email.charAt(0).toUpperCase() || 'U';

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-50 transition-all duration-300 ease-spring',
          scrolled ? 'glass border-b border-border/70 shadow-soft' : 'bg-background border-b border-transparent'
        )}
      >
        <div
          className={cn(
            'container mx-auto px-4 flex items-center justify-between gap-4 transition-all duration-300 ease-spring',
            scrolled ? 'py-2' : 'py-3'
          )}
        >
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <LogoMark
              className={cn(
                'transition-all duration-300 ease-spring group-hover:rotate-[-4deg] group-hover:scale-105',
                scrolled ? 'h-8 w-8' : 'h-9 w-9'
              )}
            />
            <div className="flex flex-col leading-tight">
              <span className="font-logo font-extrabold text-xl tracking-[-0.03em]">
                <span className="text-navy">obczajone</span>
                <span className="text-primary">.pl</span>
              </span>
              <span
                className={cn(
                  'hidden sm:block text-[11px] text-muted-foreground transition-all duration-300',
                  scrolled && 'h-0 overflow-hidden opacity-0'
                )}
              >
                Obczaj zanim kupisz.
              </span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-2">
            <nav className="flex items-center gap-1">
              {NAV_ITEMS.map(({ href, label, icon: Icon, activePrefixes }) => {
                const active = isActive(pathname, activePrefixes);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground/70 hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-4 w-4 transition-colors',
                        active ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'
                      )}
                    />
                    {label}
                  </Link>
                );
              })}
            </nav>

            {/*
              Zamówienie oględzin to jedyna rzecz w serwisie, za którą ktoś płaci,
              a do tej pory nie było do niej wejścia z paska - trzeba było
              najpierw znaleźć ogłoszenie. Teraz stoi w nagłówku na każdej
              podstronie, w kolorze zarezerwowanym wyłącznie dla tej akcji.
            */}
            <Button
              asChild
              variant="signal"
              size="sm"
              className={cn(
                'ml-1',
                isActive(pathname, ['/partnerzy', '/partner']) && 'ring-2 ring-signal/40 ring-offset-2'
              )}
            >
              <Link
                href="/partnerzy"
                aria-current={isActive(pathname, ['/partnerzy', '/partner']) ? 'page' : undefined}
              >
                <ShieldCheck className="h-4 w-4 mr-1.5" />
                Zamów inspekcję
              </Link>
            </Button>

            {user ? (
              <>
                <span aria-hidden className="h-6 w-px bg-border mx-1" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-2 rounded-full border border-transparent py-1 pl-1 pr-2.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      aria-label="Menu konta"
                    >
                      <Avatar className="h-8 w-8">
                        {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                          {initial}
                        </AvatarFallback>
                      </Avatar>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-60">
                    <DropdownMenuLabel className="font-normal">
                      <span className="block text-xs text-muted-foreground">Zalogowano jako</span>
                      <span className="block truncate text-sm font-medium">{email}</span>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="cursor-pointer">
                        <UserCircle className="h-4 w-4 mr-2 text-muted-foreground" />
                        Mój profil
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={signOut} className="cursor-pointer">
                      <LogOut className="h-4 w-4 mr-2 text-muted-foreground" />
                      Wyloguj
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setAuthDialogOpen(true)}>
                Zaloguj się
              </Button>
            )}
          </div>

          <div className="md:hidden flex items-center gap-1.5">
            <Button asChild variant="signal" size="sm" className="px-3.5">
              <Link href="/partnerzy">
                <ShieldCheck className="h-4 w-4 mr-1.5" />
                Inspekcja
              </Link>
            </Button>

            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Otwórz menu">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <div className="flex flex-col gap-1 mt-8">
                  {NAV_ITEMS.map(({ href, label, icon: Icon, activePrefixes }) => {
                    const active = isActive(pathname, activePrefixes);
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setMobileMenuOpen(false)}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors',
                          active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
                        )}
                      >
                        <Icon
                          className={cn(
                            'h-4 w-4',
                            active ? 'text-primary' : 'text-muted-foreground'
                          )}
                        />
                        {label}
                      </Link>
                    );
                  })}

                  {user ? (
                    <>
                      <div className="my-3 flex items-center gap-3 border-t pt-4">
                        <Avatar className="h-9 w-9">
                          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
                          <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                            {initial}
                          </AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                          {email}
                        </span>
                      </div>
                      <Link
                        href="/profile"
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors',
                          isActive(pathname, ['/profile'])
                            ? 'bg-primary/10 text-primary'
                            : 'text-foreground hover:bg-muted'
                        )}
                      >
                        <UserCircle
                          className={cn(
                            'h-4 w-4',
                            isActive(pathname, ['/profile'])
                              ? 'text-primary'
                              : 'text-muted-foreground'
                          )}
                        />
                        Mój profil
                      </Link>
                      <Button
                        variant="outline"
                        onClick={() => {
                          signOut();
                          setMobileMenuOpen(false);
                        }}
                        className="mt-3 w-full"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Wyloguj
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={() => {
                        setAuthDialogOpen(true);
                        setMobileMenuOpen(false);
                      }}
                      className="mt-4 w-full"
                    >
                      Zaloguj się
                    </Button>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </>
  );
}
