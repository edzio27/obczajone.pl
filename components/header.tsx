'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { AuthDialog } from '@/components/auth/auth-dialog';
import { LogOut, CircleUser as UserCircle, Menu, X } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

export function Header() {
  const { user, signOut } = useAuth();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <header className="border-b bg-white/90 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center group">
            <Image
              src="/obczajone_logo_cropped copy copy copy.png"
              alt="obczajone.pl"
              width={280}
              height={70}
              className="h-16 w-auto transition-all group-hover:scale-105"
              priority
            />
          </Link>

          <nav className="hidden md:flex items-center space-x-3">
            {user ? (
              <>
                <Link href="/profile">
                  <Button variant="ghost" size="default" className="font-medium">
                    <UserCircle className="h-4 w-4 mr-2" />
                    Mój profil
                  </Button>
                </Link>
                <Button variant="outline" size="default" onClick={signOut} className="font-medium">
                  <LogOut className="h-4 w-4 mr-2" />
                  Wyloguj
                </Button>
              </>
            ) : (
              <Button
                size="default"
                onClick={() => setAuthDialogOpen(true)}
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-md hover:shadow-lg transition-all font-medium"
              >
                Zaloguj się
              </Button>
            )}
          </nav>

          <div className="md:hidden">
            {user ? (
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-64">
                  <div className="flex flex-col space-y-4 mt-8">
                    <Link href="/profile" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="ghost" size="default" className="w-full justify-start font-medium">
                        <UserCircle className="h-4 w-4 mr-2" />
                        Mój profil
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="default"
                      onClick={() => {
                        signOut();
                        setMobileMenuOpen(false);
                      }}
                      className="w-full justify-start font-medium"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Wyloguj
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            ) : (
              <Button
                size="default"
                onClick={() => setAuthDialogOpen(true)}
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-md hover:shadow-lg transition-all font-medium"
              >
                Zaloguj się
              </Button>
            )}
          </div>
        </div>
      </header>

      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </>
  );
}
