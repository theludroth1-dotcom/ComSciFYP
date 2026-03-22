import React, { useEffect, useMemo, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  ImageBackground,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { PlaceDetails } from "./Explore";

const STORAGE_KEY = "itineraryPlaces";

const onlyDigits = (s = "") => s.replace(/[^\d]/g, "");
function formatTime12Input(raw) {
  const d = onlyDigits(raw).slice(0, 4);
  if (d.length <= 1) return d;
  if (d.length <= 3) return d.slice(0, 1) + ":" + d.slice(1);
  return d.slice(0, 2) + ":" + d.slice(2);
}
function isValidTime12(t = "") {
  return /^(0?[1-9]|1[0-2]):[0-5]\d$/.test(t);
}
function minutesFromTime12(time12 = "", ampm = "AM") {
  if (!isValidTime12(time12)) return Number.POSITIVE_INFINITY;
  const [hStr, mStr] = time12.split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (ampm === "AM") { if (h === 12) h = 0; } else { if (h !== 12) h += 12; }
  return h * 60 + m;
}

function normalizeWithSlots(items = []) {
  const withSlot = items.map((x) => ({ ampm: "AM", ...x }));
  const third = Math.max(1, Math.ceil(withSlot.length / 3));
  withSlot.forEach((x, i) => {
    if (!x.slot) {
      if (i < third) x.slot = "morning";
      else if (i < third * 2) x.slot = "afternoon";
      else x.slot = "evening";
    }
  });
  return withSlot;
}
async function loadAll() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return normalizeWithSlots(arr);
  } catch {
    return [];
  }
}
async function saveAll(arr) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}
function moveWithin(arr, fromIndex, toIndex) {
  const copy = arr.slice();
  const [it] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, it);
  return copy;
}

/* ---------- Section ---------- */
function Section({
  title,
  data,
  onMoveUp,
  onMoveDown,
  onMoveTo,
  onDelete,
  onEditTime,
  onInfo,
  emptyHint,
}) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={styles.sectionTitle}>
        {title} <Text style={{ color: "#A8B3C7" }}>({data.length})</Text>
      </Text>

      <View style={styles.card}>
        {data.length === 0 ? (
          <Text style={{ color: "#A8B3C7" }}>{emptyHint}</Text>
        ) : (
          <FlatList
            data={data}
            keyExtractor={(it) => it.id}
            scrollEnabled={false}
            renderItem={({ item, index }) => {
              const badTime = item.time12 && !isValidTime12(item.time12);
              return (
                <View style={styles.itemCard}>
                  <LinearGradient
                    colors={["#2e7be9", "#0b1930"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradientBg}
                  >
                    <View style={styles.topRow}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {item.title || "Untitled place"}
                        </Text>
                        {!!item.address && (
                          <Text numberOfLines={1} style={styles.rowSub}>
                            {item.address}
                          </Text>
                        )}
                      </View>

                      <View style={{ flexDirection: "row", gap: 6, marginRight: 8 }}>
                        <TouchableOpacity onPress={() => onMoveUp(index)} style={styles.iconBtn}>
                          <Ionicons name="chevron-up" size={18} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => onMoveDown(index)} style={styles.iconBtn}>
                          <Ionicons name="chevron-down" size={18} color="#fff" />
                        </TouchableOpacity>
                      </View>

                      <View style={styles.timeBox}>
                        <TextInput
                          placeholder="h:mm"
                          placeholderTextColor="#97A6B8"
                          value={item.time12 ?? ""}
                          keyboardType="number-pad"
                          inputMode="numeric"
                          onChangeText={(t) =>
                            onEditTime(item.id, { time12: formatTime12Input(t) })
                          }
                          maxLength={5}
                          style={[
                            styles.timeInput,
                            badTime && { borderColor: "tomato" },
                          ]}
                        />
                        <View style={{ flexDirection: "row", gap: 6 }}>
                          <TouchableOpacity
                            onPress={() => onEditTime(item.id, { ampm: "AM" })}
                            style={[
                              styles.ampmChip,
                              (item.ampm ?? "AM") === "AM" && styles.ampmChipActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.ampmText,
                                (item.ampm ?? "AM") === "AM" && styles.ampmTextActive,
                              ]}
                            >
                              AM
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => onEditTime(item.id, { ampm: "PM" })}
                            style={[
                              styles.ampmChip,
                              item.ampm === "PM" && styles.ampmChipActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.ampmText,
                                item.ampm === "PM" && styles.ampmTextActive,
                              ]}
                            >
                              PM
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>

                    <View style={styles.actionsRow}>
                      <TouchableOpacity onPress={() => onMoveTo(item.id, "morning")} style={styles.chip}>
                        <Text style={styles.chipText}>Move to Morning</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => onMoveTo(item.id, "afternoon")} style={styles.chip}>
                        <Text style={styles.chipText}>Move to Afternoon</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => onMoveTo(item.id, "evening")} style={styles.chip}>
                        <Text style={styles.chipText}>Move to Evening</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => onInfo(item)} style={[styles.chip, { borderColor: "#9ec1ff" }]}>
                        <Text style={[styles.chipText, { color: "#dbe6ff" }]}>Info</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => onDelete(item.id)} style={[styles.chip, { borderColor: "tomato" }]}>
                        <Text style={[styles.chipText, { color: "tomato" }]}>Delete</Text>
                      </TouchableOpacity>
                    </View>

                    {badTime && (
                      <Text style={{ color: "#ffd0d0", marginTop: 6 }}>
                        Time must be h:mm / hh:mm
                      </Text>
                    )}
                  </LinearGradient>
                </View>
              );
            }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          />
        )}
      </View>
    </View>
  );
}

/* ---------- screen ---------- */
export default function Itinerary() {
  const [all, setAll] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    (async () => setAll(await loadAll()))();
  }, []);

  const morning = useMemo(() => all.filter((x) => x.slot === "morning"), [all]);
  const afternoon = useMemo(() => all.filter((x) => x.slot === "afternoon"), [all]);
  const evening = useMemo(() => all.filter((x) => x.slot === "evening"), [all]);

  async function setSection(sorted, slot) {
    const others = all.filter((x) => x.slot !== slot);
    const next = [...others, ...sorted];
    setAll(next);
    await saveAll(next);
  }

  const sortSectionByTime = (arr) =>
    arr
      .slice()
      .sort(
        (a, b) =>
          minutesFromTime12(a.time12, a.ampm ?? "AM") -
          minutesFromTime12(b.time12, b.ampm ?? "AM")
      );

  const moveUp = (slot) => async (index) => {
    const src = slot === "morning" ? morning : slot === "afternoon" ? afternoon : evening;
    if (index <= 0) return;
    const nextArr = moveWithin(src, index, index - 1);
    await setSection(nextArr, slot);
  };

  const moveDown = (slot) => async (index) => {
    const src = slot === "morning" ? morning : slot === "afternoon" ? afternoon : evening;
    if (index >= src.length - 1) return;
    const nextArr = moveWithin(src, index, index + 1);
    await setSection(nextArr, slot);
  };

  const moveTo = async (id, toSlot) => {
    const next = all.map((x) => (x.id === id ? { ...x, slot: toSlot } : x));
    const destArr = next.filter((x) => x.slot === toSlot);
    const others = next.filter((x) => x.slot !== toSlot);
    const combined = [...others, ...sortSectionByTime(destArr)];
    setAll(combined);
    await saveAll(combined);
  };

  const remove = async (id) => {
    const next = all.filter((x) => x.id !== id);
    setAll(next);
    await saveAll(next);
  };

  const clearAll = async () => {
    Alert.alert("Clear itinerary", "Remove all saved places?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          setAll([]);
          await saveAll([]);
        },
      },
    ]);
  };

  const editTime = async (id, patch) => {
    const next = all.map((x) => (x.id === id ? { ...x, ...patch } : x));
    const sections = {
      morning: sortSectionByTime(next.filter((x) => x.slot === "morning")),
      afternoon: sortSectionByTime(next.filter((x) => x.slot === "afternoon")),
      evening: sortSectionByTime(next.filter((x) => x.slot === "evening")),
    };
    const combined = [...sections.morning, ...sections.afternoon, ...sections.evening];
    setAll(combined);
    await saveAll(combined);
  };

  const openInfo = (item) => {
    const rawId = item.id?.includes(":") ? item.id.split(":")[1] : item.id;
    setSelected({
      provider: item.provider,
      id: rawId,
      title: item.title,
      lat: item.lat,
      lon: item.lon,
    });
  };

  if (selected) {
    return <PlaceDetails item={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <ImageBackground source={require("../assets/bg_train.jpg")} style={{ flex: 1 }} resizeMode="cover">
      <LinearGradient
        colors={["rgba(0,0,0,0.45)", "rgba(0,0,0,0.8)"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <SafeAreaView style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Itinerary</Text>
          <TouchableOpacity onPress={clearAll} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>Clear all</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator contentContainerStyle={{ paddingBottom: 24 }}>
          <Section
            title="Morning"
            data={sortSectionByTime(morning)}
            onMoveUp={moveUp("morning")}
            onMoveDown={moveDown("morning")}
            onMoveTo={moveTo}
            onDelete={remove}
            onEditTime={editTime}
            onInfo={openInfo}
            emptyHint="Nothing here yet. Add places from Explore and assign them to Morning."
          />
          <Section
            title="Afternoon"
            data={sortSectionByTime(afternoon)}
            onMoveUp={moveUp("afternoon")}
            onMoveDown={moveDown("afternoon")}
            onMoveTo={moveTo}
            onDelete={remove}
            onEditTime={editTime}
            onInfo={openInfo}
            emptyHint="No afternoon plans yet."
          />
          <Section
            title="Evening / Midnight"
            data={sortSectionByTime(evening)}
            onMoveUp={moveUp("evening")}
            onMoveDown={moveDown("evening")}
            onMoveTo={moveTo}
            onDelete={remove}
            onEditTime={editTime}
            onInfo={openInfo}
            emptyHint="No evening plans yet."
          />
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

/* ---------- styles ---------- */
const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "transparent" },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  title: { fontSize: 22, fontWeight: "700", flex: 1, color: "#fff",paddingTop:30},
  clearBtn: {
    borderWidth: 1,
    borderColor: "tomato",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  clearBtnText: { color: "tomato", fontWeight: "700" },

  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 6, color: "#fff" },
  card: { backgroundColor: "transparent", borderRadius: 12 },

  itemCard: {
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  gradientBg: { padding: 12 },

  topRow: { flexDirection: "row", alignItems: "center" },

  rowTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },
  rowSub: { color: "#cfd7e3", marginTop: 2 },

  iconBtn: {
    borderWidth: 1,
    borderColor: "#c8d2e3",
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
  },

  timeBox: { alignItems: "center", gap: 6 },
  timeInput: {
    width: 70,
    borderWidth: 1,
    borderColor: "#8aa0c0",
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    textAlign: "center",
    fontWeight: "700",
    color: "#fff",
  },
  ampmChip: {
    borderWidth: 1,
    borderColor: "#8aa0c0",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  ampmChipActive: { backgroundColor: "#1f6feb", borderColor: "#1f6feb" },
  ampmText: { fontWeight: "700", color: "#cfd7e3" },
  ampmTextActive: { color: "#fff" },

  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 },
  chip: {
    borderWidth: 1,
    borderColor: "#7ea6ff",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  chipText: { fontWeight: "700", color: "#dbe6ff" },
});
