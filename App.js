import "react-native-gesture-handler";
import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";

import Home from "./screens/Home";
import Explore from "./screens/Explore";
import Itinerary from "./screens/Itinerary";
import Scheduler from "./screens/Scheduler";
import Emergency from "./screens/Emergency";

function TabButton({ icon, label, active, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 10,
      }}
    >
      <Ionicons name={icon} size={22} color={active ? "#1f6feb" : "#7a7a7a"} />
      <Text
        style={{
          color: active ? "#1f6feb" : "#7a7a7a",
          marginTop: 2,
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function App() {
  const [tab, setTab] = useState("Home");

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          {tab === "Home" && <Home />}
          {tab === "Explore" && <Explore />}
          {tab === "Itinerary" && <Itinerary />}
          {tab === "Scheduler" && <Scheduler />}
          {tab === "Emergency" && <Emergency />}
        </View>

        <View
          style={{
            height: 58,
            flexDirection: "row",
            borderTopWidth: 1,
            borderTopColor: "#eee",
            backgroundColor: "#fff",
          }}
        >
          <TabButton icon="home" label="Home" active={tab === "Home"} onPress={() => setTab("Home")} />
          <TabButton icon="search" label="Explore" active={tab === "Explore"} onPress={() => setTab("Explore")} />
          <TabButton icon="list" label="Itinerary" active={tab === "Itinerary"} onPress={() => setTab("Itinerary")} />
          <TabButton icon="alarm" label="Scheduler" active={tab === "Scheduler"} onPress={() => setTab("Scheduler")} />
          <TabButton icon="alert-circle" label="Emergency" active={tab === "Emergency"} onPress={() => setTab("Emergency")} />
        </View>
      </View>
    </GestureHandlerRootView>
  );
}
