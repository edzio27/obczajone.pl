/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  /*
    Strona /dla-mediow liczy się przy żądaniu (force-dynamic), bo prerenderowanie
    jej przy budowaniu nie działa: 66 stron generuje się równolegle, baza jest wtedy
    pod obciążeniem i zapytanie raportu przekracza ośmiosekundowy limit PostgREST.
    Efektem była strona prasowa bez ani jednej liczby.

    Świeżość pilnuje więc CDN, a nie prerender. Godzina to ten sam okres, który
    miał tam wcześniej `revalidate` - z tą różnicą, że teraz naprawdę obowiązuje,
    a baza dostaje dwa zapytania na godzinę zamiast dwóch na żądanie.
  */
  async headers() {
    return [
      {
        source: '/dla-mediow',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
          },
        ],
      },
    ];
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'scontent.fktw1-1.fna.fbcdn.net',
      },
      {
        protocol: 'https',
        hostname: '*.fbcdn.net',
      },
    ],
  },
};

module.exports = nextConfig;
