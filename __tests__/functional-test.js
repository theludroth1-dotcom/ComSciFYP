import React from "react";
import {
  render,
  waitFor,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react-native";
import {
  Alert,
  TouchableOpacity,
  Animated,
  Linking,
} from "react-native";
import Home from "../screens/Home";
import Explore from "../screens/Explore";
import Itinerary from "../screens/Itinerary";
import Scheduler from "../screens/Scheduler";
import Emergency from "../screens/Emergency";
import Preparedness from "../screens/Preparedness";
import Alerts from "../screens/Alerts";
import Response from "../screens/Response";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";

let realSetTimeout;
let realClearTimeout;

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

function pressSearchButton(screen) {
  const buttons = screen.UNSAFE_getAllByType(TouchableOpacity);
  const searchButton = buttons[4];
  return act(async () => {
    searchButton.props.onPress();
  });
}

function pressResultRow(screen) {
  const buttons = screen.UNSAFE_getAllByType(TouchableOpacity);
  const resultButton = buttons[5];
  return act(async () => {
    resultButton.props.onPress();
  });
}

function pressAddToItinerary(screen) {
  const buttons = screen.UNSAFE_getAllByType(TouchableOpacity);
  const addButton = buttons[1];
  return act(async () => {
    addButton.props.onPress();
  });
}

function pressClearAll(screen) {
  const buttons = screen.UNSAFE_getAllByType(TouchableOpacity);
  const clearButton = buttons[0];
  return act(async () => {
    clearButton.props.onPress();
  });
}

function getSchedulerButtons(screen) {
  return screen.UNSAFE_getAllByType(TouchableOpacity);
}

function pressSchedulerPM(screen) {
  const buttons = getSchedulerButtons(screen);
  return act(async () => {
    buttons[1].props.onPress();
  });
}

function pressSchedulerAdd(screen) {
  const buttons = getSchedulerButtons(screen);
  return act(async () => {
    buttons[2].props.onPress();
  });
}

function pressSchedulerDelete(screen) {
  const buttons = getSchedulerButtons(screen);
  return act(async () => {
    buttons[4].props.onPress();
  });
}

describe("Functional tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    realSetTimeout = global.setTimeout;
    realClearTimeout = global.clearTimeout;

    jest.spyOn(global, "setTimeout").mockImplementation((fn, ms, ...args) => {
      if (typeof ms === "number" && ms >= 5000) {
        return 0;
      }
      return realSetTimeout(fn, ms, ...args);
    });

    jest.spyOn(global, "clearTimeout").mockImplementation(() => {
      return undefined;
    });

    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    jest.spyOn(Linking, "openURL").mockImplementation(() => Promise.resolve());
    jest.spyOn(Linking, "canOpenURL").mockImplementation(() => Promise.resolve(true));
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation((msg) => {
      if (
        typeof msg === "string" &&
        (msg.includes("not wrapped in act") ||
          msg.includes("An update to Alerts inside a test was not wrapped in act"))
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
              main: {
                temp: 30,
                feels_like: 34,
              },
              weather: [{ id: 800, description: "clear sky" }],
            }),
          json: async () => ({
            name: "Singapore",
            main: {
              temp: 30,
              feels_like: 34,
            },
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
                point: {
                  lat: 35.6765,
                  lon: 139.6508,
                },
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
            point: {
              lat: 35.6765,
              lon: 139.6508,
            },
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
                  geometry: {
                    coordinates: [139.75, 35.6, 10],
                  },
                },
                {
                  id: "us2",
                  properties: {
                    title: "M 5.1 - California, United States",
                    place: "California, United States",
                    mag: 5.1,
                    time: new Date("2026-03-11T08:00:00Z").getTime(),
                    url: "https://example.com/usgs-us",
                  },
                  geometry: {
                    coordinates: [-120.0, 36.0, 10],
                  },
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
                  geometry: {
                    coordinates: [37.9, 0.2],
                  },
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
     Home tests
     ========================= */
  it("renders stored itinerary item and weather on Home", async () => {
    AsyncStorage.getItem.mockResolvedValue(
      JSON.stringify([
        {
          id: "1",
          title: "Marina Bay Sands",
          address: "10 Bayfront Ave, Singapore",
          slot: getCurrentSlot(),
          time12: "9:00",
          ampm: "AM",
        },
      ])
    );

    const { getByText } = render(<Home />);

    expect(getByText("Welcome")).toBeTruthy();
    expect(getByText("Today's itinerary")).toBeTruthy();
    expect(getByText(`${getCurrentPeriod()} itinerary`)).toBeTruthy();

    await waitFor(() => {
      expect(getByText("1. Marina Bay Sands")).toBeTruthy();
    });

    await waitFor(() => {
      expect(getByText("10 Bayfront Ave, Singapore")).toBeTruthy();
    });

    await waitFor(() => {
      expect(getByText("Singapore — 30°C")).toBeTruthy();
    });

    await waitFor(() => {
      expect(getByText("clear sky · Feels 34°C")).toBeTruthy();
    });
  });

  it("shows empty itinerary message when no places are saved", async () => {
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify([]));

    const { getByText } = render(<Home />);

    await waitFor(() => {
      expect(
        getByText(
          `No items for ${getCurrentPeriod().toLowerCase()} yet. Add places from Explore → “Add to Itinerary”.`
        )
      ).toBeTruthy();
    });
  });

  it("shows weather error when location permission is denied", async () => {
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify([]));
    Location.requestForegroundPermissionsAsync.mockResolvedValue({
      status: "denied",
    });

    const { getByText } = render(<Home />);

    await waitFor(() => {
      expect(
        getByText("Weather error: Location permission denied")
      ).toBeTruthy();
    });
  });

  /* =========================
     Explore tests
     ========================= */
  it("renders the Explore home screen", () => {
    const { getByText, getByPlaceholderText } = render(<Explore />);

    expect(getByText("Explore")).toBeTruthy();
    expect(getByText("OpenTripMap")).toBeTruthy();
    expect(getByText("Food")).toBeTruthy();
    expect(getByText("Train stations")).toBeTruthy();
    expect(getByText("Libraries")).toBeTruthy();

    expect(getByPlaceholderText("City (e.g., Tokyo)")).toBeTruthy();
    expect(
      getByPlaceholderText("Keyword (e.g., izakaya, ramen)")
    ).toBeTruthy();
  });

  it("searches for places and shows results", async () => {
    const screen = render(<Explore />);

    fireEvent.changeText(
      screen.getByPlaceholderText("City (e.g., Tokyo)"),
      "Tokyo"
    );

    await pressSearchButton(screen);

    await waitFor(() => {
      expect(screen.getByText("Tokyo Central Library")).toBeTruthy();
    });
  });

  it("opens place details when a result is pressed", async () => {
    const screen = render(<Explore />);

    fireEvent.changeText(
      screen.getByPlaceholderText("City (e.g., Tokyo)"),
      "Tokyo"
    );

    await pressSearchButton(screen);

    await waitFor(() => {
      expect(screen.getByText("Tokyo Central Library")).toBeTruthy();
    });

    await pressResultRow(screen);

    await waitFor(() => {
      expect(screen.getByText("Add to Itinerary")).toBeTruthy();
    });

    await waitFor(() => {
      expect(screen.getByText("Address")).toBeTruthy();
    });

    await waitFor(() => {
      expect(screen.getByText("Library Street, Tokyo, Japan")).toBeTruthy();
    });

    await waitFor(() => {
      expect(screen.getByText("About")).toBeTruthy();
    });

    await waitFor(() => {
      expect(
        screen.getByText("A major public library in Tokyo.")
      ).toBeTruthy();
    });
  });

  it("adds a place to itinerary", async () => {
    const screen = render(<Explore />);

    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([]));

    fireEvent.changeText(
      screen.getByPlaceholderText("City (e.g., Tokyo)"),
      "Tokyo"
    );

    await pressSearchButton(screen);

    await waitFor(() => {
      expect(screen.getByText("Tokyo Central Library")).toBeTruthy();
    });

    await pressResultRow(screen);

    await waitFor(() => {
      expect(screen.getByText("Add to Itinerary")).toBeTruthy();
    });

    await pressAddToItinerary(screen);

    await waitFor(() => {
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        "Added",
        "Saved to your itinerary."
      );
    });
  });

  it("shows alert if city is empty on Explore", async () => {
    const screen = render(<Explore />);

    await pressSearchButton(screen);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith("Enter a city");
    });
  });

  /* =========================
     Itinerary tests
     ========================= */
  it("renders empty itinerary sections", async () => {
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify([]));

    const { getByText } = render(<Itinerary />);

    await waitFor(() => {
      expect(getByText("Itinerary")).toBeTruthy();
    });

    expect(getByText("Clear all")).toBeTruthy();
    expect(getByText(/Morning\s*\(/)).toBeTruthy();
    expect(getByText(/Afternoon\s*\(/)).toBeTruthy();
    expect(getByText(/Evening \/ Midnight\s*\(/)).toBeTruthy();

    await waitFor(() => {
      expect(
        getByText(
          "Nothing here yet. Add places from Explore and assign them to Morning."
        )
      ).toBeTruthy();
    });

    expect(getByText("No afternoon plans yet.")).toBeTruthy();
    expect(getByText("No evening plans yet.")).toBeTruthy();
  });

  it("renders saved itinerary items", async () => {
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
          lat: 1.3,
          lon: 103.8,
        },
        {
          id: "otm:2",
          title: "Library Visit",
          address: "Afternoon Road",
          slot: "afternoon",
          time12: "2:15",
          ampm: "PM",
          provider: "otm",
          lat: 1.31,
          lon: 103.81,
        },
        {
          id: "g:3",
          title: "Night Market",
          address: "Evening Avenue",
          slot: "evening",
          time12: "8:00",
          ampm: "PM",
          provider: "g",
          lat: 1.32,
          lon: 103.82,
        },
      ])
    );

    const { getByText } = render(<Itinerary />);

    await waitFor(() => {
      expect(getByText("Breakfast Cafe")).toBeTruthy();
    });

    expect(getByText("Morning Street")).toBeTruthy();
    expect(getByText("Library Visit")).toBeTruthy();
    expect(getByText("Afternoon Road")).toBeTruthy();
    expect(getByText("Night Market")).toBeTruthy();
    expect(getByText("Evening Avenue")).toBeTruthy();
  });

  it("shows clear confirmation alert", async () => {
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
      expect(screen.getByText("Clear all")).toBeTruthy();
    });

    await pressClearAll(screen);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        "Clear itinerary",
        "Remove all saved places?",
        expect.any(Array)
      );
    });
  });

  it("formats and saves edited time on Itinerary", async () => {
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
      expect(screen.getByDisplayValue("8:30")).toBeTruthy();
    });

    fireEvent.changeText(screen.getByDisplayValue("8:30"), "945");

    await waitFor(() => {
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  /* =========================
     Scheduler tests
     ========================= */
  it("renders Scheduler screen with empty list", async () => {
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify([]));

    const screen = render(<Scheduler />);

    await waitFor(() => {
      expect(screen.getByText("Scheduler")).toBeTruthy();
    });

    expect(screen.getByPlaceholderText("Reminder")).toBeTruthy();
    expect(screen.getByPlaceholderText("time (h:mm)")).toBeTruthy();
    expect(screen.getByPlaceholderText("date (DD-MM-YYYY)")).toBeTruthy();
    expect(screen.getByText("Add")).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText("No reminders yet.")).toBeTruthy();
    });
  });

  it("adds a scheduler reminder", async () => {
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify([]));

    const screen = render(<Scheduler />);

    await act(async () => {
      fireEvent.changeText(
        screen.getByPlaceholderText("Reminder"),
        "Take medicine"
      );
      fireEvent.changeText(
        screen.getByPlaceholderText("time (h:mm)"),
        "930"
      );
      fireEvent.changeText(
        screen.getByPlaceholderText("date (DD-MM-YYYY)"),
        "15032026"
      );
    });

    await pressSchedulerAdd(screen);

    await waitFor(() => {
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(
        "reminders",
        expect.stringContaining("Take medicine")
      );
    });
  });

  it("shows invalid time alert in Scheduler", async () => {
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify([]));

    const screen = render(<Scheduler />);

    await act(async () => {
      fireEvent.changeText(
        screen.getByPlaceholderText("Reminder"),
        "Take medicine"
      );
      fireEvent.changeText(
        screen.getByPlaceholderText("time (h:mm)"),
        "99"
      );
      fireEvent.changeText(
        screen.getByPlaceholderText("date (DD-MM-YYYY)"),
        "15032026"
      );
    });

    await pressSchedulerAdd(screen);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        "Invalid time",
        "Use h:mm or hh:mm with AM/PM."
      );
    });
  });

  it("shows invalid date alert in Scheduler", async () => {
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify([]));

    const screen = render(<Scheduler />);

    await act(async () => {
      fireEvent.changeText(
        screen.getByPlaceholderText("Reminder"),
        "Take medicine"
      );
      fireEvent.changeText(
        screen.getByPlaceholderText("time (h:mm)"),
        "930"
      );
      fireEvent.changeText(
        screen.getByPlaceholderText("date (DD-MM-YYYY)"),
        "32132026"
      );
    });

    await pressSchedulerAdd(screen);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        "Invalid date",
        "Use DD-MM-YYYY."
      );
    });
  });

  it("shows missing title alert in Scheduler", async () => {
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify([]));

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

    await pressSchedulerAdd(screen);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        "Missing",
        "Please enter a reminder title."
      );
    });
  });

  it("renders saved scheduler reminders", async () => {
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

  it("deletes a scheduler reminder", async () => {
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

    await pressSchedulerDelete(screen);

    await waitFor(() => {
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  it("allows PM reminder creation in Scheduler", async () => {
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify([]));

    const screen = render(<Scheduler />);

    await act(async () => {
      fireEvent.changeText(
        screen.getByPlaceholderText("Reminder"),
        "Dinner"
      );
      fireEvent.changeText(
        screen.getByPlaceholderText("time (h:mm)"),
        "730"
      );
      fireEvent.changeText(
        screen.getByPlaceholderText("date (DD-MM-YYYY)"),
        "16032026"
      );
    });

    await pressSchedulerPM(screen);
    await pressSchedulerAdd(screen);

    await waitFor(() => {
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(
        "reminders",
        expect.stringContaining("Dinner")
      );
    });
  });

  /* =========================
     Preparedness tests
     ========================= */
  it("renders Preparedness checklist with initial zero progress", async () => {
    const screen = render(<Preparedness />);

    expect(screen.getByText("Preparedness Checklist")).toBeTruthy();
    expect(
      screen.getByText("Track key actions to be ready before an incident.")
    ).toBeTruthy();

    expect(screen.getByText("Emergency Readiness")).toBeTruthy();
    expect(screen.getByText("0/8 completed (0%)")).toBeTruthy();
    expect(screen.getByText("Low")).toBeTruthy();
    expect(screen.getByText("0% Needs Improvement")).toBeTruthy();
    expect(screen.getByText("⚠ Survival Starter")).toBeTruthy();

    expect(
      screen.getByText("Store drinking water (at least 3 days)")
    ).toBeTruthy();
    expect(screen.getByText("Non-perishable food supply")).toBeTruthy();
    expect(screen.getByText("First-aid kit")).toBeTruthy();
  });

  it("updates Preparedness progress after toggling one checklist item", async () => {
    const screen = render(<Preparedness />);

    await act(async () => {
      fireEvent.press(
        screen.getByText("Store drinking water (at least 3 days)")
      );
    });

    await waitFor(() => {
      expect(screen.getByText("1/8 completed (13%)")).toBeTruthy();
    });

    expect(screen.getByText("13% Needs Improvement")).toBeTruthy();
  });

  it("reaches medium readiness after toggling enough Preparedness items", async () => {
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
    expect(screen.getByText("50% Preparing")).toBeTruthy();
    expect(screen.getByText("🧰 Basic Prepared")).toBeTruthy();
  });

  it("reaches high readiness after toggling most Preparedness items", async () => {
    const screen = render(<Preparedness />);

    await act(async () => {
      fireEvent.press(
        screen.getByText("Store drinking water (at least 3 days)")
      );
      fireEvent.press(screen.getByText("Non-perishable food supply"));
      fireEvent.press(screen.getByText("First-aid kit"));
      fireEvent.press(screen.getByText("Power bank / spare batteries"));
      fireEvent.press(screen.getByText("Torch / headlamp"));
      fireEvent.press(screen.getByText("Copies of important documents"));
    });

    await waitFor(() => {
      expect(screen.getByText("6/8 completed (75%)")).toBeTruthy();
    });

    expect(screen.getByText("High")).toBeTruthy();
    expect(screen.getByText("75% Ready")).toBeTruthy();
    expect(screen.getByText("🛡 Fully Prepared")).toBeTruthy();
  });

  /* =========================
     Alerts tests
     ========================= */
  it("renders Alerts screen and loads remote alert cards", async () => {
    const screen = render(<Alerts />);

    expect(screen.getAllByText("Alerts")[0]).toBeTruthy();
    expect(
      screen.getByPlaceholderText(
        "Search by country (e.g. Japan, USA, Kenya)"
      )
    ).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText("M 6.2 - 50 km SE of Tokyo, Japan")).toBeTruthy();
    });

    expect(screen.getByText("Flood in Kenya")).toBeTruthy();
  });

  it("filters Alerts by region", async () => {
    const screen = render(<Alerts />);

    await waitFor(() => {
      expect(screen.getByText("M 6.2 - 50 km SE of Tokyo, Japan")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByText("Asia"));
    });

    await waitFor(() => {
      expect(screen.getByText("M 6.2 - 50 km SE of Tokyo, Japan")).toBeTruthy();
    });

    expect(screen.queryByText("Flood in Kenya")).toBeNull();
  });

  it("filters Alerts by country search", async () => {
    const screen = render(<Alerts />);

    await waitFor(() => {
      expect(screen.getByText("Flood in Kenya")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.changeText(
        screen.getByPlaceholderText(
          "Search by country (e.g. Japan, USA, Kenya)"
        ),
        "Kenya"
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Flood in Kenya")).toBeTruthy();
    });

    expect(screen.queryByText("M 6.2 - 50 km SE of Tokyo, Japan")).toBeNull();
  });

  it("refreshes Alerts when refresh button is pressed", async () => {
    const screen = render(<Alerts />);

    await waitFor(() => {
      expect(screen.getByText("Flood in Kenya")).toBeTruthy();
    });

    await waitFor(() => {
      expect(screen.getByText(/Refresh|Refreshing…/)).toBeTruthy();
    });

    const fetchCallsBefore = global.fetch.mock.calls.length;
    const refreshNode =
      screen.queryByText("Refresh") || screen.queryByText("Refreshing…");

    await act(async () => {
      fireEvent.press(refreshNode);
    });

    await waitFor(() => {
      expect(global.fetch.mock.calls.length).toBeGreaterThan(fetchCallsBefore);
    });
  });

  it("shows empty message when Alerts filters match nothing", async () => {
    const screen = render(<Alerts />);

    await waitFor(() => {
      expect(screen.getByText("Flood in Kenya")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.changeText(
        screen.getByPlaceholderText(
          "Search by country (e.g. Japan, USA, Kenya)"
        ),
        "Brazil"
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText("No alerts found for this region or country search.")
      ).toBeTruthy();
    });
  });

  /* =========================
     Response tests
     ========================= */
  it("renders Response screen with quick actions and contacts", async () => {
    const screen = render(<Response />);

    expect(
      screen.getByText("⚠ Stay calm and follow official guidance")
    ).toBeTruthy();
    expect(screen.getByText("Response")).toBeTruthy();
    expect(
      screen.getByText("Quick actions to take during an incident.")
    ).toBeTruthy();

    expect(screen.getByText("Check for injuries")).toBeTruthy();
    expect(screen.getByText("Move to a safer area")).toBeTruthy();
    expect(screen.getByText("Follow official instructions")).toBeTruthy();
    expect(screen.getByText("Contact family")).toBeTruthy();

    expect(screen.getByText("Emergency Contacts")).toBeTruthy();
    expect(screen.getByText("Emergency Services")).toBeTruthy();
    expect(screen.getByText("Ambulance / Fire")).toBeTruthy();
    expect(screen.getByText("999")).toBeTruthy();
    expect(screen.getByText("995")).toBeTruthy();
  });

  it("starts a phone call from Response contact card", async () => {
    const screen = render(<Response />);

    await act(async () => {
      fireEvent.press(screen.getByText("Emergency Services"));
    });

    await waitFor(() => {
      expect(Linking.canOpenURL).toHaveBeenCalledWith("tel:999");
    });

    await waitFor(() => {
      expect(Linking.openURL).toHaveBeenCalledWith("tel:999");
    });
  });

  it("shows call unavailable alert when device cannot open tel url", async () => {
    Linking.canOpenURL.mockResolvedValueOnce(false);

    const screen = render(<Response />);

    await act(async () => {
      fireEvent.press(screen.getByText("Ambulance / Fire"));
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        "Call unavailable",
        "Your device can't open tel:995"
      );
    });
  });

  /* =========================
     Emergency tests
     ========================= */
  it("renders Emergency screen with Preparedness active by default", async () => {
    const screen = render(<Emergency />);

    expect(screen.getByText("Emergency")).toBeTruthy();
    expect(
      screen.getByText("Preparedness, alerts, and response guidance.")
    ).toBeTruthy();

    expect(screen.getByText("Preparedness")).toBeTruthy();
    expect(screen.getByText("Alerts")).toBeTruthy();
    expect(screen.getByText("Response")).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText("Preparedness Checklist")).toBeTruthy();
    });
  });

  it("switches from Preparedness to Alerts tab", async () => {
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

  it("switches from Preparedness to Response tab", async () => {
    const screen = render(<Emergency />);

    await act(async () => {
      fireEvent.press(screen.getAllByText("Response")[0]);
    });

    await waitFor(() => {
      expect(screen.getByText("Emergency Contacts")).toBeTruthy();
    });
  });

  it("can switch between all Emergency subtabs", async () => {
    const screen = render(<Emergency />);

    await waitFor(() => {
      expect(screen.getByText("Preparedness Checklist")).toBeTruthy();
    });

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

    await act(async () => {
      fireEvent.press(screen.getAllByText("Response")[0]);
    });

    await waitFor(() => {
      expect(screen.getByText("Emergency Contacts")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByText("Preparedness"));
    });

    await waitFor(() => {
      expect(screen.getByText("Preparedness Checklist")).toBeTruthy();
    });
  });
});