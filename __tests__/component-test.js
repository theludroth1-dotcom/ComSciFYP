import React from "react";
import {
  render,
  fireEvent,
  waitFor,
  act,
  cleanup,
} from "@testing-library/react-native";
import { Alert, Linking, TouchableOpacity, Animated } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";

import Home from "../screens/Home";
import Explore from "../screens/Explore";
import Itinerary from "../screens/Itinerary";
import Scheduler from "../screens/Scheduler";
import Preparedness from "../screens/Preparedness";
import Alerts from "../screens/Alerts";
import Response from "../screens/Response";
import Emergency from "../screens/Emergency";

/* ---------- mocks ---------- */
jest.mock(
  "@react-native-async-storage/async-storage",
  () => ({
    __esModule: true,
    default: {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    },
  }),
  { virtual: true }
);

jest.mock(
  "expo-location",
  () => ({
    requestForegroundPermissionsAsync: jest.fn(),
    getCurrentPositionAsync: jest.fn(),
  }),
  { virtual: true }
);

jest.mock(
  "expo-linear-gradient",
  () => {
    const React = require("react");
    const { View } = require("react-native");
    return {
      LinearGradient: ({ children, ...props }) => (
        <View {...props}>{children}</View>
      ),
    };
  },
  { virtual: true }
);

jest.mock(
  "@expo/vector-icons",
  () => {
    const React = require("react");
    const { Text } = require("react-native");
    return {
      Ionicons: ({ name }) => <Text>{name}</Text>,
    };
  },
  { virtual: true }
);

jest.mock("../config", () => ({
  __esModule: true,
  default: {
    OWM_KEY: "test-owm-key",
    OTM_KEY: "test-otm-key",
    GOOGLE_PLACES_KEY: "",
  },
}));

let realSetTimeout;
let realClearTimeout;

/* ---------- helpers ---------- */
function getCurrentPeriod() {
  const h = new Date().getHours();
  if (h < 12) return "Morning";
  if (h < 18) return "Afternoon";
  return "Evening";
}

function getCurrentSlot() {
  const p = getCurrentPeriod();
  if (p === "Morning") return "morning";
  if (p === "Afternoon") return "afternoon";
  return "evening";
}

describe("Component tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    realSetTimeout = global.setTimeout;
    realClearTimeout = global.clearTimeout;

    jest.spyOn(global, "setTimeout").mockImplementation((fn, ms, ...args) => {
      if (typeof ms === "number" && ms >= 5000) return 0;
      return realSetTimeout(fn, ms, ...args);
    });

    jest.spyOn(global, "clearTimeout").mockImplementation(() => undefined);

    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    jest.spyOn(Linking, "openURL").mockImplementation(() => Promise.resolve());
    jest.spyOn(Linking, "canOpenURL").mockImplementation(() =>
      Promise.resolve(true)
    );
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation((msg) => {
      if (
        typeof msg === "string" &&
        (msg.includes("not wrapped in act") ||
          msg.includes(
            "An update to Alerts inside a test was not wrapped in act"
          ))
      ) {
        return;
      }
    });

    jest.spyOn(Animated, "timing").mockImplementation(() => ({
      start: (cb) => {
        if (cb) cb();
      },
      stop: jest.fn(),
      reset: jest.fn(),
    }));

    AsyncStorage.getItem.mockResolvedValue(JSON.stringify([]));
    AsyncStorage.setItem.mockResolvedValue();

    global.fetch = jest.fn((url) => {
      if (
        typeof url === "string" &&
        url.includes("api.openweathermap.org/data/2.5/weather")
      ) {
        return Promise.resolve({
          ok: true,
          text: async () =>
            JSON.stringify({
              name: "Singapore",
              main: { temp: 30, feels_like: 34 },
              weather: [{ id: 800, description: "clear sky" }],
            }),
          json: async () => ({
            name: "Singapore",
            main: { temp: 30, feels_like: 34 },
            weather: [{ id: 800, description: "clear sky" }],
          }),
        });
      }

      if (typeof url === "string" && url.includes("/places/geoname")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            status: "OK",
            lat: 35.6762,
            lon: 139.6503,
            name: "Tokyo",
            country: "Japan",
          }),
        });
      }

      if (typeof url === "string" && url.includes("/places/radius")) {
        return Promise.resolve({
          ok: true,
          text: async () =>
            JSON.stringify([
              {
                xid: "otm-1",
                name: "Tokyo Central Library",
                kinds: "cultural,interesting_places,libraries",
                point: { lat: 35.6765, lon: 139.6508 },
              },
            ]),
        });
      }

      if (typeof url === "string" && url.includes("/places/xid/otm-1")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            xid: "otm-1",
            name: "Tokyo Central Library",
            point: { lat: 35.6765, lon: 139.6508 },
            address: {
              road: "Library Street",
              city: "Tokyo",
              country: "Japan",
            },
            wikipedia_extracts: {
              text: "A major public library in Tokyo.",
            },
          }),
        });
      }

      if (
        typeof url === "string" &&
        url.includes(
          "earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson"
        )
      ) {
        return Promise.resolve({
          ok: true,
          text: async () =>
            JSON.stringify({
              features: [
                {
                  id: "us1",
                  properties: {
                    title: "M 6.2 - 50 km SE of Tokyo, Japan",
                    place: "50 km SE of Tokyo, Japan",
                    mag: 6.2,
                    time: new Date("2026-03-11T10:00:00Z").getTime(),
                    url: "https://example.com/usgs-japan",
                  },
                  geometry: { coordinates: [139.75, 35.6, 10] },
                },
              ],
            }),
        });
      }

      if (
        typeof url === "string" &&
        url.includes("www.gdacs.org/gdacsapi/api/events/geteventlist/events4app")
      ) {
        return Promise.resolve({
          ok: true,
          text: async () =>
            JSON.stringify({
              features: [
                {
                  properties: {
                    eventid: "gd1",
                    eventname: "Flood in Kenya",
                    country: "Kenya",
                    description: "Flood affecting Kenya",
                    alertlevel: "orange",
                    datetime: "2026-03-10T06:30:00Z",
                    url: "https://example.com/gdacs-kenya",
                  },
                  geometry: { coordinates: [37.9, 0.2] },
                },
              ],
            }),
        });
      }

      return Promise.reject(new Error(`Unhandled fetch URL: ${url}`));
    });

    Location.requestForegroundPermissionsAsync.mockResolvedValue({
      status: "granted",
    });

    Location.getCurrentPositionAsync.mockResolvedValue({
      coords: {
        latitude: 1.3521,
        longitude: 103.8198,
      },
    });
  });

  afterEach(() => {
    cleanup();
    if (Alert.alert.mockRestore) Alert.alert.mockRestore();
    if (Linking.openURL.mockRestore) Linking.openURL.mockRestore();
    if (Linking.canOpenURL.mockRestore) Linking.canOpenURL.mockRestore();
    if (console.log.mockRestore) console.log.mockRestore();
    if (console.warn.mockRestore) console.warn.mockRestore();
    if (console.error.mockRestore) console.error.mockRestore();
    if (Animated.timing.mockRestore) Animated.timing.mockRestore();
    if (global.setTimeout.mockRestore) global.setTimeout.mockRestore();
    if (global.clearTimeout.mockRestore) global.clearTimeout.mockRestore();
  });

  /* =========================
     Home.js component tests
     ========================= */
  it("Home renders static headings", () => {
    const screen = render(<Home />);
    expect(screen.getByText("Welcome")).toBeTruthy();
    expect(screen.getByText("Today's itinerary")).toBeTruthy();
    expect(screen.getByText(`${getCurrentPeriod()} itinerary`)).toBeTruthy();
    expect(screen.getByText("Weather")).toBeTruthy();
  });

  it("Home shows empty itinerary text when storage is empty", async () => {
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify([]));
    const screen = render(<Home />);

    await waitFor(() => {
      expect(
        screen.getByText(
          `No items for ${getCurrentPeriod().toLowerCase()} yet. Add places from Explore → “Add to Itinerary”.`
        )
      ).toBeTruthy();
    });
  });

  it("Home renders weather block from mocked API", async () => {
    const screen = render(<Home />);

    await waitFor(() => {
      expect(screen.getByText("Singapore — 30°C")).toBeTruthy();
    });

    expect(screen.getByText("clear sky · Feels 34°C")).toBeTruthy();
  });

  /* =========================
     Explore.js component tests
     ========================= */
  it("Explore renders provider chips, filters and inputs", () => {
    const screen = render(<Explore />);

    expect(screen.getByText("Explore")).toBeTruthy();
    expect(screen.getByText("OpenTripMap")).toBeTruthy();
    expect(screen.getByText("Food")).toBeTruthy();
    expect(screen.getByText("Train stations")).toBeTruthy();
    expect(screen.getByText("Libraries")).toBeTruthy();
    expect(screen.getByPlaceholderText("City (e.g., Tokyo)")).toBeTruthy();
    expect(
      screen.getByPlaceholderText("Keyword (e.g., izakaya, ramen)")
    ).toBeTruthy();
  });

  it("Explore shows validation alert when city is missing", async () => {
    const screen = render(<Explore />);

    const buttons = screen.UNSAFE_getAllByType(TouchableOpacity);
    await act(async () => {
      buttons[4].props.onPress();
    });

    expect(Alert.alert).toHaveBeenCalledWith("Enter a city");
  });

  it("Explore renders a search result after search", async () => {
    const screen = render(<Explore />);

    fireEvent.changeText(
      screen.getByPlaceholderText("City (e.g., Tokyo)"),
      "Tokyo"
    );

    const buttons = screen.UNSAFE_getAllByType(TouchableOpacity);
    await act(async () => {
      buttons[4].props.onPress();
    });

    await waitFor(() => {
      expect(screen.getByText("Tokyo Central Library")).toBeTruthy();
    });
  });

  /* =========================
     Itinerary.js component tests
     ========================= */
  it("Itinerary renders empty sections", async () => {
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify([]));
    const screen = render(<Itinerary />);

    await waitFor(() => {
      expect(screen.getByText("Itinerary")).toBeTruthy();
    });

    expect(screen.getByText("Clear all")).toBeTruthy();
    expect(screen.getByText(/Morning\s*\(/)).toBeTruthy();
    expect(screen.getByText(/Afternoon\s*\(/)).toBeTruthy();
    expect(screen.getByText(/Evening \/ Midnight\s*\(/)).toBeTruthy();
  });

  it("Itinerary renders saved items", async () => {
    AsyncStorage.getItem.mockResolvedValue(
      JSON.stringify([
        {
          id: "g:1",
          title: "Breakfast Cafe",
          address: "Morning Street",
          slot: "morning",
          time12: "8:30",
          ampm: "AM",
          provider: "g",
        },
      ])
    );

    const screen = render(<Itinerary />);

    await waitFor(() => {
      expect(screen.getByText("Breakfast Cafe")).toBeTruthy();
    });

    expect(screen.getByText("Morning Street")).toBeTruthy();
  });

  it("Itinerary clear all shows confirmation alert", async () => {
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify([]));
    const screen = render(<Itinerary />);

    await waitFor(() => {
      expect(screen.getByText("Clear all")).toBeTruthy();
    });

    const buttons = screen.UNSAFE_getAllByType(TouchableOpacity);
    await act(async () => {
      buttons[0].props.onPress();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      "Clear itinerary",
      "Remove all saved places?",
      expect.any(Array)
    );
  });

  /* =========================
     Scheduler.js component tests
     ========================= */
  it("Scheduler renders input fields and Add button", async () => {
    const screen = render(<Scheduler />);

    await waitFor(() => {
      expect(screen.getByText("Scheduler")).toBeTruthy();
    });

    expect(screen.getByPlaceholderText("Reminder")).toBeTruthy();
    expect(screen.getByPlaceholderText("time (h:mm)")).toBeTruthy();
    expect(screen.getByPlaceholderText("date (DD-MM-YYYY)")).toBeTruthy();
    expect(screen.getByText("Add")).toBeTruthy();
  });

  it("Scheduler shows missing title alert", async () => {
    const screen = render(<Scheduler />);

    await act(async () => {
      fireEvent.changeText(
        screen.getByPlaceholderText("time (h:mm)"),
        "930"
      );
      fireEvent.changeText(
        screen.getByPlaceholderText("date (DD-MM-YYYY)"),
        "15032026"
      );
    });

    const buttons = screen.UNSAFE_getAllByType(TouchableOpacity);
    await act(async () => {
      buttons[2].props.onPress();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      "Missing",
      "Please enter a reminder title."
    );
  });

  it("Scheduler renders saved reminder item", async () => {
    AsyncStorage.getItem.mockResolvedValue(
      JSON.stringify([
        {
          id: "1",
          title: "Doctor Appointment",
          time12: "9:30",
          ampm: "AM",
          dateStr: "15-03-2026",
          ts: new Date(2026, 2, 15, 9, 30, 0, 0).getTime(),
          done: false,
        },
      ])
    );

    const screen = render(<Scheduler />);

    await waitFor(() => {
      expect(screen.getByText("Doctor Appointment")).toBeTruthy();
    });

    expect(screen.getByText("9:30 AM | 15-03-2026")).toBeTruthy();
  });

  /* =========================
     Preparedness.js component tests
     ========================= */
  it("Preparedness renders checklist and initial score", () => {
    const screen = render(<Preparedness />);

    expect(screen.getByText("Preparedness Checklist")).toBeTruthy();
    expect(screen.getByText("Emergency Readiness")).toBeTruthy();
    expect(screen.getByText("0/8 completed (0%)")).toBeTruthy();
    expect(screen.getByText("Low")).toBeTruthy();
  });

  it("Preparedness toggles one item and updates score", async () => {
    const screen = render(<Preparedness />);

    await act(async () => {
      fireEvent.press(
        screen.getByText("Store drinking water (at least 3 days)")
      );
    });

    await waitFor(() => {
      expect(screen.getByText("1/8 completed (13%)")).toBeTruthy();
    });
  });

  it("Preparedness reaches medium readiness after several toggles", async () => {
    const screen = render(<Preparedness />);

    await act(async () => {
      fireEvent.press(
        screen.getByText("Store drinking water (at least 3 days)")
      );
      fireEvent.press(screen.getByText("Non-perishable food supply"));
      fireEvent.press(screen.getByText("First-aid kit"));
      fireEvent.press(screen.getByText("Power bank / spare batteries"));
    });

    await waitFor(() => {
      expect(screen.getByText("4/8 completed (50%)")).toBeTruthy();
    });

    expect(screen.getByText("Medium")).toBeTruthy();
  });

  /* =========================
     Alerts.js component tests
     ========================= */
  it("Alerts renders title, filters and search input", () => {
    const screen = render(<Alerts />);

    expect(screen.getAllByText("Alerts")[0]).toBeTruthy();
    expect(screen.getByText("All")).toBeTruthy();
    expect(screen.getByText("Asia")).toBeTruthy();
    expect(screen.getByText("US")).toBeTruthy();
    expect(screen.getByText("Europe")).toBeTruthy();
    expect(screen.getByText("Africa")).toBeTruthy();
    expect(
      screen.getByPlaceholderText(
        "Search by country (e.g. Japan, USA, Kenya)"
      )
    ).toBeTruthy();
  });

  it("Alerts renders fetched cards", async () => {
    const screen = render(<Alerts />);

    await waitFor(() => {
      expect(screen.getByText("M 6.2 - 50 km SE of Tokyo, Japan")).toBeTruthy();
    });

    expect(screen.getByText("Flood in Kenya")).toBeTruthy();
  });

  it("Alerts region chip filters visible cards", async () => {
    const screen = render(<Alerts />);

    await waitFor(() => {
      expect(screen.getByText("Flood in Kenya")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByText("Asia"));
    });

    await waitFor(() => {
      expect(screen.getByText("M 6.2 - 50 km SE of Tokyo, Japan")).toBeTruthy();
    });

    expect(screen.queryByText("Flood in Kenya")).toBeNull();
  });

  /* =========================
     Response.js component tests
     ========================= */
  it("Response renders quick action cards and contacts", () => {
    const screen = render(<Response />);

    expect(screen.getByText("Response")).toBeTruthy();
    expect(screen.getByText("Check for injuries")).toBeTruthy();
    expect(screen.getByText("Move to a safer area")).toBeTruthy();
    expect(screen.getByText("Follow official instructions")).toBeTruthy();
    expect(screen.getByText("Contact family")).toBeTruthy();
    expect(screen.getByText("Emergency Contacts")).toBeTruthy();
    expect(screen.getByText("Emergency Services")).toBeTruthy();
    expect(screen.getByText("Ambulance / Fire")).toBeTruthy();
  });

  it("Response tries to call selected contact", async () => {
    const screen = render(<Response />);

    await act(async () => {
      fireEvent.press(screen.getByText("Emergency Services"));
    });

    expect(Linking.canOpenURL).toHaveBeenCalledWith("tel:999");
    expect(Linking.openURL).toHaveBeenCalledWith("tel:999");
  });

  it("Response shows alert when calling is unavailable", async () => {
    Linking.canOpenURL.mockResolvedValueOnce(false);
    const screen = render(<Response />);

    await act(async () => {
      fireEvent.press(screen.getByText("Ambulance / Fire"));
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      "Call unavailable",
      "Your device can't open tel:995"
    );
  });

  /* =========================
     Emergency.js component tests
     ========================= */
  it("Emergency renders header and default Preparedness tab", async () => {
    const screen = render(<Emergency />);

    expect(screen.getByText("Emergency")).toBeTruthy();
    expect(
      screen.getByText("Preparedness, alerts, and response guidance.")
    ).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText("Preparedness Checklist")).toBeTruthy();
    });
  });

  it("Emergency switches to Alerts tab", async () => {
    const screen = render(<Emergency />);

    await act(async () => {
      fireEvent.press(screen.getAllByText("Alerts")[0]);
    });

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(
          "Search by country (e.g. Japan, USA, Kenya)"
        )
      ).toBeTruthy();
    });
  });

  it("Emergency switches to Response tab", async () => {
    const screen = render(<Emergency />);

    await act(async () => {
      fireEvent.press(screen.getAllByText("Response")[0]);
    });

    await waitFor(() => {
      expect(screen.getByText("Emergency Contacts")).toBeTruthy();
    });
  });
});