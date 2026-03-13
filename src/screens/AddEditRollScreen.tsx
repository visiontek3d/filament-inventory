import React, { useLayoutEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createRoll } from '../db/database';
import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'AddEditRoll'>;

export default function AddEditRollScreen({ route, navigation }: Props) {
  const { filamentId } = route.params;
  const [quantity, setQuantity] = useState('1');

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Add Rolls' });
  }, [navigation]);

  const handleAdd = () => {
    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    for (let i = 0; i < qty; i++) {
      createRoll(filamentId);
    }
    navigation.goBack();
  };

  const qty = Math.max(1, parseInt(quantity, 10) || 1);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.fieldLabel}>Quantity</Text>
      <TextInput
        style={styles.input}
        value={quantity}
        onChangeText={(v) => setQuantity(v.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        placeholder="1"
        placeholderTextColor="#aaa"
        autoFocus
        selectTextOnFocus
      />

      <Pressable style={styles.saveBtn} onPress={handleAdd}>
        <Text style={styles.saveBtnText}>
          Add {qty} Roll{qty !== 1 ? 's' : ''} to Inventory
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  fieldLabel: {
    fontSize: 12,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    fontSize: 15,
    color: '#1a1a1a',
  },
  saveBtn: {
    backgroundColor: '#3367d6',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 28,
    elevation: 2,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
