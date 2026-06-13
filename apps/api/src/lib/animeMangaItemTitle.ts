import type { AnimeMangaTitleLanguage, ItemDetail } from "@geeklogs/shared";
import { pickAnimeMangaTitle } from "@geeklogs/shared";

export function withAnimeMangaTitlePreference(
  item: ItemDetail,
  preference: AnimeMangaTitleLanguage
): ItemDetail {
  if (!item.titleVariants) return item;
  return {
    ...item,
    title: pickAnimeMangaTitle(item.titleVariants, preference),
  };
}
