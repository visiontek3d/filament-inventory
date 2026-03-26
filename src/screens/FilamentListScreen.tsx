import React, { useCallback, useLayoutEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  deleteFilament,
  getAllFilaments,
  getDistinctManufacturers,
  getDistinctTypes,
  getSetting,
} from '../db/supabase-operations';
import { FilamentSummary, RootStackParamList } from '../types';
import PickerModal from '../components/PickerModal';
import { Ionicons } from '@expo/vector-icons';

type Props = NativeStackScreenProps<RootStackParamList, 'FilamentList'>;

export default function FilamentListScreen({ navigation }: Props) {
  const [allFilaments, setAllFilaments] = useState<FilamentSummary[]>([]);
  const [filaments, setFilaments] = useState<FilamentSummary[]>([]);
  const [query, setQuery] = useState('');
  const [filterManufacturer, setFilterManufacturer] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterInUse, setFilterInUse] = useState(false);
  const [filterInInventory, setFilterInInventory] = useState(false);
  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [showMfgPicker, setShowMfgPicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [thresholdLow, setThresholdLow] = useState(0);
  const [thresholdMedium, setThresholdMedium] = useState(1);
  const [thresholdHigh, setThresholdHigh] = useState(4);

  const applyFilters = useCallback((
    all: FilamentSummary[], q: string, mfg: string, type: string, inUse: boolean, inInventory: boolean
  ) => {
    return all.filter((f) => {
      if (q.trim()) {
        const ql = q.toLowerCase();
        if (!f.manufacturer.toLowerCase().includes(ql) &&
            !f.type.toLowerCase().includes(ql) &&
            !f.color.toLowerCase().includes(ql) &&
            !f.upc.includes(ql)) return false;
      }
      if (mfg && f.manufacturer !== mfg) return false;
      if (type && f.type !== type) return false;
      if (inUse && !(f.in_use > 0)) return false;
      if (inInventory && !(f.in_inventory > 0)) return false;
      return true;
    });
  }, []);

  const load = useCallback(() => {
    let cancelled = false;
    (async () => {
      const [data, mfgs, tps, tLow, tMed, tHigh] = await Promise.all([
        getAllFilaments(),
        getDistinctManufacturers(),
        getDistinctTypes(),
        getSetting('threshold_Low', '0'),
        getSetting('threshold_Medium', '1'),
        getSetting('threshold_High', '4'),
      ]);
      if (cancelled) return;
      setAllFilaments(data);
      setFilaments(applyFilters(data, query, filterManufacturer, filterType, filterInUse, filterInInventory));
      setManufacturers(mfgs);
      setTypes(tps);
      setThresholdLow(parseInt(tLow, 10));
      setThresholdMedium(parseInt(tMed, 10));
      setThresholdHigh(parseInt(tHigh, 10));
    })();
    return () => { cancelled = true; };
  }, [query, filterManufacturer, filterType, filterInUse, filterInInventory, applyFilters]);

  useFocusEffect(load);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate('Settings')} style={{ marginRight: 4 }}>
          <Ionicons name="settings-outline" size={24} color="#3367d6" />
        </Pressable>
      ),
    });
  }, [navigation]);

  const handleSearch = (text: string) => {
    setQuery(text);
    setFilaments(applyFilters(allFilaments, text, filterManufacturer, filterType, filterInUse, filterInInventory));
  };

  const handleSetMfg = (value: string) => {
    setFilterManufacturer(value);
    setFilaments(applyFilters(allFilaments, query, value, filterType, filterInUse, filterInInventory));
  };

  const handleSetType = (value: string) => {
    setFilterType(value);
    setFilaments(applyFilters(allFilaments, query, filterManufacturer, value, filterInUse, filterInInventory));
  };

  const handleToggleInUse = () => {
    const next = !filterInUse;
    setFilterInUse(next);
    setFilaments(applyFilters(allFilaments, query, filterManufacturer, filterType, next, filterInInventory));
  };

  const handleToggleInInventory = () => {
    const next = !filterInInventory;
    setFilterInInventory(next);
    setFilaments(applyFilters(allFilaments, query, filterManufacturer, filterType, filterInUse, next));
  };

  const handleDelete = (item: FilamentSummary) => {
    Alert.alert(
      'Delete Filament',
      `Delete "${item.manufacturer} ${item.type} – ${item.color}"? All ${item.total_rolls} associated rolls will also be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteFilament(item.id);
            const updated = allFilaments.filter(f => f.id !== item.id);
            setAllFilaments(updated);
            setFilaments(applyFilters(updated, query, filterManufacturer, filterType, filterInUse, filterInInventory));
          },
        },
      ]
    );
  };

  const hasFilters = !!filterManufacturer || !!filterType || filterInUse || filterInInventory;

  const isLowStock = (f: FilamentSummary) => {
    const total = (f.in_use ?? 0) + (f.in_inventory ?? 0);
    if (f.priority === 'High' && total < thresholdHigh) return true;
    if (f.priority === 'Medium' && total < thresholdMedium) return true;
    if (f.priority === 'Low' && total < thresholdLow) return true;
    return false;
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.search}
          placeholder="Search manufacturer, type, color, UPC..."
          placeholderTextColor="#888"
          value={query}
          onChangeText={handleSearch}
        />
        {query.length > 0 && (
          <Pressable style={styles.searchClear} onPress={() => handleSearch('')}>
            <Text style={styles.searchClearText}>✕</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterRowContent}
      >
        <Pressable
          style={[styles.filterChip, filterManufacturer ? styles.filterChipActive : null]}
          onPress={() => setShowMfgPicker(true)}
        >
          <Text style={[styles.filterChipText, filterManufacturer ? styles.filterChipTextActive : null]}>
            {filterManufacturer || 'Manufacturer'}
          </Text>
          {filterManufacturer ? (
            <Pressable onPress={() => handleSetMfg('')} hitSlop={8}>
              <Text style={styles.filterChipClear}> ✕</Text>
            </Pressable>
          ) : (
            <Text style={styles.filterChipArrow}> ›</Text>
          )}
        </Pressable>

        <Pressable
          style={[styles.filterChip, filterType ? styles.filterChipActive : null]}
          onPress={() => setShowTypePicker(true)}
        >
          <Text style={[styles.filterChipText, filterType ? styles.filterChipTextActive : null]}>
            {filterType || 'Type'}
          </Text>
          {filterType ? (
            <Pressable onPress={() => handleSetType('')} hitSlop={8}>
              <Text style={styles.filterChipClear}> ✕</Text>
            </Pressable>
          ) : (
            <Text style={styles.filterChipArrow}> ›</Text>
          )}
        </Pressable>

        <Pressable
          style={[styles.filterChip, filterInUse ? styles.filterChipActive : null]}
          onPress={handleToggleInUse}
        >
          <Text style={[styles.filterChipText, filterInUse ? styles.filterChipTextActive : null]}>
            In Use
          </Text>
          {filterInUse && <Text style={styles.filterChipClear}> ✕</Text>}
        </Pressable>

        <Pressable
          style={[styles.filterChip, filterInInventory ? styles.filterChipActive : null]}
          onPress={handleToggleInInventory}
        >
          <Text style={[styles.filterChipText, filterInInventory ? styles.filterChipTextActive : null]}>
            In Inventory
          </Text>
          {filterInInventory && <Text style={styles.filterChipClear}> ✕</Text>}
        </Pressable>

        {hasFilters && (
          <Pressable style={styles.clearAllChip} onPress={() => {
            setFilterManufacturer('');
            setFilterType('');
            setFilterInUse(false);
            setFilterInInventory(false);
            setFilaments(applyFilters(allFilaments, query, '', '', false, false));
          }}>
            <Text style={styles.clearAllText}>Clear All</Text>
          </Pressable>
        )}
      </ScrollView>

      {filaments.length > 0 && (
        <View style={styles.totalsBar}>
          <View style={styles.totalsItem}>
            <Text style={styles.totalsValue}>
              {filaments.reduce((sum, f) => sum + (f.in_use ?? 0), 0)}
            </Text>
            <Text style={styles.totalsLabel}>Total In Use</Text>
          </View>
          <View style={styles.totalsDivider} />
          <View style={styles.totalsItem}>
            <Text style={styles.totalsValue}>
              {filaments.reduce((sum, f) => sum + (f.in_inventory ?? 0), 0)}
            </Text>
            <Text style={styles.totalsLabel}>Total In Inventory</Text>
          </View>
          <View style={styles.totalsDivider} />
          <View style={styles.totalsItem}>
            <Text style={styles.totalsValue}>
              {filaments.reduce((sum, f) => sum + (f.in_use ?? 0) + (f.in_inventory ?? 0), 0)}
            </Text>
            <Text style={styles.totalsLabel}>Rolls</Text>
          </View>
        </View>
      )}

      {filaments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.empty}>No filaments found. Tap + Add to get started.</Text>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={filaments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.row, isLowStock(item) && styles.rowLowStock]}
              onPress={() => navigation.navigate('FilamentDetail', { filamentId: item.id })}
              onLongPress={() => handleDelete(item)}
            >
              {item.photo_uri ? (
                <Image source={{ uri: item.photo_uri }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbPlaceholder]}>
                  <Text style={styles.thumbPlaceholderText}>📦</Text>
                </View>
              )}
              <View style={styles.rowText}>
                <Text style={styles.title}>{item.manufacturer} – {item.type}</Text>
                <Text style={styles.color}>{item.color}</Text>
                {item.upc ? <Text style={styles.upc}>UPC: {item.upc}</Text> : null}
              </View>
              <View style={styles.badges}>
                <View style={styles.badge}>
                  <Text style={styles.badgeLabel}>USE</Text>
                  <Text style={styles.badgeValue}>{item.in_use ?? 0}</Text>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeLabel}>INV</Text>
                  <Text style={styles.badgeValue}>{item.in_inventory ?? 0}</Text>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}

      <View style={styles.fabRow}>
        <Pressable
          style={styles.fab}
          onPress={() => navigation.navigate('Scan')}
        >
          <Text style={styles.fabText}>Scan</Text>
        </Pressable>
      </View>

      <PickerModal
        visible={showMfgPicker}
        title="Filter by Manufacturer"
        options={manufacturers}
        value={filterManufacturer}
        onSelect={(v) => { handleSetMfg(v); setShowMfgPicker(false); }}
        onClose={() => setShowMfgPicker(false)}
      />
      <PickerModal
        visible={showTypePicker}
        title="Filter by Type"
        options={types}
        value={filterType}
        onSelect={(v) => { handleSetType(v); setShowTypePicker(false); }}
        onClose={() => setShowTypePicker(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    marginBottom: 6,
  },
  search: {
    flex: 1,
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 15,
    color: '#000',
  },
  searchClear: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchClearText: { fontSize: 16, color: '#888' },
  totalsBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 8,
    paddingVertical: 10,
    elevation: 1,
  },
  totalsItem: { flex: 1, alignItems: 'center' },
  totalsValue: { fontSize: 20, fontWeight: '800', color: '#1a1a1a' },
  totalsLabel: { fontSize: 11, color: '#888', marginTop: 1 },
  totalsDivider: { width: 1, backgroundColor: '#f0f0f0', marginVertical: 4 },
  filterRow: { flexGrow: 0 },
  filterRowContent: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
    flexDirection: 'row',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipActive: {
    backgroundColor: '#3367d6',
    borderColor: '#3367d6',
  },
  filterChipText: { fontSize: 13, color: '#555', fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  filterChipArrow: { fontSize: 16, color: '#aaa' },
  filterChipClear: { fontSize: 13, color: '#fff', fontWeight: '700' },
  clearAllChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#c62828',
  },
  clearAllText: { fontSize: 13, color: '#c62828', fontWeight: '600' },
  emptyContainer: { paddingTop: 80, alignItems: 'center', paddingHorizontal: 24 },
  empty: { textAlign: 'center', color: '#888', fontSize: 15 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 8,
    padding: 12,
    elevation: 1,
    gap: 12,
  },
  rowLowStock: { backgroundColor: '#fde8e8' },
  thumb: { width: 52, height: 52, borderRadius: 8 },
  thumbPlaceholder: {
    backgroundColor: '#e8f0fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbPlaceholderText: { fontSize: 22 },
  rowText: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  color: { fontSize: 13, color: '#555', marginTop: 2 },
  upc: { fontSize: 11, color: '#888', marginTop: 2 },
  badges: { flexDirection: 'row', gap: 6 },
  badge: {
    alignItems: 'center',
    backgroundColor: '#e8f0fe',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 40,
  },
  badgeLabel: { fontSize: 10, color: '#3367d6', fontWeight: '600' },
  badgeValue: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  fabRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 12,
    marginVertical: 16,
  },
  fab: {
    flex: 1,
    backgroundColor: '#3367d6',
    paddingVertical: 14,
    borderRadius: 28,
    elevation: 4,
    alignItems: 'center',
  },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
