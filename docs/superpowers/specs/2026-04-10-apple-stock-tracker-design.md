# Apple Stock Tracker — Design Spec

## Zweck

Web-App fuer Apple-Promoter bei Media Markt Kiel. Schnelle Bestandsabfrage fuer 3 spezifische Maerkte mit Fokus auf Citti-Park Kiel. Mobile-first, Apple-Style UI, einhändig bedienbar auf dem iPhone.

## Zielgruppe

Apple-Promoter im Aussendienst bei Media Markt. Taeglich genutzt auf dem iPhone waehrend der Arbeit im Markt. Auch fuer Kollegen nutzbar ueber geteilten Link.

## Kernprinzip: Zwei-Klick-Regel

1. Produkt waehlen (kaskadierende Dropdowns)
2. Bestand in allen drei Kieler Maerkten sehen

Kein Login, kein Suchen in Warenwirtschaftssystemen.

---

## Architektur

### Stack

- **Frontend:** Next.js 14+ (App Router), React, Tailwind CSS, Lucide Icons
- **Backend:** Next.js API Route (`/api/stock`) als Proxy
- **Datenquelle:** Media Markt GraphQL API (`mediamarkt.de/api/v1/graphql`)
- **Produktkatalog:** Statische JSON-Datei (`data/products.json`)
- **Hosting:** Vercel Free Tier
- **PWA:** Nein, normale Website

### Datenfluss

```
Browser (iPhone)
  → fetch('/api/stock?articleNumber=XXX')
    → Next.js API Route
      → Media Markt GraphQL (GetProductAvailabilities)
      → Response: Verfuegbarkeit pro Store + Online-Lieferbarkeit
    ← JSON Response (gecacht 5 Min)
  ← UI Update: Store-Karten mit Status
```

### Store-Konstanten

| Store | ID | Adresse |
|---|---|---|
| Citti-Park Kiel (Primaer) | 441 | Muehlendamm |
| Sophienhof | 1250 | Sophienblatt |
| Schwentinental | 368 | Schwentinental |

---

## Datenmodell

### Produktkatalog (`data/products.json`)

```json
{
  "categories": [
    {
      "name": "iPhone",
      "models": [
        {
          "name": "iPhone 16 Pro Max",
          "variants": [
            {
              "articleNumber": "2891234",
              "storage": "256 GB",
              "color": "Titan Natur",
              "colorHex": "#4a4845",
              "connectivity": null
            }
          ]
        }
      ]
    }
  ]
}
```

Kategorien: iPhone, iPad, MacBook, Watch. Jede Variante hat genau eine `articleNumber`. Das Feld `connectivity` ist nur bei iPads relevant (`"WiFi"` oder `"Cellular"`), bei allen anderen Produkten `null`. Katalog wird manuell gepflegt (~4x/Jahr bei Apple-Releases).

### Kaskadierende Dropdown-Logik

1. **Kategorie** waehlen → filtert verfuegbare Modelle
2. **Modell** waehlen → filtert verfuegbare Speicher + Farben
3. **Speicher** waehlen (nur wenn mehrere Optionen)
4. **Farbe** waehlen (nur wenn mehrere Optionen)
5. **Konnektivitaet** waehlen (nur bei iPad: WiFi / Cellular)

Dropdowns erscheinen nur, wenn es mehr als eine Option gibt. Wenn z.B. nur eine Farbe existiert, wird sie automatisch gewaehlt.

---

## API Integration

### Endpoint

```
GET /api/stock?articleNumber={articleNumber}
```

### Media Markt GraphQL

- **Endpoint:** `https://www.mediamarkt.de/api/v1/graphql`
- **Operation:** `GetProductAvailabilities`
- **Variables:** `{ "ids": ["{articleNumber}"] }`
- **Extensions:** `{ "pwa": { "salesLine": "MediaMarkt", "country": "DE", "language": "de" }, "persistedQuery": { "version": 1, "sha256Hash": "..." } }`

Der exakte SHA256-Hash und die store-spezifischen Query-Parameter muessen bei der Implementierung per Network-Inspektion auf mediamarkt.de ermittelt werden.

### Response-Format

```json
{
  "product": "iPhone 16 Pro Max 256GB Titan Natur",
  "stores": [
    {
      "id": "441",
      "name": "Citti-Park Kiel",
      "available": true,
      "pickup": true,
      "stockLevel": "high"
    },
    {
      "id": "1250",
      "name": "Sophienhof",
      "available": true,
      "pickup": true,
      "stockLevel": "low"
    },
    {
      "id": "368",
      "name": "Schwentinental",
      "available": false,
      "pickup": false,
      "stockLevel": "none"
    }
  ],
  "online": {
    "available": true,
    "deliveryDays": "3-5"
  },
  "cachedAt": "2026-04-10T14:30:00Z"
}
```

### Stock-Level Mapping

Die Media Markt API liefert numerische oder textbasierte Verfuegbarkeitsdaten. Die API Route (`/api/stock`) normalisiert diese zu drei Stufen:

| stockLevel | UI-Anzeige | Farbe | Bedingung (Mapping in API Route) |
|---|---|---|---|
| `high` | Sofort verfuegbar | Gruen (#34c759) | pickup == true (Marktabholung moeglich) |
| `low` | Geringe Menge | Gelb (#f5a623) | available == true aber pickup == false |
| `none` | Nicht vorr. | Rot (#ff3b30) | available == false |

Prioritaet: `pickup` schlaegt `available`. Wenn Marktabholung moeglich ist, immer Gruen — unabhaengig vom numerischen Bestand.

### Online-Bestellbarkeit

Wenn ein Produkt in einem Markt nicht vorr. ist, aber online bestellbar:
- Blaues Badge "Online bestellbar" auf der Store-Karte
- Online-Banner am Ende der Ergebnisseite mit geschaetzter Lieferzeit

### Caching

- Server-side In-Memory-Cache, 5 Minuten TTL
- Key: `articleNumber`
- Bei Cache-Hit: sofortige Antwort mit `cachedAt` Timestamp
- Vercel Serverless: Cache lebt pro Cold Start, reicht fuer den Use Case

### Rate Limiting

- Max 1 Request/Sekunde an Media Markt API
- Queue bei Burst-Anfragen
- Bei 429-Response: gecachtes Ergebnis zurueckgeben

---

## UI/UX Design

### Design-Prinzipien

- **Apple-Style:** Viel Weissraum, abgerundete Ecken (12-16px), SF-Pro-aehnliche Systemschrift
- **Mobile First:** 375px Viewport-Breite als Referenz, einhaendig bedienbar
- **Touch Targets:** Minimum 44x44px fuer alle interaktiven Elemente

### Screen 1: Produktauswahl

- Header: "Apple Promoter" (Label) + "Stock Tracker" (Titel) + Refresh-Button (rund, blau)
- Kaskadierende Dropdowns mit Apple-typischem Styling (weisse Karten, subtle Border)
- Speicher und Farbe nebeneinander in einer Row
- Farb-Dropdown zeigt Farbpunkt neben dem Namen
- Grosser "Bestand pruefen"-Button (#0071e3, volle Breite)

### Screen 2: Ergebnis

- Zurueck-Link oben links
- Produktinfo zentriert (Modell + Speicher/Farbe)
- **Primaer-Karte (Citti-Park):** Gross, gruener Rand, Check-Icon (48px), "Dein Markt"-Label, Status + Pickup-Info, Teilen- und Anrufen-Buttons
- **Ausweichmaerkte:** Zwei Karten nebeneinander, kompakter, mit Status-Icon (32px)
- **Online-Banner:** Am Ende, zeigt Lieferverfuegbarkeit + Lieferzeit
- **Nicht-vorr. Badge:** Blaues "Online bestellbar"-Badge auf Karten ohne Bestand

### Status-Indikatoren

- **Gruen:** Grosser Check-Circle, gruener Hintergrund, "Sofort verfuegbar" + "Marktabholung heute moeglich"
- **Gelb:** Warning-Circle, gelber Hintergrund, "Geringe Menge"
- **Rot:** X-Circle, roter Hintergrund, "Nicht vorr." + optional "Online bestellbar"-Badge

---

## Share-Funktion

### Verhalten

Klick auf "Teilen" bei einem verfuegbaren Markt:
1. **Web Share API** (nativ auf iPhone) → oeffnet iOS Share Sheet
2. **Fallback:** WhatsApp-Deeplink (`https://wa.me/?text=...`)

### Share-Text

```
iPhone 16 Pro Max (256GB, Titan Natur) ist sofort verfuegbar bei Media Markt Citti-Park Kiel, Muehlendamm. Marktabholung heute moeglich!
```

### Anrufen-Button

Direkter `tel:`-Link zur Telefonnummer des jeweiligen Markts.

---

## Fehlerbehandlung

| Szenario | Verhalten |
|---|---|
| Media Markt API timeout | "Status kann gerade nicht geladen werden" + Retry-Button |
| Rate Limited (429) | Cached Result zeigen + "Daten von vor X Min" |
| Artikelnummer unbekannt | "Produkt nicht bei Media Markt gefunden" |
| Kein Internet | Letztes Ergebnis aus localStorage (wenn vorhanden) |
| GraphQL-Fehler | Fehlermeldung + "Bitte direkt im Markt nachfragen" |

---

## Projektstruktur

```
Projekte/MediaMarkt/
├── app/
│   ├── layout.tsx          # Root Layout mit Tailwind
│   ├── page.tsx            # Produktauswahl-Screen
│   ├── result/
│   │   └── page.tsx        # Ergebnis-Screen
│   └── api/
│       └── stock/
│           └── route.ts    # Proxy zu Media Markt GraphQL
├── components/
│   ├── CategorySelect.tsx
│   ├── ModelSelect.tsx
│   ├── VariantSelect.tsx
│   ├── StoreCard.tsx       # Wiederverwendbar fuer alle 3 Maerkte
│   ├── OnlineBanner.tsx
│   └── ShareButton.tsx
├── data/
│   └── products.json       # Statischer Produktkatalog
├── lib/
│   ├── stores.ts           # Store-Konstanten (IDs, Namen, Adressen, Telefon)
│   ├── mediamarkt.ts       # GraphQL Client fuer Media Markt API
│   └── cache.ts            # In-Memory Cache mit TTL
├── public/
│   └── favicon.ico
├── tailwind.config.ts
├── next.config.ts
├── package.json
└── .env                    # (leer, keine Secrets noetig)
```

---

## Offene Punkte (bei Implementierung zu klaeren)

1. **GraphQL SHA256-Hash:** Muss per Network-Inspektion auf mediamarkt.de ermittelt werden. Aendert sich moeglicherweise bei Website-Updates.
2. **Store-spezifische Verfuegbarkeit:** Die exakte Query-Struktur fuer filialspezifischen Bestand ist nicht oeffentlich dokumentiert. Muss reverse-engineered werden.
3. **Artikelnummern:** Der initiale Produktkatalog muss mit echten Media Markt Artikelnummern befuellt werden (manuell von der Website ablesen).
4. **Telefonnummern:** Fuer den Anrufen-Button die Nummern der 3 Maerkte recherchieren.
