import { VideoCategory } from '../types/VideoCategory';
import { Language, LocalizationDataType, Phrase } from './phrases';
import EnglishTranslations from './english';
import KoreanTranslations from './korean';
import GermanTranslations from './german';
import ChineseSimplifiedTranslations from './chineseSimplified';

const data: LocalizationDataType = {
  [Language.ENGLISH]: EnglishTranslations,
  [Language.KOREAN]: KoreanTranslations,
  [Language.GERMAN]: GermanTranslations,
  [Language.CHINESE_SIMPLIFIED]: ChineseSimplifiedTranslations,
};

const getLocalePhrase = (lang: Language, phrase: Phrase) => data[lang][phrase];

const getLocaleCategoryLabel = (
  lang: Language,
  videoCategory: VideoCategory,
) => {
  switch (videoCategory) {
    case VideoCategory.CrystallineConflict:
      return 'Crystalline Conflict';
    case VideoCategory.Manual:
      return getLocalePhrase(lang, Phrase.VideoCategoryManualLabel);
    case VideoCategory.Clips:
      return getLocalePhrase(lang, Phrase.VideoCategoryClipsLabel);
    default:
      throw new Error('Unrecognized category');
  }
};

export { getLocalePhrase, getLocaleCategoryLabel, Language };
