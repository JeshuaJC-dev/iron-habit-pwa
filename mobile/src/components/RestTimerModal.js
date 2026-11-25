import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { Play, Pause, Square, Plus, Minus, X } from 'lucide-react-native';

export default function RestTimerModal({ visible, initialSeconds = 90, exerciseName = '', onClose }) {
  // Keep screen awake while rest timer is active
  useKeepAwake();

  const [remaining, setRemaining] = useState(initialSeconds);
  const [targetDuration, setTargetDuration] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(true);
  const endTimeRef = useRef(Date.now() + initialSeconds * 1000);

  useEffect(() => {
    if (!visible) return;
    const dur = Math.max(5, initialSeconds);
    setTargetDuration(dur);
    setRemaining(dur);
    endTimeRef.current = Date.now() + dur * 1000;
    setIsRunning(true);
  }, [visible, initialSeconds]);

  useEffect(() => {
    if (!visible || !isRunning) return;

    const interval = setInterval(() => {
      const diff = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
      setRemaining(diff);

      if (diff <= 0) {
        clearInterval(interval);
        setIsRunning(false);
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {}
      }
    }, 250);

    return () => clearInterval(interval);
  }, [visible, isRunning]);

  const togglePlayPause = () => {
    if (isRunning) {
      setIsRunning(false);
    } else {
      endTimeRef.current = Date.now() + remaining * 1000;
      setIsRunning(true);
    }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {}
  };

  const adjustTime = (delta) => {
    const next = Math.max(5, remaining + delta);
    setRemaining(next);
    setTargetDuration(Math.max(next, targetDuration));
    endTimeRef.current = Date.now() + next * 1000;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
  };

  if (!visible) return null;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timeFormatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  const progressPercent = targetDuration > 0 ? Math.min(100, ((targetDuration - remaining) / targetDuration) * 100) : 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={20} color="#a1a1aa" />
          </TouchableOpacity>

          <Text style={styles.tag}>DESCANSO ENTRE SERIES</Text>
          <Text style={styles.exerciseName} numberOfLines={1}>
            {exerciseName || 'Recuperación'}
          </Text>

          {/* Big Time Display */}
          <View style={styles.timeContainer}>
            <Text style={styles.timeText}>{timeFormatted}</Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>
          </View>

          {/* Quick Adjustment Steppers */}
          <View style={styles.stepperRow}>
            <TouchableOpacity onPress={() => adjustTime(-15)} style={styles.stepperBtn}>
              <Minus size={14} color="#a1a1aa" />
              <Text style={styles.stepperText}>15s</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => adjustTime(-30)} style={styles.stepperBtn}>
              <Minus size={14} color="#a1a1aa" />
              <Text style={styles.stepperText}>30s</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => adjustTime(30)} style={styles.stepperBtn}>
              <Plus size={14} color="#fda4af" />
              <Text style={[styles.stepperText, { color: '#fda4af' }]}>30s</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => adjustTime(60)} style={styles.stepperBtn}>
              <Plus size={14} color="#fda4af" />
              <Text style={[styles.stepperText, { color: '#fda4af' }]}>60s</Text>
            </TouchableOpacity>
          </View>

          {/* Controls */}
          <View style={styles.controlsRow}>
            <TouchableOpacity onPress={togglePlayPause} style={styles.primaryControlBtn}>
              {isRunning ? <Pause size={22} color="#fff" /> : <Play size={22} color="#fff" />}
              <Text style={styles.controlBtnText}>{isRunning ? 'Pausar' : 'Reanudar'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onClose} style={styles.secondaryControlBtn}>
              <Text style={styles.secondaryBtnText}>Terminar Descanso</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    backgroundColor: '#121217',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(225,29,72,0.35)',
    padding: 24,
    alignItems: 'center',
    shadowColor: '#e11d48',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 6,
  },
  tag: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
    color: '#e11d48',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  timeContainer: {
    alignItems: 'center',
    marginBottom: 20,
    width: '100%',
  },
  timeText: {
    fontSize: 56,
    fontWeight: '900',
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: -1,
    marginBottom: 14,
  },
  progressBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#e11d48',
  },
  stepperRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  stepperBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 2,
  },
  stepperText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#a1a1aa',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  controlsRow: {
    width: '100%',
    gap: 10,
  },
  primaryControlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e11d48',
    borderRadius: 16,
    paddingVertical: 14,
    gap: 8,
  },
  controlBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryControlBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    paddingVertical: 12,
  },
  secondaryBtnText: {
    color: '#d4d4d8',
    fontSize: 13,
    fontWeight: '600',
  },
});
