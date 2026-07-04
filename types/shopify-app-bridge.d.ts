export {};

declare global {
  interface Window {
    shopify?: {
      toast: {
        show: (message: string, options?: { isError?: boolean; duration?: number }) => void;
      };
    };
  }
}
