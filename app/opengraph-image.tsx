import { ImageResponse } from 'next/server';

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
          background: '#0F2A4A',
          padding: '80px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 40 }}>
          <svg width="90" height="90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="38" stroke="#FFFFFF" strokeWidth="9" fill="none" />
            <path
              d="M32 52L46 66L70 34"
              stroke="#16A34A"
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          <span style={{ fontSize: 64, fontWeight: 700, color: 'white', display: 'flex' }}>
            obczajone
            <span style={{ color: '#16A34A' }}>.pl</span>
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
