import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  SafeAreaView,
  StyleSheet,
  Linking,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const QUICK_ACTIONS = [
  {
    id: "qa1",
    step: "1",
    icon: "🩺",
    title: "Check for injuries",
    detail: "Ensure everyone is safe and help those who need assistance.",
    color: "#FF6B6B",
  },
  {
    id: "qa2",
    step: "2",
    icon: "🏃",
    title: "Move to a safer area",
    detail: "Avoid hazards like floodwaters, unstable structures, or smoke.",
    color: "#F28C28",
  },
  {
    id: "qa3",
    step: "3",
    icon: "📡",
    title: "Follow official instructions",
    detail: "Use trusted sources for updates and evacuation guidance.",
    color: "#72D6FF",
  },
  {
    id: "qa4",
    step: "4",
    icon: "👨‍👩‍👧",
    title: "Contact family",
    detail: "Confirm locations and agree on a meeting point if separated.",
    color: "#79C66B",
  },
];

const CONTACTS = [
  { id: "c1", name: "Emergency Services", number: "999", icon: "🚓", color: "#FF6B6B" },
  { id: "c2", name: "Ambulance / Fire", number: "995", icon: "🚑", color: "#F28C28" },
];

function ResponseCard({ step, icon, title, detail, color }) {
  return (
    <View
      style={[
        styles.card,
        {
          borderColor: `${color}66`,
        },
      ]}
    >
      <View style={styles.cardTopRow}>
        <View
          style={[
            styles.stepBadge,
            {
              borderColor: color,
              backgroundColor: `${color}22`,
            },
          ]}
        >
          <Text style={[styles.stepText, { color }]}>{step}</Text>
        </View>

        <View
          style={[
            styles.iconBubble,
            {
              borderColor: `${color}88`,
              backgroundColor: `${color}22`,
            },
          ]}
        >
          <Text style={styles.iconText}>{icon}</Text>
        </View>

        <Text style={styles.cardTitle}>{title}</Text>
      </View>

      <Text style={styles.cardDetail}>{detail}</Text>
    </View>
  );
}

function ContactCard({ icon, name, number, color }) {
  async function handleCall() {
    try {
      const url = `tel:${number}`;
      const supported = await Linking.canOpenURL(url);

      if (!supported) {
        Alert.alert("Call unavailable", `Your device can't open ${url}`);
        return;
      }

      await Linking.openURL(url);
    } catch (e) {
      Alert.alert("Call error", "Unable to start the call right now.");
    }
  }

  return (
    <TouchableOpacity
      onPress={handleCall}
      activeOpacity={0.85}
      style={[
        styles.contactCard,
        {
          borderColor: `${color}66`,
        },
      ]}
    >
      <View style={styles.contactTopRow}>
        <View
          style={[
            styles.iconBubble,
            {
              borderColor: `${color}88`,
              backgroundColor: `${color}22`,
            },
          ]}
        >
          <Text style={styles.iconText}>{icon}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.contactName}>{name}</Text>
          <Text style={[styles.contactNumber, { color }]}>{number}</Text>
        </View>
      </View>

      <Text style={styles.contactHint}>Tap to call immediately.</Text>
    </TouchableOpacity>
  );
}

export default function Response() {
  return (
    <ImageBackground
      source={require("../assets/bg_citycrossing.jpg")}
      style={{ flex: 1 }}
      resizeMode="cover"
    >
      <LinearGradient
        colors={[
          "rgba(8,18,38,0.78)",
          "rgba(16,38,68,0.68)",
          "rgba(18,32,58,0.56)",
          "rgba(8,8,18,0.82)",
        ]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
          <View style={styles.banner}>
            <Text style={styles.bannerText}>⚠ Stay calm and follow official guidance</Text>
          </View>

          <Text style={styles.title}>Response</Text>
          <Text style={styles.subtitle}>
            Quick actions to take during an incident.
          </Text>

          <View style={{ marginBottom: 16 }}>
            {QUICK_ACTIONS.map((a) => (
              <ResponseCard
                key={a.id}
                step={a.step}
                icon={a.icon}
                title={a.title}
                detail={a.detail}
                color={a.color}
              />
            ))}
          </View>

          <Text style={styles.sectionTitle}>Emergency Contacts</Text>

          {CONTACTS.map((c) => (
            <ContactCard
              key={c.id}
              icon={c.icon}
              name={c.name}
              number={c.number}
              color={c.color}
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
    backgroundColor: "rgba(8,16,30,0.42)",
  },

  banner: {
    marginTop: 10,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(242,184,75,0.16)",
    borderWidth: 1,
    borderColor: "rgba(242,184,75,0.40)",
  },

  bannerText: {
    color: "#F5D38B",
    fontWeight: "800",
  },

  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#EEF6FF",
    marginBottom: 6,
    paddingTop: 10,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },

  subtitle: {
    color: "#B9CDE6",
    marginBottom: 14,
    fontSize: 14,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 10,
    color: "#EEF6FF",
  },

  card: {
    padding: 14,
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 10,
    backgroundColor: "rgba(15,34,58,0.84)",
    shadowColor: "#000",
    shadowOpacity: 0.30,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },

  stepBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },

  stepText: {
    fontWeight: "800",
    fontSize: 13,
  },

  iconBubble: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  iconText: {
    fontSize: 17,
  },

  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    color: "#F5FAFF",
  },

  cardDetail: {
    marginTop: 6,
    color: "#B9CDE6",
    lineHeight: 20,
  },

  contactCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    backgroundColor: "rgba(18,42,72,0.86)",
    shadowColor: "#000",
    shadowOpacity: 0.30,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  contactTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  contactName: {
    fontWeight: "800",
    color: "#F5FAFF",
    fontSize: 15,
  },

  contactNumber: {
    marginTop: 4,
    fontWeight: "800",
    fontSize: 16,
  },

  contactHint: {
    marginTop: 8,
    color: "#B9CDE6",
  },
});