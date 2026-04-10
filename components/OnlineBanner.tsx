import { Monitor, ChevronRight } from "lucide-react";
import type { OnlineAvailability } from "@/lib/types";

interface OnlineBannerProps {
  online: OnlineAvailability;
  articleNumber: string;
}

export default function OnlineBanner({
  online,
  articleNumber,
}: OnlineBannerProps) {
  if (!online.available) return null;

  return (
    <a
      href={`https://www.mediamarkt.de/de/product/_-${articleNumber}.html`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 bg-white rounded-apple p-3.5 shadow-apple-sm
                 active:scale-[0.98] transition-transform"
    >
      <div className="w-9 h-9 rounded-[10px] bg-blue-50 flex items-center justify-center flex-shrink-0">
        <Monitor className="w-[18px] h-[18px] text-apple-blue" />
      </div>
      <div className="flex-1">
        <p className="text-[13px] font-semibold text-apple-dark">
          Online bestellbar
        </p>
        <p className="text-xs text-apple-gray">
          Lieferung in {online.deliveryDays} Werktagen
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-apple-gray" />
    </a>
  );
}
