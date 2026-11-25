import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as Haptics from 'expo-haptics';
import { Check, X, RotateCcw } from 'lucide-react-native';

// Weight options: 0 to 200 kg (0.5kg increments, plus 1.25kg increments)
const GENERATE_WEIGHTS = () => {
  const set = new Set();
  set.add(0);
  for (let i = 0.5; i <= 200; i += 0.5) set.add(Number(i.toFixed(2)));
  for (let i = 1.25; i <= 100; i += 1.25) set.add(Number(i.toFixed(2)));
  return Array.from(set).sort((a, b) => a - b);
};
const WEIGHT_OPTIONS = GENERATE_WEIGHTS();
const REPS_OPTIONS = Array.from({ length: 60 }, (_, i) => i + 1);
const TIME_OPTIONS = [
  5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60,
  70, 75, 80, 90, 100, 105, 120, 135, 150, 180, 240, 300
];

export default function CupertinoPickerModal({
  visible,
  onClose,
  exerciseName = '',
  setIndex = 0,
  totalSets = 3,
  isTimed = false,
  initialWeight = '0',
  initialReps = '10',
  initialRir = '2',
  previousSet = null,
  onSave,
}) {
  const [selectedWeight, setSelectedWeight] = useState(0);
  const [selectedRepsOrTime, setSelectedRepsOrTime] = useState(10);
  const [selectedRir, setSelectedRir] = useState(2);

  useEffect(() => {
    if (!visible) return;

    // Parse weight
    let w = parseFloat(initialWeight);
    if (isNaN(w) && previousSet?.weight) w = parseFloat(previousSet.weight);
    setSelectedWeight(!isNaN(w) && w >= 0 ? w : 0);

    // Parse reps or time
    let r = parseInt(initialReps, 10);
    if (isNaN(r) && previousSet?.reps) r = parseInt(previousSet.reps, 10);
    if (isTimed) {
      setSelectedRepsOrTime(!isNaN(r) && r > 0 ? r : 45);
    } else {
      setSelectedRepsOrTime(!isNaN(r) && r > 0 ? r : 10);
    }

    // Parse RIR
    let rirVal = parseInt(initialRir, 10);
    setSelectedRir(!isNaN(rirVal) ? rirVal : 2);
  }, [visible, initialWeight, initialReps, initialRir, isTimed]);

  const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
    try {
      Haptics.impactAsync(style);
    } catch (e) {}
  };

  const handleConfirm = () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {}

    onSave({
      weight: selectedWeight > 0 ? selectedWeight.toString() : '0',
      reps: selectedRepsOrTime.toString(),
      rir: selectedRir.toString(),
      isTimed,
    });
    onClose();
  };

  const adjustWeightDelta = (delta) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    const next = Math.max(0, Math.min(200, Number((selectedWeight + delta).toFixed(2))));
    setSelectedWeight(next);
  };

  const handleCopyPrevious = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    if (previousSet) {
      const pW = parseFloat(previousSet.weight) || 0;
      const pR = parseInt(previousSet.reps, 10) || (isTimed ? 45 : 10);
      setSelectedWeight(pW);
      setSelectedRepsOrTime(pR);
      if (previousSet.rir !== undefined) setSelectedRir(parseInt(previousSet.rir, 10) || 2);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Grabber */}
          <View style={styles.grabber} />

          {/* Action Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.circleBtn}>
              <X size={20} color="#9ca3af" />
            </TouchableOpacity>

            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerSubtitle}>
                SERIE #{setIndex + 1} DE {totalSets}
              </Text>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {exerciseName}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              {previousSet && (
                <TouchableOpacity onPress={handleCopyPrevious} style={styles.circleBtn}>
                  <RotateCcw size={18} color="#9ca3af" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleConfirm} style={styles.confirmBtn}>
                <Check size={20} color="#fff" strokeWidth={3} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Metric Highlight Summary */}
          <View style={styles.summaryBar}>
            <Text style={styles.summaryValue}>
              {selectedRepsOrTime} {isTimed ? 'seg' : 'reps'}
            </Text>
            <Text style={styles.summarySeparator}>×</Text>
            <Text style={styles.summaryValue}>
              {selectedWeight > 0 ? `${selectedWeight} kg` : (isTimed ? 'Sin lastre' : '0 kg')}
            </Text>
          </View>

          {/* Column Titles */}
          <View style={styles.columnTitles}>
            <Text style={styles.colLabel}>{isTimed ? ' TIEMPO' : ' REPETICIONES'}</Text>
            <Text style={styles.colLabel}>{isTimed ? ' LASTRE (KG)' : ' PESO (KG)'}</Text>
          </View>

          {/* THE NATIVE APPLE UIPICKERVIEW */}
          <View style={styles.pickerContainer}>
            {/* Left Picker: Reps or Time */}
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={selectedRepsOrTime}
                onValueChange={(val) => {
                  setSelectedRepsOrTime(val);
                  triggerHaptic();
                }}
                style={styles.picker}
                itemStyle={styles.pickerItem}
              >
                {(isTimed ? TIME_OPTIONS : REPS_OPTIONS).map((v) => (
                  <Picker.Item key={`r-${v}`} label={isTimed ? `${v}s` : `${v}`} value={v} />
                ))}
              </Picker>
            </View>

            {/* Right Picker: Weight */}
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={selectedWeight}
                onValueChange={(val) => {
                  setSelectedWeight(val);
                  triggerHaptic();
                }}
                style={styles.picker}
                itemStyle={styles.pickerItem}
              >
                {WEIGHT_OPTIONS.map((w) => (
                  <Picker.Item key={`w-${w}`} label={w === 0 ? '0.00 kg' : `${w.toFixed(2)} kg`} value={w} />
                ))}
              </Picker>
            </View>
          </View>

          {/* Quick Plates & Steppers */}
          <View style={styles.platesRow}>
            {[-5, -2.5, 1.25, 2.5, 5, 10].map((delta) => (
              <TouchableOpacity
                key={`chip-${delta}`}
                onPress={() => adjustWeightDelta(delta)}
                style={[styles.plateChip, delta > 0 && styles.plateChipPositive]}
              >
                <Text style={[styles.plateText, delta > 0 && styles.plateTextPositive]}>
                  {delta > 0 ? `+${delta}` : delta}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* RIR Selection */}
          <View style={styles.rirContainer}>
            <View style={styles.rirHeader}>
              <Text style={styles.rirLabel}>RIR (REPETICIONES EN RESERVA)</Text>
              <Text style={styles.rirActiveLabel}>RIR {selectedRir}</Text>
            </View>
            <View style={styles.rirButtons}>
              {[0, 1, 2, 3, 4].map((rVal) => (
                <TouchableOpacity
                  key={`rir-${rVal}`}
                  onPress={() => {
                    setSelectedRir(rVal);
                    triggerHaptic();
                  }}
                  style={[styles.rirBtn, selectedRir === rVal && styles.rirBtnActive]}
                >
                  <Text style={[styles.rirBtnText, selectedRir === rVal && styles.rirBtnTextActive]}>
                    {rVal === 4 ? '4+' : rVal}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity onPress={handleConfirm} style={styles.bigSaveBtn}>
            <Check size={18} color="#fff" strokeWidth={3} />
            <Text style={styles.bigSaveText}>
              Guardar Serie #{setIndex + 1}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#121217',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
  },
  grabber: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
  },
  circleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#e11d48',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#e11d48',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  headerSubtitle: {
    fontSize: 10,
    color: '#e11d48',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginTop: 2,
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingVertical: 8,
    marginBottom: 10,
    gap: 12,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  summarySeparator: {
    fontSize: 16,
    color: '#71717a',
    fontWeight: '700',
  },
  columnTitles: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 4,
  },
  colLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#a1a1aa',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  pickerContainer: {
    flexDirection: 'row',
    height: 180,
    backgroundColor: '#0a0a0e',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    marginBottom: 14,
  },
  pickerWrapper: {
    flex: 1,
  },
  picker: {
    height: 180,
  },
  pickerItem: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  platesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  plateChip: {
    flex: 1,
    marginHorizontal: 3,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  plateChipPositive: {
    backgroundColor: 'rgba(225,29,72,0.15)',
    borderColor: 'rgba(225,29,72,0.3)',
  },
  plateText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#a1a1aa',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  plateTextPositive: {
    color: '#fda4af',
  },
  rirContainer: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  rirHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rirLabel: {
    fontSize: 10,
    color: '#a1a1aa',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
  },
  rirActiveLabel: {
    fontSize: 10,
    color: '#c084fc',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
  },
  rirButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  rirBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  rirBtnActive: {
    backgroundColor: '#9333ea',
  },
  rirBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#a1a1aa',
  },
  rirBtnTextActive: {
    color: '#fff',
  },
  bigSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e11d48',
    borderRadius: 16,
    paddingVertical: 14,
    gap: 8,
    shadowColor: '#e11d48',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
  },
  bigSaveText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
