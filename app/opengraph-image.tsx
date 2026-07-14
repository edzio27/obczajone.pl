import { ImageResponse } from 'next/server';
import { LogoMark } from '@/components/brand/logo-mark';

export const alt = 'obczajone.pl — historia cen i opinie o ogłoszeniach';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#041732',
          padding: '80px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 40 }}>
          <LogoMark size={90} />
          <span style={{ fontSize: 64, fontWeight: 800, display: 'flex' }}>
            <span style={{ color: 'white' }}>obczajone</span>
            <span style={{ color: '#175CE0' }}>.pl</span>
          </span>
        </div>
        {/* ASCII-only: Satori has no loaded font here that covers Polish diacritics */}
        <span style={{ fontSize: 32, color: '#CBD5E1', textAlign: 'center', display: 'flex' }}>
          Sprawdz historie cen i opinie o ogloszeniach z Otomoto i Otodom
        </span>
      </div>
    ),
    { ...size }
  );
}
