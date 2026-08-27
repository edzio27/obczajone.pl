'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { AuthDialog } from '@/components/auth/auth-dialog';
import { PartnerStars } from '@/components/partner/partner-stars';
import { VerifiedBadge } from '@/components/partner/partner-badges';
import { LeadsTab, type Lead } from '@/components/partner/panel/leads-tab';
import { ReviewsTab } from '@/components/partner/panel/reviews-tab';
import { InspectionsTab } from '@/components/partner/panel/inspections-tab';
import { ProfileTab } from '@/components/partner/panel/profile-tab';
import {
  fetchPartnerInspections,
  fetchPartnerReviews,
  PARTNER_COLUMNS,
  type Partner,
  type PartnerInspection,
  type PartnerReview,
} from '@/lib/partner-data';
import { ExternalLink, MessageSquare, MousePointerClick, ShieldCheck, Users } from 'lucide-react';

type Stats = {
  leads30: number;
  leadsTotal: number;
  clicks30: number;
  referrals30: number;
};

export function PartnerPanelClient() {
  const { user, loading: authLoading } = useAuth();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [reviews, setReviews] = useState<PartnerReview[]>([]);
  const [inspections, setInspections] = useState<PartnerInspection[]>([]);
  const [stats, setStats] = useState<Stats>({ leads30: 0, leadsTotal: 0, clicks30: 0, referrals30: 0 });

  const loadPanel = useCallback(async () => {
    if (!user) return;

    const { data: membership } = await supabase
      .from('partner_users')
      .select('partner_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      setPartner(null);
      setLoading(false);
      return;
    }

    const partnerId = membership.partner_id as string;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
      partnerResult,
      leadsResult,
      partnerReviews,
      partnerInspections,
      leads30,
      leadsTotal,
      clicks30,
      referrals30,
    ] = await Promise.all([
      supabase.from('partners').select(PARTNER_COLUMNS).eq('id', partnerId).maybeSingle(),
      supabase
        .from('partner_leads')
        .select('id, listing_id, name, phone, email, message, context, status, created_at')
        .eq('partner_id', partnerId)
        .order('created_at', { ascending: false }),
      fetchPartnerReviews(supabase, partnerId, { includePending: true }),
      fetchPartnerInspections(supabase, partnerId, { includePending: true }),
      supabase
        .from('partner_leads')
        .select('id', { count: 'exact', head: true })
        .eq('partner_id', partnerId)
        .gte('created_at', since),
      supabase
        .from('partner_leads')
        .select('id', { count: 'exact', head: true })
        .eq('partner_id', partnerId),
      supabase
        .from('partner_clicks')
        .select('id', { count: 'exact', head: true })
        .eq('partner_id', partnerId)
        .gte('created_at', since),
      supabase
        .from('partner_referrals')
        .select('id', { count: 'exact', head: true })
        .eq('partner_id', partnerId)
        .gte('created_at', since),
    ]);

    setPartner((partnerResult.data as unknown as Partner) ?? null);
    setLeads((leadsResult.data as Lead[]) || []);
    setReviews(partnerReviews);
    setInspections(partnerInspections);
    setStats({
      leads30: leads30.count ?? 0,
      leadsTotal: leadsTotal.count ?? 0,
      clicks30: clicks30.count ?? 0,
      referrals30: referrals30.count ?? 0,
    });
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    loadPanel();
  }, [user, authLoading, loadPanel]);

  if (loading || authLoading) {
    return (
      <Shell>
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </Shell>
    );
  }

  if (!user) {
    return (
      <Shell>
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <ShieldCheck className="h-10 w-10 text-primary mx-auto mb-3" />
            <h1 className="text-xl font-semibold mb-2">Panel partnera</h1>
            <p className="text-muted-foreground mb-5">
              Zaloguj się kontem, które przypisaliśmy do Twojej firmy.
            </p>
            <Button onClick={() => setAuthDialogOpen(true)}>Zaloguj się</Button>
          </CardContent>
        </Card>
        <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
      </Shell>
    );
  }

  if (!partner) {
    return (
      <Shell>
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <h1 className="text-xl font-semibold mb-2">To konto nie jest przypisane do firmy</h1>
            <p className="text-muted-foreground mb-5 max-w-md mx-auto">
              Panel partnera jest dostępny dla firm, które współpracują z obczajone.pl. Jeśli
              sprawdzasz auta albo nieruchomości przed zakupem — zgłoś się.
            </p>
            <Button asChild>
              <Link href="/dla-firm">Zobacz zasady współpracy</Link>
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  const newLeads = leads.filter((lead) => lead.status === 'new').length;

  return (
    <Shell>
      <div>
        <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{partner.name}</h1>
            {partner.is_verified && <VerifiedBadge />}
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/partner/${partner.slug}`} target="_blank">
              <ExternalLink className="h-4 w-4 mr-2" />
              Zobacz profil publiczny
            </Link>
          </Button>
        </div>
        <PartnerStars rating={partner.rating_avg} count={partner.rating_count} />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          icon={<Users className="h-4 w-4" />}
          label="Zapytania (30 dni)"
          value={String(stats.leads30)}
          hint={`łącznie ${stats.leadsTotal}`}
        />
        <StatTile
          icon={<MessageSquare className="h-4 w-4" />}
          label="Nowe do obsługi"
          value={String(newLeads)}
          hint={newLeads > 0 ? 'czekają na kontakt' : 'wszystko obsłużone'}
        />
        <StatTile
          icon={<MousePointerClick className="h-4 w-4" />}
          label="Wejścia na Twój profil (30 dni)"
          value={String(stats.clicks30)}
          hint="kliknięcia z naszych stron"
        />
        <StatTile
          icon={<ExternalLink className="h-4 w-4" />}
          label="Ruch od Ciebie (30 dni)"
          value={String(stats.referrals30)}
          hint="z Twojego linku lub kodu QR"
        />
      </div>

      <Tabs defaultValue="leads">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="leads">
            Zapytania{newLeads > 0 ? ` (${newLeads})` : ''}
          </TabsTrigger>
          <TabsTrigger value="reviews">Opinie</TabsTrigger>
          <TabsTrigger value="inspections">Oględziny</TabsTrigger>
          <TabsTrigger value="profile">Profil</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="mt-4">
          <LeadsTab leads={leads} />
        </TabsContent>

        <TabsContent value="reviews" className="mt-4">
          <ReviewsTab partnerId={partner.id} reviews={reviews} onChanged={loadPanel} />
        </TabsContent>

        <TabsContent value="inspections" className="mt-4">
          <InspectionsTab partnerId={partner.id} inspections={inspections} onChanged={loadPanel} />
        </TabsContent>

        <TabsContent value="profile" className="mt-4">
          <ProfileTab partner={partner} onSaved={loadPanel} />
        </TabsContent>
      </Tabs>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">{children}</div>
      </main>
      <Footer />
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
        {icon}
        {label}
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}
