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
    name: "Media Markt Citti-Park Kiel",
    shortName: "Citti-Park Kiel",
    address: "Muehlendamm 1, 24113 Kiel",
    isPrimary: true,
  },
  {
    id: "1250",
    name: "Media Markt Sophienhof",
    shortName: "Sophienhof",
    address: "Sophienblatt 20, 24103 Kiel",
    isPrimary: false,
  },
  {
    id: "368",
    name: "Media Markt Schwentinental",
    shortName: "Schwentinental",
    address: "Mergenthaler Str. 4, 24223 Schwentinental",
    isPrimary: false,
  },
];

export const PRIMARY_STORE = STORES.find((s) => s.isPrimary)!;
export const SECONDARY_STORES = STORES.filter((s) => !s.isPrimary);
