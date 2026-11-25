import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Check, Trophy, Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function ExerciseCard({
  exercise,
  savedSets = [],
  previousHistory = null,
  onOpenPicker,
  onToggleCheck,
}) {
  const targetCount = exercise.sets || 3;
  const isTimed =
    exercise.reps?.toString().toLowerCase().includes('s') ||
    exercise.name?.toLowerCase().includes('plancha') ||
    exercise.id?.toLowerCase().includes('plancha') ||
    exercise.name?.toLowerCase().includes('hang') ||
    exercise.id?.toLowerCase().includes('dead_hang');

  const sets =
    savedSets.length > 0
      ? savedSets
      : Array.from({ length: targetCount }, () => ({
          weight: '',
          reps: '',
          rir: '',
          checked: false,
        }));

  const checkedCount = sets.filter((s) => s.checked).length;
  const isComplete = checkedCount > 0 && checkedCount >= sets.length;

  return (
    <View style={[styles.card, isComplete && styles.cardComplete]}>
      {/* Exercise Title Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.name}>{exercise.name}</Text>
            {exercise.isMainLift && (
              <View style={styles.mainBadge}>
                <Text style={styles.mainBadgeText}>PRINCIPAL</Text>
              </View>
            )}
            {isComplete && (
              <View style={styles.doneBadge}>
                <Text style={styles.doneBadgeText}> HECHO</Text>
              </View>
            )}
          </View>

          {/* Target details */}
          <View style={styles.targetRow}>
            <Text style={styles.targetBadge}>
              {exercise.sets} series × {exercise.reps} {isTimed ? '' : 'reps'}
            </Text>
            <Text style={[styles.targetBadge, { color: '#c084fc', backgroundColor: 'rgba(192,132,252,0.1)' }]}>
              RIR {exercise.targetRir}
            </Text>
            <Text style={[styles.targetBadge, { color: '#fb923c', backgroundColor: 'rgba(251,146,60,0.1)' }]}>
              {exercise.rest}
            </Text>
          </View>
        </View>

        {/* Previous Session Snapshot */}
        {previousHistory?.sets?.length > 0 && (
          <View style={styles.prevSnapshot}>
            <Text style={styles.prevDate}>Previa ({previousHistory.date?.slice(5)})</Text>
            <Text style={styles.prevSets}>
              {previousHistory.sets.slice(0, 3).map((s) => `${s.weight}k×${s.reps}`).join(' · ')}
            </Text>
          </View>
        )}
      </View>

      {/* 191cm Cue */}
      {exercise.notes ? (
        <View style={styles.cueBox}>
          <Text style={styles.cueText}>
            <Text style={styles.cueBold}>191cm: </Text>
            {exercise.notes}
          </Text>
        </View>
      ) : null}

      {/* Sets Rows */}
      <View style={styles.setsList}>
        {sets.map((set, idx) => {
          const isChecked = !!set.checked;
          const weightNum = parseFloat(set.weight) || 0;
          const repsNum = parseInt(set.reps, 10) || 0;
          const e1rm = weightNum > 0 && repsNum > 0 ? Math.round(weightNum * (1 + repsNum / 30) * 10) / 10 : 0;

          return (
            <View key={`set-${idx}`} style={[styles.setRow, isChecked && styles.setRowChecked]}>
              {/* Set Index */}
              <View style={styles.setIndexCol}>
                <Text style={styles.setIndexText}>#{idx + 1}</Text>
              </View>

              {/* Weight Button */}
              <TouchableOpacity
                onPress={() => onOpenPicker(exercise, idx, set, 'weight', isTimed)}
                style={styles.metricBtn}
              >
                <Text style={styles.metricLabel}>{isTimed ? 'LASTRE' : 'PESO'}</Text>
                <Text style={styles.metricValue}>
                  {set.weight && parseFloat(set.weight) > 0
                    ? `${set.weight} kg`
                    : (isTimed ? '0 kg' : '0 kg')}
                </Text>
              </TouchableOpacity>

              {/* Reps/Time Button */}
              <TouchableOpacity
                onPress={() => onOpenPicker(exercise, idx, set, 'reps', isTimed)}
                style={styles.metricBtn}
              >
                <Text style={styles.metricLabel}>{isTimed ? 'TIEMPO' : 'REPS'}</Text>
                <Text style={styles.metricValue}>
                  {set.reps ? (isTimed ? `${set.reps}s` : `${set.reps}`) : (isTimed ? '0s' : '0')}
                </Text>
              </TouchableOpacity>

              {/* RIR & e1RM badge */}
              <View style={styles.statCol}>
                <Text style={styles.rirText}>
                  {set.rir !== '' && set.rir !== undefined ? `RIR ${set.rir}` : '—'}
                </Text>
                {e1rm > 0 ? (
                  <Text style={styles.e1rmText}>{e1rm}k 1RM</Text>
                ) : null}
              </View>

              {/* Checkbox Complete */}
              <TouchableOpacity
                onPress={() => {
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch (e) {}
                  onToggleCheck(exercise.id, idx);
                }}
                style={[styles.checkBtn, isChecked && styles.checkBtnActive]}
              >
                {isChecked ? <Check size={16} color="#fff" strokeWidth={3} /> : null}
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#16161c',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'transparent',
    padding: 18,
    marginBottom: 16,
  },
  cardComplete: {
    borderColor: 'rgba(34,197,94,0.3)',
    backgroundColor: 'rgba(34,197,94,0.04)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },
  mainBadge: {
    backgroundColor: 'rgba(225,29,72,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(225,29,72,0.3)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  mainBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#e11d48',
    letterSpacing: 0.5,
  },
  doneBadge: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  doneBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#22c55e',
  },
  targetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  targetBadge: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
    color: '#d4d4d8',
    backgroundColor: 'transparent',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  prevSnapshot: {
    alignItems: 'flex-end',
  },
  prevDate: {
    fontSize: 9,
    color: '#71717a',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textTransform: 'uppercase',
  },
  prevSets: {
    fontSize: 11,
    fontWeight: '600',
    color: '#a1a1aa',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  cueBox: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderLeftWidth: 3,
    borderColor: '#3b82f6',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  cueText: {
    fontSize: 12,
    color: '#a1a1aa',
    lineHeight: 16,
  },
  cueBold: {
    color: '#fff',
    fontWeight: '700',
  },
  setsList: {
    gap: 8,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 10,
  },
  setRowChecked: {
    backgroundColor: 'rgba(34,197,94,0.05)',
    borderColor: 'rgba(34,197,94,0.2)',
  },
  setIndexCol: {
    width: 26,
  },
  setIndexText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
    color: '#71717a',
  },
  metricBtn: {
    flex: 1,
    backgroundColor: '#0a0a0e',
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  metricLabel: {
    fontSize: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#71717a',
    fontWeight: '700',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '800',
    color: '#fff',
  },
  statCol: {
    width: 60,
    alignItems: 'center',
  },
  rirText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#c084fc',
    fontWeight: '700',
  },
  e1rmText: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#a1a1aa',
    marginTop: 2,
  },
  checkBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBtnActive: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
});
