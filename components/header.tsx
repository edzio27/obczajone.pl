'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogoMark } from '@/components/brand/logo-mark';
import { useAuth } from '@/lib/auth-context';
import { AuthDialog } from '@/components/auth/auth-dialog';
import { LogOut, CircleUser as UserCircle, Menu, MapPin, ShieldCheck, ChevronDown } from 'lucide-react';
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

// Katalog partnerów obejmuje auta i nieruchomości, więc etykieta nie może
// mówić wyłącznie o autach. Profil pojedynczego partnera (/partner/...) też
// należy do tej sekcji - stąd osobna lista prefiksów podświetlenia.
const NAV_ITEMS = [
  {
    href: '/posrednicy',
    label: 'Pośrednicy',
    icon: MapPin,
    activePrefixes: ['/posrednicy', '/seller', '/listing'],
  },
  {
    href: '/partnerzy',
    label: 'Sprawdź przed zakupem',
    icon: ShieldCheck,
    activePrefixes: ['/partnerzy', '/partner'],
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

  const email = user?.email ?? '';
  const avatarUrl = (user?.user_metadata?.avatar_url as string | undefined) ?? undefined;
  const initial = email.charAt(0).toUpperCase() || 'U';

  return (
    <>
      <header className="border-b bg-white/90 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <LogoMark className="h-9 w-9 transition-transform group-hover:scale-105" />
            <div className="flex flex-col leading-tight">
              <span className="font-logo font-extrabold text-xl uppercase tracking-tight">
                <span className="text-navy">Obczajone</span>
                <span className="text-primary">.pl</span>
              </span>
              <span className="hidden sm:block text-xs text-muted-foreground">
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
                      'group flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-navy/75 hover:bg-muted hover:text-navy'
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
              <Button
                size="default"
                onClick={() => setAuthDialogOpen(true)}
                className="ml-1 shadow-md hover:shadow-lg transition-all font-medium"
              >
                Zaloguj się
              </Button>
            )}
          </div>

          <div className="md:hidden flex items-center gap-2">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Otwórz menu">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
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
                          'flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                          active ? 'bg-primary/10 text-primary' : 'text-navy hover:bg-muted'
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
                          'flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                          isActive(pathname, ['/profile'])
                            ? 'bg-primary/10 text-primary'
                            : 'text-navy hover:bg-muted'
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
                        size="default"
                        onClick={() => {
                          signOut();
                          setMobileMenuOpen(false);
                        }}
                        className="mt-2 w-full justify-start font-medium"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Wyloguj
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="default"
                      onClick={() => {
                        setAuthDialogOpen(true);
                        setMobileMenuOpen(false);
                      }}
                      className="mt-4 w-full shadow-md hover:shadow-lg transition-all font-medium"
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
