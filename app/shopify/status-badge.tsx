import { Badge } from "@shopify/polaris";

type Props = {
  label: string;
  variant?: "unmapped" | "published" | "draft" | "processing" | "error";
};

export function StatusBadge({ label, variant = "unmapped" }: Props) {
  if (variant === "unmapped") {
    return <span className="shopify-outlined-badge">{label}</span>;
  }

  const tone =
    variant === "published"
      ? "success"
      : variant === "processing"
        ? "info"
        : variant === "error"
          ? "critical"
          : "warning";

  return <Badge tone={tone}>{label}</Badge>;
}
