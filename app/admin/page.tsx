'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Check, X, Trash2, TriangleAlert as AlertTriangle } from 'lucide-react';
import { PartnersAdmin } from '@/components/admin/partners-admin';
import { PartnerApplicationsAdmin } from '@/components/admin/partner-applications-admin';
import { PartnerContentAdmin } from '@/components/admin/partner-content-admin';

type Review = {
  id: string;
  listing_id: string;
  user_id: string;
  visited_in_person: boolean;
  rating: number;
  comment: string;
  is_approved: boolean;
  is_reported: boolean;
  created_at: string;
};

type Report = {
  id: string;
  review_id: string;
  reported_by: string;
  reason: string;
  created_at: string;
};

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingReviews, setPendingReviews] = useState<Review[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  // Liczniki na zakładkach ustawiają same komponenty partnerskie - dzięki temu
  // panel nie musi znać ich zapytań, a setter z useState jest stabilny, więc
  // nie rozkręca pętli przeładowań w useEffect dziecka.
  const [pendingPartnerContent, setPendingPartnerContent] = useState(0);
  const [newApplications, setNewApplications] = useState(0);

  useEffect(() => {
    async function checkAdmin() {
      if (!user) {
        router.push('/');
        return;
      }

      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error || !data) {
        router.push('/');
        return;
      }

      setIsAdmin(true);
      await fetchData();
      setLoading(false);
    }

    if (!authLoading) {
      checkAdmin();
    }
  }, [user, authLoading, router]);

  async function fetchData() {
    const { data: reviewsData } = await supabase
      .from('reviews')
      .select('*')
      .eq('is_approved', false)
      .order('created_at', { ascending: false });

    if (reviewsData) {
      setPendingReviews(reviewsData);
    }

    const { data: reportsData } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (reportsData) {
      setReports(reportsData);
    }

    // Zakładki Radiksa montują zawartość dopiero po kliknięciu, więc gdyby licznik
    // liczyły same komponenty partnerskie, pokazywałby zero do momentu wejścia w
    // zakładkę - czyli dokładnie wtedy, kiedy jest niepotrzebny. Liczymy je tutaj,
    // a komponenty aktualizują wartość po każdej własnej operacji.
    const [pendingPartnerReviews, pendingInspections, freshApplications] = await Promise.all([
      supabase
        .from('partner_reviews')
        .select('id', { count: 'exact', head: true })
        .eq('is_approved', false),
      supabase
        .from('partner_inspections')
        .select('id', { count: 'exact', head: true })
        .eq('is_approved', false),
      supabase
        .from('partner_applications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'new'),
    ]);

    setPendingPartnerContent((pendingPartnerReviews.count ?? 0) + (pendingInspections.count ?? 0));
    setNewApplications(freshApplications.count ?? 0);
  }

  async function approveReview(reviewId: string) {
    const { error } = await supabase
      .from('reviews')
      .update({ is_approved: true })
      .eq('id', reviewId);

    if (error) {
      toast({
        title: 'Błąd',
        description: 'Nie udało się zatwierdzić recenzji',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Zatwierdzono',
      description: 'Recenzja została zatwierdzona',
    });

    await fetchData();
  }

  async function deleteReview(reviewId: string) {
    const { error } = await supabase.from('reviews').delete().eq('id', reviewId);

    if (error) {
      toast({
        title: 'Błąd',
        description: 'Nie udało się usunąć recenzji',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Usunięto',
      description: 'Recenzja została usunięta',
    });

    await fetchData();
  }

  async function dismissReport(reportId: string) {
    const { error } = await supabase.from('reports').delete().eq('id', reportId);

    if (error) {
      toast({
        title: 'Błąd',
        description: 'Nie udało się odrzucić zgłoszenia',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Odrzucono',
      description: 'Zgłoszenie zostało odrzucone',
    });

    await fetchData();
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <p className="text-center">Ładowanie...</p>
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Panel Administratora</h1>
            <p className="text-gray-600 mt-2">
              Zarządzaj recenzjami, partnerami i zgłoszeniami firm
            </p>
          </div>

          <Tabs defaultValue="pending" className="space-y-6">
            <TabsList>
              <TabsTrigger value="pending">
                Oczekujące recenzje ({pendingReviews.length})
              </TabsTrigger>
              <TabsTrigger value="reports">
                Zgłoszenia ({reports.length})
              </TabsTrigger>
              <TabsTrigger value="partner-content">
                Treści partnerów{pendingPartnerContent > 0 ? ` (${pendingPartnerContent})` : ''}
              </TabsTrigger>
              <TabsTrigger value="partners">Partnerzy</TabsTrigger>
              <TabsTrigger value="applications">
                Firmy{newApplications > 0 ? ` (${newApplications})` : ''}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              {pendingReviews.length === 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Brak oczekujących recenzji</CardTitle>
                    <CardDescription>
                      Wszystkie recenzje zostały już zmoderowane
                    </CardDescription>
                  </CardHeader>
                </Card>
              ) : (
                <div className="space-y-4">
                  {pendingReviews.map((review) => (
                    <Card key={review.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">
                              Ocena: {review.rating}/5
                            </CardTitle>
                            <CardDescription>
                              {formatDistanceToNow(new Date(review.created_at), {
                                addSuffix: true,
                                locale: pl,
                              })}
                            </CardDescription>
                          </div>
                          {review.visited_in_person && (
                            <Badge variant="secondary">Był/a na miejscu</Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {review.comment && (
                            <p className="text-gray-600">{review.comment}</p>
                          )}
                          <div className="flex gap-2 pt-4">
                            <Button
                              onClick={() => approveReview(review.id)}
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Zatwierdź
                            </Button>
                            <Button
                              onClick={() => deleteReview(review.id)}
                              size="sm"
                              variant="destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Usuń
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="reports">
              {reports.length === 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Brak zgłoszeń</CardTitle>
                    <CardDescription>Nie ma żadnych zgłoszeń do rozpatrzenia</CardDescription>
                  </CardHeader>
                </Card>
              ) : (
                <div className="space-y-4">
                  {reports.map((report) => (
                    <Card key={report.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <AlertTriangle className="h-5 w-5 text-orange-500" />
                              Zgłoszenie
                            </CardTitle>
                            <CardDescription>
                              {formatDistanceToNow(new Date(report.created_at), {
                                addSuffix: true,
                                locale: pl,
                              })}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <p className="text-gray-600">
                            <strong>Powód:</strong> {report.reason}
                          </p>
                          <div className="flex gap-2 pt-4">
                            <Button
                              onClick={() => dismissReport(report.id)}
                              size="sm"
                              variant="outline"
                            >
                              <X className="h-4 w-4 mr-1" />
                              Odrzuć zgłoszenie
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="partner-content">
              <PartnerContentAdmin onCountChange={setPendingPartnerContent} />
            </TabsContent>

            <TabsContent value="partners">
              <PartnersAdmin />
            </TabsContent>

            <TabsContent value="applications">
              <PartnerApplicationsAdmin onCountChange={setNewApplications} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
