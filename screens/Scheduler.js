import React, { useEffect, useMemo, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ImageBackground,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";

const STORAGE_KEY = "reminders"; 

function onlyDigits(s = "") {
  return s.replace(/[^\d]/g, "");
}
function formatTime12Input(raw) {
  const d = onlyDigits(raw).slice(0, 4);
  if (d.length <= 1) return d;
  if (d.length <= 3) return d.slice(0, 1) + ":" + d.slice(1);
  return d.slice(0, 2) + ":" + d.slice(2);
}
function isValidTime12(t = "") {
  return /^(0?[1-9]|1[0-2]):[0-5]\d$/.test(t);
}
function isValidDate(d = "") {
  if (!/^\d{2}-\d{2}-\d{4}$/.test(d)) return false;
  const [DD, MM, YYYY] = d.split("-").map((x) => parseInt(x, 10));
  if (MM < 1 || MM > 12 || DD < 1 || DD > 31) return false;
  const js = new Date(YYYY, MM - 1, DD);
  return js.getFullYear() === YYYY && js.getMonth() === MM - 1 && js.getDate() === DD;
}
function toTimestamp(dateStr, time12, ampm) {
  const [DD, MM, YYYY] = dateStr.split("-").map((x) => parseInt(x, 10));
  const [hStr, mStr] = time12.split(":");
  let hour = parseInt(hStr, 10);
  const minute = parseInt(mStr, 10);
  if (ampm === "AM") { if (hour === 12) hour = 0; } else { if (hour !== 12) hour += 12; }
  return new Date(YYYY, MM - 1, DD, hour, minute, 0, 0).getTime();
}
function displayTime12(ts) {
  const d = new Date(ts);
  let hour = d.getHours();
  const mins = d.getMinutes();
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12; if (hour === 0) hour = 12;
  const mm = mins.toString().padStart(2, "0");
  return `${hour}:${mm} ${ampm}`;
}

/* ---------- UI ---------- */
export default function Scheduler() {
  const [title, setTitle] = useState("");
  const [time12, setTime12] = useState("");
  const [ampm, setAmpm] = useState("AM");
  const [date, setDate] = useState("");
  const [list, setList] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        setList(raw ? JSON.parse(raw) : []);
      } catch (e) {
        console.warn("Load reminders error:", e);
      }
    })();
  }, []);

  async function save(next) {
    setList(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn("Save reminders error:", e);
    }
  }

  async function addItem() {
    if (!title.trim()) return Alert.alert("Missing", "Please enter a reminder title.");
    if (!isValidTime12(time12)) return Alert.alert("Invalid time", "Use h:mm or hh:mm with AM/PM.");
    if (!isValidDate(date)) return Alert.alert("Invalid date", "Use DD-MM-YYYY.");

    const ts = toTimestamp(date, time12, ampm);
    const item = { id: Date.now().toString(), title: title.trim(), time12, ampm, dateStr: date, ts, done: false };
    const next = [item, ...list].sort((a, b) => a.ts - b.ts);
    await save(next);
    setTitle(""); setTime12(""); setDate(""); setAmpm("AM");
  }

  async function toggleDone(id) {
    const next = list.map((x) => (x.id === id ? { ...x, done: !x.done } : x));
    await save(next);
  }
  async function remove(id) {
    const next = list.filter((x) => x.id !== id);
    await save(next);
  }

  const empty = useMemo(
    () => list.length === 0 && <Text style={{ color: "#a8b3c7", marginTop: 12 }}>No reminders yet.</Text>,
    [list.length]
  );

  return (
    <ImageBackground source={require("../assets/bg_night_river.jpg")} style={{ flex: 1 }} resizeMode="cover">
      <LinearGradient
        colors={["rgba(2,10,25,0.55)", "rgba(0,0,0,0.9)"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Scheduler</Text>

        <TextInput
          placeholder="Reminder"
          placeholderTextColor="#7f93ac"
          value={title}
          onChangeText={setTitle}
          style={styles.input}
          autoCapitalize="sentences"
        />

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <TextInput
            placeholder="time (h:mm)"
            placeholderTextColor="#7f93ac"
            value={time12}
            keyboardType="number-pad"
            inputMode="numeric"
            onChangeText={(t) => setTime12(formatTime12Input(t))}
            maxLength={5}
            style={[styles.input, { flex: 1 }]}
          />
          <View style={{ flexDirection: "row", gap: 6 }}>
            <TouchableOpacity
              onPress={() => setAmpm("AM")}
              style={[styles.ampmChip, ampm === "AM" && styles.ampmChipActive]}
            >
              <Text style={[styles.ampmText, ampm === "AM" && styles.ampmTextActive]}>AM</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setAmpm("PM")}
              style={[styles.ampmChip, ampm === "PM" && styles.ampmChipActive]}
            >
              <Text style={[styles.ampmText, ampm === "PM" && styles.ampmTextActive]}>PM</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            placeholder="date (DD-MM-YYYY)"
            placeholderTextColor="#7f93ac"
            value={date}
            keyboardType="number-pad"
            inputMode="numeric"
            onChangeText={(t) => {
              const d = onlyDigits(t).slice(0, 8);
              if (d.length <= 2) setDate(d);
              else if (d.length <= 4) setDate(d.slice(0, 2) + "-" + d.slice(2));
              else setDate(d.slice(0, 2) + "-" + d.slice(2, 4) + "-" + d.slice(4));
            }}
            maxLength={10}
            style={[styles.input, { flex: 1 }]}
          />
        </View>

        {/* Neon gradient primary button */}
        <TouchableOpacity onPress={addItem} activeOpacity={0.9} style={styles.primaryBtnWrap}>
          <LinearGradient
            colors={["#00d4ff", "#7a37ff"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>Add</Text>
          </LinearGradient>
        </TouchableOpacity>

        <FlatList
          data={list}
          keyExtractor={(it) => it.id}
          ListEmptyComponent={empty}
          renderItem={({ item }) => (
            <View style={styles.rowCard}>
              <LinearGradient
                colors={["#0b3b5a", "#3b0f4a"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.rowGrad}
              >
                <TouchableOpacity onPress={() => toggleDone(item.id)} style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, item.done && styles.done]}>{item.title}</Text>
                  <Text style={styles.rowSub}>
                    {displayTime12(item.ts)} | {item.dateStr}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => remove(item.id)} style={styles.deleteBtn}>
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          )}
        />
      </SafeAreaView>
    </ImageBackground>
  );
}

/* ---------- styles ---------- */
const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "transparent" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 12, color: "#eaf2ff",paddingTop:30,},

  input: {
    borderWidth: 1,
    borderColor: "#3a5778",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(0,0,0,0.45)",
    color: "#eaf2ff",
  },

  primaryBtnWrap: { alignSelf: "flex-start", marginBottom: 8, borderRadius: 10, overflow: "hidden" },
  primaryBtn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10 },
  primaryBtnText: { color: "#fff", fontWeight: "800", letterSpacing: 0.3 },

  rowCard: {
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  rowGrad: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowTitle: { fontSize: 16, fontWeight: "700", color: "#ffffff" },
  rowSub: { color: "#c4d0e0", marginTop: 2 },
  done: { textDecorationLine: "line-through", opacity: 0.65 },

  deleteBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "tomato",
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  deleteText: { fontWeight: "700", color: "tomato" },

  ampmChip: {
    borderWidth: 1,
    borderColor: "#3a5778",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  ampmChipActive: { backgroundColor: "#1a5fff", borderColor: "#1a5fff" },
  ampmText: { fontWeight: "700", color: "#cbd6e4" },
  ampmTextActive: { color: "#fff" },
});
