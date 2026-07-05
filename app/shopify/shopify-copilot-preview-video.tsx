import { BlockStack } from "@shopify/polaris";

/** Full customer demo page (HTML + HLS player). */
export const RAZZL_COPILOT_DEMO_PAGE_URL = "https://d1z6kcce2shbja.cloudfront.net/";

/** MP4 used for inline autoplay previews in embedded admin. */
export const RAZZL_COPILOT_DEMO_VIDEO_URL =
  "https://d1z6kcce2shbja.cloudfront.net/demodesktop.mp4";

export const RAZZL_MARKETING_URL = "https://razzl.com";

type Props = {
  variant?: "full" | "compact";
};

export function ShopifyCopilotPreviewVideo({ variant = "full" }: Props) {
  return (
    <div className={`shopify-copilot-preview-video shopify-copilot-preview-video--${variant}`}>
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-label="Razzl Setup Copilot customer experience preview"
      >
        <source src={RAZZL_COPILOT_DEMO_VIDEO_URL} type="video/mp4" />
      </video>
    </div>
  );
}

function ExpandIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M10 2h4v4M6 10 14 2M14 10v4h-4M2 6l8 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type InteractiveProps = {
  demoPageUrl?: string;
  experienceLinkLabel?: string;
};

export function ShopifyCopilotPreviewVideoInteractive({
  demoPageUrl = RAZZL_COPILOT_DEMO_PAGE_URL,
  experienceLinkLabel = "See the full customer experience →"
}: InteractiveProps) {
  return (
    <BlockStack gap="200">
      <a
        className="shopify-copilot-preview-video-link"
        href={demoPageUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open full customer experience demo in a new tab"
      >
        <span className="shopify-copilot-preview-video shopify-copilot-preview-video--full shopify-copilot-preview-video--interactive">
          <video autoPlay muted loop playsInline preload="metadata" tabIndex={-1} aria-hidden="true">
            <source src={RAZZL_COPILOT_DEMO_VIDEO_URL} type="video/mp4" />
          </video>
          <span className="shopify-copilot-preview-video__hover-pill">
            <ExpandIcon />
          </span>
        </span>
      </a>
      <a
        className="shopify-brand-primary-link shopify-copilot-preview-video__experience-link"
        href={demoPageUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        {experienceLinkLabel}
      </a>
    </BlockStack>
  );
}
