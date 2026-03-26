import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  createFilament,
  getDistinctManufacturers,
  getDistinctTypes,
  getFilament,
  updateFilament,
} from '../db/supabase-operations';
import { FilamentPriority, RootStackParamList } from '../types';
import PickerModal from '../components/PickerModal';

type Props = NativeStackScreenProps<RootStackParamList, 'AddEditFilament'>;

export default function AddEditFilamentScreen({ route, navigation }: Props) {
  const { filamentId, initialUpc } = route.params ?? {};
  const isEdit = filamentId !== undefined;

  const [manufacturer, setManufacturer] = useState('');
  const [type, setType] = useState('');
  const [color, setColor] = useState('');
  const [upc, setUpc] = useState(initialUpc ?? '');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [priority, setPriority] = useState<FilamentPriority>('None');
  const [showScanner, setShowScanner] = useState(false);
  const [saving, setSaving] = useState(false);

  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [showManufacturerPicker, setShowManufacturerPicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    (async () => {
      const [mfgs, tps] = await Promise.all([getDistinctManufacturers(), getDistinctTypes()]);
      if (!cancelled) { setManufacturers(mfgs); setTypes(tps); }
    })();
    return () => { cancelled = true; };
  }, []));

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEdit ? 'Edit Filament' : 'Add Filament' });
  }, [isEdit, navigation]);

  useEffect(() => {
    if (isEdit && filamentId !== undefined) {
      (async () => {
        const f = await getFilament(filamentId);
        if (f) {
          setManufacturer(f.manufacturer);
          setType(f.type);
          setColor(f.color);
          setUpc(f.upc);
          setPhotoUri(f.photo_uri);
          setUrl(f.url ?? '');
          setPriority((f.priority as FilamentPriority) ?? 'None');
        }
      })();
    }
  }, [filamentId, isEdit]);

  const handleOpenScanner = async () => {
    if (!cameraPermission?.granted) {
      const { granted } = await requestCameraPermission();
      if (!granted) {
        Alert.alert('Permission required', 'Camera access is needed to scan barcodes.');
        return;
      }
    }
    setShowScanner(true);
  };

  const handleBarcode = ({ data }: { data: string }) => {
    setUpc(data.trim());
    setShowScanner(false);
  };

  const handlePickPhoto = () => {
    Alert.alert('Photo', 'Choose a source', [
      {
        text: 'Camera',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission required', 'Camera access is needed to take a photo.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
          });
          if (!result.canceled) setPhotoUri(result.assets[0].uri);
        },
      },
      {
        text: 'Photo Library',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
          });
          if (!result.canceled) setPhotoUri(result.assets[0].uri);
        },
      },
      {
        text: 'Browse Files (Drive, etc.)',
        onPress: async () => {
          const result = await DocumentPicker.getDocumentAsync({
            type: ['image/*'],
            copyToCacheDirectory: true,
          });
          if (!result.canceled) setPhotoUri(result.assets[0].uri);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSave = async () => {
    if (!manufacturer.trim() || !type.trim() || !color.trim()) {
      Alert.alert('Missing fields', 'Manufacturer, Type, and Color are required.');
      return;
    }
    setSaving(true);
    if (isEdit && filamentId !== undefined) {
      await updateFilament(filamentId, manufacturer.trim(), type.trim(), color.trim(), upc.trim(), photoUri, url.trim() || null, priority);
    } else {
      await createFilament(manufacturer.trim(), type.trim(), color.trim(), upc.trim(), photoUri, url.trim() || null, priority);
    }
    setSaving(false);
    navigation.goBack();
  };

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        <Pressable style={styles.photoPicker} onPress={handlePickPhoto}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoIcon}>📷</Text>
              <Text style={styles.photoHint}>Tap to add photo</Text>
            </View>
          )}
        </Pressable>
        {photoUri ? (
          <Pressable style={styles.changePhotoBtn} onPress={handlePickPhoto}>
            <Text style={styles.changePhotoBtnText}>Change Photo</Text>
          </Pressable>
        ) : null}

        <Text style={styles.fieldLabel}>Manufacturer *</Text>
        <Pressable style={styles.pickerBtn} onPress={() => setShowManufacturerPicker(true)}>
          <Text style={[styles.pickerBtnText, !manufacturer && styles.pickerBtnPlaceholder]}>
            {manufacturer || 'Select manufacturer...'}
          </Text>
          <Text style={styles.pickerChevron}>›</Text>
        </Pressable>

        <Text style={styles.fieldLabel}>Type *</Text>
        <Pressable style={styles.pickerBtn} onPress={() => setShowTypePicker(true)}>
          <Text style={[styles.pickerBtnText, !type && styles.pickerBtnPlaceholder]}>
            {type || 'Select type...'}
          </Text>
          <Text style={styles.pickerChevron}>›</Text>
        </Pressable>

        <Text style={styles.fieldLabel}>Color *</Text>
        <TextInput
          style={styles.input}
          value={color}
          onChangeText={setColor}
          placeholder="e.g. Galaxy Black, Silk Gold"
          placeholderTextColor="#aaa"
        />

        <Text style={styles.fieldLabel}>UPC / Barcode</Text>
        <View style={styles.upcRow}>
          <TextInput
            style={[styles.input, styles.upcInput]}
            value={upc}
            onChangeText={setUpc}
            placeholder="Scan or enter barcode"
            placeholderTextColor="#aaa"
            keyboardType="number-pad"
          />
          <Pressable style={styles.scanBtn} onPress={handleOpenScanner}>
            <Text style={styles.scanBtnText}>📷</Text>
          </Pressable>
        </View>

        {showScanner && (
          <View style={styles.scannerContainer}>
            <CameraView
              style={styles.scanner}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'],
              }}
              onBarcodeScanned={handleBarcode}
            />
            <Pressable style={styles.cancelScanBtn} onPress={() => setShowScanner(false)}>
              <Text style={styles.cancelScanBtnText}>Cancel</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.fieldLabel}>Inventory Priority</Text>
        <View style={styles.priorityRow}>
          {(['None', 'Low', 'Medium', 'High'] as FilamentPriority[]).map((level) => (
            <Pressable
              key={level}
              style={[styles.priorityBtn, priority === level && styles.priorityBtnActive(level)]}
              onPress={() => setPriority(level)}
            >
              <Text style={[styles.priorityBtnText, priority === level && styles.priorityBtnTextActive]}>
                {level}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.fieldLabel}>URL</Text>
        <TextInput
          style={styles.input}
          value={url}
          onChangeText={setUrl}
          placeholder="e.g. https://www.hatchbox3d.com/..."
          placeholderTextColor="#aaa"
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Pressable
          style={[styles.saveBtn, (saving || !manufacturer.trim() || !type.trim() || !color.trim()) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving || !manufacturer.trim() || !type.trim() || !color.trim()}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>{isEdit ? 'Save Changes' : 'Add Filament'}</Text>
          }
        </Pressable>
      </ScrollView>

      <PickerModal
        visible={showManufacturerPicker}
        title="Manufacturer"
        options={manufacturers}
        value={manufacturer}
        onSelect={setManufacturer}
        onClose={() => setShowManufacturerPicker(false)}
      />
      <PickerModal
        visible={showTypePicker}
        title="Type"
        options={types}
        value={type}
        onSelect={setType}
        onClose={() => setShowTypePicker(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  photoPicker: {
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 8,
    elevation: 1,
  },
  photoPreview: { width: '100%', height: 200 },
  photoPlaceholder: {
    height: 140,
    backgroundColor: '#e8f0fe',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#3367d6',
    borderStyle: 'dashed',
  },
  photoIcon: { fontSize: 36, marginBottom: 6 },
  photoHint: { color: '#3367d6', fontSize: 14, fontWeight: '600' },
  changePhotoBtn: { alignItems: 'center', marginBottom: 12 },
  changePhotoBtnText: { color: '#3367d6', fontSize: 13, fontWeight: '600' },
  fieldLabel: {
    fontSize: 12,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 14,
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 12,
    paddingVertical: 13,
  },
  pickerBtnText: { flex: 1, fontSize: 15, color: '#1a1a1a' },
  pickerBtnPlaceholder: { color: '#aaa' },
  pickerChevron: { fontSize: 22, color: '#aaa', lineHeight: 24 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    fontSize: 15,
    color: '#1a1a1a',
  },
  upcRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  upcInput: { flex: 1 },
  scanBtn: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBtnText: { fontSize: 20 },
  scannerContainer: {
    marginTop: 10,
    borderRadius: 10,
    overflow: 'hidden',
    height: 200,
  },
  scanner: { flex: 1 },
  cancelScanBtn: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  cancelScanBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  saveBtn: {
    backgroundColor: '#3367d6',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 28,
    elevation: 2,
  },
  saveBtnDisabled: { backgroundColor: '#aaa' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  priorityRow: { flexDirection: 'row', gap: 8 },
  priorityBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#ddd', backgroundColor: '#fff',
  },
  priorityBtnActive: (level: FilamentPriority) => ({
    borderColor: level === 'High' ? '#c62828' : level === 'Medium' ? '#e6a817' : level === 'Low' ? '#1a8a3a' : '#aaa',
    backgroundColor: level === 'High' ? '#fde8e8' : level === 'Medium' ? '#fff8e1' : level === 'Low' ? '#f0fdf4' : '#f0f0f0',
  }),
  priorityBtnText: { fontSize: 14, fontWeight: '600', color: '#888' },
  priorityBtnTextActive: { color: '#1a1a1a' },
});
