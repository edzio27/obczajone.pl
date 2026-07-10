import { ImageResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0F2A4A',
        }}
      >
        <svg width="130" height="130" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="38" stroke="#FFFFFF" strokeWidth="10" fill="none" />
          <path
            d="M32 52L46 66L70 34"
            stroke="#16A34A"
            strokeWidth="10"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </div>
    ),
    { width: 192, height: 192 }
  );
}
