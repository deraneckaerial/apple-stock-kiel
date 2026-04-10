"use client";

import { useState, useEffect, useCallback } from "react";
import catalog from "@/data/products.json";
import type { ProductCatalog, Variant } from "@/lib/types";
import {
  getModels,
  getVariants,
  getUniqueValues,
  filterVariants,
} from "@/lib/catalog";
import ColorAvailabilityGrid from "@/components/ColorAvailabilityGrid";

const typedCatalog = catalog as ProductCatalog;

interface ProductSelectorProps {
  onSelect: (variant: Variant, productName: string) => void;
}

export default function ProductSelector({ onSelect }: ProductSelectorProps) {
  const [category, setCategory] = useState("");
  const [model, setModel] = useState("");
  const [storage, setStorage] = useState("");
  const [connectivity, setConnectivity] = useState("");

  // Derived data
  const categories = typedCatalog.categories.map((c) => c.name);
  const models = category
    ? getModels(typedCatalog, category).map((m) => m.name)
    : [];
  const allVariants =
    category && model
      ? getVariants(typedCatalog, category, model)
      : [];

  const storages = getUniqueValues(allVariants, "storage") as string[];

  // Connectivity options (only relevant for iPad)
  const connectivities = getUniqueValues(
    filterVariants(allVariants, {
      storage: storage || undefined,
    }),
    "connectivity"
  ) as string[];
  const needsConnectivity = category === "iPad" && connectivities.length > 1;

  // Color variants to show in grid — filtered by storage + connectivity
  const colorVariants =
    storage
      ? filterVariants(allVariants, {
          storage,
          connectivity: (needsConnectivity && connectivity ? connectivity : undefined) as "WiFi" | "WiFi + Cellular" | undefined,
        })
      : [];

  // Auto-select when only one option
  const autoSelect = useCallback(
    (values: string[], current: string, setter: (v: string) => void) => {
      if (values.length === 1 && current !== values[0]) {
        setter(values[0]);
      }
    },
    []
  );

  useEffect(
    () => autoSelect(models, model, setModel),
    [models, model, autoSelect]
  );
  useEffect(
    () => autoSelect(storages, storage, setStorage),
    [storages, storage, autoSelect]
  );
  useEffect(
    () => autoSelect(connectivities, connectivity, setConnectivity),
    [connectivities, connectivity, autoSelect]
  );

  // Reset downstream on upstream change
  function handleCategoryChange(val: string) {
    setCategory(val);
    setModel("");
    setStorage("");
    setConnectivity("");
  }

  function handleModelChange(val: string) {
    setModel(val);
    setStorage("");
    setConnectivity("");
  }

  function handleStorageChange(val: string) {
    setStorage(val);
    setConnectivity("");
  }

  // If only one color variant, auto-navigate to detail
  const hasColors = colorVariants.length > 0;
  const singleVariant = colorVariants.length === 1 ? colorVariants[0] : null;

  useEffect(() => {
    if (singleVariant) {
      onSelect(singleVariant, model);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [singleVariant?.articleNumber]);

  return (
    <div className="space-y-3">
      {/* Category */}
      <div>
        <label className="block text-xs font-medium text-apple-gray mb-1">
          Kategorie
        </label>
        <select
          className="select-apple"
          value={category}
          onChange={(e) => handleCategoryChange(e.target.value)}
        >
          <option value="">Waehlen...</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Model — only show if multiple models */}
      {category && models.length > 1 && (
        <div>
          <label className="block text-xs font-medium text-apple-gray mb-1">
            Modell
          </label>
          <select
            className="select-apple"
            value={model}
            onChange={(e) => handleModelChange(e.target.value)}
          >
            <option value="">Waehlen...</option>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Storage — only show if multiple options */}
      {model && storages.length > 1 && (
        <div>
          <label className="block text-xs font-medium text-apple-gray mb-1">
            Speicher
          </label>
          <select
            className="select-apple"
            value={storage}
            onChange={(e) => handleStorageChange(e.target.value)}
          >
            <option value="">Waehlen...</option>
            {storages.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Connectivity — iPad only, only if multiple options */}
      {needsConnectivity && (
        <div>
          <label className="block text-xs font-medium text-apple-gray mb-1">
            Konnektivitaet
          </label>
          <select
            className="select-apple"
            value={connectivity}
            onChange={(e) => setConnectivity(e.target.value)}
          >
            <option value="">Waehlen...</option>
            {connectivities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Color grid with live availability — replaces color dropdown + submit button */}
      {hasColors && !singleVariant && (
        <ColorAvailabilityGrid
          variants={colorVariants}
          modelName={model}
          onSelect={(variant) => onSelect(variant, model)}
        />
      )}
    </div>
  );
}
