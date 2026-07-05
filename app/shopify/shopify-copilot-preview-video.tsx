/** Customer-facing copilot demo — hosted on CloudFront (see demodesktop.mp4). */
export const RAZZL_COPILOT_DEMO_VIDEO_URL =
  "https://d1z6kcce2shbja.cloudfront.net/demodesktop.mp4";

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
