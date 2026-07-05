type StyleMode = "inherit_theme" | "button" | "link" | "badge";

type Props = {
  label: string;
  styleMode: StyleMode;
};

function resolvePreviewVariant(styleMode: StyleMode): string {
  if (styleMode === "link") return "link";
  if (styleMode === "badge") return "badge";
  return "solid";
}

function ChatIcon() {
  return (
    <span className="shopify-cta-preview-btn__icon" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    </span>
  );
}

export function ShopifyCtaStorefrontPreview({ label, styleMode }: Props) {
  const variant = resolvePreviewVariant(styleMode);
  const showIcon = variant !== "link";
  const isThemeInherit = styleMode === "inherit_theme";

  return (
    <div className="shopify-cta-product-mockup" aria-hidden="true">
      <div className="shopify-cta-product-mockup__layout">
        <div className="shopify-cta-product-mockup__image" />
        <div className="shopify-cta-product-mockup__details">
          <div className="shopify-cta-product-mockup__title">Sample product title</div>
          <button type="button" className="shopify-cta-product-mockup__add-to-cart" tabIndex={-1}>
            Add to cart
          </button>
          <button
            type="button"
            className={`shopify-cta-preview-btn shopify-cta-preview-btn--${variant}${
              isThemeInherit ? " shopify-cta-preview-btn--inherit" : ""
            }`}
            tabIndex={-1}
          >
            {showIcon ? <ChatIcon /> : null}
            <span>{label}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
