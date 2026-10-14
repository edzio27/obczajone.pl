import { ImageResponse } from 'next/server';
import { LogoMark, BRAND_BLUE_HEX } from '@/components/brand/logo-mark';

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
          background: '#F8F9FA',
        }}
      >
        <LogoMark size={130} color={BRAND_BLUE_HEX} />
      </div>
    ),
    { width: 192, height: 192 }
  );
}
