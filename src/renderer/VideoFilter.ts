import { ccTerritories } from 'main/constants';
import { RawCombatant, RendererVideo } from 'main/types';
import {
  isCCUtil,
  getPlayerName,
  getJobAbbreviation,
  getJobRoleColor,
} from './rendererutils';
import { Tag } from 'react-tag-autocomplete';
import VideoTag from './VideoTag';
import { Language, Phrase } from 'localisation/phrases';
import { getLocalePhrase } from 'localisation/translations';
import { DateValueType } from 'react-tailwindcss-datepicker';

/**
 * The VideoFilter class provides a mechanism to populate the search
 * suggestions, as well as filter the list of videos based on the
 * user's search query.
 */
export default class VideoFilter {
  private video: RendererVideo;
  private query: string[];
  private matches: string[];
  private dateRangeFilter: DateValueType;

  constructor(
    video: RendererVideo,
    tags: Tag[],
    dateFilter: DateValueType,
    language: Language,
  ) {
    this.dateRangeFilter = dateFilter;
    this.video = video;

    this.query = tags
      .map((tag) => tag.value)
      .filter((tag) => typeof tag === 'string');

    this.matches = [video, ...video.multiPov].flatMap((v) =>
      VideoFilter.getVideoSuggestions(v, language).map((tag) => tag.encode()),
    );
  }

  public filter() {
    if (
      this.dateRangeFilter &&
      this.dateRangeFilter.startDate &&
      this.dateRangeFilter.endDate
    ) {
      const startDate = this.dateRangeFilter.startDate;
      const endDate = this.dateRangeFilter.endDate;

      const videoDate = this.video.start
        ? new Date(this.video.start)
        : new Date(this.video.mtime);

      if (videoDate < startDate || videoDate > endDate) {
        return false;
      }
    }

    return this.query.every((s) => this.matches.includes(s));
  }

  public static getCategorySuggestions(
    state: RendererVideo[],
    language: Language,
  ) {
    const suggestions: VideoTag[] = [];

    const flattened = state.flatMap((v) => v.multiPov);
    flattened.push(...state);

    flattened.forEach((video) => {
      const videoTagSuggestions = this.getVideoSuggestions(video, language);
      suggestions.push(...videoTagSuggestions);
    });

    const unique = Array.from(
      new Map(suggestions.map((item) => [item.label, item])).values(),
    );

    return unique;
  }

  private static getVideoSuggestions(video: RendererVideo, language: Language) {
    const suggestions: VideoTag[] = [];
    suggestions.push(...this.getGenericSuggestions(video, language));

    if (isCCUtil(video)) {
      suggestions.push(...this.getCCSuggestions(video, language));
    }

    return suggestions;
  }

  private static getGenericSuggestions(
    video: RendererVideo,
    language: Language,
  ) {
    const suggestions: VideoTag[] = [];

    const playerName = getPlayerName(video);

    if (video.isProtected) {
      const localised = getLocalePhrase(language, Phrase.Starred);
      const tag = new VideoTag(101, localised, '<LockIcon>', '#bb4420');
      suggestions.push(tag);
    } else {
      const localised = getLocalePhrase(language, Phrase.NotStarred);
      const tag = new VideoTag(101, localised, '<LockOpenIcon>', '#bb4420');
      suggestions.push(tag);
    }

    if (video.tag) {
      const localised = getLocalePhrase(language, Phrase.Tagged);
      const tag = new VideoTag(102, localised, '<TagIcon>', '#bb4420');
      suggestions.push(tag);
    }

    if (playerName) {
      const jobId = video.player?._jobId ?? 0;
      const color = getJobRoleColor(jobId);
      const tag = new VideoTag(200, playerName, '', color);
      suggestions.push(tag);
    }

    if (video.zoneName) {
      const tag = new VideoTag(202, video.zoneName, '<MapPinned>', '#bb4420');
      suggestions.push(tag);
    }

    video.combatants.forEach((combatant) => {
      this.pushCombatantTag(combatant, suggestions);
    });

    return suggestions;
  }

  private static pushCombatantTag(
    combatant: RawCombatant,
    suggestions: VideoTag[],
  ) {
    const combatantName = combatant._name;

    if (!combatantName) {
      return;
    }

    const color = getJobRoleColor(combatant._jobId);
    const jobAbbr = getJobAbbreviation(combatant._jobId);

    const tag = new VideoTag(200, combatantName, '', color);
    suggestions.push(tag);

    // Also add a tag for the job abbreviation
    const jobTag = new VideoTag(201, jobAbbr, '', color);
    suggestions.push(jobTag);
  }

  /**
   * Get the matches for a CC video.
   */
  private static getCCSuggestions(video: RendererVideo, language: Language) {
    const suggestions: VideoTag[] = [];

    if (video.result) {
      const localised = getLocalePhrase(language, Phrase.Win);
      const tag = new VideoTag(50, localised, '<ThumbsUp>', '#bb4420');
      suggestions.push(tag);
    } else {
      const localised = getLocalePhrase(language, Phrase.Loss);
      const tag = new VideoTag(50, localised, '<ThumbsDown>', '#bb4420');
      suggestions.push(tag);
    }

    // Add arena name as a suggestion
    if (video.zoneID) {
      const arenaName = ccTerritories[video.zoneID];
      if (arenaName) {
        const tag = new VideoTag(203, arenaName, '<MapPinned>', '#bb4420');
        suggestions.push(tag);
      }
    }

    return suggestions;
  }
}
