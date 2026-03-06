/**
 * Side menu component for xiv-recorder.
 * Shows CC category, Manual, Clips, and Settings.
 */
import React from 'react';
import { VideoCategory } from '../types/VideoCategory';
import { RecStatus, AppState, Pages } from '../main/types';
import { Phrase } from '../localisation/phrases';
import { getLocalePhrase } from '../localisation/translations';

interface SideMenuProps {
  recorderStatus: RecStatus;
  appState: AppState;
  setAppState: (state: AppState) => void;
  config: { language: string; hideEmptyCategories: boolean };
  videoCounters: Record<string, number>;
}

const categoryIcons: Record<string, string> = {
  [VideoCategory.CrystallineConflict]: '⚔️',
  [VideoCategory.Manual]: '🎬',
  [VideoCategory.Clips]: '✂️',
};

const statusLabels: Record<RecStatus, Phrase> = {
  [RecStatus.WaitingForFFXIV]: Phrase.WaitingForFFXIV,
  [RecStatus.Recording]: Phrase.Recording,
  [RecStatus.ReadyToRecord]: Phrase.ReadyToRecord,
  [RecStatus.InvalidConfig]: Phrase.InvalidConfig,
  [RecStatus.FatalError]: Phrase.FatalError,
  [RecStatus.Overrunning]: Phrase.Overrunning,
};

const statusColors: Record<RecStatus, string> = {
  [RecStatus.WaitingForFFXIV]: '#888',
  [RecStatus.Recording]: '#e53e3e',
  [RecStatus.ReadyToRecord]: '#38a169',
  [RecStatus.InvalidConfig]: '#dd6b20',
  [RecStatus.FatalError]: '#e53e3e',
  [RecStatus.Overrunning]: '#d69e2e',
};

export default function SideMenu({
  recorderStatus,
  appState,
  setAppState,
  config,
  videoCounters,
}: SideMenuProps) {
  const lang = config.language || 'English';

  const categories = [
    VideoCategory.CrystallineConflict,
    VideoCategory.Manual,
    VideoCategory.Clips,
  ];

  const visibleCategories = config.hideEmptyCategories
    ? categories.filter((cat) => (videoCounters[cat] || 0) > 0)
    : categories;

  return (
    <div
      style={{
        width: 220,
        backgroundColor: '#1a1a2e',
        color: '#eee',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        borderRight: '1px solid #333',
      }}
    >
      {/* Status indicator */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid #333',
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
          XIVRecorder
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: statusColors[recorderStatus],
            }}
          />
          <span style={{ fontSize: 12, color: '#aaa' }}>
            {getLocalePhrase(lang, statusLabels[recorderStatus])}
          </span>
        </div>
      </div>

      {/* Categories */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {visibleCategories.map((cat) => {
          const isActive =
            appState.page === Pages.None && appState.category === cat;
          const count = videoCounters[cat] || 0;

          return (
            <button
              key={cat}
              onClick={() =>
                setAppState({ page: Pages.None, category: cat })
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '10px 16px',
                border: 'none',
                backgroundColor: isActive ? '#2a2a4e' : 'transparent',
                color: isActive ? '#fff' : '#ccc',
                cursor: 'pointer',
                fontSize: 14,
                textAlign: 'left',
              }}
            >
              <span>
                {categoryIcons[cat] || ''}{' '}
                {getLocalePhrase(
                  lang,
                  cat as unknown as Phrase,
                )}
              </span>
              {count > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    backgroundColor: '#333',
                    padding: '2px 6px',
                    borderRadius: 10,
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Settings */}
      <div style={{ borderTop: '1px solid #333', padding: '8px 0' }}>
        <button
          onClick={() =>
            setAppState({ page: Pages.Settings, category: '' })
          }
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            padding: '10px 16px',
            border: 'none',
            backgroundColor:
              appState.page === Pages.Settings
                ? '#2a2a4e'
                : 'transparent',
            color:
              appState.page === Pages.Settings ? '#fff' : '#ccc',
            cursor: 'pointer',
            fontSize: 14,
            textAlign: 'left',
          }}
        >
          ⚙️ {getLocalePhrase(lang, Phrase.Settings)}
        </button>
      </div>

      {/* Version */}
      <div
        style={{
          padding: '8px 16px',
          fontSize: 10,
          color: '#666',
          textAlign: 'center',
        }}
      >
        XIVRecorder v0.1.0
      </div>
    </div>
  );
}
