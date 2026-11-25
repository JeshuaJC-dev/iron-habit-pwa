import React, { useState, useEffect, Component } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import { dbStore } from './src/data/dbStore';
import ExerciseCard from './src/components/ExerciseCard';
import CupertinoPickerModal from './src/components/CupertinoPickerModal';
import RestTimerModal from './src/components/RestTimerModal';
import { Dumbbell, Calendar, Trophy, ChevronLeft, ChevronRight, Moon, ArrowRight, AlertCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

// Error Boundary to prevent silent white screens
class ErrorBoundary extends Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('App Error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#07070a', padding: 24, justifyContent: 'center' }}>
          <View style={{ backgroundColor: '#1c1917', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#ef4444' }}>
            <Text style={{ color: '#ef4444', fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
               Error de Renderizado
            </Text>
            <Text style={{ color: '#d4d4d8', fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
              {this.state.error?.message || 'Error desconocido'}
            </Text>
          </View>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

function MainApp() {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState('workout'); // 'workout' | 'routine' | 'vault'
  const [dbData, setDbData] = useState(null);
  const [routine, setRoutine] = useState(() => dbStore.getRoutine());
  const [selectedDayOverride, setSelectedDayOverride] = useState(null); // '1', '2', '4', '5'

  // Picker modal state
  const [pickerState, setPickerState] = useState({
    visible: false,
    exercise: null,
    setIndex: 0,
    currentSet: null,
    tab: 'weight',
    isTimed: false,
  });

  // Rest Timer modal state
  const [timerState, setTimerState] = useState({
    visible: false,
    seconds: 90,
    exerciseName: '',
  });

  // Load database on mount
  useEffect(() => {
    async function load() {
      const data = await dbStore.init();
      setDbData(data);
      setRoutine(dbStore.getRoutine());
    }
    load();
    const unsubscribe = dbStore.subscribe((data) => {
      setDbData({ ...data });
    });
    return unsubscribe;
  }, []);

  // Determine which routine day corresponds to selectedDate or override
  const getDayInfo = (dateStr) => {
    if (!routine || !routine.days) return null;
    if (selectedDayOverride) {
      return routine.days[selectedDayOverride] || null;
    }
    const dateObj = new Date(dateStr + 'T12:00:00Z');
    const dayOfWeek = dateObj.getDay().toString(); // 0: Dom, 1: Lun, 2: Mar, ...
    return routine.days[dayOfWeek] || null;
  };

  const dayInfo = getDayInfo(selectedDate);
  const currentWorkout = dbStore.getDayWorkout(selectedDate) || {};
  const currentExercisesState = currentWorkout.exercises || {};

  // Handlers for Sets changes
  const handleOpenPicker = (exercise, setIndex, currentSet, tab, isTimed) => {
    setPickerState({
      visible: true,
      exercise,
      setIndex,
      currentSet,
      tab,
      isTimed,
    });
  };

  const handleSaveSet = ({ weight, reps, rir }) => {
    if (!pickerState.exercise) return;
    const exId = pickerState.exercise.id;
    const targetIdx = pickerState.setIndex;

    const existingSets = currentExercisesState[exId] || [];
    const targetCount = pickerState.exercise.sets || 3;
    const newSets = existingSets.length > 0
      ? [...existingSets]
      : Array.from({ length: targetCount }, () => ({ weight: '', reps: '', rir: '', checked: false }));

    newSets[targetIdx] = {
      ...(newSets[targetIdx] || {}),
      weight,
      reps,
      rir,
    };

    const updatedWorkout = {
      ...currentWorkout,
      dayId: dayInfo?.id || '',
      sessionName: dayInfo?.sessionName || 'Entrenamiento',
      exercises: {
        ...currentExercisesState,
        [exId]: newSets,
      },
    };

    dbStore.saveDayWorkout(selectedDate, updatedWorkout);
  };

  const handleToggleCheck = (exId, setIndex) => {
    const existingSets = currentExercisesState[exId] || [];
    const exerciseDef = (dayInfo?.exercises || []).find((e) => e.id === exId);
    const targetCount = exerciseDef?.sets || 3;

    const newSets = existingSets.length > 0
      ? [...existingSets]
      : Array.from({ length: targetCount }, () => ({ weight: '', reps: '', rir: '', checked: false }));

    const willBeChecked = !newSets[setIndex]?.checked;
    newSets[setIndex] = {
      ...(newSets[setIndex] || {}),
      checked: willBeChecked,
    };

    const updatedWorkout = {
      ...currentWorkout,
      dayId: dayInfo?.id || '',
      sessionName: dayInfo?.sessionName || 'Entrenamiento',
      exercises: {
        ...currentExercisesState,
        [exId]: newSets,
      },
    };

    dbStore.saveDayWorkout(selectedDate, updatedWorkout);

    // Auto-start rest timer
    if (willBeChecked && exerciseDef?.rest) {
      let restSeconds = 90;
      if (exerciseDef.rest.includes('3 min')) restSeconds = 180;
      else if (exerciseDef.rest.includes('2.5 min')) restSeconds = 150;
      else if (exerciseDef.rest.includes('2 min')) restSeconds = 120;
      else if (exerciseDef.rest.includes('60s')) restSeconds = 60;

      setTimerState({
        visible: true,
        seconds: restSeconds,
        exerciseName: exerciseDef.name,
      });
    }
  };

  const changeDate = (daysDelta) => {
    const current = new Date(selectedDate + 'T12:00:00Z');
    current.setDate(current.getDate() + daysDelta);
    setSelectedDate(current.toISOString().split('T')[0]);
    setSelectedDayOverride(null);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}
  };

  const dayShortNames = [
    { key: '1', label: 'LUN', title: 'Torso A' },
    { key: '2', label: 'MAR', title: 'Pierna A' },
    { key: '3', label: 'MIÉ', title: 'Descanso' },
    { key: '4', label: 'JUE', title: 'Torso B' },
    { key: '5', label: 'VIE', title: 'Pierna B' },
    { key: '6', label: 'SÁB', title: 'Descanso' },
    { key: '0', label: 'DOM', title: 'Descanso' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#07070a" />

      {/* TOP HEADER */}
      <View style={styles.header}>
        <View style={styles.brandContainer}>
          <View style={styles.emblemCircle}>
            <Text style={styles.emblemLetter}>T</Text>
          </View>
          <View>
            <Text style={styles.brandText}>
              THRAGG <Text style={styles.brandPro}>PRO</Text>
            </Text>
            <Text style={styles.brandSub}>191CM · 77KG · VILTRUM ELITE</Text>
          </View>
        </View>

        {/* Date Selector Navigation */}
        <View style={styles.dateNav}>
          <TouchableOpacity onPress={() => changeDate(-1)} style={styles.dateArrow}>
            <ChevronLeft size={16} color="#d4d4d8" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setSelectedDate(new Date().toISOString().split('T')[0]); setSelectedDayOverride(null); }}>
            <Text style={styles.dateText}>{selectedDate.slice(5)}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => changeDate(1)} style={styles.dateArrow}>
            <ChevronRight size={16} color="#d4d4d8" />
          </TouchableOpacity>
        </View>
      </View>

      {/* QUICK DAY SELECTOR CHIPS (Always accessible) */}
      <View style={styles.daysScrollRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}>
          {dayShortNames.map((d) => {
            const isSelected = selectedDayOverride ? selectedDayOverride === d.key : (new Date(selectedDate + 'T12:00:00Z').getDay().toString() === d.key);
            return (
              <TouchableOpacity
                key={`chip-day-${d.key}`}
                onPress={() => {
                  setSelectedDayOverride(d.key);
                  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
                }}
                style={[styles.dayChip, isSelected && styles.dayChipActive]}
              >
                <Text style={[styles.dayChipLabel, isSelected && styles.dayChipLabelActive]}>{d.label}</Text>
                <Text style={[styles.dayChipSub, isSelected && styles.dayChipSubActive]}>{d.title}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* SEGMENTED MAIN TABS */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          onPress={() => setActiveTab('workout')}
          style={[styles.tabBtn, activeTab === 'workout' && styles.tabBtnActive]}
        >
          <Dumbbell size={14} color={activeTab === 'workout' ? '#fff' : '#71717a'} />
          <Text style={[styles.tabText, activeTab === 'workout' && styles.tabTextActive]}>
            Entreno
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('routine')}
          style={[styles.tabBtn, activeTab === 'routine' && styles.tabBtnActive]}
        >
          <Calendar size={14} color={activeTab === 'routine' ? '#fff' : '#71717a'} />
          <Text style={[styles.tabText, activeTab === 'routine' && styles.tabTextActive]}>
            Rutina v3.3
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('vault')}
          style={[styles.tabBtn, activeTab === 'vault' && styles.tabBtnActive]}
        >
          <Trophy size={14} color={activeTab === 'vault' ? '#fff' : '#71717a'} />
          <Text style={[styles.tabText, activeTab === 'vault' && styles.tabTextActive]}>
            Bóveda PRs
          </Text>
        </TouchableOpacity>
      </View>

      {/* MAIN SCROLL CONTENT */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'workout' && (
          <>
            {/* Session Banner */}
            {dayInfo && !dayInfo.isRestDay ? (
              <View style={styles.sessionBanner}>
                <View style={styles.bannerRow}>
                  <Text style={styles.dayTag}>{dayInfo.name.toUpperCase()}</Text>
                  <Text style={styles.sessionTitle}>{dayInfo.sessionName}</Text>
                </View>
                {dayInfo.tips ? (
                  <Text style={styles.sessionTips}> {dayInfo.tips}</Text>
                ) : null}
              </View>
            ) : (
              <View style={styles.restBanner}>
                <Moon size={28} color="#a1a1aa" />
                <Text style={styles.restTitle}>Día de Descanso & Recuperación</Text>
                <Text style={styles.restSubtitle}>
                  Hoy toca reponer glucógeno y comer 3.100 kcal. Puedes revisar o entrenar otro día tocando los botones de arriba:
                </Text>

                {/* Quick Shortcuts to Training Days */}
                <View style={styles.restShortcuts}>
                  <TouchableOpacity
                    onPress={() => setSelectedDayOverride('1')}
                    style={styles.shortcutBtn}
                  >
                    <Text style={styles.shortcutText}>Ver Lunes (Torso A)</Text>
                    <ArrowRight size={14} color="#e11d48" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setSelectedDayOverride('2')}
                    style={styles.shortcutBtn}
                  >
                    <Text style={styles.shortcutText}>Ver Martes (Pierna A)</Text>
                    <ArrowRight size={14} color="#e11d48" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Exercises List */}
            {dayInfo && !dayInfo.isRestDay && dayInfo.exercises?.map((ex) => {
              const savedSets = currentExercisesState[ex.id] || [];
              const prs = dbStore.getPrs();
              const historySnapshot = prs[ex.id] ? { date: prs[ex.id].date, sets: [{ weight: prs[ex.id].weight, reps: prs[ex.id].reps }] } : null;

              return (
                <ExerciseCard
                  key={ex.id}
                  exercise={ex}
                  savedSets={savedSets}
                  previousHistory={historySnapshot}
                  onOpenPicker={handleOpenPicker}
                  onToggleCheck={handleToggleCheck}
                />
              );
            })}
          </>
        )}

        {/* TAB 2: RUTINA SEMANAL */}
        {activeTab === 'routine' && (
          <View style={styles.routineList}>
            {routine?.days && ['1', '2', '3', '4', '5', '6', '0'].map((key) => {
              const d = routine.days[key];
              if (!d) return null;
              return (
                <View key={`day-${key}`} style={styles.routineCard}>
                  <View style={styles.routineHeader}>
                    <Text style={styles.routineDayName}>{d.name.toUpperCase()}</Text>
                    <Text style={styles.routineSessionName}>{d.sessionName}</Text>
                  </View>
                  {d.tips ? <Text style={styles.routineTips}>{d.tips}</Text> : null}

                  {d.exercises?.map((ex, i) => (
                    <View key={`ex-${i}`} style={styles.routineExRow}>
                      <Text style={styles.routineExName}>{i + 1}. {ex.name}</Text>
                      <Text style={styles.routineExTarget}>{ex.sets} × {ex.reps} · {ex.targetRir}</Text>
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        )}

        {/* TAB 3: BÓVEDA & PRs */}
        {activeTab === 'vault' && (
          <View style={styles.vaultContainer}>
            <View style={styles.vaultCard}>
              <View style={styles.vaultHeader}>
                <Trophy size={20} color="#fbbf24" />
                <Text style={styles.vaultTitle}>Récords Personales (PRs)</Text>
              </View>
              <Text style={styles.vaultSubtitle}>
                Calculados en base a tus 13 entrenos registrados
              </Text>

              <View style={styles.prsList}>
                {Object.entries(dbStore.getPrs()).map(([exId, pr]) => (
                  <View key={`pr-${exId}`} style={styles.prRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.prName}>{pr.exerciseName || exId}</Text>
                      <Text style={styles.prDate}>Conseguido: {pr.date}</Text>
                    </View>
                    <View style={styles.prBadge}>
                      <Text style={styles.prValue}>{pr.weight}k × {pr.reps}</Text>
                      <Text style={styles.prE1rm}>{pr.e1rm}k 1RM</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.historyBox}>
              <Text style={styles.historyTitle}>
                 Historial de Sesiones: {Object.keys(dbStore.getAllWorkouts()).length} entrenos
              </Text>
              <Text style={styles.historySub}>
                Fechas registradas: {Object.keys(dbStore.getAllWorkouts()).sort().join(', ')}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* CUPERTINO WHEEL PICKER MODAL (Native Apple UIPickerView) */}
      <CupertinoPickerModal
        visible={pickerState.visible}
        onClose={() => setPickerState({ ...pickerState, visible: false })}
        exerciseName={pickerState.exercise?.name || ''}
        setIndex={pickerState.setIndex}
        totalSets={pickerState.exercise?.sets || 3}
        isTimed={pickerState.isTimed}
        initialWeight={pickerState.currentSet?.weight || ''}
        initialReps={pickerState.currentSet?.reps || ''}
        initialRir={pickerState.currentSet?.rir || '2'}
        onSave={handleSaveSet}
      />

      {/* REST TIMER MODAL */}
      <RestTimerModal
        visible={timerState.visible}
        initialSeconds={timerState.seconds}
        exerciseName={timerState.exerciseName}
        onClose={() => setTimerState({ ...timerState, visible: false })}
      />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07070a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: 'rgba(225,29,72,0.2)',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emblemCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(225,29,72,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(225,29,72,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblemLetter: {
    color: '#e11d48',
    fontSize: 16,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  brandText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.3,
  },
  brandPro: {
    color: '#e11d48',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
  },
  brandSub: {
    fontSize: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
    color: '#fbbf24',
    letterSpacing: 0.5,
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6,
  },
  dateArrow: {
    padding: 2,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  daysScrollRow: {
    backgroundColor: '#09090d',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: 'transparent',
  },
  dayChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  dayChipActive: {
    backgroundColor: 'rgba(225,29,72,0.2)',
    borderColor: '#e11d48',
  },
  dayChipLabel: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '800',
    color: '#a1a1aa',
  },
  dayChipLabelActive: {
    color: '#fff',
  },
  dayChipSub: {
    fontSize: 9,
    color: '#71717a',
    marginTop: 1,
  },
  dayChipSubActive: {
    color: '#fda4af',
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: '#0a0a0f',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: '#e11d48',
    borderColor: '#e11d48',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#71717a',
  },
  tabTextActive: {
    color: '#fff',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sessionBanner: {
    backgroundColor: '#16161f',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(225,29,72,0.25)',
    marginBottom: 16,
  },
  bannerRow: {
    marginBottom: 6,
  },
  dayTag: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '800',
    color: '#e11d48',
    letterSpacing: 1,
    marginBottom: 2,
  },
  sessionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  sessionTips: {
    fontSize: 12,
    color: '#a1a1aa',
    lineHeight: 16,
  },
  restBanner: {
    backgroundColor: '#16161c',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  restTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginTop: 10,
    marginBottom: 4,
  },
  restSubtitle: {
    fontSize: 12,
    color: '#71717a',
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 16,
  },
  restShortcuts: {
    width: '100%',
    gap: 8,
  },
  shortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  shortcutText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  routineList: {
    gap: 14,
  },
  routineCard: {
    backgroundColor: '#16161c',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  routineHeader: {
    marginBottom: 8,
  },
  routineDayName: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#e11d48',
    letterSpacing: 1,
  },
  routineSessionName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  routineTips: {
    fontSize: 11,
    color: '#a1a1aa',
    marginBottom: 10,
  },
  routineExRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderTopWidth: 1,
    borderColor: 'transparent',
  },
  routineExName: {
    fontSize: 12,
    color: '#d4d4d8',
    fontWeight: '500',
  },
  routineExTarget: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#71717a',
  },
  vaultContainer: {
    gap: 16,
  },
  vaultCard: {
    backgroundColor: '#16161c',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.25)',
  },
  vaultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  vaultTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
  },
  vaultSubtitle: {
    fontSize: 11,
    color: '#71717a',
    marginBottom: 14,
  },
  prsList: {
    gap: 8,
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  prName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  prDate: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#71717a',
    marginTop: 2,
  },
  prBadge: {
    alignItems: 'flex-end',
  },
  prValue: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#fbbf24',
  },
  prE1rm: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#a1a1aa',
  },
  historyBox: {
    backgroundColor: '#16161c',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  historySub: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#71717a',
    lineHeight: 16,
  },
});
