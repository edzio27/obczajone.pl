/**
 * JSON.stringify nie escape'uje "<", więc wartość zawierająca
 * "</script><script>..." wyrwałaby się z bloku <script type="application/ld+json">
 * i wykonała jako prawdziwy skrypt (te bloki wstrzykujemy przez
 * dangerouslySetInnerHTML). Escape "<" jako unicode neutralizuje to,
 * zostawiając poprawny i semantycznie identyczny JSON.
 *
 * Dotyczy każdego JSON-LD, w którym pojawia się tekst kontrolowany przez
 * użytkownika - a więc tytułów ogłoszeń, opinii i opisów partnerów.
 */
export function safeJsonLdString(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
