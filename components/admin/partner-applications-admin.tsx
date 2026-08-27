'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Globe, Mail, Phone } from 'lucide-react';

type Application = {
  id: string;
  company_name: string;
  nip: string;
  contact_name: string;
  email: string;
  phone: string;
  city: string;
  voivodeship: string;
  category: string;
  website: string;
  message: string;
  status: 'new' | 'contacted' | 'accepted' | 'rejected';
  created_at: string;
};

const STATUS_OPTIONS = [
  { value: 'new', label: 'Nowe' },
  { value: 'contacted', label: 'Skontaktowano' },
  { value: 'accepted', label: 'Przyjęte' },
  { value: 'rejected', label: 'Odrzucone' },
];

const STATUS_STYLES: Record<string, string> = {
  new: 'bg-primary/10 text-primary border-primary/20',
  contacted: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  accepted: 'bg-success/10 text-success border-success/20',
  rejected: 'bg-muted text-muted-foreground',
};

const CATEGORY_LABELS: Record<string, string> = {
  car: 'auta',
  home: 'nieruchomości',
  both: 'auta i nieruchomości',
};

export function PartnerApplicationsAdmin({ onCountChange }: { onCountChange?: (n: number) => void }) {
  const { toast } = useToast();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('partner_applications')
      .select('*')
      .order('created_at', { ascending: false });

    const rows = (data as Application[]) || [];
    setApplications(rows);
    onCountChange?.(rows.filter((a) => a.status === 'new').length);
    setLoading(false);
  }, [onCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateStatus(id: string, status: Application['status']) {
    const { error } = await supabase.from('partner_applications').update({ status }).eq('id', id);

    if (error) {
      toast({ title: 'Nie udało się zmienić statusu', variant: 'destructive' });
      return;
    }
    load();
  }

  if (loading) return <p className="text-muted-foreground">Ładowanie zgłoszeń...</p>;

  if (applications.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center py-10">
          <p className="text-muted-foreground">
            Brak zgłoszeń. Firmy trafiają tutaj z formularza na /dla-firm.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {applications.map((application) => (
        <Card key={application.id}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold">{application.company_name}</h3>
                  <Badge variant="outline" className={STATUS_STYLES[application.status]}>
                    {STATUS_OPTIONS.find((s) => s.value === application.status)?.label}
                  </Badge>
                  <Badge variant="secondary">{CATEGORY_LABELS[application.category]}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {format(new Date(application.created_at), 'd MMMM yyyy, HH:mm', { locale: pl })}
                  {application.city ? ` · ${application.city}` : ''}
                  {application.voivodeship ? `, ${application.voivodeship}` : ''}
                  {application.nip ? ` · NIP ${application.nip}` : ''}
                </p>
              </div>

              <Select
                value={application.status}
                onValueChange={(value) => updateStatus(application.id, value as Application['status'])}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-4 text-sm mb-3">
              <a
                href={`mailto:${application.email}`}
                className="inline-flex items-center gap-1.5 text-primary hover:underline"
              >
                <Mail className="h-3.5 w-3.5" />
                {application.email}
              </a>
              {application.phone && (
                <a
                  href={`tel:${application.phone.replace(/\s/g, '')}`}
                  className="inline-flex items-center gap-1.5 text-primary hover:underline"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {application.phone}
                </a>
              )}
              {application.website && (
                <a
                  href={application.website}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary"
                >
                  <Globe className="h-3.5 w-3.5" />
                  {application.website}
                </a>
              )}
            </div>

            {application.message && (
              <p className="text-sm text-gray-700 whitespace-pre-line bg-muted/40 rounded-lg p-3">
                {application.message}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
