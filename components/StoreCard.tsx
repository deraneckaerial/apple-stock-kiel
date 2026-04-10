import { CheckCircle, AlertCircle, XCircle, Monitor } from "lucide-react";
import type { StoreStock, OnlineAvailability } from "@/lib/types";

interface StoreCardProps {
  store: StoreStock;
  isPrimary?: boolean;
  online?: OnlineAvailability;
  productName: string;
  variantLabel: string;
  onShare?: () => void;
  onCall?: () => void;
}

function StockIcon({
  level,
  size,
}: {
  level: "high" | "low" | "none";
  size: number;
}) {
  if (level === "high")
    return (
      <div
        className="rounded-full bg-green-100 flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <CheckCircle className="text-apple-green" style={{ width: size * 0.5, height: size * 0.5 }} />
      </div>
    );
  if (level === "low")
    return (
      <div
        className="rounded-full bg-yellow-100 flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <AlertCircle className="text-apple-yellow" style={{ width: size * 0.5, height: size * 0.5 }} />
      </div>
    );
  return (
    <div
      className="rounded-full bg-red-100 flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <XCircle className="text-apple-red" style={{ width: size * 0.5, height: size * 0.5 }} />
    </div>
  );
}

function StockLabel({ level }: { level: "high" | "low" | "none" }) {
  if (level === "high")
    return (
      <div>
        <p className="text-[15px] font-semibold text-green-700">
          Sofort verfuegbar
        </p>
        <p className="text-xs text-green-600">Marktabholung heute moeglich</p>
      </div>
    );
  if (level === "low")
    return (
      <p className="text-xs font-medium text-apple-yellow mt-1">
        Geringe Menge
      </p>
    );
  return (
    <p className="text-xs font-medium text-apple-red mt-1">Nicht vorr.</p>
  );
}

export default function StoreCard({
  store,
  isPrimary = false,
  online,
  productName,
  variantLabel,
  onShare,
  onCall,
}: StoreCardProps) {
  if (isPrimary) {
    return (
      <div
        className={`bg-white rounded-apple-lg p-5 shadow-apple border-2 ${
          store.stockLevel === "high"
            ? "border-apple-green"
            : store.stockLevel === "low"
            ? "border-apple-yellow"
            : "border-gray-200"
        }`}
      >
        <div className="flex items-center gap-3 mb-3">
          <StockIcon level={store.stockLevel} size={48} />
          <div>
            <p className="text-[11px] text-apple-gray uppercase tracking-wide font-medium">
              Dein Markt
            </p>
            <p className="text-lg font-bold text-apple-dark">
              {store.name.replace("Media Markt ", "")}
            </p>
          </div>
        </div>

        {store.stockLevel === "high" && (
          <div className="bg-green-50 rounded-[10px] px-3.5 py-2.5 mb-3">
            <StockLabel level="high" />
          </div>
        )}
        {store.stockLevel === "low" && (
          <div className="bg-yellow-50 rounded-[10px] px-3.5 py-2.5 mb-3">
            <p className="text-[15px] font-semibold text-yellow-700">
              Geringe Menge
            </p>
            <p className="text-xs text-yellow-600">Bald vergriffen</p>
          </div>
        )}
        {store.stockLevel === "none" && (
          <div className="bg-red-50 rounded-[10px] px-3.5 py-2.5 mb-3">
            <p className="text-[15px] font-semibold text-red-700">
              Nicht vorr&auml;tig
            </p>
            {online?.available && (
              <p className="text-xs text-apple-blue font-medium mt-1">
                Online bestellbar
              </p>
            )}
          </div>
        )}

        <div className="flex gap-2">
          {onShare && (
            <button
              onClick={onShare}
              className="flex-1 py-2.5 bg-apple-lightgray rounded-[10px] text-[13px] text-apple-blue font-medium text-center
                         active:scale-[0.97] transition-transform"
            >
              Teilen
            </button>
          )}
          {onCall && (
            <button
              onClick={onCall}
              className="flex-1 py-2.5 bg-apple-lightgray rounded-[10px] text-[13px] text-apple-blue font-medium text-center
                         active:scale-[0.97] transition-transform"
            >
              Anrufen
            </button>
          )}
        </div>
      </div>
    );
  }

  // Secondary (compact) card
  return (
    <div className="flex-1 bg-white rounded-apple p-3.5 shadow-apple-sm">
      <StockIcon level={store.stockLevel} size={32} />
      <p className="text-sm font-semibold text-apple-dark mt-2">
        {store.name.replace("Media Markt ", "")}
      </p>
      <StockLabel level={store.stockLevel} />
      {store.stockLevel === "none" && online?.available && (
        <div className="flex items-center gap-1 mt-1.5 bg-blue-50 rounded-md px-2 py-1">
          <Monitor className="w-3 h-3 text-apple-blue" />
          <span className="text-[11px] text-apple-blue font-medium">
            Online bestellbar
          </span>
        </div>
      )}
      <p className="text-[11px] text-apple-gray mt-1">{store.address.split(",")[0]}</p>
    </div>
  );
}
