import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { bulkImportFilaments } from '../db/database';
import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'BulkImport'>;

type PreviewRow = {
  manufacturer: string;
  type: string;
  color: string;
  upc: string;
  url: string | null;
  error?: string;
};

export default function BulkImportScreen({ navigation }: Props) {
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [fileName, setFileName] = useState('');

  const handlePick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/plain', 'application/octet-stream', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      setFileName(asset.name);

      const response = await fetch(asset.uri);
      const content = await response.text();

      if (!content || !content.trim()) {
        Alert.alert('Empty File', 'The selected file appears to be empty.');
        return;
      }

      const rows = parseCSV(content);

      if (rows.length === 0) {
        Alert.alert(
          'No Data Found',
          'Could not parse any rows.\n\nMake sure the file has a header row and data rows separated by commas.\n\nFirst characters:\n' +
            content.substring(0, 100)
        );
        return;
      }

      setPreview(rows);
    } catch (e: any) {
      Alert.alert('Error Reading File', e.message ?? 'Unknown error');
    }
  };

  const handleImport = () => {
    const validRows = preview.filter((r) => !r.error);
    if (validRows.length === 0) {
      Alert.alert('No valid rows to import');
      return;
    }

    Alert.alert(
      'Confirm Import',
      `Import ${validRows.length} filament${validRows.length !== 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: () => {
            const result = bulkImportFilaments(validRows);
            Alert.alert(
              'Import Complete',
              `Added: ${result.inserted}\nSkipped (UPC already exists): ${result.skipped}${result.errors.length ? `\nErrors: ${result.errors.join(', ')}` : ''}`,
              [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
          },
        },
      ]
    );
  };

  const validCount = preview.filter((r) => !r.error).length;
  const errorCount = preview.filter((r) => !!r.error).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>CSV Format</Text>
        <Text style={styles.infoText}>
          First row must be a header. UPC and URL are optional:
        </Text>
        <Text style={styles.code}>Manufacturer,Type,Color,UPC,URL</Text>
        <Text style={styles.code}>Hatchbox,PLA,Black,012345678901,https://...</Text>
        <Text style={styles.code}>Prusament,PETG,Galaxy Silver,,</Text>
      </View>

      <Pressable style={styles.pickBtn} onPress={handlePick}>
        <Text style={styles.pickBtnText}>
          {fileName ? `Change File (${fileName})` : 'Pick CSV File'}
        </Text>
      </Pressable>

      {preview.length > 0 && (
        <>
          <View style={styles.summary}>
            <Text style={styles.summaryText}>
              {validCount} valid  •  {errorCount} error{errorCount !== 1 ? 's' : ''}
            </Text>
          </View>

          {preview.map((item, i) => (
            <View key={i} style={[styles.row, item.error ? styles.rowError : undefined]}>
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle}>
                  {item.manufacturer || '?'} – {item.type || '?'}
                </Text>
                <Text style={styles.rowColor}>{item.color || '(no color)'}</Text>
                {item.upc ? <Text style={styles.rowMeta}>UPC: {item.upc}</Text> : null}
                {item.url ? <Text style={styles.rowMeta} numberOfLines={1}>URL: {item.url}</Text> : null}
                {item.error ? <Text style={styles.rowErrorText}>{item.error}</Text> : null}
              </View>
            </View>
          ))}

          <Pressable
            style={[styles.importBtn, validCount === 0 && styles.importBtnDisabled]}
            onPress={handleImport}
            disabled={validCount === 0}
          >
            <Text style={styles.importBtnText}>
              Import {validCount} Filament{validCount !== 1 ? 's' : ''}
            </Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

function parseCSV(content: string): PreviewRow[] {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
  if (lines.length < 2) return [];

  const dataLines = lines.slice(1); // skip header
  const rows: PreviewRow[] = [];

  for (const line of dataLines) {
    if (!line.trim()) continue;
    const cols = splitCSVLine(line);
    const manufacturer = cols[0]?.trim() ?? '';
    const type = cols[1]?.trim() ?? '';
    const color = cols[2]?.trim() ?? '';

    if (!manufacturer || !type || !color) {
      rows.push({
        manufacturer, type, color, upc: '', url: null,
        error: 'Manufacturer, Type, and Color are required',
      });
      continue;
    }

    rows.push({
      manufacturer,
      type,
      color,
      upc: cols[3]?.trim() ?? '',
      url: cols[4]?.trim() || null,
    });
  }

  return rows;
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  infoCard: {
    backgroundColor: '#fff',
    margin: 12,
    borderRadius: 10,
    padding: 14,
    elevation: 1,
  },
  infoTitle: { fontWeight: '700', fontSize: 14, color: '#1a1a1a', marginBottom: 6 },
  infoText: { fontSize: 13, color: '#555', marginBottom: 8 },
  code: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#333',
    backgroundColor: '#f0f0f0',
    padding: 6,
    borderRadius: 4,
    marginBottom: 4,
  },
  pickBtn: {
    backgroundColor: '#3367d6',
    marginHorizontal: 12,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 2,
  },
  pickBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  summary: { marginHorizontal: 12, marginTop: 16, marginBottom: 8 },
  summaryText: { fontSize: 13, color: '#555', fontWeight: '600' },
  row: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginBottom: 6,
    borderRadius: 8,
    padding: 12,
    elevation: 1,
  },
  rowError: { backgroundColor: '#fff5f5', borderWidth: 1, borderColor: '#f5c6c6' },
  rowMain: { flex: 1 },
  rowTitle: { fontWeight: '700', fontSize: 14, color: '#1a1a1a' },
  rowColor: { fontSize: 13, color: '#555', marginTop: 2 },
  rowMeta: { fontSize: 11, color: '#888', marginTop: 2 },
  rowErrorText: { fontSize: 12, color: '#c62828', marginTop: 4, fontWeight: '600' },
  importBtn: {
    backgroundColor: '#1a8a3a',
    margin: 12,
    marginTop: 20,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 2,
  },
  importBtnDisabled: { backgroundColor: '#aaa' },
  importBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
