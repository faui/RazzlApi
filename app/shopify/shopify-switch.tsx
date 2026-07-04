"use client";

type Props = {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

export function ShopifySwitch({ checked, label, onChange, disabled }: Props) {
  return (
    <button
      type="button"
      className={`shopify-switch${checked ? " shopify-switch--on" : ""}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="shopify-switch__thumb" />
    </button>
  );
}
