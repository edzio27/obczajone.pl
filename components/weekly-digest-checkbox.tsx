'use client';

/**
 * Zgoda na poniedziałkowe podsumowanie, domyślnie odznaczona.
 *
 * Alert („daj znać, gdy cena spadnie”) i podsumowanie z innymi autami to dwie
 * różne wiadomości. Kto zapisuje się na pierwszą, nie zgadza się tym samym na
 * drugą - stąd osobne pole, które człowiek zaznacza sam.
 */
export function WeeklyDigestCheckbox({
  checked,
  onChange,
  modelName,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  modelName?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-input accent-primary"
      />
      <span>
        W poniedziałki wyślij mi też krótkie podsumowanie: co potaniało i co nowego
        {modelName ? ` w ${modelName}` : ' w tym modelu'}. Wyłączysz je linkiem z każdego maila.
      </span>
    </label>
  );
}
