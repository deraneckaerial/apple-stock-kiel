"use client";

import { useState, useEffect, useCallback } from "react";
import catalog from "@/data/products.json";
import type { ProductCatalog, Variant } from "@/lib/types";
import {
  getModels,
  getVariants,
  getUniqueValues,
  filterVariants,
  findVariant,
} from "@/lib/catalog";

const typedCatalog = catalog as ProductCatalog;

interface ProductSelectorProps {
  onSelect: (variant: Variant, productName: string) => void;
}

export default function ProductSelector({ onSelect }: ProductSelectorProps) {
  const [category, setCategory] = useState("");
  const [model, setModel] = useState("");
  const [storage, setStorage] = useState("");
  const [color, setColor] = useState("");
  const [connectivity, setConnectivity] = useState("");

  // Derived data
  const categories = typedCatalog.categories.map((c) => c.name);
  const models = category ? getModels(typedCatalog, category).map((m) => m.name) : [];
  const allVariants = category && model ? getVariants(typedCatalog, category, model) : [];

  const storages = getUniqueValues(allVariants, "storage") as string[];
  const colorsForStorage = getUniqueValues(
    storage ? filterVariants(allVariants, { storage }) : allVariants,
    "color"
  ) as string[];
  const connectivities = getUniqueValues(
    filterVariants(allVariants, { storage: storage || undefined, color: color || undefined }),
    "connectivity"
  ) as string[];

  const needsConnectivity = category === "iPad" && connectivities.length > 0;

  // Auto-select when only one option
  const autoSelect = useCallback(
    (values: string[], current: string, setter: (v: string) => void) => {
      if (values.length === 1 && current !== values[0]) {
        setter(values[0]);
      }
    },
    []
  );

  useEffect(() => autoSelect(models, model, setModel), [models, model, autoSelect]);
  useEffect(() => autoSelect(storages, storage, setStorage), [storages, storage, autoSelect]);
  useEffect(
    () => autoSelect(colorsForStorage, color, setColor),
    [colorsForStorage, color, autoSelect]
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
    setColor("");
    setConnectivity("");
  }

  function handleModelChange(val: string) {
    setModel(val);
    setStorage("");
    setColor("");
    setConnectivity("");
  }

  function handleStorageChange(val: string) {
    setStorage(val);
    setColor("");
    setConnectivity("");
  }

  function handleColorChange(val: string) {
    setColor(val);
    setConnectivity("");
  }

  // Check if selection is complete
  const selectedVariant =
    storage && color && (!needsConnectivity || connectivity)
      ? findVariant(allVariants, storage, color, connectivity)
      : undefined;

  function handleSubmit() {
    if (selectedVariant) {
      onSelect(selectedVariant, model);
    }
  }

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

      {/* Storage + Color row — only show if model selected */}
      {model && (
        <div className="flex gap-2">
          {storages.length > 1 && (
            <div className="flex-1">
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

          {colorsForStorage.length > 1 && (
            <div className="flex-1">
              <label className="block text-xs font-medium text-apple-gray mb-1">
                Farbe
              </label>
              <select
                className="select-apple"
                value={color}
                onChange={(e) => handleColorChange(e.target.value)}
              >
                <option value="">Waehlen...</option>
                {colorsForStorage.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Connectivity — iPad only, only if multiple options */}
      {needsConnectivity && connectivities.length > 1 && (
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

      {/* Submit */}
      <button
        disabled={!selectedVariant}
        onClick={handleSubmit}
        className="w-full py-3.5 bg-apple-blue text-white font-semibold text-base rounded-apple
                   disabled:opacity-40 disabled:cursor-not-allowed
                   active:scale-[0.98] transition-transform mt-2"
      >
        Bestand pruefen
      </button>
    </div>
  );
}
