import React, { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type Props = {
  visible: boolean;
  title: string;
  options: string[];
  value: string;
  onSelect: (value: string) => void;
  onClose: () => void;
};

export default function PickerModal({ visible, title, options, value, onSelect, onClose }: Props) {
  const [customText, setCustomText] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const handleSelect = (option: string) => {
    onSelect(option);
    setCustomText('');
    setShowCustom(false);
    onClose();
  };

  const handleCustomSubmit = () => {
    if (customText.trim()) {
      onSelect(customText.trim());
      setCustomText('');
      setShowCustom(false);
      onClose();
    }
  };

  const handleClose = () => {
    setCustomText('');
    setShowCustom(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={handleClose}>
            <Text style={styles.closeBtn}>✕</Text>
          </Pressable>
        </View>

        {showCustom ? (
          <View style={styles.customContainer}>
            <TextInput
              style={styles.customInput}
              value={customText}
              onChangeText={setCustomText}
              placeholder={`Enter custom ${title.toLowerCase()}...`}
              placeholderTextColor="#aaa"
              autoFocus
            />
            <View style={styles.customBtns}>
              <Pressable style={styles.customCancelBtn} onPress={() => setShowCustom(false)}>
                <Text style={styles.customCancelBtnText}>Back</Text>
              </Pressable>
              <Pressable
                style={[styles.customConfirmBtn, !customText.trim() && styles.customConfirmBtnDisabled]}
                onPress={handleCustomSubmit}
                disabled={!customText.trim()}
              >
                <Text style={styles.customConfirmBtnText}>Use This</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <FlatList
            data={options}
            keyExtractor={(item) => item}
            style={styles.list}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.option, item === value && styles.optionSelected]}
                onPress={() => handleSelect(item)}
              >
                <Text style={[styles.optionText, item === value && styles.optionTextSelected]}>
                  {item}
                </Text>
                {item === value && <Text style={styles.checkmark}>✓</Text>}
              </Pressable>
            )}
            ListFooterComponent={
              <Pressable style={styles.customOption} onPress={() => setShowCustom(true)}>
                <Text style={styles.customOptionText}>+ Enter custom value...</Text>
              </Pressable>
            }
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  closeBtn: { fontSize: 18, color: '#888', paddingHorizontal: 4 },
  list: { flexGrow: 0 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  optionSelected: { backgroundColor: '#e8f0fe' },
  optionText: { flex: 1, fontSize: 15, color: '#1a1a1a' },
  optionTextSelected: { color: '#3367d6', fontWeight: '700' },
  checkmark: { color: '#3367d6', fontWeight: '700', fontSize: 16 },
  customOption: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  customOptionText: { fontSize: 15, color: '#3367d6', fontWeight: '600' },
  customContainer: { padding: 16 },
  customInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    fontSize: 15,
    color: '#1a1a1a',
    marginBottom: 12,
  },
  customBtns: { flexDirection: 'row', gap: 8 },
  customCancelBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  customCancelBtnText: { color: '#555', fontWeight: '600' },
  customConfirmBtn: {
    flex: 2,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#3367d6',
    alignItems: 'center',
  },
  customConfirmBtnDisabled: { backgroundColor: '#aaa' },
  customConfirmBtnText: { color: '#fff', fontWeight: '700' },
});
