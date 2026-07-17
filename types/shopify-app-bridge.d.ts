export {};

declare global {
  interface Window {
    shopify?: {
      config?: {
        shop?: string;
        host?: string;
      };
      redirect?: {
        remote: (url: string) => void;
      };
      idToken?: () => Promise<string>;
      toast: {
        show: (message: string, options?: { isError?: boolean; duration?: number }) => void;
      };
    };
  }
}
