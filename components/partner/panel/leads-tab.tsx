'use client';

import { useState } from 'react';
import Link from 'next/link';
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
import { ExternalLink, Mail, Phone } from 'lucide-react';

export type Lead = {
  id: string;
  listing_id: string | null;
  name: string;
  phone: string;
  email: string;
  message: string;
  context: string;
  status: 'new' | 'contacted' | 'done' | 'rejected';
  created_at: string;
};

const STATUS_OPTIONS = [
  { value: 'new', label: 'Nowe' },
  { value: 'contacted', label: 'Skontaktowano' },
  { value: 'done', label: 'Zrealizowane' },
  { value: 'rejected', label: 'Odrzucone' },
];

const STATUS_STYLES: Record<string, string> = {
  new: 'bg-primary/10 text-primary border-primary/20',
  contacted: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  done: 'bg-success/10 text-success border-success/20',
  rejected: 'bg-muted text-muted-foreground',
};

const CONTEXT_LABELS: Record<string, string> = {
  listing_cta: 'Ze strony ogłoszenia',
  partner_page: 'Z Twojego profilu',
  partners_page: 'Z katalogu partnerów',
};

export function LeadsTab({ leads: initialLeads }: { leads: Lead[] }) {
  const { toast } = useToast();
  const [leads, setLeads] = useState(initialLeads);

  async function updateStatus(leadId: string, status: Lead['status']) {
    const previous = leads;
    setLeads((current) => current.map((l) => (l.id === leadId ? { ...l, status } : l)));

    const { error } = await supabase.from('partner_leads').update({ status }).eq('id', leadId);

    if (error) {
      setLeads(previous);
      toast({ title: 'Nie udało się zmienić statusu', variant: 'destructive' });
    }
  }

  if (leads.length === 0) {
    return (
      <Card className="border-dashed border-2">
        <CardContent className="pt-6 text-center py-10">
          <p className="text-muted-foreground max-w-md mx-auto">
            Nie masz jeszcze żadnych zapytań. Pojawią się tutaj, gdy ktoś kliknie „Zamów sprawdzenie”
            przy ogłoszeniu z Twojego regionu albo na Twoim profilu.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {leads.map((lead) => (
        <Card key={lead.id}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold">{lead.name}</p>
                  <Badge variant="outline" className={STATUS_STYLES[lead.status]}>
                    {STATUS_OPTIONS.find((s) => s.value === lead.status)?.label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {format(new Date(lead.created_at), 'd MMMM yyyy, HH:mm', { locale: pl })}
                  {' · '}
                  {CONTEXT_LABELS[lead.context] ?? lead.context}
                </p>
              </div>

              <Select
                value={lead.status}
                onValueChange={(value) => updateStatus(lead.id, value as Lead['status'])}
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
              {lead.phone && (
                <a
                  href={`tel:${lead.phone.replace(/\s/g, '')}`}
                  className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {lead.phone}
                </a>
              )}
              {lead.email && (
                <a
                  href={`mailto:${lead.email}`}
                  className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium"
                >
                  <Mail className="h-3.5 w-3.5" />
                  {lead.email}
                </a>
              )}
              {lead.listing_id && (
                <Link
                  href={`/listing/${lead.listing_id}`}
                  className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Zobacz ogłoszenie
                </Link>
              )}
            </div>

            {lead.message && (
              <p className="text-sm text-gray-700 whitespace-pre-line bg-muted/40 rounded-lg p-3">
                {lead.message}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
