// screens/Alerts.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  SafeAreaView,
  ImageBackground,
  StyleSheet,
  TextInput,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";

/* =======================
   API ENDPOINTS
   ======================= */

const USGS_URL =
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson";

const GDACS_URL =
  "https://www.gdacs.org/gdacsapi/api/events/geteventlist/events4app";

/* =======================
   REGION HELPERS
   ======================= */

const REGION_KEYWORDS = {
  Asia: [
    "japan",
    "china",
    "india",
    "indonesia",
    "philippines",
    "thailand",
    "vietnam",
    "malaysia",
    "singapore",
    "korea",
    "south korea",
    "north korea",
    "taiwan",
    "nepal",
    "pakistan",
    "bangladesh",
    "myanmar",
    "laos",
    "cambodia",
    "sri lanka",
    "mongolia",
    "fiji",
    "papua new guinea",
  ],
  US: [
    "united states",
    "usa",
    "u.s.",
    "u.s.a.",
    "california",
    "alaska",
    "hawaii",
    "nevada",
    "texas",
    "washington",
    "oregon",
    "montana",
    "idaho",
    "utah",
    "arizona",
    "new mexico",
    "oklahoma",
    "kansas",
    "colorado",
    "wyoming",
    "south carolina",
    "north carolina",
    "virginia",
    "tennessee",
    "kentucky",
    "arkansas",
    "missouri",
    "illinois",
    "indiana",
    "ohio",
    "new york",
    "florida",
    "puerto rico",
    "guam",
    "american samoa",
  ],
  Europe: [
    "united kingdom",
    "uk",
    "england",
    "scotland",
    "wales",
    "ireland",
    "france",
    "germany",
    "spain",
    "italy",
    "portugal",
    "greece",
    "turkey",
    "norway",
    "sweden",
    "finland",
    "poland",
    "ukraine",
    "romania",
    "bulgaria",
    "netherlands",
    "belgium",
    "switzerland",
    "austria",
    "iceland",
    "croatia",
    "serbia",
  ],
  Africa: [
    "africa",
    "morocco",
    "algeria",
    "tunisia",
    "libya",
    "egypt",
    "sudan",
    "ethiopia",
    "somalia",
    "kenya",
    "uganda",
    "tanzania",
    "rwanda",
    "congo",
    "ghana",
    "nigeria",
    "cameroon",
    "angola",
    "namibia",
    "botswana",
    "south africa",
    "zimbabwe",
    "mozambique",
    "madagascar",
  ],
};

function inferRegion(text) {
  const s = String(text || "").toLowerCase();

  for (const [region, keywords] of Object.entries(REGION_KEYWORDS)) {
    if (keywords.some((k) => s.includes(k))) return region;
  }

  return "Other";
}

function normalizeCountry(value) {
  return String(value || "").trim();
}

/* =======================
   UTIL
   ======================= */

function toEpoch(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : Date.now();
  if (!v) return Date.now();

  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : Date.now();
}

function toTimeLabel(v) {
  return new Date(toEpoch(v)).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function severityFromMagnitude(mag) {
  if (typeof mag !== "number") return "Medium";
  if (mag >= 7.0) return "High";
  if (mag >= 5.5) return "Medium";
  return "Low";
}

function haversineKm(lat1, lon1, lat2, lon2) {
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lon2)
  ) {
    return null;
  }

  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}

function formatDistance(distanceKm) {
  if (distanceKm == null) return "Distance unavailable";
  if (distanceKm < 1) return "< 1 km away";
  if (distanceKm < 1000) return `${Math.round(distanceKm)} km away`;
  return `${Math.round(distanceKm).toLocaleString()} km away`;
}

function localTier(distanceKm) {
  if (distanceKm == null) return "Unknown";
  if (distanceKm <= 200) return "Local";
  if (distanceKm <= 1000) return "Regional";
  return "Global";
}

function getTierColor(distanceKm) {
  const tier = localTier(distanceKm);
  if (tier === "Local") return "#72D6FF";
  if (tier === "Regional") return "#F2B84B";
  if (tier === "Global") return "#A9C1FF";
  return "#93A8C6";
}

function getFeatureCoords(feature) {
  const coords = feature?.geometry?.coordinates;

  if (!Array.isArray(coords)) {
    return { lat: null, lon: null };
  }

  if (
    coords.length >= 2 &&
    Number.isFinite(coords[0]) &&
    Number.isFinite(coords[1])
  ) {
    return { lon: coords[0], lat: coords[1] };
  }

  if (
    Array.isArray(coords[0]) &&
    coords[0].length >= 2 &&
    Number.isFinite(coords[0][0]) &&
    Number.isFinite(coords[0][1])
  ) {
    return { lon: coords[0][0], lat: coords[0][1] };
  }

  return { lat: null, lon: null };
}

/* =======================
   NETWORK
   ======================= */

async function fetchJson(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const abortTimer = setTimeout(() => controller.abort(), timeoutMs);

  const hardTimeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout ${timeoutMs}ms`)), timeoutMs + 200)
  );

  try {
    const fetchPromise = (async () => {
      const res = await fetch(url, { signal: controller.signal });
      const text = await res.text();

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
      }

      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`Non-JSON response: ${text.slice(0, 120)}`);
      }
    })();

    return await Promise.race([fetchPromise, hardTimeout]);
  } finally {
    clearTimeout(abortTimer);
  }
}

/* =======================
   UI HELPERS
   ======================= */

function SeverityPill({ severity }) {
  const color =
    severity === "High"
      ? "#F28C28"
      : severity === "Medium"
      ? "#D98E04"
      : "#5FA777";

  const bg =
    severity === "High"
      ? "rgba(242,140,40,0.14)"
      : severity === "Medium"
      ? "rgba(217,142,4,0.14)"
      : "rgba(95,167,119,0.14)";

  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: color,
        backgroundColor: bg,
      }}
    >
      <Text style={{ color, fontWeight: "800", fontSize: 12 }}>{severity}</Text>
    </View>
  );
}

function DistancePill({ distanceKm }) {
  const color = getTierColor(distanceKm);
  return (
    <View
      style={{
        marginTop: 8,
        alignSelf: "flex-start",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: color,
        backgroundColor: `${color}22`,
      }}
    >
      <Text style={{ color, fontWeight: "800", fontSize: 12 }}>
        {formatDistance(distanceKm)} · {localTier(distanceKm)}
      </Text>
    </View>
  );
}

function FilterChip({ label, active, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.filterChip,
        active ? styles.filterChipActive : styles.filterChipInactive,
      ]}
    >
      <Text
        style={[
          styles.filterChipText,
          active ? styles.filterChipTextActive : styles.filterChipTextInactive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function AlertCard({
  title,
  detail,
  severity,
  time,
  source,
  url,
  country,
  region,
  distanceKm,
}) {
  return (
    <TouchableOpacity
      activeOpacity={url ? 0.85 : 1}
      onPress={() => url && Linking.openURL(url)}
      style={styles.card}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardTime}>{time}</Text>
      </View>

      <Text style={styles.cardDetail}>{detail}</Text>

      <DistancePill distanceKm={distanceKm} />

      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.cardSource}>{source}</Text>
          <Text style={styles.cardMeta}>
            {country || "Unknown"} · {region}
          </Text>
        </View>
        <SeverityPill severity={severity} />
      </View>
    </TouchableOpacity>
  );
}

/* =======================
   MAPPERS
   ======================= */

function mapUSGS(json, userLocation) {
  const features = Array.isArray(json?.features) ? json.features : [];

  return features.map((f) => {
    const p = f?.properties ?? {};
    const place = p.place ?? "Earthquake event";
    const { lat, lon } = getFeatureCoords(f);

    let country = "Unknown";
    const m = place.match(/,\s*([^,]+)$/);
    if (m?.[1]) country = normalizeCountry(m[1]);

    const region = inferRegion(`${place} ${country}`);
    const distanceKm = userLocation
      ? haversineKm(userLocation.lat, userLocation.lon, lat, lon)
      : null;

    return {
      id: `usgs:${f?.id ?? `${p.time}:${place}`}`,
      source: "USGS",
      title: p.title ?? "Earthquake",
      detail: place,
      severity: severityFromMagnitude(p.mag),
      ts: toEpoch(p.time),
      time: toTimeLabel(p.time),
      url: p.url,
      country,
      region,
      lat,
      lon,
      distanceKm,
    };
  });
}

function mapGDACS(json, userLocation) {
  const features = Array.isArray(json?.features) ? json.features : [];

  return features.map((f, idx) => {
    const p = f?.properties ?? {};
    const ts = toEpoch(
      p.datetime ?? p.fromdate ?? p.eventdate ?? p.todate ?? Date.now()
    );

    const level = String(p.alertlevel ?? p.alertLevel ?? "").toLowerCase();
    const severity =
      level.includes("red")
        ? "High"
        : level.includes("orange")
        ? "Medium"
        : level.includes("green")
        ? "Low"
        : "Medium";

    const name = p.eventname ?? p.name ?? p.title ?? "Disaster Event";
    const country = normalizeCountry(
      p.country ?? p.iso3 ?? p.countryname ?? "Unknown"
    );
    const detail = p.description ?? (country ? `Affected: ${country}` : "GDACS event");
    const region = inferRegion(`${name} ${detail} ${country}`);

    const { lat, lon } = getFeatureCoords(f);
    const distanceKm = userLocation
      ? haversineKm(userLocation.lat, userLocation.lon, lat, lon)
      : null;

    return {
      id: `gdacs:${p.eventid ?? p.eventId ?? `${name}:${ts}:${idx}`}`,
      source: "GDACS",
      title: name,
      detail,
      severity,
      ts,
      time: toTimeLabel(ts),
      url: p.url ?? p.link ?? null,
      country,
      region,
      lat,
      lon,
      distanceKm,
    };
  });
}

/* =======================
   MAIN
   ======================= */

export default function Alerts() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState({ gdacs: 0, usgs: 0 });
  const [errors, setErrors] = useState({ gdacs: "", usgs: "" });

  const [selectedRegion, setSelectedRegion] = useState("All");
  const [countryQuery, setCountryQuery] = useState("");

  const [userLocation, setUserLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationDenied, setLocationDenied] = useState(false);

  const reqIdRef = useRef(0);

  const mergeAndSet = useCallback((partial, sourceKey, errMsg = "") => {
    setErrors((prev) => ({ ...prev, [sourceKey]: errMsg }));
    setCounts((prev) => ({ ...prev, [sourceKey]: partial.length }));

    setItems((prev) => {
      const merged = [...prev, ...partial];
      const deduped = new Map();
      merged.forEach((a) => deduped.set(a.id, a));
      return Array.from(deduped.values()).sort((a, b) => {
        const da = a.distanceKm ?? Number.MAX_SAFE_INTEGER;
        const db = b.distanceKm ?? Number.MAX_SAFE_INTEGER;
        if (da !== db) return da - db;
        return b.ts - a.ts;
      });
    });
  }, []);

  const requestLocation = useCallback(async () => {
    try {
      setLocationLoading(true);
      setLocationDenied(false);

      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setLocationDenied(true);
        setUserLocation(null);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setUserLocation({
        lat: loc.coords.latitude,
        lon: loc.coords.longitude,
      });
    } catch (e) {
      console.warn("Location error:", e);
      setUserLocation(null);
    } finally {
      setLocationLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    const myReqId = ++reqIdRef.current;

    setLoading(true);
    setItems([]);
    setCounts({ gdacs: 0, usgs: 0 });
    setErrors({ gdacs: "", usgs: "" });

    const safetyStop = setTimeout(() => {
      if (reqIdRef.current === myReqId) setLoading(false);
    }, 7500);

    const run = async (key, url, mapper, timeoutMs) => {
      try {
        const json = await fetchJson(url, timeoutMs);
        let mapped = mapper(json, userLocation);

        if (key === "gdacs") {
          const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
          mapped = mapped.filter((x) => x.ts >= cutoff);
        }

        if (reqIdRef.current !== myReqId) return;
        mergeAndSet(mapped, key, "");
      } catch (e) {
        if (reqIdRef.current !== myReqId) return;
        mergeAndSet([], key, String(e?.message ?? e));
      }
    };

    await Promise.allSettled([
      run("gdacs", GDACS_URL, mapGDACS, 5500),
      run("usgs", USGS_URL, mapUSGS, 5250),
    ]);

    clearTimeout(safetyStop);
    if (reqIdRef.current === myReqId) setLoading(false);
  }, [mergeAndSet, userLocation]);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filteredItems = useMemo(() => {
    const needle = countryQuery.trim().toLowerCase();

    return items.filter((item) => {
      const regionOk =
        selectedRegion === "All" ? true : item.region === selectedRegion;

      const countryOk = !needle
        ? true
        : `${item.country} ${item.detail} ${item.title}`
            .toLowerCase()
            .includes(needle);

      return regionOk && countryOk;
    });
  }, [items, selectedRegion, countryQuery]);

  const subtitle = useMemo(() => {
    const base = `GDACS ${counts.gdacs} • USGS ${counts.usgs} • Showing ${filteredItems.length}`;
    if (locationLoading) return `${base} • Locating...`;
    if (locationDenied) return `${base} • Distance unavailable`;
    if (userLocation) return `${base} • Nearest first`;
    return base;
  }, [counts, filteredItems.length, locationLoading, locationDenied, userLocation]);

  const anyVisibleError = errors.gdacs || errors.usgs;

  return (
    <ImageBackground
      source={require("../assets/bg_tori.jpg")}
      style={{ flex: 1 }}
      resizeMode="cover"
    >
      <LinearGradient
        colors={[
          "rgba(7,27,52,0.78)",
          "rgba(11,37,69,0.68)",
          "rgba(30,86,49,0.42)",
          "rgba(0,0,0,0.62)",
        ]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.container}>
        <View style={styles.panel}>
          <Text style={styles.title}>Alerts</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {anyVisibleError ? (
            <View style={{ marginTop: 8 }}>
              {errors.gdacs ? (
                <Text style={styles.errorText}>GDACS: {errors.gdacs}</Text>
              ) : null}
              {errors.usgs ? (
                <Text style={styles.errorText}>USGS: {errors.usgs}</Text>
              ) : null}
            </View>
          ) : null}

          <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 12 }}>
            {["All", "Asia", "US", "Europe", "Africa"].map((region) => (
              <FilterChip
                key={region}
                label={region}
                active={selectedRegion === region}
                onPress={() => setSelectedRegion(region)}
              />
            ))}
          </View>

          <TextInput
            value={countryQuery}
            onChangeText={setCountryQuery}
            placeholder="Search by country (e.g. Japan, USA, Kenya)"
            placeholderTextColor="#9DB8E8"
            style={styles.input}
          />

          <TouchableOpacity
            onPress={refresh}
            disabled={loading}
            style={[
              styles.refreshButton,
              loading ? styles.refreshButtonDisabled : null,
            ]}
          >
            {loading ? (
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <ActivityIndicator color="#fff" />
                <Text style={styles.refreshButtonText}>Refreshing…</Text>
              </View>
            ) : (
              <Text style={styles.refreshButtonText}>Refresh</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
          {filteredItems.map((a) => (
            <AlertCard key={a.id} {...a} />
          ))}

          {!loading && filteredItems.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                No alerts found for this region or country search.
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "rgba(5,15,35,0.58)",
  },
  panel: {
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(59,110,168,0.22)",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#F4F7FF",
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  subtitle: {
    marginTop: 6,
    color: "#A9C1FF",
  },
  errorText: {
    color: "#FFB4A2",
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(59,110,168,0.34)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(11,37,69,0.82)",
    color: "#F4F7FF",
    marginBottom: 8,
  },
  refreshButton: {
    marginTop: 4,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "#F28C28",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  refreshButtonDisabled: {
    backgroundColor: "#B9783A",
  },
  refreshButtonText: {
    color: "#F4F7FF",
    fontWeight: "800",
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  filterChipActive: {
    backgroundColor: "#F28C28",
    borderColor: "rgba(242,140,40,0.65)",
  },
  filterChipInactive: {
    backgroundColor: "rgba(11,37,69,0.76)",
    borderColor: "rgba(59,110,168,0.34)",
  },
  filterChipText: {
    fontWeight: "700",
  },
  filterChipTextActive: {
    color: "#F4F7FF",
  },
  filterChipTextInactive: {
    color: "#A9C1FF",
  },
  card: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    backgroundColor: "rgba(11,37,69,0.86)",
    borderWidth: 1,
    borderColor: "rgba(242,140,40,0.22)",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    flex: 1,
    marginRight: 10,
    color: "#F4F7FF",
  },
  cardTime: {
    color: "#A9C1FF",
  },
  cardDetail: {
    marginTop: 8,
    color: "#D7E5FF",
  },
  cardFooter: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardSource: {
    color: "#F28C28",
    fontWeight: "700",
  },
  cardMeta: {
    color: "#A9C1FF",
    marginTop: 2,
    fontSize: 12,
  },
  emptyCard: {
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(59,110,168,0.25)",
    borderRadius: 12,
    backgroundColor: "rgba(11,37,69,0.82)",
  },
  emptyText: {
    color: "#D7E5FF",
  },
});