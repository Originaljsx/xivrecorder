import { Row } from '@tanstack/react-table';
import { Language } from 'localisation/phrases';
import { RendererVideo } from 'main/types';
import {
  countUniqueViewpoints,
  getVideoResultText,
} from 'renderer/rendererutils';

export const resultSort = (
  a: Row<RendererVideo>,
  b: Row<RendererVideo>,
  language: Language,
) => {
  const resultA = getVideoResultText(a.original, language);
  const resultB = getVideoResultText(b.original, language);
  return resultB.localeCompare(resultA);
};

export const durationSort = (a: Row<RendererVideo>, b: Row<RendererVideo>) => {
  const resultA = a.original.duration;
  const resultB = b.original.duration;
  return resultA - resultB;
};

export const viewPointCountSort = (
  a: Row<RendererVideo>,
  b: Row<RendererVideo>,
) => {
  const countA = countUniqueViewpoints(a.original);
  const countB = countUniqueViewpoints(b.original);

  if (countA !== countB) {
    return countA - countB;
  }

  const playerA = a.original.player?._name || '';
  const playerB = b.original.player?._name || '';
  return playerB.localeCompare(playerA);
};

export const detailSort = (a: Row<RendererVideo>, b: Row<RendererVideo>) => {
  const aProtected = a.original.isProtected;
  const bProtected = b.original.isProtected;

  const aTag = a.original.tag;
  const bTag = b.original.tag;

  if ((aProtected && !bProtected) || (aTag && !bTag)) {
    return 1;
  }

  if ((!aProtected && bProtected) || (!aTag && bTag)) {
    return -1;
  }

  return 0;
};

export const clipActivitySort = (
  a: Row<RendererVideo>,
  b: Row<RendererVideo>,
  _language: Language,
) => {
  const rvA = a.original;
  const activityA = rvA.zoneName || '';

  const rvB = b.original;
  const activityB = rvB.zoneName || '';

  return activityB.localeCompare(activityA);
};
