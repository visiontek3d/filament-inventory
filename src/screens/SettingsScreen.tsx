import React, { useEffect, useState } from 'react';
import { Alert, ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { RootStackParamList } from '../types';
import { clearAllData, getFilamentByUpc, getSetting, setSetting, updateFilamentPhoto } from '../db/database';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen({ navigation }: Props) {
  const [matching, setMatching] = useState(false);
  const [thresholdLow, setThresholdLow] = useState('');
  const [thresholdMedium, setThresholdMedium] = useState('');
  const [thresholdHigh, setThresholdHigh] = useState('');

  useEffect(() => {
    setThresholdLow(getSetting('threshold_Low', '0'));
    setThresholdMedium(getSetting('threshold_Medium', '1'));
    setThresholdHigh(getSetting('threshold_High', '4'));
  }, []);

  const saveThreshold = (key: string, value: string) => {
    const n = parseInt(value, 10);
    if (!isNaN(n) && n >= 0) setSetting(key, String(n));
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all filaments and rolls. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: () => {
            clearAllData();
            Alert.alert('Done', 'All data has been cleared.');
          },
        },
      ]
    );
  };

  const handleMatchPhotos = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'image/*',
      multiple: true,
      copyToCacheDirectory: true,
    });

    if (result.canceled || result.assets.length === 0) return;

    setMatching(true);
    let matched = 0;
    const unmatched: string[] = [];
    const errors: string[] = [];

    for (const asset of result.assets) {
      try {
        // Strip extension to get the UPC
        const upc = asset.name.replace(/\.[^.]+$/, '').trim();
        const filament = getFilamentByUpc(upc);

        if (!filament) {
          unmatched.push(asset.name);
          continue;
        }

        // Copy image into app's permanent storage
        const ext = asset.name.split('.').pop() ?? 'jpg';
        const dest = `${FileSystem.documentDirectory}filament_${filament.id}.${ext}`;
        await FileSystem.copyAsync({ from: asset.uri, to: dest });
        updateFilamentPhoto(filament.id, dest);
        matched++;
      } catch (e: any) {
        errors.push(`${asset.name}: ${e.message}`);
      }
    }

    setMatching(false);

    const total = result.assets.length;
    const lines = [
      `Files selected: ${total}`,
      `Matched: ${matched}`,
      `No UPC match: ${unmatched.length}`,
    ];
    if (unmatched.length > 0 && unmatched.length <= 5) {
      lines.push(`Unmatched files: ${unmatched.join(', ')}`);
    }
    if (errors.length > 0) lines.push(`Errors: ${errors.join('\n')}`);
    Alert.alert('Photo Match Complete', lines.join('\n'));
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Manufacturers & Types</Text>
        <Text style={styles.cardBody}>
          These lists are built automatically from your filament data. Import or add filaments to populate them.
        </Text>
      </View>

      <View style={styles.actionRow}>
        <Pressable style={[styles.actionBtn, styles.actionBtnSecondary]} onPress={() => navigation.navigate('BulkImport')}>
          <Text style={styles.actionBtnText}>Import CSV</Text>
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={() => navigation.navigate('AddEditFilament', {})}>
          <Text style={styles.actionBtnText}>+ Add Filament</Text>
        </Pressable>
      </View>

      <Pressable style={[styles.actionBtn, styles.matchBtn]} onPress={handleMatchPhotos} disabled={matching}>
        {matching
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.actionBtnText}>Match Photos by UPC</Text>
        }
      </Pressable>

      <View style={[styles.card, { marginTop: 24 }]}>
        <Text style={styles.cardTitle}>Low-Stock Thresholds</Text>
        <Text style={styles.cardBody}>
          A filament card highlights red when total rolls (in use + inventory) falls below the threshold for its priority level.
        </Text>
        {(
          [
            { label: 'Low', key: 'threshold_Low', value: thresholdLow, set: setThresholdLow },
            { label: 'Medium', key: 'threshold_Medium', value: thresholdMedium, set: setThresholdMedium },
            { label: 'High', key: 'threshold_High', value: thresholdHigh, set: setThresholdHigh },
          ] as const
        ).map(({ label, key, value, set }) => (
          <View key={key} style={styles.thresholdRow}>
            <Text style={styles.thresholdLabel}>{label}</Text>
            <TextInput
              style={styles.thresholdInput}
              value={value}
              onChangeText={set}
              onBlur={() => saveThreshold(key, value)}
              keyboardType="number-pad"
              maxLength={3}
            />
            <Text style={styles.thresholdHint}>rolls or fewer</Text>
          </View>
        ))}
      </View>

      <Pressable style={styles.dangerBtn} onPress={handleClearAll}>
        <Text style={styles.dangerBtnText}>Clear All Data</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginTop: 8,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  cardBody: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 24,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#3367d6',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    elevation: 1,
  },
  actionBtnSecondary: { backgroundColor: '#555' },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  matchBtn: {
    flex: 0,
    marginTop: 8,
  },
  dangerBtn: {
    marginTop: 24,
    backgroundColor: '#c62828',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    elevation: 1,
  },
  dangerBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  thresholdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 10,
  },
  thresholdLabel: {
    width: 64,
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  thresholdInput: {
    width: 60,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 8,
    fontSize: 15,
    color: '#1a1a1a',
    textAlign: 'center',
  },
  thresholdHint: {
    fontSize: 13,
    color: '#888',
  },
});
