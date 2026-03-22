import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";

import Preparedness from "./Preparedness";
import Alerts from "./Alerts";
import Response from "./Response";

function SubTab({ label, active, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: 10,
        alignItems: "center",
        borderBottomWidth: 2,
        borderBottomColor: active ? "#1f6feb" : "transparent",
      }}
    >
      <Text style={{ color: active ? "#1f6feb" : "#7a7a7a", fontWeight: "600" }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function Emergency() {
  const [subTab, setSubTab] = useState("Preparedness");

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: "#eee" }}>
        <Text style={{ fontSize: 18, fontWeight: "700" }}>Emergency</Text>
        <Text style={{ marginTop: 4, color: "#666" }}>
          Preparedness, alerts, and response guidance.
        </Text>
      </View>

      <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#eee" }}>
        <SubTab label="Preparedness" active={subTab === "Preparedness"} onPress={() => setSubTab("Preparedness")} />
        <SubTab label="Alerts" active={subTab === "Alerts"} onPress={() => setSubTab("Alerts")} />
        <SubTab label="Response" active={subTab === "Response"} onPress={() => setSubTab("Response")} />
      </View>

      <View style={{ flex: 1 }}>
        {subTab === "Preparedness" && <Preparedness />}
        {subTab === "Alerts" && <Alerts />}
        {subTab === "Response" && <Response />}
      </View>
    </View>
  );
}
