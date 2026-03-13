import React, { useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createRoll, getFilamentByUpc, getRolls, setRollInUse } from '../db/database';
import { FilamentSummary, Roll, RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Scan'>;
type Stage = 'scanning' | 'confirm';
type Direction = 'in' | 'out';

export default function ScanScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [stage, setStage] = useState<Stage>('scanning');
  const [filament, setFilament] = useState<FilamentSummary | null>(null);
  const [existingRolls, setExistingRolls] = useState<Roll[]>([]);
  const [direction, setDirection] = useState<Direction>('in');
  const [quantity, setQuantity] = useState('1');
  const scannedRef = useRef(false);

  const resetScan = () => {
    scannedRef.current = false;
    setFilament(null);
    setExistingRolls([]);
    setStage('scanning');
    setDirection('in');
    setQuantity('1');
  };

  const handleBarcode = ({ data }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;

    const upc = data.trim();
    const found = getFilamentByUpc(upc);

    if (!found) {
      Alert.alert(
        'Filament Not Found',
        `No filament with UPC "${upc}" in your inventory.`,
        [
          { text: 'Scan Again', onPress: resetScan },
          {
            text: 'Create New',
            onPress: () => navigation.replace('AddEditFilament', { initialUpc: upc }),
          },
          { text: 'Cancel', onPress: () => navigation.goBack() },
        ]
      );
      return;
    }

    const rolls = getRolls(found.id);
    setFilament(found);
    setExistingRolls(rolls);
    setStage('confirm');
  };

  const inventoryRolls = existingRolls.filter((r) => !r.is_in_use);

  const handleAddRoll = () => {
    if (!filament) return;
    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    for (let i = 0; i < qty; i++) {
      createRoll(filament.id);
    }
    Alert.alert(
      'Added to Inventory',
      `Added ${qty} roll${qty !== 1 ? 's' : ''} of ${filament.manufacturer} ${filament.type} to Inventory.`,
      [
        { text: 'Scan Another', onPress: resetScan },
        { text: 'View Item', onPress: () => navigation.replace('FilamentDetail', { filamentId: filament.id }) },
        { text: 'Done', onPress: () => navigation.goBack() },
      ]
    );
  };

  const handleMoveToInUse = () => {
    if (!filament) return;
    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    if (qty > inventoryRolls.length) {
      Alert.alert(
        'Not Enough in Inventory',
        `You only have ${inventoryRolls.length} roll${inventoryRolls.length !== 1 ? 's' : ''} in Inventory.`
      );
      return;
    }
    for (let i = 0; i < qty; i++) {
      setRollInUse(inventoryRolls[i].id);
    }
    Alert.alert(
      'Moved to In Use',
      `Moved ${qty} roll${qty !== 1 ? 's' : ''} of ${filament.manufacturer} ${filament.type} to In Use.`,
      [
        { text: 'Scan Another', onPress: resetScan },
        { text: 'View Item', onPress: () => navigation.replace('FilamentDetail', { filamentId: filament.id }) },
        { text: 'Done', onPress: () => navigation.goBack() },
      ]
    );
  };

  if (!permission) {
    return <View style={styles.center}><Text>Requesting camera access...</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>Camera access is required to scan barcodes.</Text>
        <Pressable style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  if (stage === 'scanning') {
    return (
      <View style={styles.container}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'],
          }}
          onBarcodeScanned={handleBarcode}
        />
        <View style={styles.overlay}>
          <Text style={styles.scanTitle}>Scan Filament Barcode</Text>
          <View style={styles.scanFrame} />
          <Text style={styles.scanHint}>Point camera at UPC or barcode label</Text>
        </View>
        <Pressable style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  // Confirm stage
  return (
    <ScrollView style={styles.confirmContainer} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.confirmTitle}>{filament?.manufacturer} {filament?.type}</Text>
      <Text style={styles.confirmColor}>{filament?.color}</Text>
      {filament?.upc ? <Text style={styles.confirmUpc}>UPC: {filament.upc}</Text> : null}

      <View style={styles.stockRow}>
        <View style={styles.stockBadge}>
          <Text style={styles.stockBadgeValue}>{inventoryRolls.length}</Text>
          <Text style={styles.stockBadgeLabel}>Inventory</Text>
        </View>
        <View style={[styles.stockBadge, styles.stockBadgeInUse]}>
          <Text style={[styles.stockBadgeValue, styles.stockBadgeValueInUse]}>
            {existingRolls.length - inventoryRolls.length}
          </Text>
          <Text style={styles.stockBadgeLabel}>In Use</Text>
        </View>
      </View>

      <Text style={styles.fieldLabel}>Action</Text>
      <View style={styles.pillRow}>
        {(['in', 'out'] as Direction[]).map((d) => (
          <Pressable
            key={d}
            style={[styles.pill, direction === d && (d === 'in' ? styles.pillIn : styles.pillOut)]}
            onPress={() => setDirection(d)}
          >
            <Text style={[styles.pillText, direction === d && styles.pillTextActive]}>
              {d === 'in' ? 'Add to Inventory' : 'Move to In Use'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.fieldLabel}>Quantity</Text>
      <TextInput
        style={styles.input}
        value={quantity}
        onChangeText={(v) => setQuantity(v.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        placeholder="1"
        placeholderTextColor="#aaa"
      />
      {direction === 'out' && inventoryRolls.length > 0 && (
        <Text style={styles.qtyHint}>Max: {inventoryRolls.length} in Inventory</Text>
      )}

      {direction === 'in' ? (
        <Pressable style={styles.confirmBtn} onPress={handleAddRoll}>
          <Text style={styles.confirmBtnText}>Add to Inventory</Text>
        </Pressable>
      ) : (
        inventoryRolls.length === 0 ? (
          <View style={styles.noRollsCard}>
            <Text style={styles.noRollsText}>No rolls in Inventory for this filament.</Text>
          </View>
        ) : (
          <Pressable style={[styles.confirmBtn, styles.confirmBtnOut]} onPress={handleMoveToInUse}>
            <Text style={styles.confirmBtnText}>Move to In Use</Text>
          </Pressable>
        )
      )}

      <Pressable style={styles.rescanBtn} onPress={resetScan}>
        <Text style={styles.rescanBtnText}>Scan Again</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#f5f5f5' },
  permText: { fontSize: 15, color: '#333', textAlign: 'center', marginBottom: 16 },
  permBtn: { backgroundColor: '#3367d6', padding: 14, borderRadius: 8 },
  permBtnText: { color: '#fff', fontWeight: '700' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  scanTitle: {
    color: '#fff', fontSize: 17, fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, marginBottom: 24,
  },
  scanFrame: {
    width: 260, height: 160,
    borderWidth: 2, borderColor: '#fff', borderRadius: 12,
  },
  scanHint: {
    color: '#fff', marginTop: 20, fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20,
  },
  cancelBtn: {
    position: 'absolute', bottom: 40, alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 28, paddingVertical: 12,
    borderRadius: 24, borderWidth: 1, borderColor: '#fff',
  },
  cancelBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  confirmContainer: { flex: 1, backgroundColor: '#f5f5f5', padding: 20, paddingTop: 56 },
  confirmTitle: { fontSize: 24, fontWeight: '800', color: '#1a1a1a', marginBottom: 2 },
  confirmColor: { fontSize: 15, color: '#555' },
  confirmUpc: { fontSize: 12, color: '#888', marginTop: 2 },
  stockRow: { flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 4 },
  stockBadge: {
    flex: 1, alignItems: 'center', backgroundColor: '#e8f5e9',
    borderRadius: 8, paddingVertical: 12,
  },
  stockBadgeInUse: { backgroundColor: '#fff0e0' },
  stockBadgeValue: { fontSize: 28, fontWeight: '800', color: '#1a8a3a' },
  stockBadgeValueInUse: { color: '#c65800' },
  stockBadgeLabel: { fontSize: 12, color: '#888', marginTop: 2 },

  fieldLabel: {
    fontSize: 12, color: '#888', textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: 8, marginTop: 16,
  },
  pillRow: { gap: 8 },
  pill: {
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#ccc', backgroundColor: '#fff', alignItems: 'center',
  },
  pillIn: { backgroundColor: '#1a8a3a', borderColor: '#1a8a3a' },
  pillOut: { backgroundColor: '#c62828', borderColor: '#c62828' },
  pillText: { color: '#333', fontWeight: '600', fontSize: 14 },
  pillTextActive: { color: '#fff' },

  qtyHint: { fontSize: 12, color: '#c65800', marginTop: 4, fontWeight: '600' },
  input: {
    backgroundColor: '#fff', borderRadius: 8, borderWidth: 1,
    borderColor: '#ddd', padding: 12, fontSize: 15, color: '#1a1a1a',
  },
  confirmBtn: {
    backgroundColor: '#1a8a3a', padding: 16, borderRadius: 10,
    alignItems: 'center', marginTop: 20, elevation: 2,
  },
  confirmBtnOut: { backgroundColor: '#c65800' },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  noRollsCard: {
    backgroundColor: '#fde8e8', borderRadius: 8, padding: 16, alignItems: 'center',
  },
  noRollsText: { color: '#c62828', fontSize: 14, fontWeight: '600' },
  rescanBtn: { alignItems: 'center', marginTop: 16, padding: 10 },
  rescanBtnText: { color: '#3367d6', fontWeight: '600', fontSize: 15 },
});
