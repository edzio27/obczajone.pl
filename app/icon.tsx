import { ImageResponse } from 'next/server';
import { LogoMark, BRAND_BLUE_HEX } from '@/components/brand/logo-mark';

// Google pokazuje w wynikach tylko favicon o boku będącym wielokrotnością 48 px.
// Przeglądarka przeskaluje go w karcie sama.
export const size = { width: 96, height: 96 };
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
          background: '#F8F9FA',
        }}
      >
        <LogoMark size={78} color={BRAND_BLUE_HEX} />
      </div>
    ),
    { ...size }
  );
}
