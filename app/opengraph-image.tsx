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
          background: '#1E1B4B',
          padding: '80px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 40 }}>
          <svg width="90" height="90" viewBox="0 0 100 100">
            <defs>
              <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4F46E5" />
                <stop offset="100%" stopColor="#06B6D4" />
              </linearGradient>
            </defs>
            <path
              d="M30,10 L70,10 A20,20 0 0 1 90,30 L90,60 A20,20 0 0 1 70,80 L34,80 L20,96 L28,80 L30,80 A20,20 0 0 1 10,60 L10,30 A20,20 0 0 1 30,10 Z"
              fill="url(#g)"
            />
            <path
              d="M32 52L46 66L70 34"
              stroke="#FFFFFF"
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          <span style={{ fontSize: 64, fontWeight: 700, color: 'white', display: 'flex' }}>
            obczajone.pl
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
