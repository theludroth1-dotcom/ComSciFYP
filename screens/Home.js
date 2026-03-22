import React, { useEffect, useMemo, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  ImageBackground,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import CONFIG from "../config";

/* ============ OpenWeather ============ */
async function getWeatherByCoords(lat, lon) {
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${CONFIG.OWM_KEY}`;
  const r = await fetch(url);
  const j = await r.json();
  if (!r.ok) throw new Error(j?.message || `Weather ${r.status}`);
  return j;
}
function weatherGlyph(w) {
  const id = w?.weather?.[0]?.id || 800;
  if (id >= 200 && id < 300) return "⛈️";
  if (id >= 300 && id < 600) return "🌧️";
  if (id >= 600 && id < 700) return "❄️";
  if (id === 800) return "☀️";
  if (id > 800) return "☁️";
  return "🌤️";
}

/* ============ Time ============ */
function getPeriod(now = new Date()) {
  const h = now.getHours();
  if (h < 12) return "Morning";
  if (h < 18) return "Afternoon";
  return "Evening";
}
function isValidTime12(t = "") {
  return /^(0?[1-9]|1[0-2]):[0-5]\d$/.test(t);
}
function minutesFromTime12(time12 = "", ampm = "AM") {
  if (!isValidTime12(time12)) return Number.POSITIVE_INFINITY;
  const [hStr, mStr] = time12.split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (ampm === "AM") {
    if (h === 12) h = 0;
  } else {
    if (h !== 12) h += 12;
  }
  return h * 60 + m;
}

/* ============ Home Screen ============ */
export default function Home() {
  const [places, setPlaces] = useState([]);
  const [now, setNow] = useState(new Date());
  const [wx, setWx] = useState(null);
  const [wErr, setWErr] = useState("");
  const period = getPeriod(now);

  // Load itinerary places
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("itineraryPlaces");
        setPlaces(raw ? JSON.parse(raw) : []);
      } catch {
        setPlaces([]);
      }
    })();
  }, []);

  //refresh the clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  // Weather
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        setWErr("");
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setWErr("Location permission denied");
          return;
        }
        const loc = await Location.getCurrentPositionAsync({});
        const d = await getWeatherByCoords(loc.coords.latitude, loc.coords.longitude);
        if (live) setWx(d);
      } catch (e) {
        setWErr(String(e?.message || e));
      }
    })();
    return () => { live = false; };
  }, []);

  // Bucket by saved slot
  const buckets = useMemo(() => {
    if (!places?.length) return { Morning: [], Afternoon: [], Evening: [] };

    const hasSlots = places.some(p => p.slot);
    if (hasSlots) {
      const sortByTime = (arr) =>
        arr
          .slice()
          .sort(
            (a, b) =>
              minutesFromTime12(a.time12, a.ampm ?? "AM") -
              minutesFromTime12(b.time12, b.ampm ?? "AM")
          );

      return {
        Morning: sortByTime(places.filter(p => p.slot === "morning")),
        Afternoon: sortByTime(places.filter(p => p.slot === "afternoon")),
        Evening: sortByTime(places.filter(p => p.slot === "evening")),
      };
    }

    const third = Math.max(1, Math.ceil(places.length / 3));
    return {
      Morning: places.slice(0, third),
      Afternoon: places.slice(third, third * 2),
      Evening: places.slice(third * 2),
    };
  }, [places]);

  const todayList = buckets[period] || [];

  return (
    <ImageBackground
      source={require("../assets/bg_dawn.jpg")}
      style={{ flex: 1 }}
      resizeMode="cover"
    >
      <LinearGradient
        colors={["rgba(10,15,30,0.85)", "rgba(25,30,45,0.75)", "rgba(255,179,71,0.12)"]}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.container}>
        <View style={styles.headerRow}>
          <Ionicons name="partly-sunny-outline" size={26} color="#ffb347" />
          <Text style={styles.welcome}>Welcome</Text>
        </View>

        <View style={{ marginBottom: 8 }}>
          <Text style={styles.sectionTitle}>Today's itinerary</Text>
          <Text style={styles.sectionSub}>{period} itinerary</Text>
        </View>

        <View style={styles.card}>
          {todayList.length === 0 ? (
            <Text style={styles.emptyText}>
              No items for {period.toLowerCase()} yet. Add places from Explore → “Add to Itinerary”.
            </Text>
          ) : (
            <FlatList
              data={todayList}
              keyExtractor={(it) => it.id}
              renderItem={({ item, index }) => (
                <View style={styles.row}>
                  <Text style={styles.rowTitle}>
                    {index + 1}. {item.title || "Untitled place"}
                  </Text>
                  {!!item.address && (
                    <Text numberOfLines={1} style={styles.rowSub}>
                      {item.address}
                    </Text>
                  )}
                </View>
              )}
            />
          )}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Weather</Text>
        <View style={[styles.card, { borderColor: "#ffb34733" }]}>
          {!wx && !wErr && <ActivityIndicator color="#ffb347" />}
          {wErr ? <Text style={styles.errorText}>Weather error: {wErr}</Text> : null}
          {wx && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={{ fontSize: 28 }}>{weatherGlyph(wx)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>
                  {wx.name} — {Math.round(wx.main.temp)}°C
                </Text>
                <Text style={styles.rowSub}>
                  {wx.weather?.[0]?.description ?? "—"} · Feels {Math.round(wx.main.feels_like)}°C
                </Text>
              </View>
            </View>
          )}
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

/* ---------- styles ---------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "rgba(10,15,30,0.6)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  welcome: {
    fontSize: 28,
    fontWeight: "800",
    color: "#f5f5f5",
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    paddingTop:30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffb347", 
  },
  sectionSub: {
    color: "#b0c4de", 
    marginTop: 2,
  },
  emptyText: {
    color: "#b0c4de",
  },
  errorText: {
    color: "tomato",
  },
  card: {
    backgroundColor: "rgba(25,30,45,0.92)",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#2f3a56",
    minHeight: 120,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  row: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#3c4a63",
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#f5f5f5",
  },
  rowSub: {
    color: "#b0c4de",
    marginTop: 2,
  },
});
