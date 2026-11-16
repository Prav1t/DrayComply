// Integrity tests for the UNVERIFIED fuel surcharge supplement.
import { describe, it, expect } from 'vitest';
import { FUEL_SUPPLEMENT_META, FUEL_SURCHARGE_PUBLISHED_SUPPLEMENT as SUPPLEMENT } from './obcctc-fuel-published-supplement';
import { FUEL_SURCHARGE, FUEL_SURCHARGE_PUBLISHED } from './obcctc-2026-07-01';

describe('fuel surcharge supplement', () => {
  it('is marked unverified', () => {
    expect([FUEL_SUPPLEMENT_META.status, FUEL_SUPPLEMENT_META.verifiedBy]).toEqual(['unverified-transcription', null]);
  });
  it('covers every month of 2021 to 2024, plus November 2026', () => {
    const months = [2021, 2022, 2023, 2024].flatMap(y => Array.from({ length: 12 }, (_, m) => `${y}-${String(m + 1).padStart(2, '0')}`));
    expect(Object.keys(SUPPLEMENT).sort()).toEqual([...months, '2026-11']);
  });
  it('never restates a month the verified file already holds', () => {
    expect(Object.keys(SUPPLEMENT).filter(m => m in FUEL_SURCHARGE_PUBLISHED)).toEqual([]);
  });
  it('holds only percentages the formula can produce: whole steps of 2%', () => {
    Object.entries(SUPPLEMENT).forEach(([month, v]) => expect({ month, remainder: v.pct % FUEL_SURCHARGE.pctPerStep, negative: v.pct < 0 }).toEqual({ month, remainder: 0, negative: false }));
  });
  it('derives the percentage from the formula wherever a reference price is given', () => {
    Object.entries(SUPPLEMENT).forEach(([month, v]) => {
      if (v.referenceCentsPerLitre === null) return;
      const steps = Math.floor((v.referenceCentsPerLitre - FUEL_SURCHARGE.thresholdCentsPerLitre) / FUEL_SURCHARGE.stepCentsPerLitre);
      expect({ month, pct: steps * FUEL_SURCHARGE.pctPerStep }).toEqual({ month, pct: v.pct });
    });
  });
});
