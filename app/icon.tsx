import { ImageResponse } from 'next/server';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'white',
        }}
      >
        <svg width="28" height="28" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="38" stroke="#0F2A4A" strokeWidth="12" fill="none" />
          <path
            d="M32 52L46 66L70 34"
            stroke="#16A34A"
            strokeWidth="12"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
