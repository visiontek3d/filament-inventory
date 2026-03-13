import React, { useCallback, useLayoutEffect, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  archiveRoll,
  deleteFilament,
  deleteRoll,
  getFilament,
  getRolls,
  setRollInUse,
} from '../db/database';
import { Filament, Roll, RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'FilamentDetail'>;

export default function FilamentDetailScreen({ route, navigation }: Props) {
  const { filamentId } = route.params;
  const [filament, setFilament] = useState<Filament | null>(null);
  const [rolls, setRolls] = useState<Roll[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(() => {
    const f = getFilament(filamentId);
    setFilament(f);
    if (f) {
      navigation.setOptions({ title: `${f.manufacturer} ${f.type}` });
      setRolls(getRolls(filamentId));
    }
  }, [filamentId, navigation]);

  useFocusEffect(load);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => navigation.navigate('AddEditFilament', { filamentId })}
          style={{ marginRight: 4 }}
        >
          <Text style={styles.editBtn}>Edit</Text>
        </Pressable>
      ),
    });
  }, [navigation, filamentId]);

  const handleMarkEmpty = (roll: Roll) => {
    Alert.alert('Mark as Empty', 'Move this spool to the empty archive?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark Empty',
        style: 'destructive',
        onPress: () => {
          archiveRoll(roll.id);
          setRolls(getRolls(filamentId));
        },
      },
    ]);
  };

  const handleMoveToInUse = (roll: Roll) => {
    setRollInUse(roll.id);
    setRolls(getRolls(filamentId));
  };

  const handleDeleteFilament = () => {
    Alert.alert(
      'Delete Filament',
      `Delete "${filament?.manufacturer} ${filament?.type} – ${filament?.color}"? All associated rolls will also be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteFilament(filamentId);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleDeleteRoll = (roll: Roll) => {
    Alert.alert('Delete Roll', 'Remove this roll permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteRoll(roll.id);
          setRolls(getRolls(filamentId));
        },
      },
    ]);
  };

  if (!filament) return null;

  const activeRolls = rolls.filter((r) => !r.archived);
  const archivedRolls = rolls.filter((r) => r.archived);
  const inInventory = activeRolls.filter((r) => !r.is_in_use);
  const inUse = activeRolls.filter((r) => r.is_in_use);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {filament.photo_uri ? (
        <Image source={{ uri: filament.photo_uri }} style={styles.photo} resizeMode="cover" />
      ) : (
        <View style={styles.photoPlaceholder}>
          <Text style={styles.photoPlaceholderText}>📦</Text>
        </View>
      )}

      <View style={styles.card}>
        <InfoRow label="Manufacturer" value={filament.manufacturer} />
        <InfoRow label="Type" value={filament.type} />
        <InfoRow label="Color" value={filament.color} />
        {filament.upc ? <InfoRow label="UPC" value={filament.upc} /> : null}
        <InfoRow label="Priority" value={filament.priority ?? 'Medium'} />
        {filament.url ? (
          <Pressable onPress={() => Linking.openURL(filament.url!)} style={styles.infoRow}>
            <Text style={styles.infoLabel}>URL</Text>
            <Text style={[styles.infoValue, styles.infoLink]} numberOfLines={1}>{filament.url}</Text>
          </Pressable>
        ) : null}

        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: '#1a8a3a' }]}>{inInventory.length}</Text>
            <Text style={styles.statLabel}>Inventory</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: '#c65800' }]}>{inUse.length}</Text>
            <Text style={styles.statLabel}>In Use</Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Rolls</Text>
        <Pressable
          style={styles.addRollBtn}
          onPress={() => navigation.navigate('AddEditRoll', { filamentId })}
        >
          <Text style={styles.addRollBtnText}>+ Add Rolls</Text>
        </Pressable>
      </View>

      {activeRolls.length === 0 ? (
        <Text style={styles.noRolls}>No rolls tracked yet. Tap + Add Rolls to start.</Text>
      ) : null}

      {/* In Use rolls */}
      {inUse.map((roll) => (
        <View key={roll.id} style={[styles.rollCard, styles.rollCardInUse]}>
          <View style={styles.rollInfo}>
            <Text style={[styles.rollStatus, styles.rollStatusInUse]}>In Use</Text>
            <Text style={styles.rollDate}>Added: {fmtDate(roll.created_at)}</Text>
          </View>
          <View style={styles.rollActions}>
            <Pressable style={styles.emptyBtn} onPress={() => handleMarkEmpty(roll)}>
              <Text style={styles.emptyBtnText}>Mark Empty</Text>
            </Pressable>
            <Pressable style={styles.rollDeleteBtn} onPress={() => handleDeleteRoll(roll)}>
              <Text style={styles.rollDeleteBtnText}>✕</Text>
            </Pressable>
          </View>
        </View>
      ))}

      {/* Inventory rolls */}
      {inInventory.map((roll) => (
        <View key={roll.id} style={[styles.rollCard, styles.rollCardInventory]}>
          <View style={styles.rollInfo}>
            <Text style={[styles.rollStatus, styles.rollStatusInventory]}>Inventory</Text>
            <Text style={styles.rollDate}>Added: {fmtDate(roll.created_at)}</Text>
          </View>
          <View style={styles.rollActions}>
            <Pressable style={styles.rollToggleBtnToUse} onPress={() => handleMoveToInUse(roll)}>
              <Text style={styles.rollToggleBtnText}>→ In Use</Text>
            </Pressable>
            <Pressable style={styles.rollDeleteBtn} onPress={() => handleDeleteRoll(roll)}>
              <Text style={styles.rollDeleteBtnText}>✕</Text>
            </Pressable>
          </View>
        </View>
      ))}

      {/* Empty spool archive */}
      {archivedRolls.length > 0 && (
        <>
          <Pressable style={styles.archiveToggle} onPress={() => setShowArchived(v => !v)}>
            <Text style={styles.archiveToggleText}>
              {showArchived ? '▾' : '▸'} Empty Spools ({archivedRolls.length})
            </Text>
          </Pressable>

          {showArchived && archivedRolls.map((roll) => (
            <View key={roll.id} style={[styles.rollCard, styles.rollCardArchived]}>
              <View style={styles.rollInfo}>
                <Text style={[styles.rollStatus, styles.rollStatusArchived]}>Empty</Text>
                <Text style={styles.rollDate}>Added: {fmtDate(roll.created_at)}</Text>
              </View>
              <View style={styles.rollActions}>
                <Pressable style={styles.rollDeleteBtn} onPress={() => handleDeleteRoll(roll)}>
                  <Text style={styles.rollDeleteBtnText}>✕</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </>
      )}

      <Pressable style={styles.deleteFilamentBtn} onPress={handleDeleteFilament}>
        <Text style={styles.deleteFilamentBtnText}>Delete Filament</Text>
      </Pressable>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString(); } catch { return iso; }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  photo: { width: '100%', height: 220 },
  photoPlaceholder: {
    width: '100%', height: 120, backgroundColor: '#e8f0fe',
    alignItems: 'center', justifyContent: 'center',
  },
  photoPlaceholderText: { fontSize: 48 },
  card: {
    backgroundColor: '#fff', marginHorizontal: 12, marginTop: 12,
    borderRadius: 10, padding: 16, elevation: 1,
  },
  infoRow: { flexDirection: 'row', paddingVertical: 4 },
  infoLabel: { width: 110, fontSize: 14, color: '#888', fontWeight: '600' },
  infoValue: { flex: 1, fontSize: 14, color: '#1a1a1a' },
  infoLink: { color: '#3367d6', textDecorationLine: 'underline' },
  statRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    marginTop: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#f0f0f0',
  },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 28, fontWeight: '800' },
  statLabel: { fontSize: 12, color: '#888', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: '#f0f0f0', marginVertical: 4 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 12, marginTop: 20, marginBottom: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  addRollBtn: {
    backgroundColor: '#3367d6', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  addRollBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  noRolls: {
    textAlign: 'center', color: '#888', fontSize: 14, marginTop: 16, paddingHorizontal: 24,
  },
  rollCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 12, marginBottom: 8,
    borderRadius: 8, padding: 12, elevation: 1,
  },
  rollCardInventory: { backgroundColor: '#f0fdf4', borderLeftWidth: 4, borderLeftColor: '#1a8a3a' },
  rollCardInUse: { backgroundColor: '#fff8f0', borderLeftWidth: 4, borderLeftColor: '#c65800' },
  rollCardArchived: { backgroundColor: '#f5f5f5', borderLeftWidth: 4, borderLeftColor: '#aaa' },
  rollInfo: { flex: 1 },
  rollStatus: { fontSize: 15, fontWeight: '700' },
  rollStatusInventory: { color: '#1a8a3a' },
  rollStatusInUse: { color: '#c65800' },
  rollStatusArchived: { color: '#888' },
  rollDate: { fontSize: 12, color: '#888', marginTop: 2 },
  rollActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  rollToggleBtnToUse: { backgroundColor: '#fff0e0', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  rollToggleBtnText: { fontSize: 12, fontWeight: '600', color: '#1a1a1a' },
  emptyBtn: { backgroundColor: '#e8e8e8', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  emptyBtnText: { fontSize: 12, fontWeight: '600', color: '#555' },
  rollDeleteBtn: {
    paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, backgroundColor: '#fde8e8',
  },
  rollDeleteBtnText: { color: '#c62828', fontWeight: '700', fontSize: 14 },
  archiveToggle: {
    marginHorizontal: 12, marginTop: 16, marginBottom: 4, paddingVertical: 6,
  },
  archiveToggleText: { fontSize: 14, fontWeight: '600', color: '#888' },
  editBtn: { color: '#3367d6', fontSize: 15, fontWeight: '600' },
  deleteFilamentBtn: {
    marginHorizontal: 12, marginTop: 24, marginBottom: 8,
    backgroundColor: '#c62828', borderRadius: 10, padding: 16, alignItems: 'center',
  },
  deleteFilamentBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
