export const stations = [
  {
    name: "Civic Center",
    zone: "Central Administrative Zone",
    coordinates: { lat: 28.6139, lng: 77.209 },
    readings: [
      { recordedAt: "2026-09-01T08:00:00.000Z", aqi: 138, pm25: 61, pm10: 132, no2: 42, so2: 14 },
      { recordedAt: "2026-09-02T08:00:00.000Z", aqi: 152, pm25: 72, pm10: 145, no2: 46, so2: 16 },
      { recordedAt: "2026-09-03T08:00:00.000Z", aqi: 166, pm25: 79, pm10: 158, no2: 51, so2: 18 },
      { recordedAt: "2026-09-04T08:00:00.000Z", aqi: 159, pm25: 74, pm10: 149, no2: 48, so2: 17 },
      { recordedAt: "2026-09-05T08:00:00.000Z", aqi: 181, pm25: 88, pm10: 171, no2: 56, so2: 21 }
    ]
  },
  {
    name: "Industrial Belt",
    zone: "North Manufacturing Corridor",
    coordinates: { lat: 28.7041, lng: 77.1025 },
    readings: [
      { recordedAt: "2026-09-01T08:00:00.000Z", aqi: 188, pm25: 96, pm10: 198, no2: 72, so2: 28 },
      { recordedAt: "2026-09-02T08:00:00.000Z", aqi: 203, pm25: 108, pm10: 216, no2: 79, so2: 31 },
      { recordedAt: "2026-09-03T08:00:00.000Z", aqi: 219, pm25: 118, pm10: 232, no2: 83, so2: 35 },
      { recordedAt: "2026-09-04T08:00:00.000Z", aqi: 224, pm25: 123, pm10: 240, no2: 88, so2: 38 },
      { recordedAt: "2026-09-05T08:00:00.000Z", aqi: 236, pm25: 131, pm10: 255, no2: 94, so2: 41 }
    ]
  },
  {
    name: "Lakeside Residential",
    zone: "East Residential Zone",
    coordinates: { lat: 28.5355, lng: 77.391 },
    readings: [
      { recordedAt: "2026-09-01T08:00:00.000Z", aqi: 82, pm25: 29, pm10: 74, no2: 24, so2: 8 },
      { recordedAt: "2026-09-02T08:00:00.000Z", aqi: 94, pm25: 36, pm10: 82, no2: 29, so2: 9 },
      { recordedAt: "2026-09-03T08:00:00.000Z", aqi: 101, pm25: 39, pm10: 88, no2: 32, so2: 10 },
      { recordedAt: "2026-09-04T08:00:00.000Z", aqi: 97, pm25: 34, pm10: 81, no2: 28, so2: 9 },
      { recordedAt: "2026-09-05T08:00:00.000Z", aqi: 109, pm25: 43, pm10: 94, no2: 34, so2: 11 }
    ]
  },
  {
    name: "Ring Road Junction",
    zone: "Traffic Exposure Zone",
    coordinates: { lat: 28.4595, lng: 77.0266 },
    readings: [
      { recordedAt: "2026-09-01T08:00:00.000Z", aqi: 151, pm25: 66, pm10: 154, no2: 68, so2: 13 },
      { recordedAt: "2026-09-02T08:00:00.000Z", aqi: 171, pm25: 77, pm10: 177, no2: 74, so2: 14 },
      { recordedAt: "2026-09-03T08:00:00.000Z", aqi: 183, pm25: 83, pm10: 189, no2: 82, so2: 15 },
      { recordedAt: "2026-09-04T08:00:00.000Z", aqi: 176, pm25: 81, pm10: 181, no2: 78, so2: 14 },
      { recordedAt: "2026-09-05T08:00:00.000Z", aqi: 192, pm25: 91, pm10: 202, no2: 86, so2: 17 }
    ]
  }
];

export const policyActions = [
  {
    title: "Traffic diversion window",
    zone: "Traffic Exposure Zone",
    priority: "High",
    status: "Ready for review",
    impact: "Expected 8-12% NO2 reduction during morning peak"
  },
  {
    title: "Industrial stack inspection",
    zone: "North Manufacturing Corridor",
    priority: "Critical",
    status: "Dispatch required",
    impact: "Targets SO2 and PM10 spike source"
  },
  {
    title: "School outdoor advisory",
    zone: "Central Administrative Zone",
    priority: "Medium",
    status: "Published",
    impact: "Protects sensitive groups while AQI remains above 150"
  }
];
