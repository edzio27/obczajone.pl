'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { AuthDialog } from '@/components/auth/auth-dialog';
import { LogOut, User } from 'lucide-react';

export function Header() {
  const { user, signOut } = useAuth();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  return (
    <>
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <div className="text-2xl font-bold text-gray-900">
              obczajone<span className="text-blue-600">.pl</span>
            </div>
          </Link>

          <nav className="flex items-center space-x-4">
            {user ? (
              <>
                <span className="text-sm text-gray-600 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {user.email}
                </span>
                <Button variant="outline" size="sm" onClick={signOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Wyloguj
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => setAuthDialogOpen(true)}>
                Zaloguj się
              </Button>
            )}
          </nav>
        </div>
      </header>

      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </>
  );
}
