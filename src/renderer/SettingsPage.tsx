/**
 * Settings page for xiv-recorder.
 * Provides configuration for IINACT log path, recording categories,
 * and OBS settings.
 */
import React, { useState, useEffect } from 'react';
import { Phrase } from '../localisation/phrases';
import { getLocalePhrase } from '../localisation/translations';

interface SettingsPageProps {
  config: Record<string, any>;
  onConfigChange: (key: string, value: any) => void;
  language: string;
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 0',
        borderBottom: '1px solid #2a2a3e',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500, marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 12, color: '#888' }}>{description}</div>
      </div>
      <div style={{ marginLeft: 16 }}>{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        border: 'none',
        backgroundColor: checked ? '#38a169' : '#555',
        position: 'relative',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          backgroundColor: '#fff',
          position: 'absolute',
          top: 3,
          left: checked ? 23 : 3,
          transition: 'left 0.2s',
        }}
      />
    </button>
  );
}

export default function SettingsPage({
  config,
  onConfigChange,
  language,
}: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<'application' | 'game'>(
    'application',
  );

  const t = (phrase: Phrase) => getLocalePhrase(language, phrase);

  return (
    <div
      style={{
        flex: 1,
        padding: 24,
        overflowY: 'auto',
        backgroundColor: '#16162a',
        color: '#eee',
      }}
    >
      <h2 style={{ marginBottom: 16 }}>{t(Phrase.Settings)}</h2>

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 24,
          borderBottom: '1px solid #333',
          paddingBottom: 8,
        }}
      >
        {(['application', 'game'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: 4,
              backgroundColor:
                activeTab === tab ? '#2a2a4e' : 'transparent',
              color: activeTab === tab ? '#fff' : '#aaa',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            {tab === 'application'
              ? t(Phrase.SettingsApplication)
              : t(Phrase.SettingsGame)}
          </button>
        ))}
      </div>

      {/* Application Settings */}
      {activeTab === 'application' && (
        <div>
          <h3 style={{ marginBottom: 12, color: '#aaa', fontSize: 13 }}>
            {t(Phrase.SettingsGeneral)}
          </h3>

          <SettingRow
            label={t(Phrase.StoragePath)}
            description={t(Phrase.StoragePathDescription)}
          >
            <input
              type="text"
              value={config.storagePath || ''}
              onChange={(e) =>
                onConfigChange('storagePath', e.target.value)
              }
              style={{
                padding: '6px 8px',
                backgroundColor: '#222',
                border: '1px solid #444',
                borderRadius: 4,
                color: '#eee',
                width: 300,
              }}
            />
          </SettingRow>

          <SettingRow
            label={t(Phrase.Resolution)}
            description={t(Phrase.ResolutionDescription)}
          >
            <select
              value={config.obsOutputResolution || '1920x1080'}
              onChange={(e) =>
                onConfigChange('obsOutputResolution', e.target.value)
              }
              style={{
                padding: '6px 8px',
                backgroundColor: '#222',
                border: '1px solid #444',
                borderRadius: 4,
                color: '#eee',
              }}
            >
              {[
                '1280x720',
                '1920x1080',
                '2560x1440',
                '3840x2160',
              ].map((res) => (
                <option key={res} value={res}>
                  {res}
                </option>
              ))}
            </select>
          </SettingRow>

          <SettingRow
            label={t(Phrase.FPS)}
            description={t(Phrase.FPSDescription)}
          >
            <select
              value={config.obsFPS || 60}
              onChange={(e) =>
                onConfigChange('obsFPS', parseInt(e.target.value, 10))
              }
              style={{
                padding: '6px 8px',
                backgroundColor: '#222',
                border: '1px solid #444',
                borderRadius: 4,
                color: '#eee',
              }}
            >
              {[30, 60, 120].map((fps) => (
                <option key={fps} value={fps}>
                  {fps}
                </option>
              ))}
            </select>
          </SettingRow>

          <SettingRow
            label={t(Phrase.BufferSeconds)}
            description={t(Phrase.BufferSecondsDescription)}
          >
            <input
              type="number"
              value={config.bufferSeconds || 20}
              min={5}
              max={120}
              onChange={(e) =>
                onConfigChange(
                  'bufferSeconds',
                  parseInt(e.target.value, 10),
                )
              }
              style={{
                padding: '6px 8px',
                backgroundColor: '#222',
                border: '1px solid #444',
                borderRadius: 4,
                color: '#eee',
                width: 80,
              }}
            />
          </SettingRow>

          <SettingRow
            label={t(Phrase.HideEmptyCategories)}
            description={t(Phrase.HideEmptyCategoriesDescription)}
          >
            <Toggle
              checked={config.hideEmptyCategories || false}
              onChange={(v) => onConfigChange('hideEmptyCategories', v)}
            />
          </SettingRow>

          <SettingRow
            label={t(Phrase.StartMinimized)}
            description={t(Phrase.StartMinimizedDescription)}
          >
            <Toggle
              checked={config.startMinimized || false}
              onChange={(v) => onConfigChange('startMinimized', v)}
            />
          </SettingRow>
        </div>
      )}

      {/* Game Settings */}
      {activeTab === 'game' && (
        <div>
          <h3 style={{ marginBottom: 12, color: '#aaa', fontSize: 13 }}>
            IINACT
          </h3>

          <SettingRow
            label={t(Phrase.IINACTLogPath)}
            description={t(Phrase.IINACTLogPathDescription)}
          >
            <input
              type="text"
              value={config.iinactLogPath || ''}
              onChange={(e) =>
                onConfigChange('iinactLogPath', e.target.value)
              }
              style={{
                padding: '6px 8px',
                backgroundColor: '#222',
                border: '1px solid #444',
                borderRadius: 4,
                color: '#eee',
                width: 300,
              }}
            />
          </SettingRow>

          <h3
            style={{
              marginTop: 24,
              marginBottom: 12,
              color: '#aaa',
              fontSize: 13,
            }}
          >
            PvP
          </h3>

          <SettingRow
            label={t(Phrase.RecordCrystallineConflict)}
            description={t(
              Phrase.RecordCrystallineConflictDescription,
            )}
          >
            <Toggle
              checked={config.recordCrystallineConflict !== false}
              onChange={(v) =>
                onConfigChange('recordCrystallineConflict', v)
              }
            />
          </SettingRow>

          <h3
            style={{
              marginTop: 24,
              marginBottom: 12,
              color: '#aaa',
              fontSize: 13,
            }}
          >
            {t(Phrase.ManualRecord)}
          </h3>

          <SettingRow
            label={t(Phrase.ManualRecord)}
            description={t(Phrase.ManualRecordDescription)}
          >
            <Toggle
              checked={config.manualRecord || false}
              onChange={(v) => onConfigChange('manualRecord', v)}
            />
          </SettingRow>
        </div>
      )}
    </div>
  );
}
