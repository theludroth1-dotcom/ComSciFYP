import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Image,
  ScrollView,
  ImageBackground,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import CONFIG from "../config";

/* =========================
   Providers (OpenTripMap + Google Places New)
   ========================= */
const OTM_BASE = "https://api.opentripmap.com/0.1";

async function otmGeoname(name) {
  const url = `${OTM_BASE}/en/places/geoname?name=${encodeURIComponent(
    name
  )}&apikey=${CONFIG.OTM_KEY}`;
  const r = await fetch(url);
  const j = await r.json();
  if (!r.ok || j?.status !== "OK") throw new Error("City not found");
  return { lat: j.lat, lon: j.lon, name: j.name, country: j.country };
}

async function otmRadius({
  lat,
  lon,
  radius = 5000,
  limit = 50,
  offset = 0,
}) {
  const safeRadius = Math.max(100, parseInt(radius, 10) || 2000);

  const params = new URLSearchParams({
    apikey: CONFIG.OTM_KEY,
    lat: String(lat),
    lon: String(lon),
    radius: String(safeRadius),
    limit: String(limit),
    offset: String(offset),
    format: "json",
    rate: "2",
  });

  const url = `${OTM_BASE}/en/places/radius?${params.toString()}`;
  console.log("OTM URL:", url);

  const r = await fetch(url);
  const text = await r.text();

  if (!r.ok) {
    throw new Error(`OTM radius ${r.status}: ${text}`);
  }

  let j;
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error(`OTM radius non-JSON response: ${text}`);
  }

  return Array.isArray(j) ? j : [];
}

async function otmDetails(xid) {
  const url = `${OTM_BASE}/en/places/xid/${encodeURIComponent(
    xid
  )}?apikey=${CONFIG.OTM_KEY}`;
  const r = await fetch(url);
  const j = await r.json();
  if (!r.ok) throw new Error(`OTM details ${r.status}`);
  return j;
}

function hasGPlaces() {
  return !!(
    CONFIG.GOOGLE_PLACES_KEY &&
    CONFIG.GOOGLE_PLACES_KEY !== "YOUR_GOOGLE_PLACES_API_KEY"
  );
}

/* =========================
   Google Places API (New)
   ========================= */
async function gPlacesTextSearch({ query, lat, lon, radius = 5000 }) {
  if (!hasGPlaces()) return [];

  const safeRadius = Math.max(100, parseInt(radius, 10) || 2000);
  const url = "https://places.googleapis.com/v1/places:searchText";

  const body = {
    textQuery: query.trim(),
    pageSize: 20,
  };

  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    body.locationBias = {
      circle: {
        center: {
          latitude: lat,
          longitude: lon,
        },
        radius: safeRadius,
      },
    };
  }

  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": CONFIG.GOOGLE_PLACES_KEY,
      "X-Goog-FieldMask": [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.location",
        "places.types",
        "places.googleMapsUri",
        "places.photos",
      ].join(","),
    },
    body: JSON.stringify(body),
  });

  let j;
  try {
    j = await r.json();
  } catch (e) {
    throw new Error(`Google Places (New): non-JSON response (HTTP ${r.status})`);
  }

  if (!r.ok) {
    const msg = j?.error?.message || `HTTP ${r.status}`;
    throw new Error(`Google Places (New): ${msg}`);
  }

  return Array.isArray(j?.places) ? j.places : [];
}

async function gPlacesDetails(placeId) {
  if (!hasGPlaces()) throw new Error("No Google Places key set");

  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(
    placeId
  )}`;

  const r = await fetch(url, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": CONFIG.GOOGLE_PLACES_KEY,
      "X-Goog-FieldMask": [
        "id",
        "displayName",
        "formattedAddress",
        "location",
        "googleMapsUri",
        "regularOpeningHours",
        "editorialSummary",
        "photos",
        "websiteUri",
      ].join(","),
    },
  });

  let j;
  try {
    j = await r.json();
  } catch (e) {
    throw new Error(
      `Google Place Details (New): non-JSON response (HTTP ${r.status})`
    );
  }

  if (!r.ok) {
    const msg = j?.error?.message || `HTTP ${r.status}`;
    throw new Error(`Google Place Details (New): ${msg}`);
  }

  return j || {};
}

function gPhotoUrl(photoName, maxWidth = 800) {
  return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${CONFIG.GOOGLE_PLACES_KEY}`;
}

/* =========================
   Normalizers + merge
   ========================= */
function toMeters(lat1, lon1, lat2, lon2) {
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return Infinity;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function normalizeOTM(item) {
  return {
    id: item?.xid,
    provider: "otm",
    name: item?.name || "",
    types: (item?.kinds || "").split(","),
    lat: item?.point?.lat,
    lon: item?.point?.lon,
    raw: item,
  };
}

function normalizeG(result) {
  return {
    id: result?.id,
    provider: "g",
    name: result?.displayName?.text || "",
    types: Array.isArray(result?.types) ? result.types : [],
    lat: result?.location?.latitude,
    lon: result?.location?.longitude,
    raw: result,
  };
}

function matchesOTMFilter(item, filters) {
  const kindsText = ((item?.raw?.kinds || item?.raw?.kind || "") + "").toLowerCase();
  const nameText = (item?.name || "").toLowerCase();

  const wantsFood = filters.food;
  const wantsTrain = filters.train;
  const wantsLibraries = filters.libraries;

  if (!wantsFood && !wantsTrain && !wantsLibraries) return true;

  const isFood =
    kindsText.includes("foods") ||
    kindsText.includes("catering") ||
    kindsText.includes("restaurants") ||
    kindsText.includes("fast_food") ||
    kindsText.includes("cafe") ||
    nameText.includes("restaurant") ||
    nameText.includes("ramen") ||
    nameText.includes("izakaya");

  const isTrain =
    kindsText.includes("railway") ||
    kindsText.includes("station") ||
    kindsText.includes("transport");

  const isLibrary =
    kindsText.includes("library") ||
    kindsText.includes("libraries");

  return (
    (wantsFood && isFood) ||
    (wantsTrain && isTrain) ||
    (wantsLibraries && isLibrary)
  );
}

function mergeResults(a = [], b = [], nearLat, nearLon) {
  const out = [];
  const push = (x) => {
    if (!x?.name) return;
    for (const y of out) {
      if (y.name.toLowerCase() === x.name.toLowerCase()) {
        const d = toMeters(x.lat, x.lon, y.lat, y.lon);
        if (d < 120) return;
      }
    }
    out.push(x);
  };
  a.forEach(push);
  b.forEach(push);

  if (Number.isFinite(nearLat) && Number.isFinite(nearLon)) {
    out.sort(
      (x, y) =>
        toMeters(nearLat, nearLon, x.lat, x.lon) -
        toMeters(nearLat, nearLon, y.lat, y.lon)
    );
  }

  return out;
}

/* =========================
   Explore list (home)
   ========================= */
function ExploreHome({ onOpen }) {
  const [provider, setProvider] = useState(
    hasGPlaces() ? "Both" : "OpenTripMap"
  );
  const [city, setCity] = useState("");
  const [keyword, setKeyword] = useState("");
  const [filters, setFilters] = useState({
    food: true,
    train: true,
    libraries: true,
  });
  const [center, setCenter] = useState(null);
  const [radius, setRadius] = useState("6000");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const selectedLabels = useMemo(() => {
    const k = [];
    if (filters.food) k.push("food");
    if (filters.train) k.push("train");
    if (filters.libraries) k.push("library");
    return k;
  }, [filters]);

  const toggle = (k) => setFilters((f) => ({ ...f, [k]: !f[k] }));

  const ensureCenter = useCallback(async () => {
    if (center) return center;

    const cityName = city.trim();
    if (!cityName) throw new Error("Enter a city");

    if (provider === "Google") {
      const c = await gGeocodeCity(cityName);
      setCenter(c);
      return c;
    }

    if (provider === "Both") {
      try {
        const c = await gGeocodeCity(cityName);
        setCenter(c);
        return c;
      } catch {
        const g = await otmGeoname(cityName);
        const c = { lat: g.lat, lon: g.lon };
        setCenter(c);
        return c;
      }
    }

    const g = await otmGeoname(cityName);
    const c = { lat: g.lat, lon: g.lon };
    setCenter(c);
    return c;
  }, [center, city, provider]);

  const runSearch = useCallback(async () => {
    if (!city.trim()) {
      Alert.alert("Enter a city");
      return;
    }

    if (!selectedLabels.length) {
      Alert.alert("Select at least one filter");
      return;
    }

    setLoading(true);
    try {
      const c = await ensureCenter();
      const nearLat = c.lat;
      const nearLon = c.lon;
      const safeRadius = Math.max(100, parseInt(radius, 10) || 2000);

      const tasks = [];

      if (provider === "Google" || provider === "Both") {
        const parts = [];
        if (filters.food) parts.push("restaurant");
        if (filters.train) parts.push("train station");
        if (filters.libraries) parts.push("library");

        const q = keyword.trim()
          ? `${keyword.trim()} in ${city}`
          : parts.length
          ? `${parts.join(", ")} in ${city}`
          : `points of interest in ${city}`;

        tasks.push(
          gPlacesTextSearch({
            query: q,
            lat: nearLat,
            lon: nearLon,
            radius: safeRadius,
          }).then((arr) => arr.map(normalizeG))
        );
      } else {
        tasks.push(Promise.resolve([]));
      }

      if (provider === "OpenTripMap" || provider === "Both") {
        tasks.push(
          otmRadius({
            lat: nearLat,
            lon: nearLon,
            radius: safeRadius,
          }).then((arr) =>
            arr.map(normalizeOTM).filter((x) => matchesOTMFilter(x, filters))
          )
        );
      } else {
        tasks.push(Promise.resolve([]));
      }

      const [gRes, oRes] = await Promise.all(tasks);
      const merged = mergeResults(gRes, oRes, nearLat, nearLon);

      const needle = keyword.trim().toLowerCase();
      const refined = needle
        ? merged.filter(
            (x) =>
              x.name.toLowerCase().includes(needle) ||
              x.types.join(",").toLowerCase().includes(needle)
          )
        : merged;

      setResults(refined);
    } catch (e) {
      Alert.alert("Explore error", String(e?.message || e));
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [city, ensureCenter, filters, keyword, provider, radius, selectedLabels]);

  useEffect(() => {
    if (searched) runSearch();
  }, [provider, filters, searched, runSearch]);

  const triggerSearch = () => {
    setSearched(true);
    runSearch();
  };

  const ProviderChip = ({ label, val }) => (
    <TouchableOpacity
      onPress={() => setProvider(val)}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
        backgroundColor:
          provider === val ? "#2c7a7b" : "rgba(255,255,255,0.65)",
        borderWidth: 1,
        borderColor: provider === val ? "#1f6feb" : "#b7d0e8",
        marginRight: 8,
        marginBottom: 6,
      }}
    >
      <Text
        style={{
          color: provider === val ? "#fff" : "#0b2545",
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const FilterChip = ({ label, keyName }) => (
    <TouchableOpacity
      onPress={() => toggle(keyName)}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
        backgroundColor: filters[keyName]
          ? "#2c7a7b"
          : "rgba(255,255,255,0.65)",
        borderWidth: 1,
        borderColor: filters[keyName] ? "#1f6feb" : "#b7d0e8",
        marginRight: 8,
        marginBottom: 6,
      }}
    >
      <Text
        style={{
          color: filters[keyName] ? "#fff" : "#0b2545",
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <ImageBackground
      source={require("../assets/bg_day_park.jpg")}
      style={{ flex: 1 }}
      resizeMode="cover"
    >
      <LinearGradient
        colors={[
          "rgba(120,180,255,0.35)",
          "rgba(255,255,255,0.0)",
          "rgba(120,200,150,0.25)",
        ]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Explore</Text>

        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 8 }}>
          <ProviderChip label="OpenTripMap" val="OpenTripMap" />
          {hasGPlaces() && <ProviderChip label="Google Places" val="Google" />}
          {hasGPlaces() && <ProviderChip label="Both" val="Both" />}
        </View>

        <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
          <TextInput
            placeholder="City (e.g., Tokyo)"
            placeholderTextColor="#5b6e84"
            value={city}
            onChangeText={(t) => {
              setCity(t);
              setCenter(null);
            }}
            style={styles.input}
            autoCapitalize="words"
            returnKeyType="search"
            onSubmitEditing={triggerSearch}
          />
          <TextInput
            placeholder="Keyword (e.g., izakaya, ramen)"
            placeholderTextColor="#5b6e84"
            value={keyword}
            onChangeText={setKeyword}
            style={styles.input}
            returnKeyType="search"
            onSubmitEditing={triggerSearch}
          />
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 8 }}>
          <FilterChip label="Food" keyName="food" />
          <FilterChip label="Train stations" keyName="train" />
          <FilterChip label="Libraries" keyName="libraries" />
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <Text style={{ color: "#0b2545" }}>Radius (m):</Text>
          <TextInput
            value={radius}
            onChangeText={setRadius}
            keyboardType="number-pad"
            style={[styles.input, { width: 120 }]}
            placeholderTextColor="#5b6e84"
            placeholder="6000"
          />
          <TouchableOpacity
            style={styles.searchBtn}
            onPress={triggerSearch}
            disabled={loading}
          >
            <Ionicons name="search" size={20} color="#0b2545" />
          </TouchableOpacity>
        </View>

        {loading && <Text style={{ color: "#0b2545" }}>Loading…</Text>}

        <FlatList
          data={results}
          keyExtractor={(it, idx) => String(it?.provider) + ":" + (it?.id || idx)}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.resultRow}
              onPress={() =>
                onOpen({
                  provider: item.provider,
                  id: item.id,
                  title: item.name,
                  lat: item.lat,
                  lon: item.lon,
                })
              }
            >
              <Text style={styles.resultTitle}>{item.name || "Unnamed"}</Text>
              <Text style={styles.resultSub}>
                {(item.types || []).slice(0, 4).join(", ") || "—"}{" "}
                <Text style={{ color: "#1f6feb" }}>
                  · {item.provider === "g" ? "Google" : "OTM"}
                </Text>
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            !loading ? (
              <Text style={{ color: "#0b2545", marginTop: 12 }}>
                Nothing found. Try another keyword or provider.
              </Text>
            ) : null
          }
        />
      </SafeAreaView>
    </ImageBackground>
  );
}

/* =========================
   Place details
   ========================= */
export function PlaceDetails({ item, onBack }) {
  const { provider, id, title, lat: navLat, lon: navLon } = item || {};
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");
        if (provider === "g") {
          const d = await gPlacesDetails(id);
          setData({ provider, ...d });
        } else {
          const d = await otmDetails(id);
          setData({ provider, ...d });
        }
      } catch (e) {
        setErr(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, [provider, id]);

  const coords =
    provider === "g"
      ? {
          lat: data?.location?.latitude ?? navLat,
          lon: data?.location?.longitude ?? navLon,
        }
      : {
          lat: data?.point?.lat ?? navLat,
          lon: data?.point?.lon ?? navLon,
        };

  const address =
    provider === "g"
      ? data?.formattedAddress || ""
      : [
          data?.address?.road,
          data?.address?.house_number,
          data?.address?.suburb,
          data?.address?.city ||
            data?.address?.town ||
            data?.address?.village,
          data?.address?.state,
          data?.address?.country,
        ]
          .filter(Boolean)
          .join(", ");

  const mapsUrl =
    provider === "g" && data?.googleMapsUri
      ? data.googleMapsUri
      : coords.lat && coords.lon
      ? `https://www.google.com/maps?q=${coords.lat},${coords.lon}`
      : undefined;

  async function addToItinerary() {
    try {
      const raw = await AsyncStorage.getItem("itineraryPlaces");
      const arr = raw ? JSON.parse(raw) : [];
      const one = {
        id: `${provider}:${id}`,
        title: title || data?.displayName?.text || data?.name || "Untitled",
        address,
        lat: coords.lat,
        lon: coords.lon,
        provider,
        url: mapsUrl,
        added_at: Date.now(),
      };
      const exists = arr.some((x) => x.id === one.id);
      const next = exists ? arr : [one, ...arr];
      await AsyncStorage.setItem("itineraryPlaces", JSON.stringify(next));
      Alert.alert("Added", "Saved to your itinerary.");
    } catch (e) {
      Alert.alert("Save error", String(e?.message || e));
    }
  }

  const gPhotos = provider === "g" ? data?.photos || [] : [];
  const hasPhotos = hasGPlaces() && gPhotos.length > 0;

  const renderGoogle = (d) => (
    <View style={styles.card}>
      {hasPhotos ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 10 }}
          contentContainerStyle={{ gap: 8 }}
        >
          {gPhotos.slice(0, 10).map((p, i) => (
            <Image
              key={p.name || i}
              source={{ uri: gPhotoUrl(p.name, 800) }}
              style={{
                width: 260,
                height: 170,
                borderRadius: 12,
                backgroundColor: "#eee",
              }}
              resizeMode="cover"
            />
          ))}
        </ScrollView>
      ) : null}

      {d?.formattedAddress ? (
        <>
          <Text style={styles.resultTitle}>Address</Text>
          <Text style={styles.resultSub}>{d.formattedAddress}</Text>
        </>
      ) : null}

      {d?.regularOpeningHours?.weekdayDescriptions?.length ? (
        <>
          <Text style={[styles.resultTitle, { marginTop: 12 }]}>Hours</Text>
          {d.regularOpeningHours.weekdayDescriptions.map((t, i) => (
            <Text key={i} style={styles.resultSub}>
              {t}
            </Text>
          ))}
        </>
      ) : null}

      {d?.editorialSummary?.text ? (
        <>
          <Text style={[styles.resultTitle, { marginTop: 12 }]}>About</Text>
          <Text style={styles.resultSub}>{d.editorialSummary.text}</Text>
        </>
      ) : null}

      {d?.websiteUri ? (
        <>
          <Text style={[styles.resultTitle, { marginTop: 12 }]}>Website</Text>
          <Text
            style={[
              styles.resultSub,
              { color: "#1f6feb", textDecorationLine: "underline" },
            ]}
          >
            {d.websiteUri}
          </Text>
        </>
      ) : null}

      {mapsUrl ? (
        <>
          <Text style={[styles.resultTitle, { marginTop: 12 }]}>Maps</Text>
          <Text
            style={[
              styles.resultSub,
              { color: "#1f6feb", textDecorationLine: "underline" },
            ]}
          >
            {mapsUrl}
          </Text>
        </>
      ) : null}
    </View>
  );

  const renderOTM = (d) => (
    <View style={styles.card}>
      {d?.preview?.source ? (
        <Image
          source={{ uri: d.preview.source }}
          style={{
            width: "100%",
            height: 200,
            borderRadius: 12,
            marginBottom: 12,
          }}
          resizeMode="cover"
        />
      ) : null}

      {address ? (
        <>
          <Text style={styles.resultTitle}>Address</Text>
          <Text style={styles.resultSub}>{address}</Text>
        </>
      ) : null}

      {d?.wikipedia_extracts?.text ? (
        <>
          <Text style={[styles.resultTitle, { marginTop: 12 }]}>About</Text>
          <Text style={styles.resultSub}>{d.wikipedia_extracts.text}</Text>
        </>
      ) : d?.info?.descr ? (
        <>
          <Text style={[styles.resultTitle, { marginTop: 12 }]}>About</Text>
          <Text style={styles.resultSub}>{d.info.descr}</Text>
        </>
      ) : null}

      {mapsUrl ? (
        <>
          <Text style={[styles.resultTitle, { marginTop: 12 }]}>Maps</Text>
          <Text
            style={[
              styles.resultSub,
              { color: "#1f6feb", textDecorationLine: "underline" },
            ]}
          >
            {mapsUrl}
          </Text>
        </>
      ) : null}
    </View>
  );

  return (
    <ImageBackground
      source={require("../assets/bg_city_shop.jpg")}
      style={{ flex: 1 }}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.container}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <TouchableOpacity onPress={onBack} style={{ padding: 6, marginRight: 6 }}>
            <Ionicons name="chevron-back" size={22} color="#111" />
          </TouchableOpacity>
          <Text
            style={[styles.title, { marginBottom: 0, flex: 1 }]}
            numberOfLines={1}
          >
            {item?.title || "Details"}
          </Text>
        </View>

        {loading && <Text>Loading…</Text>}
        {err ? <Text style={{ color: "tomato" }}>{err}</Text> : null}

        <TouchableOpacity style={styles.primaryBtn} onPress={addToItinerary}>
          <Text style={styles.primaryBtnText}>Add to Itinerary</Text>
        </TouchableOpacity>

        {data && (
          <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
            {data.provider === "g" ? renderGoogle(data) : renderOTM(data)}
          </ScrollView>
        )}
      </SafeAreaView>
    </ImageBackground>
  );
}

export default function Explore() {
  const [selected, setSelected] = useState(null);

  if (selected) {
    return <PlaceDetails item={selected} onBack={() => setSelected(null)} />;
  }

  return <ExploreHome onOpen={setSelected} />;
}

/* ---------- styles ---------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.75)",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 12,
    color: "#0d1b2a",
    paddingTop: 30,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    backgroundColor: "#fff",
  },
  searchBtn: {
    backgroundColor: "#1f6feb",
    padding: 10,
    borderRadius: 8,
    marginLeft: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: "rgba(245,247,251,0.9)",
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e6e9f2",
  },
  resultRow: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#d0dce8",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  resultCard: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#d0dce8",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0d1b2a",
  },
  resultSub: {
    color: "#333",
    marginTop: 2,
  },
  primaryBtn: {
    backgroundColor: "#1f6feb",
    padding: 12,
    borderRadius: 10,
    alignSelf: "stretch",
    alignItems: "center",
    marginBottom: 12,
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "700",
  },
});