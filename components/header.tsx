'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { AuthDialog } from '@/components/auth/auth-dialog';
import { LogOut, CircleUser as UserCircle, Eye } from 'lucide-react';

export function Header() {
  const { user, signOut } = useAuth();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  return (
    <>
      <header className="border-b bg-gray-50/90 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2.5 group">
            <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm group-hover:shadow-md transition-all group-hover:scale-105">
              <Eye className="w-5 h-5 text-white" />
            </div>
            <div className="text-xl font-bold text-gray-900">
              obczajone<span className="text-blue-600">.pl</span>
            </div>
          </Link>

          <nav className="flex items-center space-x-3">
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
        </div>
      </header>

      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </>
  );
}
