/**
 * Detection History Export Utility
 *
 * Exports detection history as CSV or JSON for analysis.
 * Uses Expo Sharing for cross-platform file sharing.
 */

import { cacheDirectory, writeAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { DetectionResult } from '../types';

/**
 * Export detections as CSV file and open share dialog.
 */
export async function exportAsCSV(detections: DetectionResult[]): Promise<void> {
  if (detections.length === 0) return;

  try {
  const headers = [
    'id', 'timestamp', 'datetime', 'threatCategory', 'severity',
    'confidence', 'distanceMeters', 'bearingDegrees', 'approachRate',
    'source', 'similarDrone',
  ];

  const rows = detections.map((d) => [
    d.id,
    d.timestamp,
    new Date(d.timestamp).toISOString(),
    d.threatCategory,
    d.severity,
    isFinite(d.confidence) ? d.confidence.toFixed(3) : '0',
    isFinite(d.distanceMeters) ? d.distanceMeters : 0,
    isFinite(d.bearingDegrees) ? d.bearingDegrees : 0,
    isFinite(d.approachRate) ? d.approachRate : 0,
    d.source || 'ACOUSTIC',
    d.similarDrones?.[0]?.name || '',
  ].map((v) => `"${v}"`).join(','));

  const csv = [headers.join(','), ...rows].join('\n');

  const filename = `droneear_export_${Date.now()}.csv`;
  const filePath = `${cacheDirectory}${filename}`;
  await writeAsStringAsync(filePath, csv);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(filePath, {
      mimeType: 'text/csv',
      dialogTitle: 'Export Detection Log',
    });
  }
  } catch (err) {
    console.error('[ExportData] CSV export failed:', err);
    throw new Error(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

/**
 * Export detections as JSON file and open share dialog.
 */
export async function exportAsJSON(detections: DetectionResult[]): Promise<void> {
  if (detections.length === 0) return;

  try {
  const data = {
    exportedAt: new Date().toISOString(),
    count: detections.length,
    detections: detections.map((d) => ({
      id: d.id,
      timestamp: d.timestamp,
      datetime: new Date(d.timestamp).toISOString(),
      threatCategory: d.threatCategory,
      severity: d.severity,
      confidence: d.confidence,
      distanceMeters: d.distanceMeters,
      bearingDegrees: d.bearingDegrees,
      approachRate: d.approachRate,
      source: d.source || 'ACOUSTIC',
      similarDrones: d.similarDrones?.slice(0, 3) || [],
    })),
  };

  const json = JSON.stringify(data, null, 2);
  const filename = `droneear_export_${Date.now()}.json`;
  const filePath = `${cacheDirectory}${filename}`;
  await writeAsStringAsync(filePath, json);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(filePath, {
      mimeType: 'application/json',
      dialogTitle: 'Export Detection Log',
    });
  }
  } catch (err) {
    console.error('[ExportData] JSON export failed:', err);
    throw new Error(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}
