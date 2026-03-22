import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  SafeAreaView,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const DEFAULT_CHECKLIST = [
  {
    id: "water",
    label: "Store drinking water (at least 3 days)",
    icon: "💧",
    color: "#72D6FF",
    done: false,
  },
  {
    id: "food",
    label: "Non-perishable food supply",
    icon: "🍱",
    color: "#F2B84B",
    done: false,
  },
  {
    id: "firstaid",
    label: "First-aid kit",
    icon: "⛑",
    color: "#E57373",
    done: false,
  },
  {
    id: "power",
    label: "Power bank / spare batteries",
    icon: "🔋",
    color: "#B39DDB",
    done: false,
  },
  {
    id: "light",
    label: "Torch / headlamp",
    icon: "🔦",
    color: "#FFD866",
    done: false,
  },
  {
    id: "docs",
    label: "Copies of important documents",
    icon: "📄",
    color: "#8AB4F8",
    done: false,
  },
  {
    id: "contacts",
    label: "Emergency contacts saved",
    icon: "📞",
    color: "#4DB6AC",
    done: false,
  },
  {
    id: "plan",
    label: "Family meeting point planned",
    icon: "🧭",
    color: "#79C66B",
    done: false,
  },
];

function getReadinessMeta(pct) {
  if (pct >= 75) {
    return {
      level: "High",
      label: "Ready",
      color: "#79C66B",
      bg: "rgba(121,198,107,0.18)",
      border: "rgba(121,198,107,0.45)",
      badge: "🛡 Fully Prepared",
    };
  }
  if (pct >= 40) {
    return {
      level: "Medium",
      label: "Preparing",
      color: "#D9A441",
      bg: "rgba(217,164,65,0.18)",
      border: "rgba(217,164,65,0.45)",
      badge: "🧰 Basic Prepared",
    };
  }
  return {
    level: "Low",
    label: "Needs Improvement",
    color: "#D97777",
    bg: "rgba(217,119,119,0.18)",
    border: "rgba(217,119,119,0.45)",
    badge: "⚠ Survival Starter",
  };
}

function CheckItem({ item, onToggle }) {
  return (
    <TouchableOpacity onPress={onToggle} style={styles.checkCard} activeOpacity={0.85}>
      <View style={styles.leftWrap}>
        <View
          style={[
            styles.iconDot,
            {
              backgroundColor: `${item.color}22`,
              borderColor: `${item.color}88`,
            },
          ]}
        >
          <Text style={styles.iconText}>{item.icon}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.checkLabel,
              { color: item.color },
              item.done && styles.checkLabelDone,
            ]}
          >
            {item.label}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.statusPill,
          item.done
            ? {
                backgroundColor: "rgba(121,198,107,0.18)",
                borderColor: "#79C66B",
              }
            : {
                backgroundColor: `${item.color}18`,
                borderColor: item.color,
              },
        ]}
      >
        <Text
          style={[
            styles.statusText,
            item.done
              ? styles.statusTextDone
              : {
                  color: item.color,
                },
          ]}
        >
          {item.done ? "✔ READY" : "TODO"}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function Preparedness() {
  const [items, setItems] = useState(DEFAULT_CHECKLIST);

  const progress = useMemo(() => {
    const doneCount = items.filter((x) => x.done).length;
    const total = items.length;
    const pct = Math.round((doneCount / total) * 100);
    return { doneCount, total, pct, ...getReadinessMeta(pct) };
  }, [items]);

  const toggle = (id) => {
    setItems((prev) =>
      prev.map((x) => (x.id === id ? { ...x, done: !x.done } : x))
    );
  };

  return (
    <ImageBackground
      source={require("../assets/bg_oldroad.jpg")}
      style={{ flex: 1 }}
      resizeMode="cover"
    >
      <LinearGradient
        colors={[
          "rgba(8,28,46,0.85)",
          "rgba(16,44,68,0.75)",
          "rgba(44,60,32,0.55)",
          "rgba(0,0,0,0.75)",
        ]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
          <View style={styles.headerWrap}>
            <Text style={styles.title}>Preparedness Checklist</Text>
            <Text style={styles.subtitle}>
              Track key actions to be ready before an incident.
            </Text>
          </View>

          <View style={styles.progressCard}>
            <View style={styles.progressTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.progressTitle}>Emergency Readiness</Text>
                <Text style={styles.progressText}>
                  {progress.doneCount}/{progress.total} completed ({progress.pct}%)
                </Text>
              </View>

              <View
                style={[
                  styles.levelPill,
                  {
                    backgroundColor: progress.bg,
                    borderColor: progress.border,
                  },
                ]}
              >
                <Text style={[styles.levelPillText, { color: progress.color }]}>
                  {progress.level}
                </Text>
              </View>
            </View>

            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${progress.pct}%`,
                    backgroundColor: progress.color,
                  },
                ]}
              />
            </View>

            <View style={styles.scoreWrap}>
              <Text style={styles.scoreLabel}>Preparedness Score</Text>
              <Text style={[styles.scoreValue, { color: progress.color }]}>
                {progress.pct}% {progress.label}
              </Text>
            </View>

            <View
              style={[
                styles.badgeBox,
                {
                  backgroundColor: progress.bg,
                  borderColor: progress.border,
                },
              ]}
            >
              <Text style={[styles.badgeText, { color: progress.color }]}>
                {progress.badge}
              </Text>
            </View>
          </View>

          {items.map((item) => (
            <CheckItem
              key={item.id}
              item={item}
              onToggle={() => toggle(item.id)}
            />
          ))}
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "rgba(8,28,46,0.55)",
  },

  headerWrap: {
    marginBottom: 14,
  },

  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#F2F6FF",
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },

  subtitle: {
    marginTop: 6,
    color: "#B6D4F2",
    fontSize: 14,
  },

  progressCard: {
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(111,175,214,0.25)",
    borderRadius: 14,
    marginBottom: 14,
    backgroundColor: "rgba(16,44,68,0.88)",
  },

  progressTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },

  progressTitle: {
    fontWeight: "800",
    color: "#F2F6FF",
    fontSize: 16,
  },

  progressText: {
    marginTop: 6,
    color: "#B6D4F2",
  },

  levelPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },

  levelPillText: {
    fontWeight: "800",
    fontSize: 12,
  },

  progressTrack: {
    marginTop: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },

  progressFill: {
    height: 12,
    borderRadius: 999,
  },

  scoreWrap: {
    marginTop: 12,
  },

  scoreLabel: {
    color: "#B6D4F2",
    fontSize: 13,
    marginBottom: 4,
  },

  scoreValue: {
    fontSize: 20,
    fontWeight: "800",
  },

  badgeBox: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },

  badgeText: {
    fontWeight: "700",
    fontSize: 14,
  },

  checkCard: {
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(111,175,214,0.28)",
    borderRadius: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(16,44,68,0.85)",
    gap: 10,
  },

  leftWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 10,
  },

  iconDot: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  iconText: {
    fontSize: 16,
  },

  checkLabel: {
    fontSize: 14,
    fontWeight: "600",
  },

  checkLabelDone: {
    color: "#F2F6FF",
    opacity: 0.92,
  },

  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },

  statusText: {
    fontWeight: "800",
    fontSize: 12,
  },

  statusTextDone: {
    color: "#79C66B",
  },
});