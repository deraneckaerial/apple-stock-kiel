export interface StoreInfo {
  id: string;
  name: string;
  shortName: string;
  address: string;
  isPrimary: boolean;
}

export const STORES: StoreInfo[] = [
  {
    id: "441",
    name: "MediaMarkt Kiel",
    shortName: "Citti-Park Kiel",
    address: "Mühlendamm 5, 24113 Kiel",
    isPrimary: true,
  },
  {
    id: "1250",
    name: "MediaMarkt Kiel-Sophienhof",
    shortName: "Sophienhof",
    address: "Sophienblatt 20, 24103 Kiel",
    isPrimary: false,
  },
  {
    id: "440",
    name: "MediaMarkt Schwentinental",
    shortName: "Schwentinental",
    address: "Mergenthalerstr. 1, 24223 Schwentinental",
    isPrimary: false,
  },
];

export const PRIMARY_STORE = STORES.find((s) => s.isPrimary)!;
export const SECONDARY_STORES = STORES.filter((s) => !s.isPrimary);
