export interface ShareData {
  productName: string;
  variantLabel: string;
  storeName: string;
  storeAddress: string;
  pickup: boolean;
}

export function buildShareText(data: ShareData): string {
  const status = data.pickup
    ? "ist sofort verfuegbar"
    : "hat geringe Menge";
  return (
    `${data.productName} (${data.variantLabel}) ${status} ` +
    `bei ${data.storeName}, ${data.storeAddress}.` +
    (data.pickup ? " Marktabholung heute moeglich!" : "")
  );
}

export async function shareOrFallback(text: string): Promise<void> {
  if (navigator.share) {
    try {
      await navigator.share({ text });
    } catch (err) {
      // User dismissed share sheet — not an error
      if (err instanceof Error && err.name === "AbortError") return;
      throw err;
    }
  } else {
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
  }
}
